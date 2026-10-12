import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Job, JobDetail, Page } from '@takhti/contracts';
import { claimJobs, defineJob, enqueue, runClaimedJob, type Actor } from '@takhti/core';
import { adminDb, auditLog, jobs } from '@takhti/db';
import * as cancelRoute from '../../../apps/web/app/api/v1/jobs/[id]/cancel/route';
import * as retryRoute from '../../../apps/web/app/api/v1/jobs/[id]/retry/route';
import * as jobItem from '../../../apps/web/app/api/v1/jobs/[id]/route';
import * as jobList from '../../../apps/web/app/api/v1/jobs/route';
import { callRoute } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { as, seedOrg, type TestOrg } from '../../helpers/world';

/*
 * The job queue as a permitted person sees it.
 * Rules: docs/plan/10-modules/m00-shared-kernel.md, R-shared-15.
 */

let db: TestDb;
let school: TestOrg;
let other: TestOrg;
let principal: Actor;
let itAdmin: Actor;
let teacher: Actor;
let outsider: Actor;

let failing = true;
const flaky = defineJob({
  name: 'tests.flaky-task',
  payload: z.object({ label: z.string() }),
  retries: 0,
  handler: async () => {
    if (failing) throw new Error('The printer is on fire');
  },
});

const list = (actor: Actor, query = '') =>
  callRoute<Page<Job>>(jobList.GET, { as: actor, url: `/api/v1/jobs${query}` });
const open = (actor: Actor, id: string) =>
  callRoute<JobDetail>(jobItem.GET, { as: actor, url: `/api/v1/jobs/${id}`, params: { id } });
const act = (route: typeof retryRoute, actor: Actor, id: string) =>
  callRoute<JobDetail>(route.POST, {
    as: actor,
    method: 'POST',
    url: `/api/v1/jobs/${id}/x`,
    params: { id },
  });

const queue = (label: string, org: Actor = principal) =>
  as(org, (ctx) => enqueue(ctx, flaky, { label }));
/** Runs whatever is waiting, once. */
async function work(): Promise<void> {
  for (const job of await claimJobs({ workerId: 'test', limit: 20, perOrgLimit: 20 }))
    await runClaimedJob(job);
}
const row = async (id: string) => (await adminDb().select().from(jobs).where(eq(jobs.id, id)))[0]!;

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  other = await seedOrg();
  principal = await school.actor('principal');
  itAdmin = await school.actor('it_admin');
  teacher = await school.actor('class_teacher');
  outsider = await other.actor('principal');
});
afterAll(async () => {
  await db.destroy();
});

describe('looking at the queue', () => {
  it('lists the school’s jobs, newest first, by status and by name, and opens one with what it was asked to do', async () => {
    failing = true;
    const failed = await queue('will fail');
    await work();
    const waiting = await queue('still waiting');
    const theirs = await queue('another school', outsider);

    const all = await list(itAdmin);
    expect(all.status).toBe(200);
    const ids = all.data.items.map((job) => job.id);
    expect(ids).toContain(failed);
    expect(ids).toContain(waiting);
    expect(ids).not.toContain(theirs);
    expect(ids.indexOf(waiting)).toBeLessThan(ids.indexOf(failed));

    const onlyFailed = await list(itAdmin, '?status=failed&name=tests.flaky-task');
    expect(onlyFailed.data.items.map((job) => job.id)).toEqual([failed]);
    expect(onlyFailed.data.total).toBe(1);
    expect(onlyFailed.data.items[0]).toMatchObject({
      name: 'tests.flaky-task',
      status: 'failed',
      attempts: 1,
      maxAttempts: 1,
      lastError: 'Error: The printer is on fire',
      createdBy: principal.userId,
    });

    const detail = await open(itAdmin, failed);
    expect(detail.data.payload).toEqual({ label: 'will fail' });
    expect((await open(itAdmin, theirs)).status).toBe(404);
    expect((await open(itAdmin, randomUUID())).status).toBe(404);
    expect((await list(itAdmin, '?status=exploded')).status).toBe(422);
  });

  it('only people who may see the queue see it', async () => {
    expect((await list(teacher)).status).toBe(403);
    expect((await open(teacher, randomUUID())).status).toBe(403);
    expect((await act(retryRoute, teacher, randomUUID())).status).toBe(403);
  });
});

describe('R-shared-15 retrying and cancelling', () => {
  it('a failed job is put back for one more try; when it then works, it is done', async () => {
    failing = true;
    const id = await queue('retry me');
    await work();
    expect((await row(id)).status).toBe('failed');

    const retried = await act(retryRoute, itAdmin, id);
    expect(retried.status).toBe(200);
    expect(retried.data).toMatchObject({ status: 'queued', attempts: 1, maxAttempts: 2 });
    failing = false;
    await work();
    expect(await row(id)).toMatchObject({ status: 'succeeded', attempts: 2 });

    const [entry] = await adminDb()
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entity, 'jobs'), eq(auditLog.entityId, id)));
    expect(entry).toMatchObject({
      action: 'retry',
      actorId: itAdmin.userId,
      summary: 'Retried the job tests.flaky-task',
    });
    // A job that succeeded is not retried.
    expect((await act(retryRoute, itAdmin, id)).status).toBe(409);
  });

  it('a job may be retried by hand three times at most', async () => {
    failing = true;
    const id = await queue('never works');
    await work();
    for (let round = 1; round <= 3; round++) {
      expect((await act(retryRoute, itAdmin, id)).status, `retry ${round}`).toBe(200);
      await work();
      expect((await row(id)).status).toBe('failed');
    }
    const fourth = await act(retryRoute, itAdmin, id);
    expect(fourth.status).toBe(409);
    expect(fourth.error?.message).toBe(
      'This job has been retried 3 times and still fails. It needs someone to look at why.',
    );
    expect((await row(id)).attempts).toBe(4);
  });

  it('a waiting job can be cancelled; a cancelled job is never retried and never runs', async () => {
    const id = await queue('cancel me');
    const cancelled = await act(cancelRoute, itAdmin, id);
    expect(cancelled.status).toBe(200);
    expect(cancelled.data.status).toBe('cancelled');
    expect(cancelled.data.finishedAt).not.toBeNull();

    failing = false;
    await work();
    expect((await row(id)).status).toBe('cancelled');
    const retry = await act(retryRoute, itAdmin, id);
    expect(retry.status).toBe(409);
    expect(retry.error?.message).toBe('A cancelled job is never retried');
    expect((await act(cancelRoute, itAdmin, id)).status).toBe(409);
  });

  it('only a waiting job can be cancelled, and only a failed one retried; another school’s jobs are out of reach', async () => {
    failing = false;
    const done = await queue('done');
    await work();
    const refused = await act(cancelRoute, itAdmin, done);
    expect(refused.status).toBe(409);
    expect(refused.error?.message).toBe(
      'Only a job that is still waiting can be cancelled. This one is succeeded.',
    );
    const waiting = await queue('waiting');
    expect((await act(retryRoute, itAdmin, waiting)).error?.message).toBe(
      'Only a failed job can be retried. This one is queued.',
    );

    const theirs = await queue('theirs', outsider);
    expect((await act(cancelRoute, itAdmin, theirs)).status).toBe(404);
    expect((await row(theirs)).status).toBe('queued');
    await adminDb().delete(jobs);
  });
});

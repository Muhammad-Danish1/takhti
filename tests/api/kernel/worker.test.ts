import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { cleanupJob, defineJob, enqueue, runAsSystem, type Actor } from '@takhti/core';
import { adminDb, idempotencyKeys, jobSchedules, jobs, rateLimits, withAdminTx } from '@takhti/db';
import { createWorker } from '@takhti/worker';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { as, freezeTime, seedOrg, type TestOrg } from '../../helpers/world';

let db: TestDb;
let school: TestOrg;
let principal: Actor;
const finished: string[] = [];
let release: (() => void) | undefined;

const quickJob = defineJob({
  name: 'tests.worker-quick',
  payload: z.object({ label: z.string() }),
  handler: async (_ctx, payload) => {
    finished.push(payload.label);
  },
});

/** Waits outside the database until the test lets it go, like a job waiting on an outside service. */
const heldJob = defineJob({
  name: 'tests.worker-held',
  payload: z.object({ label: z.string() }),
  timeoutSeconds: 30,
  handler: async (_ctx, payload) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    finished.push(payload.label);
  },
});

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  principal = await school.actor('principal');
});
afterAll(async () => {
  freezeTime();
  await db.destroy();
});
beforeEach(async () => {
  finished.length = 0;
  release = undefined;
  await withAdminTx((tx) => tx.delete(jobs));
});

describe('the worker process', () => {
  it('takes queued jobs, runs them and leaves them succeeded', async () => {
    for (const label of ['a', 'b', 'c'])
      await as(principal, (ctx) => enqueue(ctx, quickJob, { label }));
    const worker = createWorker({ concurrency: 5, perOrgLimit: 5, workerId: 'test-worker' });
    expect(await worker.tick()).toBe(3);
    await worker.idle();
    expect(finished.sort()).toEqual(['a', 'b', 'c']);
    expect((await adminDb().select().from(jobs)).every((job) => job.status === 'succeeded')).toBe(
      true,
    );
    expect(await worker.tick()).toBe(0);
  });

  it('never runs more at once than its slots', async () => {
    for (const label of ['a', 'b', 'c', 'd'])
      await as(principal, (ctx) => enqueue(ctx, quickJob, { label }));
    const worker = createWorker({ concurrency: 2, perOrgLimit: 10 });
    expect(await worker.tick()).toBe(2);
    await worker.idle();
    expect(await worker.tick()).toBe(2);
    await worker.idle();
    expect(finished).toHaveLength(4);
  });

  it('on a stop signal it takes nothing new and lets the running job finish', async () => {
    await runAsSystem(school.orgId, {}, (ctx) => enqueue(ctx, heldJob, { label: 'in progress' }));
    const worker = createWorker({ concurrency: 2, perOrgLimit: 2, shutdownGraceMs: 10_000 });
    expect(await worker.tick()).toBe(1);
    // Give the job a moment to reach the point where it waits.
    while (!release) await new Promise((resolve) => setTimeout(resolve, 10));

    let stopped = false;
    const stopping = worker.stop().then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(stopped).toBe(false); // still waiting for the job
    expect(await worker.tick()).toBe(0); // and taking nothing new

    release();
    await stopping;
    expect(finished).toEqual(['in progress']);
    const [job] = await adminDb().select().from(jobs);
    expect(job?.status).toBe('succeeded');
  });

  it('starting it writes the schedules defined in code to the database', async () => {
    const worker = createWorker({ pollMs: 20, scheduleMs: 1_000_000, reapMs: 1_000_000 });
    await worker.start();
    await worker.stop();
    const names = (await adminDb().select().from(jobSchedules)).map((schedule) => schedule.name);
    expect(names).toContain('shared.cleanup.nightly');
  });

  it('the running loop picks up a job without being asked', async () => {
    const worker = createWorker({ pollMs: 20, scheduleMs: 1_000_000, reapMs: 1_000_000 });
    await worker.start();
    await as(principal, (ctx) => enqueue(ctx, quickJob, { label: 'picked up' }));
    for (let waited = 0; waited < 3_000 && finished.length === 0; waited += 25)
      await new Promise((resolve) => setTimeout(resolve, 25));
    await worker.stop();
    expect(finished).toEqual(['picked up']);
  });
});

describe('nightly cleanup', () => {
  it('removes what has outlived its use and nothing else', async () => {
    freezeTime('2026-10-12T22:00:00.000Z'); // 03:00 on the 13th in Pakistan
    await withAdminTx(async (tx) => {
      await tx.insert(rateLimits).values([
        { key: 'old', windowStart: '2026-10-10T00:00:00Z', count: 3 },
        { key: 'recent', windowStart: '2026-10-12T21:59:00Z', count: 1 },
      ]);
      await tx.insert(jobs).values([
        {
          orgId: school.orgId,
          name: 'tests.worker-quick',
          payload: { label: 'old success' },
          status: 'succeeded',
          finishedAt: '2026-09-01T00:00:00Z',
        },
        {
          orgId: school.orgId,
          name: 'tests.worker-quick',
          payload: { label: 'recent success' },
          status: 'succeeded',
          finishedAt: '2026-10-12T00:00:00Z',
        },
        {
          orgId: school.orgId,
          name: 'tests.worker-quick',
          payload: { label: 'old failure' },
          status: 'failed',
          finishedAt: '2026-09-01T00:00:00Z',
        },
      ]);
      await tx.insert(idempotencyKeys).values([
        {
          orgId: school.orgId,
          userId: principal.userId,
          key: 'expired-key',
          route: 'POST /x',
          requestHash: 'h',
          expiresAt: '2026-10-11T00:00:00Z',
        },
        {
          orgId: school.orgId,
          userId: principal.userId,
          key: 'live-key',
          route: 'POST /x',
          requestHash: 'h',
          expiresAt: '2026-10-13T00:00:00Z',
        },
      ]);
      // A platform job has no organisation; it is queued by the scheduler on the privileged connection.
      await tx.insert(jobs).values({ orgId: null, name: cleanupJob.name, payload: {} });
    });

    const worker = createWorker({ concurrency: 1 });
    expect(await worker.tick()).toBe(1);
    await worker.idle();

    expect((await adminDb().select().from(rateLimits)).map((row) => row.key)).toEqual(['recent']);
    expect(
      (
        await adminDb()
          .select()
          .from(idempotencyKeys)
          .where(eq(idempotencyKeys.orgId, school.orgId))
      ).map((row) => row.key),
    ).toEqual(['live-key']);
    const left = (await adminDb().select().from(jobs))
      .map((job) => (job.payload as { label?: string }).label ?? job.name)
      .sort();
    // A failed job is kept until someone has looked at it.
    expect(left).toEqual(['old failure', 'recent success', 'shared.cleanup']);
  });
});

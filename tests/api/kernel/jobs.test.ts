import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineEvent } from '@takhti/contracts';
import {
  claimJobs,
  defineJob,
  defineSchedule,
  emit,
  enqueue,
  enqueueDueSchedules,
  onEvent,
  reapStuckJobs,
  runClaimedJob,
  syncSchedules,
  type Actor,
} from '@takhti/core';
import { adminDb, domainEvents, jobSchedules, jobs, rooms, withAdminTx } from '@takhti/db';
import { createTestDb, testEngine, type TestDb } from '../../helpers/test-db';
import { as, freezeTime, seedOrg, type TestOrg } from '../../helpers/world';

let db: TestDb;
let school: TestOrg;
let other: TestOrg;
let principal: Actor;

const ran: { job: string; orgId: string; payload: unknown; attempt: number }[] = [];
let failTimes = 0;

const noteJob = defineJob({
  name: 'tests.note',
  payload: z.object({ text: z.string(), key: z.string().optional() }),
  retries: 2,
  concurrencyKey: (payload) => payload.key ?? `free:${randomUUID()}`,
  handler: async (ctx, payload, run) => {
    ran.push({ job: 'tests.note', orgId: ctx.actor.orgId, payload, attempt: run.attempt });
    if (failTimes > 0) {
      failTimes -= 1;
      throw new Error('the provider is down');
    }
    // Proves the handler works inside the school's own row-level-secured transaction.
    await ctx.db.insert(rooms).values({
      orgId: ctx.actor.orgId,
      branchId: school.mainBranchId,
      name: `Job room ${randomUUID()}`,
    });
  },
});

const slowJob = defineJob({
  name: 'tests.slow',
  payload: z.object({}),
  retries: 0,
  timeoutSeconds: 1,
  handler: async (ctx) => {
    await ctx.db.execute(sql`select pg_sleep(3)`);
  },
});

const stuckJob = defineJob({
  name: 'tests.stuck',
  payload: z.object({}),
  retries: 0,
  timeoutSeconds: 1,
  handler: async () => {
    // Stuck somewhere the database cannot see: waiting on an outside service that never answers.
    await new Promise((resolve) => setTimeout(resolve, 3_500));
  },
});

const nightlyJob = defineJob({
  name: 'tests.nightly',
  payload: z.object({
    scheduledFor: z.string(),
    branchId: z.string().optional(),
    flavour: z.string().optional(),
  }),
  handler: async (ctx, payload) => {
    ran.push({ job: 'tests.nightly', orgId: ctx.actor.orgId, payload, attempt: 1 });
  },
});

const allJobs = () => adminDb().select().from(jobs);
const jobsOf = async (orgId: string) => (await allJobs()).filter((job) => job.orgId === orgId);
const claim = (limit = 10, perOrgLimit = 10) =>
  claimJobs({ workerId: 'worker-a', limit, perOrgLimit });

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  other = await seedOrg();
  principal = await school.actor('principal');
});
afterAll(async () => {
  freezeTime();
  await db.destroy();
});
beforeEach(async () => {
  ran.length = 0;
  failTimes = 0;
  freezeTime();
  await withAdminTx((tx) => tx.delete(jobs));
});

describe('queueing', () => {
  it('a job queued in a transaction that rolls back does not exist', async () => {
    await expect(
      as(principal, async (ctx) => {
        await enqueue(ctx, noteJob, { text: 'never' });
        throw new Error('the change failed');
      }),
    ).rejects.toThrow();
    expect(await jobsOf(school.orgId)).toEqual([]);
  });

  it('a committed job is queued for its organisation, with the definition’s limits', async () => {
    const id = await as(principal, (ctx) =>
      enqueue(ctx, noteJob, { text: 'hello' }, { priority: 5 }),
    );
    const [job] = await jobsOf(school.orgId);
    expect(job).toMatchObject({
      id,
      name: 'tests.note',
      status: 'queued',
      priority: 5,
      attempts: 0,
      maxAttempts: 3,
      timeoutSeconds: 120,
      payload: { text: 'hello' },
    });
    expect(job?.createdBy).toBe(principal.userId);
  });

  it('a family user’s action can queue a job, but cannot read the queue', async () => {
    const guardian = await school.actor('guardian');
    await as(guardian, (ctx) => enqueue(ctx, noteJob, { text: 'from a parent' }));
    expect(await jobsOf(school.orgId)).toHaveLength(1);
    expect(await as(guardian, (ctx) => ctx.db.select().from(jobs))).toEqual([]);
    expect(await as(principal, (ctx) => ctx.db.select().from(jobs))).toHaveLength(1);
  });

  it('with a dedupe key the same job is not queued twice, while each school keeps its own', async () => {
    const theirs = await other.actor('principal');
    await as(principal, (ctx) =>
      enqueue(ctx, noteJob, { text: 'a' }, { dedupeKey: 'reminder:2026-10' }),
    );
    await as(principal, (ctx) =>
      enqueue(ctx, noteJob, { text: 'b' }, { dedupeKey: 'reminder:2026-10' }),
    );
    await as(theirs, (ctx) =>
      enqueue(ctx, noteJob, { text: 'c' }, { dedupeKey: 'reminder:2026-10' }),
    );
    expect(await jobsOf(school.orgId)).toHaveLength(1);
    expect(await jobsOf(other.orgId)).toHaveLength(1);
  });

  it('a payload that does not fit is a programming error, caught before anything is queued', async () => {
    await expect(
      as(principal, (ctx) => enqueue(ctx, noteJob, { text: 5 } as never)),
    ).rejects.toThrow(/not valid/);
    expect(await allJobs()).toEqual([]);
  });
});

describe('the worker', () => {
  it('claims a due job, runs it inside the school’s own transaction and marks it succeeded', async () => {
    await as(principal, (ctx) => enqueue(ctx, noteJob, { text: 'run me' }));
    const [claimed] = await claim();
    expect(claimed).toMatchObject({ name: 'tests.note', orgId: school.orgId, attempts: 1 });
    expect((await allJobs())[0]).toMatchObject({ status: 'running', lockedBy: 'worker-a' });

    expect(await runClaimedJob(claimed!, { workerId: 'worker-a' })).toBe('succeeded');
    expect(ran).toEqual([
      { job: 'tests.note', orgId: school.orgId, payload: { text: 'run me' }, attempt: 1 },
    ]);
    expect((await allJobs())[0]).toMatchObject({
      status: 'succeeded',
      lockedBy: null,
      lastError: null,
    });
  });

  it('does not take a job before its time', async () => {
    await as(principal, (ctx) =>
      enqueue(ctx, noteJob, { text: 'later' }, { runAt: '2999-01-01T00:00:00.000Z' }),
    );
    expect(await claim()).toEqual([]);
  });

  it('two workers never take the same job', async () => {
    for (let i = 0; i < 12; i++)
      await as(principal, (ctx) => enqueue(ctx, noteJob, { text: `job ${i}` }));
    const [a, b] = await Promise.all([
      claimJobs({ workerId: 'worker-a', limit: 8, perOrgLimit: 50 }),
      claimJobs({ workerId: 'worker-b', limit: 8, perOrgLimit: 50 }),
    ]);
    const ids = [...a, ...b].map((job) => job.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(12);
  });

  it('takes higher priority first, then the oldest', async () => {
    await as(principal, (ctx) => enqueue(ctx, noteJob, { text: 'ordinary' }));
    await as(principal, (ctx) => enqueue(ctx, noteJob, { text: 'urgent' }, { priority: 10 }));
    const [first] = await claim(1);
    expect(first?.payload).toEqual({ text: 'urgent' });
  });

  it('a failing job is retried with a growing delay and ends failed with its reason', async () => {
    freezeTime('2026-10-12T06:00:00.000Z');
    failTimes = 99;
    await as(principal, (ctx) => enqueue(ctx, noteJob, { text: 'doomed' }));

    const [first] = await claim();
    expect(await runClaimedJob(first!)).toBe('retrying');
    const afterFirst = (await allJobs())[0]!;
    expect(afterFirst).toMatchObject({ status: 'queued', attempts: 1 });
    expect(afterFirst.lastError).toMatch(/the provider is down/);
    const firstDelay = Date.parse(afterFirst.runAt) - Date.parse('2026-10-12T06:00:00.000Z');
    expect(firstDelay).toBeGreaterThanOrEqual(24_000);
    expect(firstDelay).toBeLessThanOrEqual(36_000);
    expect(await claim()).toEqual([]); // not yet due

    freezeTime('2026-10-12T06:05:00.000Z');
    const [second] = await claim();
    expect(await runClaimedJob(second!)).toBe('retrying');
    const secondDelay =
      Date.parse((await allJobs())[0]!.runAt) - Date.parse('2026-10-12T06:05:00.000Z');
    expect(secondDelay).toBeGreaterThan(firstDelay);

    freezeTime('2026-10-12T06:30:00.000Z');
    const [third] = await claim();
    expect(third?.attempts).toBe(3);
    expect(await runClaimedJob(third!)).toBe('failed');
    expect((await allJobs())[0]).toMatchObject({ status: 'failed', attempts: 3 });
    expect(await claim()).toEqual([]);
    // Nothing the failed attempts wrote was kept.
    expect(ran).toHaveLength(3);
  });

  it('a job that recovers succeeds on a later try', async () => {
    freezeTime('2026-10-12T06:00:00.000Z');
    failTimes = 1;
    await as(principal, (ctx) => enqueue(ctx, noteJob, { text: 'flaky' }));
    expect(await runClaimedJob((await claim())[0]!)).toBe('retrying');
    freezeTime('2026-10-12T06:10:00.000Z');
    expect(await runClaimedJob((await claim())[0]!)).toBe('succeeded');
    expect(ran.map((entry) => entry.attempt)).toEqual([1, 2]);
  });

  it('a job with no handler, or a payload that no longer fits, fails at once instead of retrying', async () => {
    await withAdminTx((tx) =>
      tx.insert(jobs).values([
        { orgId: school.orgId, name: 'tests.unknown', payload: {} },
        { orgId: school.orgId, name: 'tests.note', payload: { text: 42 } },
      ]),
    );
    for (const job of await claim()) expect(await runClaimedJob(job)).toBe('failed');
    const rows = await allJobs();
    expect(rows.map((row) => row.status)).toEqual(['failed', 'failed']);
    expect(rows.map((row) => row.lastError).join(' ')).toMatch(
      /No handler[\s\S]*no longer fits|no longer fits[\s\S]*No handler/,
    );
  });

  it('jobs sharing a concurrency key never run together', async () => {
    await as(principal, (ctx) =>
      enqueue(ctx, noteJob, { text: 'first', key: 'vouchers:main:2026-10' }),
    );
    await as(principal, (ctx) =>
      enqueue(ctx, noteJob, { text: 'second', key: 'vouchers:main:2026-10' }),
    );
    await as(principal, (ctx) =>
      enqueue(ctx, noteJob, { text: 'unrelated', key: 'vouchers:city:2026-10' }),
    );

    const round1 = await claim();
    expect(round1.map((job) => (job.payload as { text: string }).text).sort()).toEqual([
      'first',
      'unrelated',
    ]);
    expect(await claim()).toEqual([]); // the second waits while the first runs
    for (const job of round1) await runClaimedJob(job);
    const round2 = await claim();
    expect(round2.map((job) => (job.payload as { text: string }).text)).toEqual(['second']);
  });

  it('one large school cannot take every slot', async () => {
    const theirs = await other.actor('principal');
    for (let i = 0; i < 6; i++)
      await as(principal, (ctx) => enqueue(ctx, noteJob, { text: `big ${i}` }));
    await as(theirs, (ctx) => enqueue(ctx, noteJob, { text: 'small school' }));

    const claimed = await claimJobs({ workerId: 'worker-a', limit: 10, perOrgLimit: 2 });
    const byOrg = claimed.reduce<Record<string, number>>(
      (count, job) => ({ ...count, [job.orgId ?? '']: (count[job.orgId ?? ''] ?? 0) + 1 }),
      {},
    );
    expect(byOrg).toEqual({ [school.orgId]: 2, [other.orgId]: 1 });
    expect(await claimJobs({ workerId: 'worker-a', limit: 10, perOrgLimit: 2 })).toEqual([]); // the big school is at its share
  });

  // The in-process engine has no timers and runs a statement without yielding, so only the real server can show this.
  it.runIf(testEngine() === 'postgres')(
    'the database itself cancels a statement that overruns the job’s limit, and the job’s work is undone',
    async () => {
      await as(principal, (ctx) => enqueue(ctx, slowJob, {}));
      const started = Date.now();
      expect(await runClaimedJob((await claim())[0]!)).toBe('failed');
      expect(Date.now() - started).toBeLessThan(2_900);
      const [job] = await allJobs();
      expect(job?.status).toBe('failed');
      expect(job?.lastError).toMatch(/did not finish within 1 seconds/);
      // The connection survived: the next job runs normally.
      await as(principal, (ctx) => enqueue(ctx, noteJob, { text: 'after the timeout' }));
      expect(await runClaimedJob((await claim())[0]!)).toBe('succeeded');
    },
  );

  it('a handler stuck outside the database is given up on by the worker’s own clock', async () => {
    await as(principal, (ctx) => enqueue(ctx, stuckJob, {}));
    expect(await runClaimedJob((await claim())[0]!)).toBe('failed');
    const [job] = await allJobs();
    expect(job?.status).toBe('failed');
    expect(job?.lastError).toMatch(/did not finish within 1 seconds/);
  });

  it('a job left running by a worker that died is returned to the queue, or failed if it has no tries left', async () => {
    freezeTime('2026-10-12T06:00:00.000Z');
    await as(principal, (ctx) => enqueue(ctx, noteJob, { text: 'orphan' }));
    await as(principal, (ctx) => enqueue(ctx, slowJob, {}));
    await claim(); // both marked running; the "worker" now disappears

    freezeTime('2026-10-12T06:01:30.000Z');
    expect(await reapStuckJobs()).toBe(1); // the slow job's 1-second limit plus a minute's grace has passed
    freezeTime('2026-10-12T06:04:00.000Z');
    expect(await reapStuckJobs()).toBe(1);
    const rows = await allJobs();
    expect(rows.find((row) => row.name === 'tests.slow')).toMatchObject({
      status: 'failed',
      lockedBy: null,
    });
    expect(rows.find((row) => row.name === 'tests.note')).toMatchObject({
      status: 'queued',
      lockedBy: null,
      lastError: 'The worker stopped before the job finished',
    });
    expect(await reapStuckJobs()).toBe(0);
  });

  it('a late result from a worker that lost its job changes nothing', async () => {
    freezeTime('2026-10-12T06:00:00.000Z');
    await as(principal, (ctx) => enqueue(ctx, noteJob, { text: 'contested' }));
    const [mine] = await claimJobs({ workerId: 'worker-a', limit: 1, perOrgLimit: 5 });
    freezeTime('2026-10-12T06:10:00.000Z');
    await reapStuckJobs();
    const [theirs] = await claimJobs({ workerId: 'worker-b', limit: 1, perOrgLimit: 5 });
    expect(theirs?.id).toBe(mine?.id);
    await runClaimedJob(mine!, { workerId: 'worker-a' }); // the first worker wakes up and finishes late
    expect((await allJobs())[0]).toMatchObject({ status: 'running', lockedBy: 'worker-b' });
  });
});

describe('schedules', () => {
  beforeAll(() => {
    defineSchedule({
      name: 'tests.nightly.per-org',
      cron: '0 1 * * *',
      job: nightlyJob,
      fanOut: 'per_org',
      payload: { flavour: 'org' },
    });
    defineSchedule({
      name: 'tests.nightly.per-branch',
      cron: '0 2 * * *',
      job: nightlyJob,
      fanOut: 'per_branch',
    });
  });

  it('are written to the database from code, and schedules that left the code are removed', async () => {
    await withAdminTx((tx) =>
      tx.insert(jobSchedules).values({
        name: 'tests.gone',
        cron: '* * * * *',
        jobName: 'tests.note',
        fanOut: 'per_org',
      }),
    );
    freezeTime('2026-10-12T10:00:00.000Z');
    await syncSchedules();
    const rows = await adminDb().select().from(jobSchedules);
    // The product's own nightly cleanup, and the two schedules of this file.
    expect(rows.map((row) => row.name).sort()).toEqual([
      'shared.cleanup.nightly',
      'tests.nightly.per-branch',
      'tests.nightly.per-org',
    ]);
    // A new schedule waits for its next due time rather than firing for one already past.
    expect(await enqueueDueSchedules()).toBe(0);
    await syncSchedules();
    expect(await adminDb().select().from(jobSchedules)).toHaveLength(3);
  });

  it('a due schedule queues one job per active school, once, however often the check runs', async () => {
    await syncSchedules();
    await withAdminTx((tx) => tx.update(jobSchedules).set({ lastEnqueuedFor: null }));
    freezeTime('2026-10-11T20:00:30.000Z'); // 01:00 in Pakistan on the 12th
    const queued = await enqueueDueSchedules();
    expect(queued).toBeGreaterThanOrEqual(2);
    expect(await enqueueDueSchedules()).toBe(0);

    const mine = (await jobsOf(school.orgId)).filter(
      (job) => job.name === 'tests.nightly' && !(job.payload as { branchId?: string }).branchId,
    );
    expect(mine).toHaveLength(1);
    expect(mine[0]?.payload).toEqual({ flavour: 'org', scheduledFor: '2026-10-11T20:00:00.000Z' });
    expect(mine[0]?.createdBy).toBeNull();
  });

  it('a per-branch schedule queues one job per active branch', async () => {
    await syncSchedules();
    await withAdminTx((tx) =>
      tx
        .update(jobSchedules)
        .set({ lastEnqueuedFor: '2026-10-11T20:00:00.000Z' })
        .where(eq(jobSchedules.name, 'tests.nightly.per-org')),
    );
    freezeTime('2026-10-11T21:00:10.000Z'); // 02:00 in Pakistan
    await enqueueDueSchedules();
    const mine = (await jobsOf(school.orgId)).filter((job) => job.name === 'tests.nightly');
    expect(mine.map((job) => (job.payload as { branchId: string }).branchId).sort()).toEqual(
      [school.mainBranchId, school.cityBranchId].sort(),
    );
  });

  it('after a long gap a schedule runs once, not once per missed time', async () => {
    await syncSchedules();
    await withAdminTx((tx) =>
      tx.update(jobSchedules).set({ lastEnqueuedFor: '2026-10-01T20:00:00.000Z' }),
    );
    freezeTime('2026-10-12T10:00:00.000Z');
    await enqueueDueSchedules();
    const mine = (await jobsOf(school.orgId)).filter(
      (job) => job.name === 'tests.nightly' && !(job.payload as { branchId?: string }).branchId,
    );
    expect(mine).toHaveLength(1);
  });

  it('a schedule that is switched off queues nothing', async () => {
    await syncSchedules();
    await withAdminTx((tx) =>
      tx.update(jobSchedules).set({ lastEnqueuedFor: null, isEnabled: false }),
    );
    freezeTime('2026-10-11T20:00:30.000Z');
    expect(await enqueueDueSchedules()).toBe(0);
    await withAdminTx((tx) => tx.update(jobSchedules).set({ isEnabled: true }));
  });
});

describe('events', () => {
  const paymentReceived = defineEvent({
    key: 'tests.payment-received',
    category: 'fees',
    payload: z.object({ paymentId: z.uuid(), amount: z.int() }),
    variables: ['amount'],
    rules: [{ audience: 'guardians-of-family', channels: ['whatsapp', 'sms'] }],
  });
  const quietEvent = defineEvent({
    key: 'tests.quiet',
    category: 'system',
    payload: z.object({}),
    variables: [],
    rules: [],
  });
  const ledgerJob = defineJob({
    name: 'tests.post-to-ledger',
    payload: z.object({ paymentId: z.uuid() }),
    handler: async () => {},
  });
  beforeAll(() =>
    onEvent(paymentReceived, ledgerJob, (payload) => ({ paymentId: payload.paymentId })),
  );

  it('an event is recorded with what follows from it, all in the caller’s transaction', async () => {
    const paymentId = randomUUID();
    const eventId = await as(principal, (ctx) =>
      emit(
        ctx,
        paymentReceived,
        { paymentId, amount: 1_250_000 },
        { entityType: 'fee-payments', entityId: paymentId },
      ),
    );

    const [event] = await adminDb().select().from(domainEvents).where(eq(domainEvents.id, eventId));
    expect(event).toMatchObject({
      name: 'tests.payment-received',
      orgId: school.orgId,
      entityType: 'fee-payments',
      entityId: paymentId,
      source: 'api',
    });
    const queued = await jobsOf(school.orgId);
    expect(queued.map((job) => job.name).sort()).toEqual([
      'notify.dispatch',
      'tests.post-to-ledger',
    ]);
    expect(queued.find((job) => job.name === 'tests.post-to-ledger')?.payload).toEqual({
      paymentId,
    });
    expect(queued.find((job) => job.name === 'notify.dispatch')?.payload).toEqual({ eventId });
  });

  it('an event nobody is told about queues no notification', async () => {
    await as(principal, (ctx) => emit(ctx, quietEvent, {}));
    expect(await jobsOf(school.orgId)).toEqual([]);
  });

  it('a rolled-back change leaves no event and no job', async () => {
    const paymentId = randomUUID();
    await expect(
      as(principal, async (ctx) => {
        await emit(ctx, paymentReceived, { paymentId, amount: 100 });
        throw new Error('rolled back');
      }),
    ).rejects.toThrow();
    expect(
      await adminDb().select().from(domainEvents).where(eq(domainEvents.entityId, paymentId)),
    ).toEqual([]);
    expect(await jobsOf(school.orgId)).toEqual([]);
  });

  it('the dispatch job finishes quietly while no dispatcher is installed', async () => {
    await as(principal, (ctx) =>
      emit(ctx, paymentReceived, { paymentId: randomUUID(), amount: 100 }),
    );
    const claimed = await claim();
    for (const job of claimed) expect(await runClaimedJob(job)).toBe('succeeded');
    expect((await allJobs()).every((job) => job.status === 'succeeded')).toBe(true);
    await withAdminTx((tx) =>
      tx.delete(jobs).where(inArray(jobs.name, ['notify.dispatch', 'tests.post-to-ledger'])),
    );
  });

  it('a payload that does not fit the event is a programming error', async () => {
    await expect(
      as(principal, (ctx) => emit(ctx, paymentReceived, { paymentId: 'nope', amount: 1 } as never)),
    ).rejects.toThrow(/not valid/);
  });
});

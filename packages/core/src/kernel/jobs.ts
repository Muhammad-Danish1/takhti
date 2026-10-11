import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  adminDb,
  branches,
  jobSchedules,
  jobs,
  orgs,
  rowsOf,
  supportsSessionTimeouts,
  withAdminTx,
  type Tx,
} from '@takhti/db';
import { NO_ORG_ID, currentTime, runAsSystem, stampOf, systemActor, type Ctx } from './context';
import { latestDue, parseCron } from './cron';
import { addSeconds, todayPk } from './dates';
import { findPostgresError } from './errors';
import { newId } from './ids';
import { childLogger, logger } from './logger';

/*
 * Background jobs, queued in Postgres.
 *
 * A job row is inserted in the same transaction as the change that needs it: if the change rolls
 * back the job does not exist, and if it commits the job cannot be lost.
 *
 * This file has two halves. `defineJob` and `enqueue` are used by every module. The functions after
 * them (`claimJobs`, `runClaimedJob`, `reapStuckJobs`, the schedule functions) are the worker's, and
 * use the privileged connection: the queue spans organisations.
 */

// ---------------------------------------------------------------------------------------------
// Defining and queueing
// ---------------------------------------------------------------------------------------------

export interface JobRun {
  jobId: string;
  /** 1 on the first try. */
  attempt: number;
  maxAttempts: number;
}

export interface JobDefinition<P extends z.ZodType = z.ZodType> {
  /** `<module>.<what-it-does>`, for example `fees.generate-vouchers`. */
  name: string;
  payload: P;
  /** Tries after the first one. */
  retries: number;
  backoff: 'exponential' | 'fixed';
  timeoutSeconds: number;
  /** Higher runs first. */
  priority: number;
  /** `org`: runs for one school, inside row-level security. `platform`: privileged, for Takhti's own housekeeping. */
  scope: 'org' | 'platform';
  /** Jobs that return the same key never run at the same time. */
  concurrencyKey?: (payload: z.output<P>) => string;
  /** Must be safe to run twice: a job is retried after a crash. */
  handler: (ctx: Ctx, payload: z.output<P>, run: JobRun) => Promise<void>;
}

type JobOptions<P extends z.ZodType> = Pick<JobDefinition<P>, 'name' | 'payload' | 'handler'> &
  Partial<Omit<JobDefinition<P>, 'name' | 'payload' | 'handler'>>;

const registry = new Map<string, JobDefinition>();

export function defineJob<P extends z.ZodType>(options: JobOptions<P>): JobDefinition<P> {
  if (!/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(options.name)) {
    throw new Error(`Job name "${options.name}" must look like module.what-it-does`);
  }
  const definition: JobDefinition<P> = {
    retries: 5,
    backoff: 'exponential',
    timeoutSeconds: 120,
    priority: 0,
    scope: 'org',
    ...options,
  };
  registry.set(definition.name, definition as unknown as JobDefinition);
  return definition;
}

export const findJob = (name: string): JobDefinition | undefined => registry.get(name);
export const registeredJobs = (): JobDefinition[] => [...registry.values()];

export interface EnqueueOptions {
  /** Not before this moment. */
  runAt?: string;
  /** While a job with this key is queued or running, another is not added. */
  dedupeKey?: string;
  priority?: number;
  parentJobId?: string;
}

interface NewJob {
  id: string;
  orgId: string | null;
  createdBy: string | null;
  now: string;
  definition: JobDefinition;
  payload: unknown;
  options: EnqueueOptions;
}

async function insertJob(db: Tx, job: NewJob): Promise<void> {
  const { definition, options } = job;
  // Keys are prefixed with the organisation, so one school can never block or collide with another.
  const scopeKey = (key: string | undefined) =>
    key === undefined ? null : `${job.orgId ?? 'platform'}:${key}`.slice(0, 500);
  // No `returning`: a family user's action may queue a job, but only staff can read the queue.
  await db
    .insert(jobs)
    .values({
      id: job.id,
      orgId: job.orgId,
      createdAt: job.now,
      updatedAt: job.now,
      createdBy: job.createdBy,
      name: definition.name,
      payload: job.payload as never,
      status: 'queued',
      priority: options.priority ?? definition.priority,
      runAt: options.runAt ?? job.now,
      maxAttempts: definition.retries + 1,
      timeoutSeconds: definition.timeoutSeconds,
      concurrencyKey: scopeKey(definition.concurrencyKey?.(job.payload as never)),
      dedupeKey: scopeKey(options.dedupeKey),
      parentJobId: options.parentJobId ?? null,
    })
    // Deliberately without naming the index: naming its columns would make Postgres apply the queue's
    // read policy to the new row, and a family user (who may queue but not read) would be refused.
    // The only unique rule a new, queued job can meet is the dedupe key.
    .onConflictDoNothing();
}

function checkedPayload<P extends z.ZodType>(
  definition: JobDefinition<P>,
  payload: unknown,
): z.output<P> {
  const parsed = definition.payload.safeParse(payload);
  // A wrong payload is a programming error, not something the user typed: fail loudly, as a bug.
  if (!parsed.success)
    throw new Error(
      `Payload for job "${definition.name}" is not valid: ${z.prettifyError(parsed.error)}`,
    );
  return parsed.data;
}

/**
 * Queues a job in the caller's transaction and returns its id.
 * With a `dedupeKey`, a job already waiting with that key wins and this call adds nothing.
 */
export async function enqueue<P extends z.ZodType>(
  ctx: Ctx,
  job: JobDefinition<P>,
  payload: z.input<P>,
  options: EnqueueOptions = {},
): Promise<string> {
  if (findJob(job.name) !== (job as unknown as JobDefinition)) {
    throw new Error(
      `Job "${job.name}" is not registered. Define it with defineJob and import its file where the worker starts.`,
    );
  }
  const platform = job.scope === 'platform';
  if (!platform && ctx.actor.orgId === NO_ORG_ID)
    throw new Error(`Job "${job.name}" needs an organisation`);
  const id = newId();
  await insertJob(ctx.db, {
    id,
    orgId: platform ? null : ctx.actor.orgId,
    createdBy: stampOf(ctx),
    now: ctx.now,
    definition: job as unknown as JobDefinition,
    payload: checkedPayload(job, payload),
    options,
  });
  return id;
}

// ---------------------------------------------------------------------------------------------
// The worker's side
// ---------------------------------------------------------------------------------------------

export interface ClaimedJob {
  id: string;
  orgId: string | null;
  name: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  timeoutSeconds: number;
}

export interface ClaimOptions {
  /** Identifies this worker process in `locked_by`. */
  workerId: string;
  /** The most jobs to take in one go. */
  limit: number;
  /** The most jobs one organisation may have running at once, so a large school cannot starve the others. */
  perOrgLimit: number;
}

const CLAIM_LOCK = 7_254_818;

/**
 * Takes queued jobs whose time has come and marks them running.
 *
 * `for update skip locked` keeps two workers from taking the same row. Claims are also taken one
 * at a time (an advisory lock held for a few milliseconds), which is what makes the two rules below
 * exact rather than approximate: jobs sharing a concurrency key never run together, and no
 * organisation exceeds its share.
 */
export async function claimJobs(options: ClaimOptions): Promise<ClaimedJob[]> {
  if (options.limit < 1) return [];
  const now = currentTime();
  return withAdminTx(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${CLAIM_LOCK})`);
    const result = await tx.execute(sql`
      with due as (
        select j.id, j.org_id, j.concurrency_key, j.priority, j.run_at
        from jobs j
        where j.status = 'queued' and j.run_at <= ${now}::timestamptz
        order by j.priority desc, j.run_at, j.id
        limit ${options.limit * 10}
        for update skip locked
      ), ranked as (
        select d.*,
          row_number() over (partition by d.org_id order by d.priority desc, d.run_at, d.id) as org_rank,
          row_number() over (partition by coalesce(d.concurrency_key, d.id::text) order by d.priority desc, d.run_at, d.id) as key_rank,
          (select count(*) from jobs r where r.status = 'running' and r.org_id is not distinct from d.org_id) as org_running,
          exists (select 1 from jobs r where r.status = 'running' and r.concurrency_key = d.concurrency_key) as key_busy
        from due d
      ), chosen as (
        select id from ranked
        where key_rank = 1 and not key_busy and org_rank + org_running <= ${options.perOrgLimit}
        order by priority desc, run_at, id
        limit ${options.limit}
      )
      update jobs j
      set status = 'running', locked_by = ${options.workerId}, locked_at = ${now}::timestamptz,
          started_at = ${now}::timestamptz, attempts = j.attempts + 1, updated_at = ${now}::timestamptz
      from chosen
      where j.id = chosen.id
      returning j.id, j.org_id, j.name, j.payload, j.attempts, j.max_attempts, j.timeout_seconds
    `);
    return rowsOf<{
      id: string;
      org_id: string | null;
      name: string;
      payload: unknown;
      attempts: number;
      max_attempts: number;
      timeout_seconds: number;
    }>(result).map((row) => ({
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      payload: row.payload,
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
      timeoutSeconds: Number(row.timeout_seconds),
    }));
  });
}

/** Seconds to wait before the next try. Doubles each time from 30 seconds, up to an hour, with a little spread. */
export function retryDelaySeconds(
  attempt: number,
  backoff: 'exponential' | 'fixed',
  random: () => number = Math.random,
): number {
  const base = backoff === 'fixed' ? 60 : Math.min(3600, 30 * 2 ** Math.max(0, attempt - 1));
  // Spread retries out so a burst of failures does not come back as a burst.
  return Math.round(base * (0.8 + 0.4 * random()));
}

class JobTimeout extends Error {
  constructor(seconds: number) {
    super(`The job did not finish within ${seconds} seconds`);
  }
}

/** A failure that trying again cannot cure: an unknown job name, a payload that no longer fits. */
class PermanentJobFailure extends Error {}

const describe = (error: unknown): string =>
  (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 2000);

export type JobOutcome = 'succeeded' | 'retrying' | 'failed';

async function settle(
  job: ClaimedJob,
  error: unknown | undefined,
  backoff: 'exponential' | 'fixed',
  workerId: string | undefined,
): Promise<JobOutcome> {
  const now = currentTime();
  // Only the worker that still holds the job may settle it: a job reaped as stuck and taken by another worker is theirs now.
  const mine = and(
    eq(jobs.id, job.id),
    eq(jobs.status, 'running'),
    workerId === undefined ? undefined : eq(jobs.lockedBy, workerId),
  );
  if (error === undefined) {
    await adminDb()
      .update(jobs)
      .set({
        status: 'succeeded',
        finishedAt: now,
        updatedAt: now,
        lockedBy: null,
        lockedAt: null,
        lastError: null,
      })
      .where(mine);
    return 'succeeded';
  }
  const final = error instanceof PermanentJobFailure || job.attempts >= job.maxAttempts;
  await adminDb()
    .update(jobs)
    .set(
      final
        ? {
            status: 'failed',
            finishedAt: now,
            updatedAt: now,
            lockedBy: null,
            lockedAt: null,
            lastError: describe(error),
          }
        : {
            status: 'queued',
            runAt: addSeconds(now, retryDelaySeconds(job.attempts, backoff)),
            updatedAt: now,
            lockedBy: null,
            lockedAt: null,
            lastError: describe(error),
          },
    )
    .where(mine);
  return final ? 'failed' : 'retrying';
}

/** A privileged unit of work with no organisation, for platform jobs. */
async function runPlatformJob(requestId: string, work: (ctx: Ctx) => Promise<void>): Promise<void> {
  await withAdminTx(async (db) => {
    const now = currentTime();
    await work({
      db,
      actor: systemActor(NO_ORG_ID),
      requestId,
      source: 'job',
      now,
      today: todayPk(now),
      log: childLogger({ requestId }),
    });
  });
}

/**
 * Runs one claimed job to its end and records the result. Never throws: a failure becomes a retry
 * or a failed job with its reason, and the worker carries on.
 */
export async function runClaimedJob(
  job: ClaimedJob,
  options: { workerId?: string } = {},
): Promise<JobOutcome> {
  const definition = findJob(job.name);
  const log = childLogger({ jobId: job.id, job: job.name, ...(job.orgId && { orgId: job.orgId }) });
  let failure: unknown;
  try {
    if (!definition)
      throw new PermanentJobFailure(`No handler is registered for job "${job.name}"`);
    const parsed = definition.payload.safeParse(job.payload);
    if (!parsed.success)
      throw new PermanentJobFailure(
        `The payload no longer fits job "${job.name}": ${z.prettifyError(parsed.error)}`,
      );
    if (definition.scope === 'org' && !job.orgId)
      throw new PermanentJobFailure(`Job "${job.name}" needs an organisation`);

    const run: JobRun = { jobId: job.id, attempt: job.attempts, maxAttempts: job.maxAttempts };
    const requestId = `job-${job.id}`;
    const body = async (ctx: Ctx) => {
      // The database cancels any single statement that runs past the job's limit: the handler gets an error and
      // its transaction rolls back cleanly. (A limit on the whole transaction would end the connection instead,
      // which the driver does not survive gracefully; the timer below covers time spent outside the database.)
      if (supportsSessionTimeouts()) {
        await ctx.db.execute(
          sql.raw(
            `set local statement_timeout = ${Math.max(1, Math.floor(job.timeoutSeconds)) * 1000}`,
          ),
        );
      }
      await definition.handler(ctx, parsed.data, run);
    };
    const work =
      job.orgId && definition.scope === 'org'
        ? runAsSystem(job.orgId, { requestId, source: 'job' }, body)
        : runPlatformJob(requestId, body);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const overrun = new Promise<never>((_resolve, reject) => {
      // A second later than the database's own limit, so that a slow statement is cancelled cleanly first.
      // This fires when the handler is stuck somewhere the database cannot see, such as waiting on an outside service.
      timer = setTimeout(
        () => reject(new JobTimeout(job.timeoutSeconds)),
        (job.timeoutSeconds + 1) * 1000,
      );
    });
    try {
      await Promise.race([work, overrun]);
    } finally {
      clearTimeout(timer);
      // If the timer won, the handler is still running; its eventual error must not go unhandled.
      work.catch(() => {});
    }
  } catch (error) {
    // 57014: the database cancelled a statement that ran past the job's limit.
    failure =
      findPostgresError(error)?.code === '57014'
        ? new JobTimeout(job.timeoutSeconds)
        : (error ?? new Error('The job failed without a reason'));
  }

  try {
    const outcome = await settle(
      job,
      failure,
      definition?.backoff ?? 'exponential',
      options.workerId,
    );
    if (outcome === 'succeeded') log.debug('job succeeded');
    else
      log.warn({ err: describe(failure), attempt: job.attempts, outcome }, 'job did not succeed');
    return outcome;
  } catch (error) {
    // The result could not be recorded (the database is away). The job stays `running` and the reaper returns it to the queue.
    log.error({ err: describe(error) }, 'could not record the result of a job');
    return failure === undefined ? 'succeeded' : 'retrying';
  }
}

/**
 * Returns to the queue any job still `running` well past its timeout: the worker that held it died.
 * A job that has used all its tries is marked failed instead.
 */
export async function reapStuckJobs(): Promise<number> {
  const now = currentTime();
  const result = await adminDb().execute(sql`
    update jobs
    set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
        finished_at = case when attempts >= max_attempts then ${now}::timestamptz else null end,
        run_at = ${now}::timestamptz,
        locked_by = null, locked_at = null, updated_at = ${now}::timestamptz,
        last_error = 'The worker stopped before the job finished'
    where status = 'running' and locked_at < ${now}::timestamptz - make_interval(secs => timeout_seconds + 60)
    returning id
  `);
  return rowsOf(result).length;
}

// ---------------------------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------------------------

export interface ScheduleDefinition {
  /** Unique, for example `fees.assess-fines.daily`. */
  name: string;
  /** Five cron fields, in Pakistan time. */
  cron: string;
  job: JobDefinition;
  /** Merged into each job's payload, next to `scheduledFor` (and `branchId` for per-branch schedules). */
  payload?: Record<string, unknown>;
  /** One job for the platform, one per active organisation, or one per active branch. */
  fanOut: 'platform' | 'per_org' | 'per_branch';
}

const schedules = new Map<string, ScheduleDefinition>();

export function defineSchedule(schedule: ScheduleDefinition): ScheduleDefinition {
  parseCron(schedule.cron);
  if (schedule.fanOut === 'platform' && schedule.job.scope !== 'platform') {
    throw new Error(
      `Schedule "${schedule.name}" is for the platform but its job runs per organisation`,
    );
  }
  if (schedule.fanOut !== 'platform' && schedule.job.scope === 'platform') {
    throw new Error(
      `Schedule "${schedule.name}" fans out per organisation but its job is a platform job`,
    );
  }
  schedules.set(schedule.name, schedule);
  return schedule;
}

export const registeredSchedules = (): ScheduleDefinition[] => [...schedules.values()];

/** Brings `job_schedules` in line with the schedules defined in code. Run when the worker starts. */
export async function syncSchedules(): Promise<void> {
  const now = currentTime();
  const wanted = registeredSchedules();
  await withAdminTx(async (tx) => {
    const existing = await tx.select({ name: jobSchedules.name }).from(jobSchedules);
    const names = new Set(wanted.map((schedule) => schedule.name));
    for (const row of existing) {
      if (!names.has(row.name))
        await tx.delete(jobSchedules).where(eq(jobSchedules.name, row.name));
    }
    for (const schedule of wanted) {
      const values = {
        cron: schedule.cron,
        jobName: schedule.job.name,
        payload: (schedule.payload ?? {}) as never,
        fanOut: schedule.fanOut,
        updatedAt: now,
      };
      await tx
        .insert(jobSchedules)
        // A schedule that is new starts from its next due time; it does not run at once for a time already past.
        .values({
          id: newId(),
          name: schedule.name,
          createdAt: now,
          lastEnqueuedFor: now,
          ...values,
        })
        .onConflictDoUpdate({ target: jobSchedules.name, set: values });
    }
  });
}

/**
 * Queues a job for every schedule that has come due since it last ran. Run once a minute.
 * Two workers doing this at the same moment queue each run once: the schedule row is locked while
 * it is handled, and every job carries a key made of the schedule, the due time and the school.
 */
export async function enqueueDueSchedules(): Promise<number> {
  const now = currentTime();
  let queued = 0;
  const rows = await adminDb().select().from(jobSchedules).where(eq(jobSchedules.isEnabled, true));

  for (const row of rows) {
    const definition = findJob(row.jobName);
    if (!definition) {
      logger().warn(
        { schedule: row.name, job: row.jobName },
        'schedule names a job that is not registered',
      );
      continue;
    }
    let due: string | undefined;
    try {
      due = latestDue(row.cron, now);
    } catch (error) {
      logger().error(
        { schedule: row.name, err: describe(error) },
        'schedule has a cron expression that cannot be read',
      );
      continue;
    }
    if (!due || (row.lastEnqueuedFor && Date.parse(row.lastEnqueuedFor) >= Date.parse(due)))
      continue;

    queued += await withAdminTx(async (tx) => {
      const [locked] = await tx
        .select()
        .from(jobSchedules)
        .where(eq(jobSchedules.id, row.id))
        .limit(1)
        .for('update');
      if (!locked || !locked.isEnabled) return 0;
      if (locked.lastEnqueuedFor && Date.parse(locked.lastEnqueuedFor) >= Date.parse(due)) return 0;

      const targets: { orgId: string | null; branchId?: string }[] =
        row.fanOut === 'platform'
          ? [{ orgId: null }]
          : row.fanOut === 'per_org'
            ? (
                await tx
                  .select({ id: orgs.id })
                  .from(orgs)
                  .where(and(eq(orgs.status, 'active'), isNull(orgs.deletedAt)))
              ).map((org) => ({ orgId: org.id }))
            : (
                await tx
                  .select({ id: branches.id, orgId: branches.orgId })
                  .from(branches)
                  .innerJoin(orgs, eq(orgs.id, branches.orgId))
                  .where(
                    and(
                      eq(branches.status, 'active'),
                      isNull(branches.deletedAt),
                      eq(orgs.status, 'active'),
                      isNull(orgs.deletedAt),
                    ),
                  )
              ).map((branch) => ({ orgId: branch.orgId, branchId: branch.id }));

      for (const target of targets) {
        const payload = {
          ...(row.payload as Record<string, unknown>),
          scheduledFor: due,
          ...(target.branchId && { branchId: target.branchId }),
        };
        await insertJob(tx, {
          id: newId(),
          orgId: target.orgId,
          createdBy: null,
          now,
          definition,
          payload: checkedPayload(definition, payload),
          options: { dedupeKey: `schedule:${row.name}:${due}:${target.branchId ?? ''}` },
        });
      }
      await tx
        .update(jobSchedules)
        .set({ lastEnqueuedFor: due, updatedAt: now })
        .where(eq(jobSchedules.id, row.id));
      return targets.length;
    });
  }
  return queued;
}

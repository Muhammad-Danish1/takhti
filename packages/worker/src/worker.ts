import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import {
  claimJobs,
  enqueueDueSchedules,
  logger,
  reapStuckJobs,
  runClaimedJob,
  syncSchedules,
  type ClaimedJob,
  type JobOutcome,
} from '@takhti/core';

/*
 * The job runner. One loop, three duties:
 *
 *   every second   take queued jobs whose time has come, up to the free slots, and run them
 *   every minute   queue whatever the schedules say is due
 *   every minute   return to the queue any job whose worker died while holding it
 *
 * Nothing in the loop may end the process: a database that is briefly away is logged and waited
 * out. Several workers can run side by side; the queue itself keeps them from taking the same job.
 */

export interface WorkerOptions {
  /** Jobs running at once in this process. */
  concurrency?: number;
  /** The most jobs one school may have running at once, across all workers. */
  perOrgLimit?: number;
  pollMs?: number;
  scheduleMs?: number;
  reapMs?: number;
  /** How long `stop` waits for running jobs before giving up on them. They are then reaped and retried. */
  shutdownGraceMs?: number;
  workerId?: string;
}

export interface Worker {
  readonly id: string;
  /** Writes the schedules defined in code to the database, then starts the loop. */
  start(): Promise<void>;
  /** Stops taking jobs, lets the running ones finish, then resolves. */
  stop(): Promise<void>;
  /** One pass of the claiming duty. Returns how many jobs were started. For tests. */
  tick(): Promise<number>;
  /** Resolves when every job that has been started has finished. For tests. */
  idle(): Promise<void>;
  readonly running: number;
}

export function createWorker(options: WorkerOptions = {}): Worker {
  const id = options.workerId ?? `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
  const concurrency = Math.max(1, options.concurrency ?? 5);
  const perOrgLimit = Math.max(1, options.perOrgLimit ?? 2);
  const pollMs = options.pollMs ?? 1_000;
  const scheduleMs = options.scheduleMs ?? 60_000;
  const reapMs = options.reapMs ?? 60_000;
  const graceMs = options.shutdownGraceMs ?? 30_000;
  const log = logger().child({ worker: id });

  const inFlight = new Set<Promise<JobOutcome>>();
  let stopping = false;
  let loop: Promise<void> | undefined;
  let wake: (() => void) | undefined;

  const run = (job: ClaimedJob): void => {
    // `runClaimedJob` never rejects: a failure becomes a retry or a failed job with its reason.
    const task = runClaimedJob(job, { workerId: id }).finally(() => inFlight.delete(task));
    inFlight.add(task);
  };

  async function tick(): Promise<number> {
    if (stopping) return 0;
    const free = concurrency - inFlight.size;
    if (free <= 0) return 0;
    const jobs = await claimJobs({ workerId: id, limit: free, perOrgLimit });
    for (const job of jobs) run(job);
    return jobs.length;
  }

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });

  /** Runs a duty and never lets its failure escape. Returns false when it failed. */
  async function safely(name: string, duty: () => Promise<unknown>): Promise<boolean> {
    try {
      await duty();
      return true;
    } catch (error) {
      log.error(
        { duty: name, err: error instanceof Error ? error.message : String(error) },
        'worker duty failed; will try again',
      );
      return false;
    }
  }

  async function main(): Promise<void> {
    let lastSchedule = 0;
    let lastReap = 0;
    let failures = 0;
    while (!stopping) {
      const now = Date.now();
      let healthy = await safely('claim', tick);
      if (!stopping && now - lastSchedule >= scheduleMs) {
        lastSchedule = now;
        healthy = (await safely('schedules', enqueueDueSchedules)) && healthy;
      }
      if (!stopping && now - lastReap >= reapMs) {
        lastReap = now;
        healthy = (await safely('reap', reapStuckJobs)) && healthy;
      }
      // When the database is away, wait longer each time, up to half a minute, instead of hammering it.
      failures = healthy ? 0 : failures + 1;
      if (!stopping)
        await sleep(healthy ? pollMs : Math.min(30_000, pollMs * 2 ** Math.min(failures, 5)));
    }
  }

  return {
    id,
    get running() {
      return inFlight.size;
    },
    tick,
    async idle() {
      while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
    },
    async start() {
      if (loop) return;
      await safely('sync schedules', syncSchedules);
      log.info({ concurrency, perOrgLimit }, 'worker started');
      loop = main();
    },
    async stop() {
      if (stopping) return;
      stopping = true;
      wake?.();
      await loop;
      if (inFlight.size > 0) {
        log.info({ running: inFlight.size }, 'waiting for running jobs to finish');
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timedOut = new Promise<'timeout'>((resolve) => {
          timer = setTimeout(() => resolve('timeout'), graceMs);
        });
        const finished = await Promise.race([
          Promise.allSettled([...inFlight]).then(() => 'done' as const),
          timedOut,
        ]);
        clearTimeout(timer);
        if (finished === 'timeout')
          log.warn(
            { running: inFlight.size },
            'some jobs did not finish in time; they will be returned to the queue and retried',
          );
      }
      log.info('worker stopped');
    },
  };
}

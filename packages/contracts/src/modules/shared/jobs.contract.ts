import { z } from 'zod';
import { MAX_PAGE_SIZE } from '../../kernel/resource';
import { JobStatus } from './shared.constants';

/*
 * The background job queue as a person sees it: docs/plan/10-modules/m00-shared-kernel.md.
 * Jobs are queued by the product itself; a permitted person may look, retry a failed one and
 * cancel one that is still waiting.
 */

export const ListJobs = z.strictObject({
  status: JobStatus.optional(),
  /** The whole name of a job, such as `fees.generate-vouchers`. */
  name: z
    .string()
    .regex(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/, 'Not the name of a job')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});
export type ListJobs = z.output<typeof ListJobs>;

export const Job = z.object({
  id: z.uuid(),
  name: z.string(),
  status: JobStatus,
  priority: z.int(),
  /** Not before this moment. */
  runAt: z.string(),
  /** How many times it has been tried, and the most it will be. */
  attempts: z.int(),
  maxAttempts: z.int(),
  /** Why the last try failed, in the system's own words. */
  lastError: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  createdAt: z.string(),
  /** The person whose action queued it; empty for a scheduled job. */
  createdBy: z.uuid().nullable(),
  parentJobId: z.uuid().nullable(),
  progress: z.object({ done: z.number(), total: z.number() }).nullable(),
});
export type Job = z.output<typeof Job>;

/** One job, with what it was asked to do. */
export const JobDetail = Job.extend({ payload: z.unknown() });
export type JobDetail = z.output<typeof JobDetail>;

/** How many times a person may retry one failed job. After that it needs someone to find the cause. */
export const MAX_MANUAL_RETRIES = 3;

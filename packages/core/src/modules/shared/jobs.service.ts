import { and, count, desc, eq, sql } from 'drizzle-orm';
import {
  Job,
  JobDetail,
  MAX_MANUAL_RETRIES,
  type ListJobs,
  type Page,
} from '@takhti/contracts';
import { auditLog, jobs } from '@takhti/db';
import { audit } from '../../kernel/audit';
import type { Ctx } from '../../kernel/context';
import { notFound, registerConstraintMessages, rule } from '../../kernel/errors';
import { assertPermission } from '../../kernel/permissions';

/*
 * The job queue as a permitted person sees it: docs/plan/10-modules/m00-shared-kernel.md, rule
 * R-shared-15. The worker claims and finishes jobs on its own connection; this service only looks,
 * puts a failed job back in the queue, and takes a waiting one out of it.
 */

registerConstraintMessages({
  jobs_dedupe_uq: 'The same task is already waiting to run',
});

const progressOf = (value: unknown): { done: number; total: number } | null => {
  const { done, total } = (value ?? {}) as { done?: unknown; total?: unknown };
  return typeof done === 'number' && typeof total === 'number' ? { done, total } : null;
};

async function one(ctx: Ctx, id: string) {
  // Row-level security keeps this to the school's own jobs; a platform job is not reachable here.
  const [row] = await ctx.db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!row) throw notFound('Job');
  return row;
}

export const jobsService = {
  /** The school's jobs, newest first. */
  async list(ctx: Ctx, query: ListJobs): Promise<Page<Job>> {
    assertPermission(ctx, 'jobs:read');
    const where = and(
      query.status ? eq(jobs.status, query.status) : undefined,
      query.name ? eq(jobs.name, query.name) : undefined,
    );
    const rows = await ctx.db
      .select()
      .from(jobs)
      .where(where)
      .orderBy(desc(jobs.createdAt), desc(jobs.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const [counted] = await ctx.db.select({ total: count() }).from(jobs).where(where);
    return {
      items: rows.map((row) => Job.parse({ ...row, progress: progressOf(row.progress) })),
      page: query.page,
      pageSize: query.pageSize,
      total: counted?.total ?? 0,
    };
  },

  async get(ctx: Ctx, id: string): Promise<JobDetail> {
    assertPermission(ctx, 'jobs:read');
    const row = await one(ctx, id);
    return JobDetail.parse({ ...row, progress: progressOf(row.progress) });
  },

  /**
   * R-shared-15: puts a failed job back in the queue, for one more try, at most three times.
   * A cancelled job is never retried.
   */
  async retry(ctx: Ctx, id: string): Promise<JobDetail> {
    assertPermission(ctx, 'jobs:retry');
    const current = await one(ctx, id);
    if (current.status === 'cancelled') throw rule('A cancelled job is never retried');
    if (current.status !== 'failed')
      throw rule(`Only a failed job can be retried. This one is ${current.status}.`);

    // The audit log is the record of who retried what, so it is also the count.
    const [earlier] = await ctx.db
      .select({ total: count() })
      .from(auditLog)
      .where(
        and(eq(auditLog.entity, 'jobs'), eq(auditLog.entityId, id), eq(auditLog.action, 'retry')),
      );
    if ((earlier?.total ?? 0) >= MAX_MANUAL_RETRIES)
      throw rule(
        `This job has been retried ${MAX_MANUAL_RETRIES} times and still fails. It needs someone to look at why.`,
      );

    const [row] = await ctx.db
      .update(jobs)
      .set({
        status: 'queued',
        runAt: ctx.now,
        // One more try, and no more: the job's own retries were used up when it failed.
        maxAttempts: sql`${jobs.attempts} + 1`,
        lockedBy: null,
        lockedAt: null,
        startedAt: null,
        finishedAt: null,
        updatedAt: ctx.now,
      })
      .where(and(eq(jobs.id, id), eq(jobs.status, 'failed')))
      .returning();
    // It stopped being a failed job between the look and the change: someone else retried it.
    if (!row) throw rule('This job is no longer waiting to be retried');
    await audit(ctx, 'jobs', 'retry', id, { summary: `Retried the job ${row.name}` });
    return JobDetail.parse({ ...row, progress: progressOf(row.progress) });
  },

  /** Takes a job that has not started out of the queue. */
  async cancel(ctx: Ctx, id: string): Promise<JobDetail> {
    assertPermission(ctx, 'jobs:retry');
    const current = await one(ctx, id);
    const [row] = await ctx.db
      .update(jobs)
      .set({ status: 'cancelled', finishedAt: ctx.now, updatedAt: ctx.now })
      .where(and(eq(jobs.id, id), eq(jobs.status, 'queued')))
      .returning();
    if (!row)
      throw rule(
        current.status === 'running'
          ? 'This job has already started and cannot be stopped'
          : `Only a job that is still waiting can be cancelled. This one is ${current.status}.`,
      );
    await audit(ctx, 'jobs', 'cancel', id, { summary: `Cancelled the job ${row.name}` });
    return JobDetail.parse({ ...row, progress: progressOf(row.progress) });
  },
};

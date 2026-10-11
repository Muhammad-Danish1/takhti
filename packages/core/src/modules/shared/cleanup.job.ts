import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { rowsOf } from '@takhti/db';
import type { Ctx } from '../../kernel/context';
import { addDays, addSeconds } from '../../kernel/dates';
import { defineJob, defineSchedule } from '../../kernel/jobs';

/*
 * Nightly housekeeping for the whole platform: things that are only useful for a short time and
 * would otherwise pile up for ever. Nothing a school would call its data is touched here.
 *
 * A platform job runs on the privileged connection, so everything goes through `ctx.db`:
 * the three deletes succeed or fail together.
 */

/** How long a finished job stays visible on the jobs screen. */
export const KEEP_FINISHED_JOBS_DAYS = 14;

const removed = async (ctx: Ctx, statement: ReturnType<typeof sql>): Promise<number> =>
  rowsOf(await ctx.db.execute(statement)).length;

export const cleanupJob = defineJob({
  name: 'shared.cleanup',
  scope: 'platform',
  payload: z.object({ scheduledFor: z.string().optional() }),
  retries: 2,
  timeoutSeconds: 600,
  handler: async (ctx) => {
    const idempotencyKeys = await removed(
      ctx,
      sql`delete from idempotency_keys where expires_at < ${ctx.now}::timestamptz returning id`,
    );
    // A rate-limit window is at most an hour long; a day-old one can never matter again.
    const rateLimitWindows = await removed(
      ctx,
      sql`delete from rate_limits where window_start < ${addSeconds(ctx.now, -24 * 60 * 60)}::timestamptz returning key`,
    );
    const finishedJobs = await removed(
      ctx,
      sql`delete from jobs where status in ('succeeded', 'cancelled') and finished_at < ${`${addDays(ctx.today, -KEEP_FINISHED_JOBS_DAYS)}T00:00:00Z`}::timestamptz returning id`,
    );
    ctx.log.info({ idempotencyKeys, rateLimitWindows, finishedJobs }, 'nightly cleanup finished');
  },
});

/** 03:00 in Pakistan, when schools are asleep. */
export const cleanupSchedule = defineSchedule({
  name: 'shared.cleanup.nightly',
  cron: '0 3 * * *',
  job: cleanupJob,
  fanOut: 'platform',
});

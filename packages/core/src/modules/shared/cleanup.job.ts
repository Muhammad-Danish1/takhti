import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { rowsOf } from '@takhti/db';
import type { Ctx } from '../../kernel/context';
import { addDays, addSeconds } from '../../kernel/dates';
import { defineJob, defineSchedule } from '../../kernel/jobs';
import { storage } from '../../providers/storage';

/*
 * Nightly housekeeping for the whole platform: things that are only useful for a short time and
 * would otherwise pile up for ever. Nothing a school would call its data is touched here.
 *
 * A platform job runs on the privileged connection, so everything goes through `ctx.db`:
 * what it removes is removed together or not at all.
 */

/** How long a finished job stays visible on the jobs screen. */
export const KEEP_FINISHED_JOBS_DAYS = 14;

/** How long an upload may wait for its bytes and its confirmation. */
export const KEEP_PENDING_UPLOADS_HOURS = 24;

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
    // F-shared-1: a link was issued and the upload never finished. The record it was meant for was
    // saved without it; the row and whatever part of the file arrived are of no use to anyone.
    const abandoned = rowsOf<{ bucket: string; path: string }>(
      await ctx.db.execute(
        sql`update files set status = 'deleted', deleted_at = ${ctx.now}::timestamptz, updated_at = ${ctx.now}::timestamptz, version = version + 1
            where status = 'pending' and deleted_at is null
              and created_at < ${addSeconds(ctx.now, -KEEP_PENDING_UPLOADS_HOURS * 60 * 60)}::timestamptz
            returning bucket, path`,
      ),
    );
    const byBucket = new Map<string, string[]>();
    for (const file of abandoned)
      byBucket.set(file.bucket, [...(byBucket.get(file.bucket) ?? []), file.path]);
    // If the store cannot be reached the job fails, nothing above is kept, and it runs again.
    for (const [bucket, paths] of byBucket) await storage().remove(bucket, paths);

    ctx.log.info(
      { idempotencyKeys, rateLimitWindows, finishedJobs, abandonedUploads: abandoned.length },
      'nightly cleanup finished',
    );
  },
});

/** 03:00 in Pakistan, when schools are asleep. */
export const cleanupSchedule = defineSchedule({
  name: 'shared.cleanup.nightly',
  cron: '0 3 * * *',
  job: cleanupJob,
  fanOut: 'platform',
});

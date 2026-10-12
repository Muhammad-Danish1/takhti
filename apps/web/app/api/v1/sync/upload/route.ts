import { SyncUpload } from '@takhti/contracts';
import { applySyncBatch } from '@takhti/core';
import { defineRoute } from '@/server/route';

/**
 * `POST /api/v1/sync/upload`: applies the changes a device queued while it was offline.
 * It answers 200 with a result for each operation, so one refused change never blocks the rest.
 */
export const POST = defineRoute({
  permission: 'signed-in',
  body: SyncUpload,
  source: 'sync',
  // A device that was offline for days sends several batches in a row.
  rateLimit: { max: 60, windowSeconds: 60, by: 'user' },
  maxBodyBytes: 5 * 1024 * 1024,
  handler: (ctx, { body }) => applySyncBatch(ctx, body),
});

import { IdParams, ResolveSyncConflict } from '@takhti/contracts';
import { syncConflictsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `POST /api/v1/sync/conflicts/[id]/resolve`: keeps the server's value, or takes the device's. */
export const POST = defineRoute({
  permission: 'sync-conflicts:update',
  params: IdParams,
  body: ResolveSyncConflict,
  handler: (ctx, { params, body }) => syncConflictsService.resolve(ctx, params.id, body),
});

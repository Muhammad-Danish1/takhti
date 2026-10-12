import { ListSyncConflicts } from '@takhti/contracts';
import { syncConflictsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/sync/conflicts`: the conflicts waiting for a decision, oldest first. */
export const GET = defineRoute({
  permission: 'sync-conflicts:update',
  query: ListSyncConflicts,
  handler: (ctx, { query }) => syncConflictsService.list(ctx, query),
});

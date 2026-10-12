import { ListSyncRejections } from '@takhti/contracts';
import { syncRejectionsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/sync/rejections`: one's own changes that the server refused, with the reason for each. */
export const GET = defineRoute({
  permission: 'signed-in',
  query: ListSyncRejections,
  handler: (ctx, { query }) => syncRejectionsService.list(ctx, query),
});

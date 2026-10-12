import { ListExports } from '@takhti/contracts';
import { exportsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/exports`: one's own exports, newest first. */
export const GET = defineRoute({
  permission: 'signed-in',
  query: ListExports,
  handler: (ctx, { query }) => exportsService.list(ctx, query),
});

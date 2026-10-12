import { IdParams } from '@takhti/contracts';
import { importsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/imports/[id]`: the status and counts of one's own import. */
export const GET = defineRoute({
  permission: 'signed-in',
  params: IdParams,
  handler: (ctx, { params }) => importsService.get(ctx, params.id),
});

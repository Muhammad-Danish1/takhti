import { IdParams } from '@takhti/contracts';
import { exportsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/exports/[id]`: the status of one's own export, with a download link once it is ready. */
export const GET = defineRoute({
  permission: 'signed-in',
  params: IdParams,
  handler: (ctx, { params }) => exportsService.get(ctx, params.id),
});

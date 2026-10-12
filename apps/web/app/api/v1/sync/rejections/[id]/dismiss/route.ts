import { IdParams } from '@takhti/contracts';
import { syncRejectionsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `POST /api/v1/sync/rejections/[id]/dismiss`: marks a refused change of one's own as dealt with. */
export const POST = defineRoute({
  permission: 'signed-in',
  params: IdParams,
  handler: (ctx, { params }) => syncRejectionsService.dismiss(ctx, params.id),
});

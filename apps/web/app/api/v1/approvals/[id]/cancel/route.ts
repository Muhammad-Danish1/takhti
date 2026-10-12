import { IdParams } from '@takhti/contracts';
import { approvalsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `POST /api/v1/approvals/[id]/cancel`: the person who asked withdraws the request. */
export const POST = defineRoute({
  permission: 'signed-in',
  params: IdParams,
  handler: (ctx, { params }) => approvalsService.cancel(ctx, params.id),
});

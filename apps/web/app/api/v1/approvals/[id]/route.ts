import { IdParams } from '@takhti/contracts';
import { approvalsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/approvals/[id]`: one request with its steps. */
export const GET = defineRoute({
  permission: 'signed-in',
  params: IdParams,
  handler: (ctx, { params }) => approvalsService.get(ctx, params.id),
});

import { Decision, IdParams } from '@takhti/contracts';
import { approvalsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `POST /api/v1/approvals/[id]/approve`: approves the step that is waiting. A decision is never taken twice: it needs an Idempotency-Key. */
export const POST = defineRoute({
  permission: 'signed-in',
  params: IdParams,
  body: Decision,
  idempotent: true,
  handler: (ctx, { params, body }) => approvalsService.approve(ctx, params.id, body),
});

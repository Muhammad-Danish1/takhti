import { ListApprovals } from '@takhti/contracts';
import { approvalsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/approvals`: requests waiting for the caller, or raised by them; all of them with `approvals:read`. */
export const GET = defineRoute({
  permission: 'signed-in',
  query: ListApprovals,
  handler: (ctx, { query }) => approvalsService.list(ctx, query),
});

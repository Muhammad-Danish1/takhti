import { IdParams } from '@takhti/contracts';
import { settingsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/branches/[id]/settings`: the settings a branch may override, with the value in force there. */
export const GET = defineRoute({
  permission: 'org-settings:read',
  params: IdParams,
  handler: (ctx, { params }) => settingsService.listForBranch(ctx, params.id),
});

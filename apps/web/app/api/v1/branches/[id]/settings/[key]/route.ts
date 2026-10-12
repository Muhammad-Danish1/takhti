import { BranchSettingParams, PutSetting } from '@takhti/contracts';
import { settingsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `PUT /api/v1/branches/[id]/settings/[key]`: gives the branch a value of its own. */
export const PUT = defineRoute({
  permission: 'signed-in',
  params: BranchSettingParams,
  body: PutSetting,
  handler: (ctx, { params, body }) =>
    settingsService.putForBranch(ctx, params.id, params.key, body.value),
});

/** `DELETE /api/v1/branches/[id]/settings/[key]`: removes the branch's own value; answers with the value now in force. */
export const DELETE = defineRoute({
  permission: 'signed-in',
  params: BranchSettingParams,
  handler: (ctx, { params }) => settingsService.clearForBranch(ctx, params.id, params.key),
});

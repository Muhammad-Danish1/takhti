import { PutSetting, SettingKeyParams, SettingQuery } from '@takhti/contracts';
import { settingsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/**
 * `GET /api/v1/org/settings/[key]?branchId=`: one setting with the value in force. Whether the
 * person may read it is the setting's own rule, so the route lets every member through.
 */
export const GET = defineRoute({
  permission: 'signed-in',
  params: SettingKeyParams,
  query: SettingQuery,
  handler: (ctx, { params, query }) => settingsService.get(ctx, params.key, query.branchId),
});

/** `PUT /api/v1/org/settings/[key]`: saves the group's value. The setting's own permission decides who may. */
export const PUT = defineRoute({
  permission: 'signed-in',
  params: SettingKeyParams,
  body: PutSetting,
  handler: (ctx, { params, body }) => settingsService.put(ctx, params.key, body.value),
});

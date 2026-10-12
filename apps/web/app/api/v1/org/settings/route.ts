import { settingsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/org/settings`: every setting with the group's value and its default. */
export const GET = defineRoute({
  permission: 'org-settings:read',
  handler: (ctx) => settingsService.list(ctx),
});

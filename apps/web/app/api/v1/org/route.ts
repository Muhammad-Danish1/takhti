import { UpdateOrg } from '@takhti/contracts';
import { orgService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/org`: the school group's profile. */
export const GET = defineRoute({
  permission: 'org:read',
  handler: (ctx) => orgService.get(ctx),
});

/** `PATCH /api/v1/org`: changes the profile. The slug and the status are the platform's to change. */
export const PATCH = defineRoute({
  permission: 'org:update',
  body: UpdateOrg,
  handler: (ctx, { body }) => orgService.update(ctx, body),
});

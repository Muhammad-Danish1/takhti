import { orgService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/org/public`: the school's name, logo and contact details, for a family's screens. */
export const GET = defineRoute({
  permission: 'signed-in',
  handler: (ctx) => orgService.publicProfile(ctx),
});

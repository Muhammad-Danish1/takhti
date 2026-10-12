import { onboardingService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/onboarding`: the setup checklist, with what was ticked and what the system can already see. */
export const GET = defineRoute({
  permission: 'org:read',
  handler: (ctx) => onboardingService.list(ctx),
});

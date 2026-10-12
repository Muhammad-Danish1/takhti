import { CompleteOnboardingTask, OnboardingKeyParams } from '@takhti/contracts';
import { onboardingService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `POST /api/v1/onboarding/[key]/complete`: ticks a setup task off, as done or as skipped. */
export const POST = defineRoute({
  permission: 'onboarding:update',
  params: OnboardingKeyParams,
  body: CompleteOnboardingTask,
  handler: (ctx, { params, body }) => onboardingService.complete(ctx, params.key, body),
});

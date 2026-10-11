import { z } from 'zod';

export const onboardingTaskKeys = [
  'profile',
  'academic_year',
  'grades',
  'sections',
  'subjects',
  'fee_structure',
  'staff',
  'students',
  'first_voucher_run',
] as const;
export const OnboardingTaskKey = z.enum(onboardingTaskKeys);
export type OnboardingTaskKey = (typeof onboardingTaskKeys)[number];

export const onboardingStatuses = ['pending', 'done', 'skipped'] as const;
export const OnboardingStatus = z.enum(onboardingStatuses);
export type OnboardingStatus = (typeof onboardingStatuses)[number];

export const OnboardingTask = z.object({
  key: OnboardingTaskKey,
  status: OnboardingStatus,
  completedAt: z.string().nullable(),
  /** Whether the system can already see the task is done (a grade exists, a student exists). */
  detected: z.boolean(),
});
export type OnboardingTask = z.output<typeof OnboardingTask>;

export const CompleteOnboardingTask = z.object({ status: z.enum(['done', 'skipped']) });
export type CompleteOnboardingTask = z.output<typeof CompleteOnboardingTask>;

export const OnboardingKeyParams = z.object({ key: OnboardingTaskKey });

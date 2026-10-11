import { z } from 'zod';

const settingKey = z
  .string()
  .regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_.]*$/, { error: 'Not a setting key' });

/** One setting as the API returns it: its effective value and where that value came from. */
export const SettingView = z.object({
  key: z.string(),
  scope: z.enum(['org', 'branch']),
  label: z.string(),
  value: z.unknown(),
  defaultValue: z.unknown(),
  /** `default`: nobody set it. `org`: set for the group. `branch`: overridden at this branch. */
  source: z.enum(['default', 'org', 'branch']),
});
export type SettingView = z.output<typeof SettingView>;

export const PutSetting = z.object({ value: z.unknown() });
export type PutSetting = z.output<typeof PutSetting>;

export const SettingKeyParams = z.object({ key: settingKey });
export const BranchSettingParams = z.object({ id: z.uuid(), key: settingKey });

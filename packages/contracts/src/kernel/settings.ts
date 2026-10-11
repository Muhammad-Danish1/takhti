import type { z } from 'zod';

/*
 * A typed registry of settings. A setting that is not registered cannot be read or written.
 * Each module declares its settings in `<module>.settings.ts`; the catalogue gathers them.
 */

export type SettingScope = 'org' | 'branch';

export interface SettingDef<T = unknown> {
  /** `<module>.<name>`, for example `fees.due_day`. */
  key: string;
  /** `org`: one value per school group. `branch`: a branch may override the group's value. */
  scope: SettingScope;
  schema: z.ZodType<T>;
  default: T;
  label: string;
  labelUr?: string;
  /** Shown under the field on the settings screen. */
  hint?: string;
}

export function defineSetting<T>(def: SettingDef<T>): SettingDef<T> {
  if (!/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_.]*$/.test(def.key)) {
    throw new Error(`Setting key "${def.key}" must look like module.name`);
  }
  // A default that its own schema rejects would surface much later, at the first read. Fail now instead.
  def.schema.parse(def.default);
  return def;
}

/** The value type of a setting definition. */
export type SettingValue<D> = D extends SettingDef<infer T> ? T : never;

import { isCalendarDate } from '@takhti/contracts';

/*
 * Checking the extra fields a school added to its own records, with no database:
 * docs/plan/10-modules/m00-shared-kernel.md, rule R-shared-10.
 *
 * The values live in the `custom` column of the record they belong to, under each field's key.
 */

export interface CustomFieldRule {
  key: string;
  label: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'bool';
  options: readonly string[] | null;
  isRequired: boolean;
  isActive: boolean;
}

export interface CheckedCustomValues {
  /** The values to store: only those of active fields, each in the shape of its type. */
  values: Record<string, string | number | boolean>;
  /** What is wrong, by field key. Empty when the record may be saved. */
  errors: Record<string, string>;
}

const isEmpty = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

/**
 * R-shared-10: values are checked against the active definitions, and a required field that is
 * empty blocks saving. A value for a field that is switched off, or that the school never defined,
 * is not an error: it is simply not kept.
 */
export function checkCustomValues(
  definitions: readonly CustomFieldRule[],
  given: Readonly<Record<string, unknown>> = {},
): CheckedCustomValues {
  const values: CheckedCustomValues['values'] = {};
  const errors: CheckedCustomValues['errors'] = {};

  for (const field of definitions) {
    if (!field.isActive) continue;
    const value = given[field.key];
    if (isEmpty(value)) {
      if (field.isRequired) errors[field.key] = `${field.label} is required`;
      continue;
    }
    switch (field.fieldType) {
      case 'text':
        if (typeof value !== 'string') errors[field.key] = `${field.label} must be text`;
        else if (value.trim().length > 500)
          errors[field.key] = `${field.label} must be under 500 characters`;
        else values[field.key] = value.trim();
        break;
      case 'number': {
        const number = typeof value === 'number' ? value : Number(String(value).trim());
        if (!Number.isFinite(number)) errors[field.key] = `${field.label} must be a number`;
        else values[field.key] = number;
        break;
      }
      case 'date':
        if (typeof value !== 'string' || !isCalendarDate(value))
          errors[field.key] = `${field.label} must be a date`;
        else values[field.key] = value;
        break;
      case 'select':
        if (typeof value !== 'string' || !(field.options ?? []).includes(value))
          errors[field.key] = `${field.label}: choose one of ${(field.options ?? []).join(', ')}`;
        else values[field.key] = value;
        break;
      case 'bool':
        if (typeof value !== 'boolean') errors[field.key] = `${field.label} must be yes or no`;
        else values[field.key] = value;
        break;
    }
  }
  return { values, errors };
}

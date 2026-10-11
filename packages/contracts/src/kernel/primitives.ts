import { z } from 'zod';

/*
 * Small Zod pieces used by every contract, so a phone number, a date or an amount is validated
 * the same way everywhere. Allowed-value lists are exported as `const` arrays: the database's
 * check constraints are built from the same arrays.
 */

// ---------------------------------------------------------------- identifiers and numbers

export const Id = z.uuid();

/** An amount in paisa. Rs 8,500 is 850000. Whole, never negative. */
export const Money = z
  .number({ error: 'Enter an amount' })
  .int({ error: 'Amounts are whole paisa' })
  .min(0, { error: 'An amount cannot be negative' })
  .max(Number.MAX_SAFE_INTEGER);

/** An amount in paisa that may be negative: adjustments and deltas. */
export const SignedMoney = z
  .number({ error: 'Enter an amount' })
  .int({ error: 'Amounts are whole paisa' })
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);

const atMostTwoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

/** 0 to 100, at most two decimal places. */
export const Percent = z
  .number({ error: 'Enter a percentage' })
  .min(0, { error: 'A percentage cannot be below 0' })
  .max(100, { error: 'A percentage cannot be above 100' })
  .refine(atMostTwoDecimals, { error: 'Use at most two decimal places' });

/** Marks: zero or more, at most two decimal places. Half marks are allowed. */
export const Marks = z
  .number({ error: 'Enter the marks' })
  .min(0, { error: 'Marks cannot be negative' })
  .max(9999.99)
  .refine(atMostTwoDecimals, { error: 'Use at most two decimal places' });

// ---------------------------------------------------------------- dates and times

export const isLeapYear = (year: number) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** Days in a month, `month` from 1 to 12. Plain arithmetic: no Date object, so no time zone can interfere. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** True for a real calendar date written as YYYY-MM-DD. `2026-02-30` is refused. */
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return (
    year >= 1900 &&
    year <= 2200 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

/** A calendar date as text, `YYYY-MM-DD`. Never a JavaScript Date. */
export const DateStr = z
  .string({ error: 'Enter a date' })
  .refine(isCalendarDate, { error: 'Enter a real date as YYYY-MM-DD' });

/** A time of day, 24-hour `HH:MM`. */
export const TimeStr = z
  .string({ error: 'Enter a time' })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Enter a time as HH:MM' });

/** A moment in time as ISO text with an offset. */
export const Timestamp = z.iso.datetime({ offset: true, error: 'Enter a date and time' });

/** A month, `YYYY-MM`. */
export const Period = z
  .string({ error: 'Enter a month' })
  .regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/, { error: 'Enter a month as YYYY-MM' });

// ---------------------------------------------------------------- phone and identity numbers

/** Western digits for the Urdu and Arabic digits a phone keyboard may produce. */
export function toWesternDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (char) => {
    const code = char.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

const mobileDigits = (raw: string): string | undefined => {
  const digits = toWesternDigits(raw).replace(/[\s\-().]/g, '');
  const match = /^(?:\+92|0092|92|0)?(3\d{9})$/.exec(digits);
  return match?.[1];
};

/**
 * A Pakistani mobile number. Accepts `03001234567`, `0300-1234567`, `+92 300 1234567`.
 * Always output as `+923001234567`.
 */
export const Phone = z
  .string({ error: 'Enter a mobile number' })
  .trim()
  .refine((value) => mobileDigits(value) !== undefined, {
    error: 'Enter a mobile number like 0300 1234567',
  })
  .transform((value) => `+92${mobileDigits(value)}`);

const anyPhoneDigits = (raw: string): string | undefined => {
  const digits = toWesternDigits(raw).replace(/[\s\-().]/g, '');
  const match = /^(?:\+92|0092|92|0)?([1-9]\d{8,9})$/.exec(digits);
  return match?.[1];
};

/** A mobile or landline number in Pakistan, for offices and schools. Output as `+92…`. */
export const PhoneAny = z
  .string({ error: 'Enter a phone number' })
  .trim()
  .refine((value) => anyPhoneDigits(value) !== undefined, {
    error: 'Enter a phone number with its area code',
  })
  .transform((value) => `+92${anyPhoneDigits(value)}`);

const cnicDigits = (raw: string): string | undefined => {
  const digits = toWesternDigits(raw).replace(/[\s-]/g, '');
  return /^\d{13}$/.test(digits) ? digits : undefined;
};

/** A CNIC or B-Form number: 13 digits, with or without dashes. Output as `12345-1234567-1`. */
export const Cnic = z
  .string({ error: 'Enter the 13-digit number' })
  .trim()
  .refine((value) => cnicDigits(value) !== undefined, { error: 'Use the format 12345-1234567-1' })
  .transform((value) => {
    const digits = cnicDigits(value) ?? '';
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  });

// ---------------------------------------------------------------- text

const collapseSpaces = (text: string) => text.trim().replace(/\s+/g, ' ');

/** A person's or thing's name: 2 to 120 characters, repeated spaces collapsed. */
export const Name = z
  .string({ error: 'Enter a name' })
  .transform(collapseSpaces)
  .pipe(
    z
      .string()
      .min(2, { error: 'Enter at least 2 characters' })
      .max(120, { error: 'Keep it under 120 characters' }),
  );

/** Text in Urdu script, up to 120 characters. Arabic-script letters, digits, spaces and common punctuation. */
export const NameUr = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    z
      .string()
      .min(1)
      .max(120, { error: 'Keep it under 120 characters' })
      .regex(/^[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿\s\d.,'()\-‌‍]+$/, {
        error: 'Write this in Urdu script',
      }),
  );

export const ShortText = z.string().trim().max(200, { error: 'Keep it under 200 characters' });
export const LongText = z.string().trim().max(5000, { error: 'Keep it under 5,000 characters' });
/** Free text that must be given. */
export const RequiredText = LongText.min(1, { error: 'This cannot be left empty' });

export const Email = z
  .string({ error: 'Enter an email address' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address' }).max(254));

/** A short code such as a branch code: capital letters and digits. */
export const Code = (min: number, max: number) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .pipe(
      z.string().regex(new RegExp(`^[A-Z0-9]{${min},${max}}$`), {
        error: `Use ${min} to ${max} capital letters or digits`,
      }),
    );

/** A URL-safe slug: lower-case letters, digits and hyphens. */
export const Slug = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .string()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: 'Use lower-case letters, digits and hyphens' }),
  );

// ---------------------------------------------------------------- fixed lists

export const genders = ['male', 'female', 'other'] as const;
export const Gender = z.enum(genders);
export type Gender = (typeof genders)[number];

/** Students are recorded as male or female, as boards require. */
export const studentGenders = ['male', 'female'] as const;
export const StudentGender = z.enum(studentGenders);
export type StudentGender = (typeof studentGenders)[number];

/** Whom a branch or section admits. */
export const genderPolicies = ['boys', 'girls', 'mixed'] as const;
export const GenderPolicy = z.enum(genderPolicies);
export type GenderPolicy = (typeof genderPolicies)[number];

export const bloodGroups = [
  'a_pos',
  'a_neg',
  'b_pos',
  'b_neg',
  'ab_pos',
  'ab_neg',
  'o_pos',
  'o_neg',
  'unknown',
] as const;
export const BloodGroup = z.enum(bloodGroups);
export type BloodGroup = (typeof bloodGroups)[number];

export const religions = ['islam', 'christianity', 'hinduism', 'sikhism', 'other'] as const;
export const Religion = z.enum(religions);
export type Religion = (typeof religions)[number];

export const locales = ['en', 'ur'] as const;
export const Locale = z.enum(locales);
export type Locale = (typeof locales)[number];

/** Monday is 1, Sunday is 7. */
export const weekdays = [1, 2, 3, 4, 5, 6, 7] as const;
export const Weekday = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
]);

export const provinces = ['punjab', 'sindh', 'kp', 'balochistan', 'ict', 'ajk', 'gb'] as const;
export const Province = z.enum(provinces);
export type Province = (typeof provinces)[number];

// ---------------------------------------------------------------- query-string helpers

/** A filter that takes several values separated by commas: `status=unpaid,partial`. */
export function csv<T extends z.ZodType<unknown, string>>(item: T) {
  return z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    )
    .pipe(z.array(item).min(1).max(50));
}

/** A boolean in a query string: `true`, `false`, `1`, `0`. */
export const QueryBool = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

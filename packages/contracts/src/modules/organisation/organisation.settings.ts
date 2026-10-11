import { z } from 'zod';
import { defineSetting } from '../../kernel/settings';
import { Locale, Weekday } from '../../kernel/primitives';
import { roleKeys } from '../../access/roles';

/*
 * Organisation-wide settings that belong to no other module (M02 section 4).
 * Each module registers its own settings in its own `<module>.settings.ts`.
 */

export const generalLanguages = defineSetting({
  key: 'general.languages',
  scope: 'org',
  schema: z.array(Locale).min(1),
  default: ['en', 'ur'],
  label: 'Languages offered',
});

export const generalNumberFormats = defineSetting({
  key: 'general.number_formats',
  scope: 'org',
  schema: z.object({
    admission: z.string().min(1).max(60),
    feeVoucher: z.string().min(1).max(60),
    receipt: z.string().min(1).max(60),
    employee: z.string().min(1).max(60),
    certificate: z.string().min(1).max(60),
  }),
  default: {
    admission: '{branch}-{yy}-{0000}',
    feeVoucher: 'FV-{yymm}-{00000}',
    receipt: 'R-{yymm}-{00000}',
    employee: 'E-{0000}',
    certificate: '{type}-{yyyy}-{0000}',
  },
  label: 'Number formats',
  hint: 'How admission, voucher, receipt, employee and certificate numbers are written.',
});

export const generalWorkingWeek = defineSetting({
  key: 'general.working_week',
  scope: 'branch',
  schema: z.object({
    /** Monday is 1, Sunday is 7. */
    workingDays: z.array(Weekday).min(1).max(7),
    /** A day that ends early, usually Friday. */
    shortDay: Weekday.nullable(),
  }),
  default: { workingDays: [1, 2, 3, 4, 5, 6], shortDay: 5 },
  label: 'Working week',
});

export const securityPasswordPolicy = defineSetting({
  key: 'security.password_policy',
  scope: 'org',
  schema: z.object({
    minLength: z.int().min(8).max(64),
    requireNumber: z.boolean(),
    requireSymbol: z.boolean(),
  }),
  default: { minLength: 10, requireNumber: true, requireSymbol: false },
  label: 'Password rules',
});

export const securityMfaRoles = defineSetting({
  key: 'security.mfa_roles',
  scope: 'org',
  schema: z.array(z.enum(roleKeys as [string, ...string[]])),
  default: [
    'owner',
    'director',
    'finance_head',
    'accountant',
    'payroll_officer',
    'hr_manager',
    'it_admin',
  ],
  label: 'Roles that must use two-factor sign-in',
});

export const securitySessionHours = defineSetting({
  key: 'security.session_hours',
  scope: 'org',
  schema: z.int().min(1).max(720),
  default: 168,
  label: 'Hours before a session must sign in again',
});

export const documentsLetterhead = defineSetting({
  key: 'documents.letterhead',
  scope: 'branch',
  schema: z.object({
    showLogo: z.boolean(),
    showUrduName: z.boolean(),
    showRegistrationNumbers: z.boolean(),
    footerText: z.string().max(200),
  }),
  default: { showLogo: true, showUrduName: true, showRegistrationNumbers: true, footerText: '' },
  label: 'Letterhead',
});

export const documentsSignatures = defineSetting({
  key: 'documents.signatures',
  scope: 'branch',
  schema: z.array(
    z.object({
      /** Which signature line this is: `principal`, `accountant`, `class_teacher`, `exam_controller`. */
      role: z.string().min(1).max(40),
      label: z.string().min(1).max(60),
      labelUr: z.string().max(60).optional(),
      fileId: z.uuid().nullable(),
    }),
  ),
  default: [
    { role: 'principal', label: 'Principal', fileId: null },
    { role: 'accountant', label: 'Accountant', fileId: null },
    { role: 'class_teacher', label: 'Class Teacher', fileId: null },
  ],
  label: 'Signatures on documents',
});

export const organisationSettings = [
  generalLanguages,
  generalNumberFormats,
  generalWorkingWeek,
  securityPasswordPolicy,
  securityMfaRoles,
  securitySessionHours,
  documentsLetterhead,
  documentsSignatures,
] as const;

import { z } from 'zod';
import {
  Email,
  Locale,
  Name,
  NameUr,
  PhoneAny,
  Province,
  ShortText,
  Slug,
} from '../../kernel/primitives';
import { baseEntity } from '../../kernel/resource';

export const billingModes = ['student', 'family'] as const;
export const BillingMode = z.enum(billingModes);
export type BillingMode = (typeof billingModes)[number];

export const orgStatuses = ['provisioning', 'active', 'suspended', 'closed'] as const;
export const OrgStatus = z.enum(orgStatuses);
export type OrgStatus = (typeof orgStatuses)[number];

const month = z.int().min(1).max(12);

const Website = z
  .url({ protocol: /^https?$/, error: 'Enter a web address starting with http or https' })
  .max(200);

/** Fields a person with `org:update` can change. `slug` and `status` are platform-only. */
const editable = {
  name: Name,
  nameUr: NameUr.nullable(),
  legalName: ShortText.nullable(),
  logoFileId: z.uuid().nullable(),
  ntn: ShortText.nullable(),
  phone: PhoneAny.nullable(),
  email: Email.nullable(),
  website: Website.nullable(),
  address: ShortText.nullable(),
  city: Name,
  province: Province,
  academicYearStartMonth: month,
  fiscalYearStartMonth: month,
  defaultLocale: Locale,
  billingMode: BillingMode,
};

export const Org = z.object({
  ...baseEntity,
  slug: Slug,
  ...editable,
  status: OrgStatus,
});
export type Org = z.output<typeof Org>;

export const UpdateOrg = z.object(editable).partial().extend({ version: z.int() });
export type UpdateOrg = z.output<typeof UpdateOrg>;

/** What a family portal may know about the school: name, logo and how to reach it. */
export const OrgPublic = Org.pick({
  id: true,
  name: true,
  nameUr: true,
  logoFileId: true,
  phone: true,
  email: true,
  website: true,
  address: true,
  city: true,
  defaultLocale: true,
});
export type OrgPublic = z.output<typeof OrgPublic>;

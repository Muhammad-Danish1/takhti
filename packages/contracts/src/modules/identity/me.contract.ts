import { z } from 'zod';
import { Locale } from '../../kernel/primitives';
import { memberKinds } from '../../access/roles';
import { MembershipStatus } from './identity.constants';

/*
 * Who is signed in and what they may do. Every portal shell is built from this one response:
 * the menu from `permissions` and `modules`, the branch switcher from `branches`.
 */

export const MeBranch = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  nameUr: z.string().nullable(),
  status: z.enum(['active', 'inactive']),
});
export type MeBranch = z.output<typeof MeBranch>;

export const Me = z.object({
  user: z.object({
    id: z.uuid(),
    fullName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    avatarFileId: z.uuid().nullable(),
    locale: Locale,
  }),
  membership: z.object({
    id: z.uuid(),
    kind: z.enum(memberKinds),
    roleKeys: z.array(z.string()),
    allBranches: z.boolean(),
    staffId: z.uuid().nullable(),
    guardianId: z.uuid().nullable(),
    studentIds: z.array(z.uuid()),
  }),
  org: z.object({
    id: z.uuid(),
    name: z.string(),
    nameUr: z.string().nullable(),
    slug: z.string(),
    logoFileId: z.uuid().nullable(),
    defaultLocale: Locale,
  }),
  /** The branches this person may work in (staff), or the school's active branches (families). */
  branches: z.array(MeBranch),
  /** `resource:action` keys the person holds. */
  permissions: z.array(z.string()),
  /** Keys of the modules switched on for the school. */
  modules: z.array(z.string()),
});
export type Me = z.output<typeof Me>;

/** One of the places a signed-in person can go, for the "choose where to continue" screen. */
export const MembershipChoice = z.object({
  membershipId: z.uuid(),
  orgId: z.uuid(),
  orgName: z.string(),
  orgSlug: z.string(),
  kind: z.enum(memberKinds),
  status: MembershipStatus,
});
export type MembershipChoice = z.output<typeof MembershipChoice>;

export const SwitchOrg = z.object({ membershipId: z.uuid() });
export type SwitchOrg = z.output<typeof SwitchOrg>;

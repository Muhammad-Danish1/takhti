import { z } from 'zod';

/* Allowed-value lists of the identity module (M03). The tables build their check constraints from these. */

export const membershipStatuses = ['invited', 'active', 'suspended'] as const;
export const MembershipStatus = z.enum(membershipStatuses);
export type MembershipStatus = (typeof membershipStatuses)[number];

/** The level a role sits at, as stored per organisation. Platform roles are not stored here. */
export const orgRoleLevels = [
  'group',
  'branch',
  'academics',
  'finance',
  'hr',
  'front',
  'operations',
  'family',
] as const;
export const OrgRoleLevel = z.enum(orgRoleLevels);
export type OrgRoleLevel = (typeof orgRoleLevels)[number];

export const invitationStatuses = ['pending', 'accepted', 'expired', 'revoked'] as const;
export const InvitationStatus = z.enum(invitationStatuses);
export type InvitationStatus = (typeof invitationStatuses)[number];

/** Who did something, as the audit log records it. */
export const actorKinds = ['staff', 'guardian', 'student', 'platform', 'system'] as const;
export const ActorKind = z.enum(actorKinds);
export type ActorKind = (typeof actorKinds)[number];

/** Where a change came from: an API call, an offline device, a background job or the AI assistant. */
export const changeSources = ['api', 'sync', 'job', 'ai'] as const;
export const ChangeSource = z.enum(changeSources);
export type ChangeSource = (typeof changeSources)[number];

export const loginEventKinds = [
  'sign_in',
  'sign_out',
  'failed',
  'locked',
  'otp_sent',
  'mfa_passed',
  'mfa_failed',
  'password_reset',
  'invitation_accepted',
] as const;
export const LoginEventKind = z.enum(loginEventKinds);
export type LoginEventKind = (typeof loginEventKinds)[number];

export const devicePlatforms = ['web', 'android', 'ios'] as const;
export const DevicePlatform = z.enum(devicePlatforms);
export type DevicePlatform = (typeof devicePlatforms)[number];

export const themes = ['system', 'light', 'dark'] as const;
export const Theme = z.enum(themes);
export type Theme = (typeof themes)[number];

export const densities = ['compact', 'normal', 'comfortable'] as const;
export const Density = z.enum(densities);
export type Density = (typeof densities)[number];

export const numberStyles = ['international', 'south_asian'] as const;
export const NumberStyle = z.enum(numberStyles);
export type NumberStyle = (typeof numberStyles)[number];

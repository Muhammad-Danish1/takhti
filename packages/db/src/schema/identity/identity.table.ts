import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import {
  actorKinds,
  changeSources,
  densities,
  devicePlatforms,
  invitationStatuses,
  locales,
  loginEventKinds,
  memberKinds,
  membershipStatuses,
  numberStyles,
  orgRoleLevels,
  themes,
} from '@takhti/contracts';
import { appendColumns, baseColumns } from '../../kernel/base-columns';
import {
  auditColumns,
  enumChecks,
  enumText,
  idColumn,
  live,
  table,
  timestamptz,
  unindexed,
} from '../../kernel/columns';
import {
  appendOnly,
  customPolicy,
  globalRead,
  orgScoped,
  platformOnly,
  policySql,
  selfOwned,
} from '../../kernel/policies';
import { registerTable } from '../../registry';
import { branches } from '../organisation/branches.table';
import { orgs } from '../organisation/orgs.table';
import { supportSessions } from '../platform/platform.table';
import { files } from '../shared/files.table';
import { staff } from '../staff/staff.table';
import { guardians, students } from '../students/students.table';
import { syncDevices } from '../shared/sync.table';

/** One row per Supabase Auth user. `id` equals `auth.users.id`. */
export const profiles = table(
  'profiles',
  {
    /** Set to the Auth user's id; never generated here. */
    id: uuid().primaryKey(),
    ...auditColumns,
    fullName: text().notNull(),
    /** Lower case. */
    email: text(),
    /** E.164. */
    phone: text(),
    avatarFileId: uuid().references((): AnyPgColumn => files.id),
    lastSeenAt: timestamptz(),
    isPlatform: boolean().notNull().default(false),
  },
  (t) => [
    index('profiles_email_idx').on(t.email),
    index('profiles_phone_idx').on(t.phone),
    ...platformOnly('profiles'),
    // A user reads and updates their own row. Rows are created and removed by the system only.
    ...selfOwned('profiles', t.id, { access: 'update' }),
    // Staff may read the profiles of members of their own organisation.
    customPolicy('profiles_org_read', {
      for: 'select',
      using: sql`${policySql.isStaff} and exists (
        select 1 from memberships m
        where m.user_id = ${t.id} and m.org_id = (select app.org_id()) and m.deleted_at is null
      )`,
    }),
  ],
);
registerTable(profiles, 'profiles', {
  module: 'M03',
  scope: 'platform',
  self: 'id',
  selfAccess: 'update',
  custom: true,
});

/** Joins a login to an organisation and one person record. */
export const memberships = table(
  'memberships',
  {
    ...baseColumns,
    userId: uuid()
      .notNull()
      .references(() => profiles.id),
    kind: enumText(memberKinds).notNull(),
    /** Set when kind is staff. */
    staffId: uuid().references((): AnyPgColumn => staff.id),
    /** Set when kind is guardian. */
    guardianId: uuid().references((): AnyPgColumn => guardians.id),
    /** Set when kind is student. */
    studentId: uuid().references((): AnyPgColumn => students.id),
    status: enumText(membershipStatuses).notNull(),
    allBranches: boolean().notNull().default(false),
    suspendedReason: text(),
    /** Raising it ends every session of this membership. */
    tokenVersion: integer().notNull().default(1),
    lastActiveAt: timestamptz(),
  },
  (t) => [
    ...enumChecks('memberships', t),
    check(
      'memberships_person_chk',
      sql`(${t.kind} = 'staff' and ${t.staffId} is not null and ${t.guardianId} is null and ${t.studentId} is null)
       or (${t.kind} = 'guardian' and ${t.guardianId} is not null and ${t.staffId} is null and ${t.studentId} is null)
       or (${t.kind} = 'student' and ${t.studentId} is not null and ${t.staffId} is null and ${t.guardianId} is null)`,
    ),
    uniqueIndex('memberships_user_kind_uq').on(t.orgId, t.userId, t.kind).where(live(t)),
    uniqueIndex('memberships_staff_uq')
      .on(t.orgId, t.staffId)
      .where(sql`${t.deletedAt} is null and ${t.staffId} is not null`),
    uniqueIndex('memberships_guardian_uq')
      .on(t.orgId, t.guardianId)
      .where(sql`${t.deletedAt} is null and ${t.guardianId} is not null`),
    uniqueIndex('memberships_student_uq')
      .on(t.orgId, t.studentId)
      .where(sql`${t.deletedAt} is null and ${t.studentId} is not null`),
    index('memberships_user_idx').on(t.userId),
    ...orgScoped('memberships', t),
    // A person may see their own memberships, in every organisation they belong to, but never change one.
    ...selfOwned('memberships', t.userId, { access: 'read' }),
  ],
);
registerTable(memberships, 'memberships', {
  module: 'M03',
  scope: 'org',
  self: 'userId',
  selfAccess: 'read',
  selfAcrossOrgs: true,
});

export const roles = table(
  'roles',
  {
    ...baseColumns,
    /** A built-in key or a slug for a custom role. */
    key: text().notNull(),
    name: text().notNull(),
    nameUr: text(),
    description: text(),
    level: enumText(orgRoleLevels).notNull(),
    /** Built-in roles. */
    isSystem: boolean().notNull().default(false),
    /** `owner`, `auditor`, `guardian` and `student` cannot be edited. */
    isLocked: boolean().notNull().default(false),
    defaultAllBranches: boolean().notNull().default(false),
  },
  (t) => [
    ...enumChecks('roles', t),
    uniqueIndex('roles_key_uq').on(t.orgId, t.key).where(live(t)),
    ...orgScoped('roles', t),
  ],
);
registerTable(roles, 'roles', { module: 'M03', scope: 'org' });

export const membershipRoles = table(
  'membership_roles',
  {
    ...baseColumns,
    membershipId: uuid()
      .notNull()
      .references(() => memberships.id),
    roleId: uuid()
      .notNull()
      .references(() => roles.id),
  },
  (t) => [
    uniqueIndex('membership_roles_uq').on(t.membershipId, t.roleId).where(live(t)),
    index('membership_roles_role_idx').on(t.roleId),
    ...orgScoped('membership_roles', t),
  ],
);
registerTable(membershipRoles, 'membership_roles', { module: 'M03', scope: 'org' });

export const membershipBranches = table(
  'membership_branches',
  {
    ...baseColumns,
    membershipId: uuid()
      .notNull()
      .references(() => memberships.id),
    branchId: uuid()
      .notNull()
      .references(() => branches.id),
  },
  (t) => [
    uniqueIndex('membership_branches_uq').on(t.membershipId, t.branchId).where(live(t)),
    index('membership_branches_branch_idx').on(t.branchId),
    ...orgScoped('membership_branches', t),
  ],
);
registerTable(membershipBranches, 'membership_branches', { module: 'M03', scope: 'org' });

/** The catalogue of permissions, seeded from code by a migration. */
export const permissions = table(
  'permissions',
  {
    /** `resource:action`. */
    key: text().primaryKey(),
    resource: text().notNull(),
    action: text().notNull(),
    moduleKey: text().notNull(),
    label: text().notNull(),
    description: text(),
    /** Shown with a warning on the roles screen. */
    isSensitive: boolean().notNull().default(false),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [index('permissions_module_idx').on(t.moduleKey), ...globalRead('permissions')],
);
registerTable(permissions, 'permissions', { module: 'M03', scope: 'global' });

export const rolePermissions = table(
  'role_permissions',
  {
    ...baseColumns,
    roleId: uuid()
      .notNull()
      .references(() => roles.id),
    permissionKey: text()
      .notNull()
      .references(() => permissions.key),
  },
  (t) => [
    uniqueIndex('role_permissions_uq').on(t.roleId, t.permissionKey).where(live(t)),
    index('role_permissions_org_idx').on(t.orgId, t.roleId),
    ...orgScoped('role_permissions', t),
  ],
);
registerTable(rolePermissions, 'role_permissions', { module: 'M03', scope: 'org' });

export const invitations = table(
  'invitations',
  {
    ...baseColumns,
    kind: enumText(memberKinds).notNull(),
    /** The staff, guardian or student record. */
    personId: uuid().notNull(),
    email: text(),
    phone: text(),
    /** The token itself is never stored. */
    tokenHash: text().notNull(),
    /** Staff only. */
    roleIds: uuid()
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    branchIds: uuid()
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    allBranches: boolean().notNull().default(false),
    status: enumText(invitationStatuses).notNull().default('pending'),
    expiresAt: timestamptz().notNull(),
    sentCount: integer().notNull().default(0),
    lastSentAt: timestamptz(),
    acceptedAt: timestamptz(),
    acceptedUserId: uuid().references(() => profiles.id),
  },
  (t) => [
    ...enumChecks('invitations', t),
    check('invitations_contact_chk', sql`${t.email} is not null or ${t.phone} is not null`),
    uniqueIndex('invitations_token_uq').on(t.tokenHash),
    uniqueIndex('invitations_pending_uq')
      .on(t.orgId, t.kind, t.personId)
      .where(sql`${t.status} = 'pending' and ${t.deletedAt} is null`),
    index('invitations_org_status_idx').on(t.orgId, t.status),
    ...orgScoped('invitations', t),
  ],
);
registerTable(invitations, 'invitations', { module: 'M03', scope: 'org' });

/** Every change, by whom, when and how. Rows are only ever added. */
export const auditLog = table(
  'audit_log',
  {
    ...appendColumns,
    /** Empty for system jobs. Found through the (org, actor, time) index; a second index on the largest table would only slow every write. */
    actorId: unindexed(uuid().references((): AnyPgColumn => profiles.id)),
    actorKind: enumText(actorKinds).notNull(),
    source: enumText(changeSources).notNull(),
    requestId: text().notNull(),
    /** Kept for filtering inside an organisation's log; never the leading condition. */
    branchId: unindexed(uuid().references(() => branches.id)),
    /** The resource name. */
    entity: text().notNull(),
    entityId: uuid().notNull(),
    /** `create`, `update`, `delete`, or a verb. */
    action: text().notNull(),
    /** `{ field: [before, after] }`, with sensitive values masked. */
    changes: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** One readable line. */
    summary: text(),
    ip: text(),
    userAgent: text(),
    deviceId: uuid().references((): AnyPgColumn => syncDevices.id),
    supportSessionId: uuid().references((): AnyPgColumn => supportSessions.id),
  },
  (t) => [
    ...enumChecks('audit_log', t),
    index('audit_log_entity_idx').on(t.orgId, t.entity, t.entityId, t.createdAt),
    index('audit_log_actor_idx').on(t.orgId, t.actorId, t.createdAt),
    index('audit_log_time_idx').on(t.orgId, t.createdAt),
    // Any member's action is recorded; only staff read the log.
    ...appendOnly('audit_log', t, { insertBy: 'member', readBy: 'staff' }),
  ],
);
registerTable(auditLog, 'audit_log', {
  module: 'M03',
  scope: 'org',
  staff: 'append',
  member: 'insert',
  appendOnly: true,
});

export const loginEvents = table(
  'login_events',
  {
    id: idColumn(),
    createdAt: timestamptz().notNull().defaultNow(),
    /** Empty for a failed attempt on an unknown identifier. */
    userId: uuid().references(() => profiles.id),
    orgId: uuid().references(() => orgs.id),
    event: enumText(loginEventKinds).notNull(),
    /** Hash of the email or phone tried. */
    identifierHash: text(),
    ip: text(),
    userAgent: text(),
  },
  (t) => [
    ...enumChecks('login_events', t),
    index('login_events_user_idx').on(t.userId, t.createdAt),
    index('login_events_org_idx').on(t.orgId, t.createdAt),
    index('login_events_identifier_idx').on(t.identifierHash, t.createdAt),
    ...platformOnly('login_events'),
    ...selfOwned('login_events', t.userId, { access: 'read' }),
  ],
);
registerTable(loginEvents, 'login_events', {
  module: 'M03',
  scope: 'platform',
  self: 'userId',
  selfAccess: 'read',
  appendOnly: true,
});

export const userDevices = table(
  'user_devices',
  {
    id: idColumn(),
    ...auditColumns,
    userId: uuid()
      .notNull()
      .references(() => profiles.id),
    /** A stable per-browser or per-app id. */
    fingerprint: text().notNull(),
    name: text(),
    platform: enumText(devicePlatforms).notNull(),
    pushToken: text(),
    lastSeenAt: timestamptz().notNull(),
  },
  (t) => [
    ...enumChecks('user_devices', t),
    uniqueIndex('user_devices_uq').on(t.userId, t.fingerprint).where(live(t)),
    ...platformOnly('user_devices'),
    ...selfOwned('user_devices', t.userId),
  ],
);
registerTable(userDevices, 'user_devices', { module: 'M03', scope: 'platform', self: 'userId' });

export const userPreferences = table(
  'user_preferences',
  {
    id: idColumn(),
    ...auditColumns,
    userId: uuid()
      .notNull()
      .references(() => profiles.id),
    locale: enumText(locales).notNull().default('en'),
    theme: enumText(themes).notNull().default('system'),
    density: enumText(densities).notNull().default('normal'),
    numberStyle: enumText(numberStyles).notNull().default('international'),
    defaultOrgId: uuid().references(() => orgs.id),
    defaultBranchId: uuid().references(() => branches.id),
  },
  (t) => [
    ...enumChecks('user_preferences', t),
    uniqueIndex('user_preferences_user_uq').on(t.userId),
    ...platformOnly('user_preferences'),
    ...selfOwned('user_preferences', t.userId),
  ],
);
registerTable(userPreferences, 'user_preferences', {
  module: 'M03',
  scope: 'platform',
  self: 'userId',
});

import { sql, type SQL } from 'drizzle-orm';
import { pgPolicy, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { authenticatedRole } from 'drizzle-orm/supabase';

/*
 * Row-level security is the second wall behind the permission checks in the service layer:
 * even a buggy query cannot read another school's rows.
 *
 * The `app.*()` functions are created in the foundation migration and read the signed-in user's
 * claims. Wrapping each call in `(select ...)` lets Postgres evaluate it once per query, not once per row.
 *
 * Templates and their meaning: docs/plan/00-foundation/06-tenancy-roles-and-access.md.
 * A table's scope in its module spec ("branch +family") names the templates it combines.
 */

const sameOrg = (orgId: AnyPgColumn) => sql`${orgId} = (select app.org_id())`;
const isStaff = sql`(select app.is_staff())`;

/** `org`: staff of the school group may read and write. */
export function orgScoped(table: string, t: { orgId: AnyPgColumn }) {
  const allowed = sql`${sameOrg(t.orgId)} and ${isStaff}`;
  return [
    pgPolicy(`${table}_staff`, {
      for: 'all',
      to: authenticatedRole,
      using: allowed,
      withCheck: allowed,
    }),
  ];
}

/** `branch`: as `org`, and staff are also limited to the branches they are assigned to. */
export function branchScoped(table: string, t: { orgId: AnyPgColumn; branchId: AnyPgColumn }) {
  const ownBranch = sql`(not ${isStaff} or (select app.all_branches()) or ${t.branchId} = any ((select app.branch_ids())::uuid[]))`;
  return [
    ...orgScoped(table, t),
    pgPolicy(`${table}_branch`, {
      as: 'restrictive',
      for: 'all',
      to: authenticatedRole,
      using: ownBranch,
      withCheck: ownBranch,
    }),
  ];
}

/** `+family`: a guardian or student may also read rows about their own students. */
export function familyRead(table: string, t: { orgId: AnyPgColumn }, studentId: AnyPgColumn) {
  return [
    pgPolicy(`${table}_family_read`, {
      for: 'select',
      to: authenticatedRole,
      using: sql`${sameOrg(t.orgId)} and ${studentId} = any ((select app.student_ids())::uuid[])`,
    }),
  ];
}

/** `+household`: a guardian or student may also read rows that belong to their family as a whole. */
export function householdRead(table: string, t: { orgId: AnyPgColumn; familyId: AnyPgColumn }) {
  return [
    pgPolicy(`${table}_household_read`, {
      for: 'select',
      to: authenticatedRole,
      using: sql`${sameOrg(t.orgId)} and ${t.familyId} = (select app.family_id())`,
    }),
  ];
}

/**
 * `+self`: the user the row belongs to may read and write it (`access: 'write'`, the default),
 * read and change but neither add nor remove it (`'update'`), or only read it (`'read'`).
 * Pass `orgId` on organisation tables so the row must also belong to the organisation the user is signed in to;
 * leave it out only where a person's rows are meant to be seen across organisations (their own memberships).
 */
export function selfOwned(
  table: string,
  userId: AnyPgColumn,
  options: { access?: 'read' | 'update' | 'write'; orgId?: AnyPgColumn } = {},
) {
  const mine = sql`${userId} = (select app.user_id())`;
  const own = options.orgId ? sql`${sameOrg(options.orgId)} and ${mine}` : mine;
  const read = pgPolicy(`${table}_self_read`, { for: 'select', to: authenticatedRole, using: own });
  if (options.access === 'read') return [read];
  if (options.access === 'update') {
    return [
      read,
      pgPolicy(`${table}_self_update`, {
        for: 'update',
        to: authenticatedRole,
        using: own,
        withCheck: own,
      }),
    ];
  }
  return [
    pgPolicy(`${table}_self`, { for: 'all', to: authenticatedRole, using: own, withCheck: own }),
  ];
}

/**
 * `+cap(name)`: a restrictive policy for the few sensitive tables. A staff user must hold the
 * capability, unless the row is about themselves. Family users are unaffected by it.
 */
export function capRestricted(table: string, capability: string, ownerStaffId?: AnyPgColumn) {
  const own = ownerStaffId ? sql` or ${ownerStaffId} = (select app.staff_id())` : sql``;
  const allowed = sql`(not ${isStaff} or (select app.has_cap(${sql.raw(`'${capability}'`)}))${own})`;
  return [
    pgPolicy(`${table}_cap`, {
      as: 'restrictive',
      for: 'all',
      to: authenticatedRole,
      using: allowed,
      withCheck: allowed,
    }),
  ];
}

/** `global`: everyone signed in may read; only migrations and platform services write. */
export function globalRead(table: string) {
  return [pgPolicy(`${table}_read`, { for: 'select', to: authenticatedRole, using: sql`true` })];
}

/**
 * `platform`: row-level security on with no way in. The table is reachable only through the
 * privileged connection. (A policy that allows nothing is the same as no policy; declaring it
 * makes the generated migration switch row-level security on.)
 */
export function platformOnly(table: string) {
  return [
    pgPolicy(`${table}_platform`, {
      for: 'all',
      to: authenticatedRole,
      using: sql`false`,
      withCheck: sql`false`,
    }),
  ];
}

/**
 * `org … append-only`: rows can be added and read, never changed or removed.
 * `insertBy: 'member'` lets any member of the organisation add a row (audit entries, events);
 * `'staff'` limits inserts to staff.
 */
export function appendOnly(
  table: string,
  t: { orgId: AnyPgColumn },
  options: { insertBy?: 'member' | 'staff'; readBy?: 'staff' | 'member' } = {},
) {
  const member = sameOrg(t.orgId);
  const staff = sql`${member} and ${isStaff}`;
  return [
    pgPolicy(`${table}_insert`, {
      for: 'insert',
      to: authenticatedRole,
      withCheck: options.insertBy === 'staff' ? staff : member,
    }),
    pgPolicy(`${table}_read`, {
      for: 'select',
      to: authenticatedRole,
      using: options.readBy === 'member' ? member : staff,
    }),
  ];
}

/** Any member of the organisation may read (not only staff). For tables families look at, such as branches. */
export function memberRead(table: string, t: { orgId: AnyPgColumn }) {
  return [
    pgPolicy(`${table}_member_read`, {
      for: 'select',
      to: authenticatedRole,
      using: sameOrg(t.orgId),
    }),
  ];
}

/** A hand-written policy, for the few tables whose spec states one in a `Policy:` line. */
export function customPolicy(
  name: string,
  options: {
    for: 'select' | 'insert' | 'update' | 'delete' | 'all';
    using?: SQL;
    withCheck?: SQL;
    restrictive?: boolean;
  },
) {
  return pgPolicy(name, {
    for: options.for,
    to: authenticatedRole,
    ...(options.restrictive && { as: 'restrictive' as const }),
    ...(options.using && { using: options.using }),
    ...(options.withCheck && { withCheck: options.withCheck }),
  });
}

/** Reusable SQL fragments for hand-written policies. */
export const policySql = {
  sameOrg,
  isStaff,
  userId: sql`(select app.user_id())`,
  staffId: sql`(select app.staff_id())`,
  guardianId: sql`(select app.guardian_id())`,
  familyId: sql`(select app.family_id())`,
  studentIds: sql`(select app.student_ids())::uuid[]`,
};

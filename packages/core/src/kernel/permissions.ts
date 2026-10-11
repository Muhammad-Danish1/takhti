import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  capabilitiesFor,
  defaultPermissionsFor,
  type Capability,
  type MemberKind,
  type PermissionKey,
} from '@takhti/contracts';
import {
  adminDb,
  guardians,
  membershipBranches,
  membershipRoles,
  memberships,
  rolePermissions,
  roles,
  studentGuardians,
  students,
} from '@takhti/db';
import type { Ctx } from './context';
import { forbidden } from './errors';

/*
 * Wall 1: every service function starts with `assertCan`. (Wall 2 is row-level security.)
 *
 * A member's roles, permissions and branches are read from the database, never trusted from the
 * token, and remembered for a minute. So a change to someone's role takes effect within a minute,
 * and suspending a membership takes effect at once, because `membershipState` is read on every request.
 *
 * This file is one of the few allowed to use the privileged connection: it has to read a member's
 * access before any row-level-secured transaction for that member can be opened.
 */

/** The standard actions; modules add their own verbs (`collect`, `approve`, `publish`, …). */
export type Action = 'read' | 'create' | 'update' | 'delete' | 'export' | 'manage' | (string & {});

export const can = (ctx: Ctx, resource: string, action: Action): boolean =>
  ctx.actor.permissions.has(`${resource}:${action}`);

export const holds = (ctx: Ctx, permission: PermissionKey): boolean =>
  ctx.actor.permissions.has(permission);

export function assertCan(ctx: Ctx, resource: string, action: Action): void {
  if (!can(ctx, resource, action)) {
    ctx.log.debug({ permission: `${resource}:${action}` }, 'permission refused');
    throw forbidden(
      'You do not have access to do this. Ask an administrator of your school to grant it.',
    );
  }
}

export function assertPermission(ctx: Ctx, permission: PermissionKey): void {
  if (!holds(ctx, permission)) {
    ctx.log.debug({ permission }, 'permission refused');
    throw forbidden(
      'You do not have access to do this. Ask an administrator of your school to grant it.',
    );
  }
}

/** Only staff of the school may pass. Family users get the same answer as for any missing permission. */
export function assertStaff(ctx: Ctx): void {
  if (ctx.actor.kind !== 'staff' && ctx.actor.kind !== 'system') throw forbidden();
}

/** Everything about a membership that decides what its holder may do. */
export interface Access {
  membershipId: string;
  orgId: string;
  userId: string;
  kind: MemberKind;
  roleKeys: readonly string[];
  permissions: ReadonlySet<string>;
  allBranches: boolean;
  branchIds: readonly string[];
  staffId?: string;
  guardianId?: string;
  studentIds: readonly string[];
  familyId?: string;
  caps: readonly Capability[];
}

/**
 * Whose records a family user may reach: a guardian's children and family, or a student's own.
 * A guardian's children are the students they are linked to, not everyone in the family, so a
 * link that is removed (a custody order, a mistake) takes the child out of that guardian's reach.
 * `public.custom_access_token_hook` gives the same answer in SQL for the tokens Supabase issues.
 */
async function resolveFamily(membership: {
  orgId: string;
  kind: MemberKind;
  guardianId: string | null;
  studentId: string | null;
}): Promise<{ studentIds: string[]; familyId?: string }> {
  const db = adminDb();
  if (membership.kind === 'student' && membership.studentId) {
    const [student] = await db
      .select({ familyId: students.familyId })
      .from(students)
      .where(
        and(
          eq(students.id, membership.studentId),
          eq(students.orgId, membership.orgId),
          isNull(students.deletedAt),
        ),
      )
      .limit(1);
    return student
      ? { studentIds: [membership.studentId], familyId: student.familyId }
      : { studentIds: [] };
  }
  if (membership.kind === 'guardian' && membership.guardianId) {
    const [guardian] = await db
      .select({ familyId: guardians.familyId })
      .from(guardians)
      .where(
        and(
          eq(guardians.id, membership.guardianId),
          eq(guardians.orgId, membership.orgId),
          isNull(guardians.deletedAt),
        ),
      )
      .limit(1);
    if (!guardian) return { studentIds: [] };
    const children = await db
      .select({ id: students.id })
      .from(studentGuardians)
      .innerJoin(students, eq(students.id, studentGuardians.studentId))
      .where(
        and(
          eq(studentGuardians.guardianId, membership.guardianId),
          eq(students.orgId, membership.orgId),
          isNull(studentGuardians.deletedAt),
          isNull(students.deletedAt),
        ),
      );
    return { studentIds: children.map((child) => child.id).sort(), familyId: guardian.familyId };
  }
  return { studentIds: [] };
}

const CACHE_MS = 60_000;
const cache = new Map<string, { access: Access; expires: number }>();

/**
 * A membership's access, or undefined when the membership does not exist.
 * Does not look at `status`: use `membershipState` for that, on every request.
 */
export async function loadAccess(membershipId: string): Promise<Access | undefined> {
  const hit = cache.get(membershipId);
  if (hit && hit.expires > Date.now()) return hit.access;

  const db = adminDb();
  const [membership] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.id, membershipId), isNull(memberships.deletedAt)))
    .limit(1);
  if (!membership) {
    cache.delete(membershipId);
    return undefined;
  }

  const heldRoles = await db
    .select({ id: roles.id, key: roles.key })
    .from(membershipRoles)
    .innerJoin(roles, eq(roles.id, membershipRoles.roleId))
    .where(
      and(
        eq(membershipRoles.membershipId, membershipId),
        isNull(membershipRoles.deletedAt),
        isNull(roles.deletedAt),
      ),
    );
  const roleKeys = heldRoles.map((role) => role.key);

  const permissions = new Set<string>();
  // Two roles are computed from the catalogue in code, so a permission added later reaches them at once.
  if (roleKeys.includes('owner'))
    for (const key of defaultPermissionsFor('owner')) permissions.add(key);
  if (roleKeys.includes('auditor'))
    for (const key of defaultPermissionsFor('auditor')) permissions.add(key);
  const stored = heldRoles
    .filter((role) => role.key !== 'owner' && role.key !== 'auditor')
    .map((role) => role.id);
  if (stored.length > 0) {
    const granted = await db
      .select({ key: rolePermissions.permissionKey })
      .from(rolePermissions)
      .where(and(inArray(rolePermissions.roleId, stored), isNull(rolePermissions.deletedAt)));
    for (const row of granted) permissions.add(row.key);
  }

  const branches = await db
    .select({ branchId: membershipBranches.branchId })
    .from(membershipBranches)
    .where(
      and(eq(membershipBranches.membershipId, membershipId), isNull(membershipBranches.deletedAt)),
    );

  const family = await resolveFamily({
    orgId: membership.orgId,
    kind: membership.kind,
    guardianId: membership.guardianId,
    studentId: membership.studentId,
  });

  const access: Access = {
    membershipId,
    orgId: membership.orgId,
    userId: membership.userId,
    kind: membership.kind,
    roleKeys,
    permissions,
    allBranches: membership.allBranches,
    branchIds: branches.map((row) => row.branchId),
    ...(membership.staffId && { staffId: membership.staffId }),
    ...(membership.guardianId && { guardianId: membership.guardianId }),
    studentIds: family.studentIds,
    ...(family.familyId && { familyId: family.familyId }),
    caps: capabilitiesFor(permissions),
  };
  cache.set(membershipId, { access, expires: Date.now() + CACHE_MS });
  return access;
}

/**
 * Forgets what is remembered about one membership, or about every membership of an organisation.
 * Call it after changing roles, role permissions, branches or memberships. Other server processes
 * catch up within a minute.
 */
export function invalidateAccess(membershipOrOrgId?: string): void {
  if (membershipOrOrgId === undefined) {
    cache.clear();
    return;
  }
  if (cache.delete(membershipOrOrgId)) return;
  for (const [key, entry] of cache) if (entry.access.orgId === membershipOrOrgId) cache.delete(key);
}

export interface MembershipState {
  status: 'invited' | 'active' | 'suspended';
  /** Raised to end every session of the membership. A token issued for an older value is refused. */
  tokenVersion: number;
  userId: string;
  orgId: string;
}

/** Read on every request, never cached: a suspension or a forced sign-out must bite immediately. */
export async function membershipState(membershipId: string): Promise<MembershipState | undefined> {
  const [row] = await adminDb()
    .select({
      status: memberships.status,
      tokenVersion: memberships.tokenVersion,
      userId: memberships.userId,
      orgId: memberships.orgId,
    })
    .from(memberships)
    .where(and(eq(memberships.id, membershipId), isNull(memberships.deletedAt)))
    .limit(1);
  return row;
}

import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import {
  builtInRoles,
  coreModuleKeys,
  defaultPermissionsFor,
  moduleKeys,
  onboardingTaskKeys,
  type GenderPolicy,
  type MemberKind,
  type ModuleKey,
  type Province,
  type RoleKey,
} from '@takhti/contracts';
import type { Tx } from './client';
import {
  branches,
  membershipBranches,
  membershipRoles,
  memberships,
  onboardingTasks,
  orgModules,
  orgs,
  profiles,
  rolePermissions,
  roles,
} from './schema';

/*
 * The rows a new school group starts with: the organisation, its branches, the built-in roles with
 * their default permissions, its modules and the setup checklist.
 *
 * Written once and used by everything that creates an organisation: the seed, the test helpers and
 * the platform's "create organisation" service. All of it runs on the privileged connection,
 * because a school that does not exist yet has no member who could do it.
 */

export interface NewBranch {
  id?: string;
  /** 2 to 5 capital letters or digits. */
  code: string;
  name: string;
  nameUr?: string;
  address: string;
  city: string;
  /** Default: mixed. */
  gender?: GenderPolicy;
  phone?: string;
}

export interface NewOrg {
  id?: string;
  name: string;
  nameUr?: string;
  /** The school code students sign in with. Unique across the platform. */
  slug: string;
  city: string;
  province: Province;
  /** 1 to 12. Default: April. */
  academicYearStartMonth?: number;
  /** 1 to 12. Default: July. */
  fiscalYearStartMonth?: number;
  status?: 'provisioning' | 'active';
  branches: readonly NewBranch[];
  /** Optional modules to switch on. `all` switches on every module. Core modules are always on. */
  modules?: readonly ModuleKey[] | 'all';
  /** Written to the audit columns. */
  createdBy?: string;
  now: string;
}

export interface ProvisionedOrg {
  orgId: string;
  /** Branch code → id. */
  branchIds: Record<string, string>;
  /** Role key → id of this organisation's copy of the role. */
  roleIds: Record<string, string>;
}

/** The roles an organisation holds: every built-in role except Takhti's own. */
export const orgRoles = builtInRoles.filter((role) => role.kind !== 'platform');

export async function provisionOrg(tx: Tx, input: NewOrg): Promise<ProvisionedOrg> {
  const orgId = input.id ?? randomUUID();
  const stamps = {
    createdAt: input.now,
    updatedAt: input.now,
    createdBy: input.createdBy ?? null,
    updatedBy: input.createdBy ?? null,
  };

  await tx.insert(orgs).values({
    id: orgId,
    ...stamps,
    name: input.name,
    nameUr: input.nameUr ?? null,
    slug: input.slug,
    city: input.city,
    province: input.province,
    ...(input.academicYearStartMonth !== undefined && {
      academicYearStartMonth: input.academicYearStartMonth,
    }),
    ...(input.fiscalYearStartMonth !== undefined && {
      fiscalYearStartMonth: input.fiscalYearStartMonth,
    }),
    status: input.status ?? 'active',
  });

  const branchIds: Record<string, string> = {};
  for (const branch of input.branches) {
    const id = branch.id ?? randomUUID();
    branchIds[branch.code] = id;
    await tx.insert(branches).values({
      id,
      orgId,
      ...stamps,
      code: branch.code,
      name: branch.name,
      nameUr: branch.nameUr ?? null,
      address: branch.address,
      city: branch.city,
      ...(branch.gender !== undefined && { gender: branch.gender }),
      phone: branch.phone ?? null,
    });
  }

  const roleIds: Record<string, string> = {};
  const roleRows = orgRoles.map((role) => {
    const id = randomUUID();
    roleIds[role.key] = id;
    return {
      id,
      orgId,
      ...stamps,
      key: role.key,
      name: role.name,
      nameUr: role.nameUr,
      level: role.level,
      isSystem: true,
      // These four are defined by the product, not by the school: two are computed, two belong to families.
      isLocked: ['owner', 'auditor', 'guardian', 'student'].includes(role.key),
      defaultAllBranches: role.allBranches,
    };
  });
  await tx.insert(roles).values(roleRows as never);

  // The owner and the auditor are computed from the catalogue when access is loaded, so they need no rows.
  const grants = orgRoles
    .filter((role) => role.key !== 'owner' && role.key !== 'auditor')
    .flatMap((role) =>
      defaultPermissionsFor(role.key).map((permissionKey) => ({
        id: randomUUID(),
        orgId,
        ...stamps,
        roleId: roleIds[role.key] as string,
        permissionKey,
      })),
    );
  for (let start = 0; start < grants.length; start += 1000) {
    await tx.insert(rolePermissions).values(grants.slice(start, start + 1000));
  }

  const core = new Set<string>(coreModuleKeys);
  const chosen =
    input.modules === 'all'
      ? moduleKeys.filter((key) => !core.has(key))
      : (input.modules ?? []).filter((key) => !core.has(key));
  if (chosen.length > 0) {
    await tx.insert(orgModules).values(
      chosen.map((moduleKey) => ({
        id: randomUUID(),
        orgId,
        ...stamps,
        moduleKey,
        isEnabled: true,
        source: 'plan' as const,
      })),
    );
  }

  await tx.insert(onboardingTasks).values(
    onboardingTaskKeys.map((key) => ({
      id: randomUUID(),
      orgId,
      ...stamps,
      key,
      status: 'pending' as const,
    })),
  );

  return { orgId, branchIds, roleIds };
}

export interface NewProfile {
  /** The Supabase Auth user's id. */
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  isPlatform?: boolean;
  now: string;
}

/** Creates the profile of a sign-in account, or leaves an existing one alone. */
export async function ensureProfile(tx: Tx, input: NewProfile): Promise<void> {
  await tx
    .insert(profiles)
    .values({
      id: input.id,
      fullName: input.fullName,
      email: input.email?.toLowerCase() ?? null,
      phone: input.phone ?? null,
      isPlatform: input.isPlatform ?? false,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoNothing({ target: profiles.id });
}

export interface NewMember {
  id?: string;
  orgId: string;
  userId: string;
  kind: MemberKind;
  /** The staff, guardian or student record this sign-in belongs to. */
  personId: string;
  roleKeys: readonly RoleKey[];
  /** Branch ids the member may work in. Ignored when `allBranches` is true. */
  branchIds?: readonly string[];
  allBranches?: boolean;
  status?: 'invited' | 'active' | 'suspended';
  createdBy?: string;
  now: string;
}

/** Joins a sign-in account to an organisation, with roles and branches. Returns the membership id. */
export async function addMember(tx: Tx, input: NewMember): Promise<string> {
  const id = input.id ?? randomUUID();
  const stamps = {
    createdAt: input.now,
    updatedAt: input.now,
    createdBy: input.createdBy ?? null,
    updatedBy: input.createdBy ?? null,
  };
  await tx.insert(memberships).values({
    id,
    orgId: input.orgId,
    ...stamps,
    userId: input.userId,
    kind: input.kind,
    staffId: input.kind === 'staff' ? input.personId : null,
    guardianId: input.kind === 'guardian' ? input.personId : null,
    studentId: input.kind === 'student' ? input.personId : null,
    status: input.status ?? 'active',
    allBranches: input.allBranches ?? false,
  });

  if (input.roleKeys.length > 0) {
    const held = await tx
      .select({ id: roles.id, key: roles.key })
      .from(roles)
      .where(and(eq(roles.orgId, input.orgId), isNull(roles.deletedAt)));
    const byKey = new Map(held.map((role) => [role.key, role.id]));
    const rows = input.roleKeys.map((key) => {
      const roleId = byKey.get(key);
      if (!roleId) throw new Error(`Organisation ${input.orgId} has no role "${key}"`);
      return { id: randomUUID(), orgId: input.orgId, ...stamps, membershipId: id, roleId };
    });
    await tx.insert(membershipRoles).values(rows);
  }

  if (!input.allBranches && input.branchIds && input.branchIds.length > 0) {
    await tx.insert(membershipBranches).values(
      input.branchIds.map((branchId) => ({
        id: randomUUID(),
        orgId: input.orgId,
        ...stamps,
        membershipId: id,
        branchId,
      })),
    );
  }
  return id;
}

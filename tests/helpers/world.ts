import { randomUUID } from 'node:crypto';
import type { ErrorCode, ModuleKey, RoleKey } from '@takhti/contracts';
import {
  actorFor,
  invalidateAccess,
  invalidateModules,
  runAs,
  setClockForTests,
  toErrorResponse,
  type Actor,
  type Ctx,
} from '@takhti/core';
import { addMember, ensureProfile, orgRoles, provisionOrg, withAdminTx, type Tx } from '@takhti/db';
import { expect } from 'vitest';
import { linkGuardian, makeGuardian, makeStaff, makeStudent } from './people';

/*
 * A small world for service and API tests: a school group with two branches and one signed-in
 * person for every built-in role, made the same way the product makes them.
 *
 *   const school = await seedOrg();
 *   const principal = await school.actor('principal');
 *   await as(principal, (ctx) => branchesService.list(ctx, …));
 *
 * Every call to `seedOrg` makes a separate organisation, so tests in one file never see each
 * other's rows, and `await seedOrg()` twice gives two tenants for isolation tests.
 *
 * Each person has a real staff, guardian or student record. The first guardian and the first
 * student of a school are parent and child, in one family; later ones get families of their own.
 */

export const TEST_NOW = '2026-10-12T06:00:00.000Z'; // a Monday, 11:00 in Pakistan

let counter = 0;

export interface TestOrg {
  orgId: string;
  slug: string;
  /** Main Campus. */
  mainBranchId: string;
  /** City Campus. */
  cityBranchId: string;
  roleIds: Record<string, string>;
  /**
   * The signed-in person holding this role. Group roles see every branch; the rest work at Main Campus
   * unless `branch: 'city'` or `'both'` is given. Each call with the same arguments returns the same person.
   */
  actor(
    role: RoleKey,
    options?: { branch?: 'main' | 'city' | 'both'; extraRoles?: RoleKey[] },
  ): Promise<Actor>;
  /** Adds a person without going through `actor`, for tests about memberships themselves. Returns the ids. */
  member(input: {
    role: RoleKey;
    branch?: 'main' | 'city' | 'both';
    status?: 'invited' | 'active' | 'suspended';
    userId?: string;
  }): Promise<{ userId: string; membershipId: string; personId: string }>;
}

export interface SeedOrgOptions {
  /** Optional modules to switch on. Default: all of them. */
  modules?: readonly ModuleKey[] | 'all';
  status?: 'provisioning' | 'active';
}

const names: Partial<Record<RoleKey, string>> = {
  owner: 'Tariq Mehmood',
  director: 'Saima Tariq',
  principal: 'Rubina Qureshi',
  accountant: 'Imran Sheikh',
  cashier: 'Bilal Aslam',
  class_teacher: 'Nadia Hussain',
  subject_teacher: 'Usman Ghani',
  guardian: 'Farhan Ahmed',
  student: 'Ayesha Ahmed',
  driver: 'Ghulam Rasool',
};

export async function seedOrg(options: SeedOrgOptions = {}): Promise<TestOrg> {
  const n = ++counter;
  const suffix = randomUUID().slice(0, 8);
  const slug = `school-${n}-${suffix}`;
  const provisioned = await withAdminTx((tx) =>
    provisionOrg(tx, {
      name: `Roshan Public School ${n}`,
      nameUr: 'روشن پبلک اسکول',
      slug,
      city: 'Lahore',
      province: 'punjab',
      status: options.status ?? 'active',
      modules: options.modules ?? 'all',
      branches: [
        { code: 'MC', name: 'Main Campus', address: '12 Canal Road', city: 'Lahore' },
        { code: 'CC', name: 'City Campus', address: '48 Mall Road', city: 'Lahore' },
      ],
      now: TEST_NOW,
    }),
  );
  const mainBranchId = provisioned.branchIds.MC as string;
  const cityBranchId = provisioned.branchIds.CC as string;
  const cache = new Map<string, Promise<Actor>>();
  const base = { orgId: provisioned.orgId, now: TEST_NOW };
  const teachingRoles: readonly RoleKey[] = ['class_teacher', 'subject_teacher', 'coordinator'];
  const household: { familyId?: string; guardianId?: string; studentId?: string } = {};

  /** The staff, guardian or student record behind a sign-in. */
  async function person(
    tx: Tx,
    role: RoleKey,
    kind: 'staff' | 'guardian' | 'student',
    fullName: string,
    branchId: string,
  ): Promise<string> {
    if (kind === 'staff')
      return makeStaff(tx, { ...base, branchId, fullName, teaching: teachingRoles.includes(role) });

    const first = kind === 'guardian' ? !household.guardianId : !household.studentId;
    const familyId = first ? household.familyId : undefined;
    if (kind === 'guardian') {
      const made = await makeGuardian(tx, { ...base, fullName, ...(familyId && { familyId }) });
      if (first) {
        household.familyId = made.familyId;
        household.guardianId = made.guardianId;
        if (household.studentId)
          await linkGuardian(tx, {
            ...base,
            studentId: household.studentId,
            guardianId: made.guardianId,
          });
      }
      return made.guardianId;
    }
    const made = await makeStudent(tx, {
      ...base,
      branchId,
      fullName,
      ...(familyId && { familyId }),
    });
    if (first) {
      household.familyId = made.familyId;
      household.studentId = made.studentId;
      if (household.guardianId)
        await linkGuardian(tx, {
          ...base,
          studentId: made.studentId,
          guardianId: household.guardianId,
        });
    }
    return made.studentId;
  }

  // People are made one at a time, so two tests asking at once cannot both be "the first guardian".
  let queue: Promise<unknown> = Promise.resolve();
  const oneAtATime = <T>(work: () => Promise<T>): Promise<T> => {
    const run = queue.then(work);
    queue = run.catch(() => undefined);
    return run;
  };

  const member: TestOrg['member'] = (input) => oneAtATime(() => addPerson(input));

  const addPerson: TestOrg['member'] = async (input) => {
    const definition = orgRoles.find((role) => role.key === input.role);
    if (!definition) throw new Error(`"${input.role}" is not a role an organisation holds`);
    const userId = input.userId ?? randomUUID();
    const branchIds =
      input.branch === 'city'
        ? [cityBranchId]
        : input.branch === 'both'
          ? [mainBranchId, cityBranchId]
          : [mainBranchId];
    const kind = definition.kind as 'staff' | 'guardian' | 'student';
    const fullName = names[input.role] ?? definition.name;
    return withAdminTx(async (tx) => {
      await ensureProfile(tx, {
        id: userId,
        fullName,
        email: `${input.role}.${suffix}.${randomUUID().slice(0, 4)}@roshan.test`,
        now: TEST_NOW,
      });
      const personId = await person(tx, input.role, kind, fullName, branchIds[0] ?? mainBranchId);
      const membershipId = await addMember(tx, {
        orgId: provisioned.orgId,
        userId,
        kind,
        personId,
        roleKeys: [input.role],
        allBranches: definition.allBranches,
        branchIds: kind === 'staff' ? branchIds : [],
        status: input.status ?? 'active',
        now: TEST_NOW,
      });
      return { userId, membershipId, personId };
    });
  };

  return {
    orgId: provisioned.orgId,
    slug,
    mainBranchId,
    cityBranchId,
    roleIds: provisioned.roleIds,
    member,
    actor(role, actorOptions = {}) {
      const key = `${role}:${actorOptions.branch ?? 'main'}:${(actorOptions.extraRoles ?? []).join(',')}`;
      let pending = cache.get(key);
      if (!pending) {
        pending = (async () => {
          const created = await member({
            role,
            ...(actorOptions.branch && { branch: actorOptions.branch }),
          });
          if (actorOptions.extraRoles?.length) {
            const { membershipRoles } = await import('@takhti/db');
            await withAdminTx((tx) =>
              tx.insert(membershipRoles).values(
                (actorOptions.extraRoles ?? []).map((extra) => ({
                  id: randomUUID(),
                  orgId: provisioned.orgId,
                  membershipId: created.membershipId,
                  roleId: provisioned.roleIds[extra] as string,
                  createdAt: TEST_NOW,
                  updatedAt: TEST_NOW,
                })),
              ),
            );
            invalidateAccess(created.membershipId);
          }
          return actorFor({ userId: created.userId, membershipId: created.membershipId });
        })();
        cache.set(key, pending);
      }
      return pending;
    },
  };
}

let requests = 0;

/** Runs `work` as the actor, in one transaction, exactly like a request. */
export const as = <T>(actor: Actor, work: (ctx: Ctx) => Promise<T>): Promise<T> =>
  runAs(actor, { requestId: `test-${++requests}` }, work);

/** Asserts that `work` fails with the given API error code, and returns the error body for further checks. */
export async function expectError(code: ErrorCode, work: () => Promise<unknown>) {
  let thrown: unknown;
  try {
    await work();
  } catch (error) {
    thrown = error;
  }
  if (thrown === undefined) throw new Error(`Expected ${code}, but nothing was thrown`);
  const reply = toErrorResponse(thrown, 'test');
  if (reply.unexpected && code !== 'INTERNAL') throw thrown;
  expect(reply.body.error.code, reply.body.error.message).toBe(code);
  return reply.body.error;
}

/** Fixes the clock for every unit of work started afterwards. Call `freezeTime()` to return to the real clock. */
export function freezeTime(iso: string | undefined = undefined): void {
  setClockForTests(iso);
}

/** Forgets cached access and module switches, after a test changes them directly in the database. */
export function forgetCaches(): void {
  invalidateAccess();
  invalidateModules();
}

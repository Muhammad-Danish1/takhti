import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { defaultPermissionsFor, permissionKeys } from '@takhti/contracts';
import {
  actorFor,
  assertBranch,
  assertCan,
  assertNotSelf,
  assertOwnStudent,
  can,
  invalidateAccess,
  loadAccess,
  membershipsOf,
  platformAdminFor,
  runAs,
  runAsPlatform,
  runAsSystem,
  type Actor,
} from '@takhti/core';
import {
  adminDb,
  ensureProfile,
  memberships,
  orgs,
  platformAdmins,
  platformAuditLog,
  rolePermissions,
  rooms,
  rowsOf,
  withAdminTx,
} from '@takhti/db';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { as, expectError, freezeTime, seedOrg, TEST_NOW, type TestOrg } from '../../helpers/world';

let db: TestDb;
let school: TestOrg;
let other: TestOrg;
let principal: Actor;

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  other = await seedOrg();
  principal = await school.actor('principal');
});
afterAll(async () => {
  freezeTime();
  await db.destroy();
});

describe('a unit of work', () => {
  it('tells Postgres who is acting, so row-level security sees the same person', async () => {
    const seen = await as(
      principal,
      async (ctx) =>
        rowsOf<Record<string, unknown>>(
          await ctx.db.execute(
            sql`select app.org_id()::text as org, app.user_id()::text as "user", app.is_staff() as staff, app.all_branches() as all_branches, app.branch_ids()::text[] as branches, current_user::text as role`,
          ),
        )[0],
    );
    expect(seen).toEqual({
      org: school.orgId,
      user: principal.userId,
      staff: true,
      all_branches: false,
      branches: [school.mainBranchId],
      role: 'authenticated',
    });
  });

  it('keeps one moment for its whole length', async () => {
    freezeTime('2026-10-12T19:30:00.000Z');
    const { now, today, later } = await as(principal, async (ctx) => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return { now: ctx.now, today: ctx.today, later: ctx.now };
    });
    expect(now).toBe('2026-10-12T19:30:00.000Z');
    expect(later).toBe(now);
    // Half past midnight in Pakistan: already the 13th.
    expect(today).toBe('2026-10-13');
    freezeTime();
  });

  it('undoes everything when the work throws', async () => {
    const roomId = randomUUID();
    await expect(
      as(principal, async (ctx) => {
        await ctx.db.insert(rooms).values({
          id: roomId,
          orgId: school.orgId,
          branchId: school.mainBranchId,
          name: 'Vanishing Room',
        });
        throw new Error('something went wrong later');
      }),
    ).rejects.toThrow('something went wrong later');
    const found = await adminDb().select().from(rooms).where(eq(rooms.id, roomId));
    expect(found).toEqual([]);
  });

  it('refuses to open a second unit of work inside the first', async () => {
    await expect(as(principal, () => as(principal, async () => 'inner'))).rejects.toThrow(
      /inside runAs/,
    );
    await expect(
      as(principal, () => runAsSystem(school.orgId, {}, async () => 'inner')),
    ).rejects.toThrow(/inside runAs/);
    // Afterwards the next one opens normally.
    await expect(as(principal, async () => 'fine')).resolves.toBe('fine');
  });

  it('a platform actor cannot use runAs', async () => {
    await expect(runAs({ ...principal, kind: 'platform' }, {}, async () => 'x')).rejects.toThrow(
      /runAsPlatform/,
    );
  });

  it('a system job is confined to its organisation by row-level security', async () => {
    const roomId = randomUUID();
    await runAsSystem(school.orgId, {}, async (ctx) => {
      expect(ctx.source).toBe('job');
      expect(ctx.actor.kind).toBe('system');
      await ctx.db.insert(rooms).values({
        id: roomId,
        orgId: school.orgId,
        branchId: school.cityBranchId,
        name: 'System Room',
      });
    });
    const fromOther = await runAsSystem(other.orgId, {}, (ctx) =>
      ctx.db.select().from(rooms).where(eq(rooms.id, roomId)),
    );
    expect(fromOther).toEqual([]);
    await expect(
      runAsSystem(other.orgId, {}, (ctx) =>
        ctx.db
          .insert(rooms)
          .values({ orgId: school.orgId, branchId: school.mainBranchId, name: 'Smuggled' }),
      ),
    ).rejects.toThrow();
  });

  it('platform work is privileged and always leaves a record, saved with the work or not at all', async () => {
    const adminUser = randomUUID();
    await withAdminTx((tx) =>
      ensureProfile(tx, {
        id: adminUser,
        fullName: 'Takhti Support',
        isPlatform: true,
        now: TEST_NOW,
      }),
    );

    const names = await runAsPlatform(
      { userId: adminUser, role: 'support_agent' },
      { action: 'org.list', detail: { reason: 'test' } },
      (ctx) => ctx.db.select({ id: orgs.id }).from(orgs),
    );
    expect(names.length).toBeGreaterThanOrEqual(2);
    const logged = await adminDb()
      .select()
      .from(platformAuditLog)
      .where(eq(platformAuditLog.adminUserId, adminUser));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      action: 'org.list',
      targetOrgId: null,
      detail: { reason: 'test' },
    });

    await expect(
      runAsPlatform(
        { userId: adminUser, role: 'support_agent' },
        { action: 'org.suspend', targetOrgId: school.orgId },
        async () => {
          throw new Error('failed half way');
        },
      ),
    ).rejects.toThrow('failed half way');
    expect(
      await adminDb()
        .select()
        .from(platformAuditLog)
        .where(eq(platformAuditLog.adminUserId, adminUser)),
    ).toHaveLength(1);
  });
});

describe('access', () => {
  it('a role holds exactly the default permissions of the catalogue', async () => {
    const accountant = await school.actor('accountant');
    expect([...accountant.permissions].sort()).toEqual(
      [...defaultPermissionsFor('accountant')].sort(),
    );
    expect(accountant.roleKeys).toEqual(['accountant']);
    expect(accountant.kind).toBe('staff');
    expect(accountant.branchIds).toEqual([school.mainBranchId]);
    expect(accountant.allBranches).toBe(false);
  });

  it('the owner holds every permission, and the auditor every one that only looks', async () => {
    const owner = await school.actor('owner');
    expect([...owner.permissions].sort()).toEqual([...permissionKeys].sort());
    expect(owner.allBranches).toBe(true);

    const auditor = await school.actor('auditor');
    expect(auditor.permissions.size).toBeGreaterThan(0);
    for (const key of auditor.permissions) expect(key).toMatch(/:(read|reports|export)$/);
    expect(auditor.permissions.has('branches:read')).toBe(true);
    expect(auditor.permissions.has('branches:update')).toBe(false);
  });

  it('several roles give the union of their permissions', async () => {
    const both = await school.actor('cashier', { extraRoles: ['admissions_officer'] });
    expect(both.permissions.has('invitations:create')).toBe(true);
    expect([...both.roleKeys].sort()).toEqual(['admissions_officer', 'cashier']);
  });

  it('a family user is not staff and sees no branch list', async () => {
    const guardian = await school.actor('guardian');
    expect(guardian.kind).toBe('guardian');
    expect(guardian.branchIds).toEqual([]);
    expect(guardian.guardianId).toBeDefined();
    const seen = await as(
      guardian,
      async (ctx) =>
        rowsOf<{ staff: boolean }>(await ctx.db.execute(sql`select app.is_staff() as staff`))[0],
    );
    expect(seen?.staff).toBe(false);
  });

  it('assertCan lets a holder through and refuses anyone else with FORBIDDEN', async () => {
    const driver = await school.actor('driver');
    await as(principal, async (ctx) => {
      expect(can(ctx, 'branches', 'update')).toBe(true);
      assertCan(ctx, 'branches', 'update');
    });
    await expectError('FORBIDDEN', () =>
      as(driver, async (ctx) => assertCan(ctx, 'branches', 'update')),
    );
  });

  it('a change to a role takes effect once the cached access is forgotten', async () => {
    const cashier = await school.member({ role: 'cashier' });
    const before = await loadAccess(cashier.membershipId);
    expect(before?.permissions.has('org-settings:update')).toBe(false);

    await withAdminTx((tx) =>
      tx.insert(rolePermissions).values({
        orgId: school.orgId,
        roleId: school.roleIds.cashier as string,
        permissionKey: 'org-settings:update',
      }),
    );
    expect((await loadAccess(cashier.membershipId))?.permissions.has('org-settings:update')).toBe(
      false,
    ); // still remembered
    invalidateAccess(school.orgId);
    expect((await loadAccess(cashier.membershipId))?.permissions.has('org-settings:update')).toBe(
      true,
    );

    await withAdminTx((tx) =>
      tx
        .delete(rolePermissions)
        .where(eq(rolePermissions.permissionKey, 'org-settings:update'))
        .returning(),
    );
    invalidateAccess();
  });

  it('scope helpers: branches, own children, and never deciding for oneself', async () => {
    const guardian = await school.actor('guardian');
    await as(principal, async (ctx) => {
      expect(() => assertBranch(ctx, school.mainBranchId)).not.toThrow();
      expect(() => assertBranch(ctx, school.cityBranchId)).toThrow();
      expect(() => assertNotSelf(ctx, principal.userId)).toThrow();
      expect(() => assertNotSelf(ctx, randomUUID())).not.toThrow();
      expect(() => assertOwnStudent(ctx, randomUUID())).not.toThrow(); // staff are limited by permissions instead
    });
    await as(guardian, async (ctx) => {
      expect(() => assertOwnStudent(ctx, randomUUID())).toThrow();
    });
  });
});

describe('signing in to a school', () => {
  it('one active membership is chosen without asking', async () => {
    const person = await school.member({ role: 'receptionist' });
    const actor = await actorFor({ userId: person.userId });
    expect(actor.membershipId).toBe(person.membershipId);
    expect(actor.orgId).toBe(school.orgId);
  });

  it('nobody gets in without a membership', async () => {
    await expectError('FORBIDDEN', () => actorFor({ userId: randomUUID() }));
  });

  it('a person in two schools must choose, and then gets exactly that one', async () => {
    const first = await school.member({ role: 'subject_teacher' });
    const second = await other.member({ role: 'guardian', userId: first.userId });
    const error = await expectError('FORBIDDEN', () => actorFor({ userId: first.userId }));
    expect(error.message).toMatch(/Choose which school/);
    expect((await membershipsOf(first.userId)).map((m) => m.orgId).sort()).toEqual(
      [school.orgId, other.orgId].sort(),
    );
    expect(
      (await actorFor({ userId: first.userId, membershipId: second.membershipId })).orgId,
    ).toBe(other.orgId);
  });

  it('a membership that belongs to someone else is refused in the same words as none at all', async () => {
    const mine = await school.member({ role: 'librarian' });
    const theirs = await school.member({ role: 'nurse' });
    const error = await expectError('FORBIDDEN', () =>
      actorFor({ userId: mine.userId, membershipId: theirs.membershipId }),
    );
    expect(error.message).toBe('This account is not linked to a school yet');
  });

  it('an invitation not yet accepted does not let anyone in', async () => {
    const invited = await school.member({ role: 'coordinator', status: 'invited' });
    await expectError('FORBIDDEN', () =>
      actorFor({ userId: invited.userId, membershipId: invited.membershipId }),
    );
    await expectError('FORBIDDEN', () => actorFor({ userId: invited.userId }));
  });

  it('a suspension bites on the very next request, with no cache in the way', async () => {
    const person = await school.member({ role: 'store_keeper' });
    await actorFor({ userId: person.userId, membershipId: person.membershipId });
    await withAdminTx((tx) =>
      tx
        .update(memberships)
        .set({ status: 'suspended' })
        .where(eq(memberships.id, person.membershipId)),
    );
    const error = await expectError('FORBIDDEN', () =>
      actorFor({ userId: person.userId, membershipId: person.membershipId }),
    );
    expect(error.message).toMatch(/suspended/);
  });

  it('a token issued before a forced sign-out is refused', async () => {
    const person = await school.member({ role: 'hostel_warden' });
    await expect(
      actorFor({ userId: person.userId, membershipId: person.membershipId, tokenVersion: 1 }),
    ).resolves.toBeDefined();
    await withAdminTx((tx) =>
      tx
        .update(memberships)
        .set({ tokenVersion: 2 })
        .where(eq(memberships.id, person.membershipId)),
    );
    await expectError('UNAUTHENTICATED', () =>
      actorFor({ userId: person.userId, membershipId: person.membershipId, tokenVersion: 1 }),
    );
    await expect(
      actorFor({ userId: person.userId, membershipId: person.membershipId, tokenVersion: 2 }),
    ).resolves.toBeDefined();
  });

  it('a suspended or unfinished school lets nobody in', async () => {
    const suspended = await seedOrg();
    const person = await suspended.member({ role: 'principal' });
    await withAdminTx((tx) =>
      tx.update(orgs).set({ status: 'suspended' }).where(eq(orgs.id, suspended.orgId)),
    );
    await expectError('FORBIDDEN', () =>
      actorFor({ userId: person.userId, membershipId: person.membershipId }),
    );

    const unfinished = await seedOrg({ status: 'provisioning' });
    const early = await unfinished.member({ role: 'owner' });
    await expectError('FORBIDDEN', () =>
      actorFor({ userId: early.userId, membershipId: early.membershipId }),
    );
  });

  it('platform staff need an active record and two-factor sign-in', async () => {
    const userId = randomUUID();
    await withAdminTx((tx) =>
      ensureProfile(tx, { id: userId, fullName: 'New Admin', isPlatform: true, now: TEST_NOW }),
    );
    await expectError('FORBIDDEN', () => platformAdminFor(userId));
    await withAdminTx((tx) => tx.insert(platformAdmins).values({ userId, role: 'super_admin' }));
    const error = await expectError('FORBIDDEN', () => platformAdminFor(userId));
    expect(error.message).toMatch(/two-factor/);
    await withAdminTx((tx) =>
      tx
        .update(platformAdmins)
        .set({ mfaEnrolledAt: TEST_NOW })
        .where(eq(platformAdmins.userId, userId)),
    );
    expect(await platformAdminFor(userId)).toEqual({ userId, role: 'super_admin' });
    await withAdminTx((tx) =>
      tx.update(platformAdmins).set({ isActive: false }).where(eq(platformAdmins.userId, userId)),
    );
    await expectError('FORBIDDEN', () => platformAdminFor(userId));
  });
});

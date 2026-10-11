import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adminDb,
  registeredTables,
  rowsOf,
  withAdminTx,
  withUserTx,
  type DbClaims,
} from '@takhti/db';
import { permissionCatalogue } from '@takhti/contracts';
import { createTestDb, type TestDb } from '../helpers/test-db';

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.destroy();
});

const claims: DbClaims = {
  sub: '0198c1de-0000-7000-8000-000000000001',
  role: 'authenticated',
  org_id: '0198c1de-0000-7000-8000-00000000000a',
  kind: 'staff',
  all_branches: false,
  branch_ids: ['0198c1de-0000-7000-8000-0000000000b1', '0198c1de-0000-7000-8000-0000000000b2'],
  student_ids: ['0198c1de-0000-7000-8000-0000000000c1'],
  staff_id: '0198c1de-0000-7000-8000-0000000000d1',
  guardian_id: '0198c1de-0000-7000-8000-0000000000e1',
  family_id: '0198c1de-0000-7000-8000-0000000000f1',
  caps: ['payroll', 'health'],
};

const one = async <T>(run: Promise<unknown>): Promise<T> => rowsOf<T>(await run)[0] as T;

/** Every view in the database, in name order. */
const views = ['house_point_totals', 'staff_directory'];

describe('foundation migration', () => {
  it('every helper function reads the claims the API sets', async () => {
    const row = await withUserTx(claims, (tx) =>
      one<Record<string, unknown>>(
        tx.execute(sql`
          select app.org_id()::text as org_id, app.user_id()::text as user_id, app.kind() as kind,
                 app.is_staff() as is_staff, app.all_branches() as all_branches,
                 app.branch_ids()::text[] as branch_ids, app.student_ids()::text[] as student_ids,
                 app.staff_id()::text as staff_id, app.guardian_id()::text as guardian_id,
                 app.family_id()::text as family_id, app.has_cap('payroll') as has_payroll,
                 app.has_cap('hr') as has_hr, current_user::text as acting_as
        `),
      ),
    );
    expect(row).toEqual({
      org_id: claims.org_id,
      user_id: claims.sub,
      kind: 'staff',
      is_staff: true,
      all_branches: false,
      branch_ids: claims.branch_ids,
      student_ids: claims.student_ids,
      staff_id: claims.staff_id,
      guardian_id: claims.guardian_id,
      family_id: claims.family_id,
      has_payroll: true,
      has_hr: false,
      acting_as: 'authenticated',
    });
  });

  it('with no claims every helper answers null, false or empty: no claims, no rows', async () => {
    const row = await withAdminTx(async (tx) => {
      await tx.execute(sql`select set_config('request.jwt.claims', '', true)`);
      return one<Record<string, unknown>>(
        tx.execute(sql`
          select app.org_id() as org_id, app.user_id() as user_id, app.kind() as kind, app.is_staff() as is_staff,
                 app.all_branches() as all_branches, cardinality(app.branch_ids()) as branches,
                 cardinality(app.student_ids()) as students, app.staff_id() as staff_id,
                 app.family_id() as family_id, app.has_cap('hr') as has_hr
        `),
      );
    });
    expect(row).toEqual({
      org_id: null,
      user_id: null,
      kind: null,
      is_staff: false,
      all_branches: false,
      branches: 0,
      students: 0,
      staff_id: null,
      family_id: null,
      has_hr: false,
    });
  });

  it('a claim that is not a list is treated as an empty list, not as an error', async () => {
    const broken = { ...claims, branch_ids: 'all', caps: 'payroll' } as unknown as DbClaims;
    const row = await withUserTx(broken, (tx) =>
      one<Record<string, unknown>>(
        tx.execute(
          sql`select cardinality(app.branch_ids()) as branches, app.has_cap('payroll') as has_payroll`,
        ),
      ),
    );
    expect(row).toEqual({ branches: 0, has_payroll: false });
  });

  it('claims and role disappear when the transaction ends', async () => {
    await withUserTx(claims, (tx) => tx.execute(sql`select 1`));
    const row = await withAdminTx((tx) =>
      one<{ org_id: string | null; acting_as: string }>(
        tx.execute(sql`select app.org_id()::text as org_id, current_user::text as acting_as`),
      ),
    );
    expect(row.org_id).toBeNull();
    expect(row.acting_as).not.toBe('authenticated');
  });

  it("app.today() is today's date in Pakistan", async () => {
    const row = await one<{ today: string; expected: string }>(
      adminDb().execute(
        sql`select app.today()::text as today, (now() at time zone 'Asia/Karachi')::date::text as expected`,
      ),
    );
    expect(row.today).toBe(row.expected);
    expect(row.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('database conventions', () => {
  it('every table in the database is registered, and every registered table exists', async () => {
    const rows = rowsOf<{ name: string }>(
      await adminDb().execute(
        sql`select tablename as name from pg_tables where schemaname = 'public' order by 1`,
      ),
    );
    expect(rows.map((row) => row.name)).toEqual(
      registeredTables()
        .map((table) => table.name)
        .sort(),
    );
  });

  it('row-level security is on for every table', async () => {
    const rows = rowsOf<{ name: string }>(
      await adminDb().execute(sql`
        select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
      `),
    );
    expect(rows).toEqual([]);
  });

  it('every table with updated_at has the safety-net trigger', async () => {
    const rows = rowsOf<{ name: string }>(
      await adminDb().execute(sql`
        select c.relname as name
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_at' and not a.attisdropped
        where n.nspname = 'public' and c.relkind = 'r'
          and not exists (select from pg_trigger g where g.tgrelid = c.oid and g.tgname = 'touch_updated_at')
      `),
    );
    expect(rows).toEqual([]);
  });

  it('append-only tables, and only those, refuse changes by trigger', async () => {
    const rows = rowsOf<{ name: string }>(
      await adminDb().execute(sql`
        select c.relname as name from pg_class c join pg_trigger g on g.tgrelid = c.oid and g.tgname = 'forbid_change'
        join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' order by 1
      `),
    );
    expect(rows.map((row) => row.name)).toEqual(
      registeredTables()
        .filter((table) => table.appendOnly)
        .map((table) => table.name)
        .sort(),
    );
  });

  it('every foreign key column leads an index (the tenant column aside), so joins never scan a whole table', async () => {
    const rows = rowsOf<{ table_name: string; column_name: string }>(
      await adminDb().execute(sql`
        select c.conrelid::regclass::text as table_name, a.attname as column_name
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        where c.contype = 'f' and c.connamespace = 'public'::regnamespace and cardinality(c.conkey) = 1
          and a.attname <> 'org_id'
          and not exists (
            select from pg_index i
            where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
          )
        order by 1, 2
      `),
    );
    // Deliberate exceptions, each marked `unindexed(...)` with its reason in the table file.
    expect(rows.map((row) => `${row.table_name}.${row.column_name}`)).toEqual([
      'audit_log.actor_id',
      'audit_log.branch_id',
    ]);
  });

  it('signed-in users hold only the four row operations on tables, may only read views, and visitors hold nothing', async () => {
    const rows = rowsOf<{ grantee: string; kind: string; privilege: string; relations: number }>(
      await adminDb().execute(sql`
        select g.grantee::text, t.table_type::text as kind, g.privilege_type::text as privilege, count(*)::int as relations
        from information_schema.role_table_grants g
        join information_schema.tables t on t.table_schema = g.table_schema and t.table_name = g.table_name
        where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated', 'takhti_api', 'PUBLIC')
        group by 1, 2, 3 order by 1, 2, 3
      `),
    );
    const total = registeredTables().length;
    expect(rows).toEqual([
      { grantee: 'authenticated', kind: 'BASE TABLE', privilege: 'DELETE', relations: total },
      { grantee: 'authenticated', kind: 'BASE TABLE', privilege: 'INSERT', relations: total },
      { grantee: 'authenticated', kind: 'BASE TABLE', privilege: 'SELECT', relations: total },
      { grantee: 'authenticated', kind: 'BASE TABLE', privilege: 'UPDATE', relations: total },
      { grantee: 'authenticated', kind: 'VIEW', privilege: 'SELECT', relations: views.length },
    ]);
  });

  it('the only views are the ones listed here, each with a security test of its own', async () => {
    const rows = rowsOf<{ name: string }>(
      await adminDb().execute(
        sql`select viewname as name from pg_views where schemaname = 'public' order by 1`,
      ),
    );
    // A view runs with its owner's rights, so it is a way round row-level security unless it filters
    // by organisation itself. Adding one means adding it here and proving it in tests/api/security/views.test.ts.
    expect(rows.map((row) => row.name)).toEqual(views);
  });

  it('the permissions table mirrors the catalogue in code', async () => {
    const rows = rowsOf<{ key: string; module_key: string }>(
      await adminDb().execute(sql`select key, module_key from permissions order by key`),
    );
    expect(rows).toEqual(
      permissionCatalogue
        .map((permission) => ({ key: permission.key, module_key: permission.module }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    );
  });
});

describe('the access-token hook', () => {
  const event = (
    userId: string,
    appMetadata: Record<string, unknown> = {},
    extra: Record<string, unknown> = {},
  ) =>
    sql`select public.custom_access_token_hook(${JSON.stringify({ user_id: userId, claims: { sub: userId, role: 'authenticated', aal: 'aal1', app_metadata: appMetadata, ...extra } })}::jsonb) as event`;
  const claimsFor = async (
    userId: string,
    appMetadata?: Record<string, unknown>,
    extra?: Record<string, unknown>,
  ) =>
    (rowsOf<{ event: { claims: Record<string, unknown> } }>(
      await adminDb().execute(event(userId, appMetadata, extra)),
    )[0]?.event.claims ?? {}) as Record<string, unknown>;

  it('adds the claims of a person’s only membership, and leaves the rest of the token alone', async () => {
    const { seedOrg } = await import('../helpers/world');
    const school = await seedOrg();
    const principal = await school.member({ role: 'principal' });
    const found = await claimsFor(principal.userId);
    expect(found).toMatchObject({
      sub: principal.userId,
      role: 'authenticated',
      aal: 'aal1',
      org_id: school.orgId,
      kind: 'staff',
      membership_id: principal.membershipId,
      membership_version: 1,
      all_branches: false,
      branch_ids: [school.mainBranchId],
      student_ids: [],
      caps: [],
    });
    expect(found.staff_id).toBeTruthy();
  });

  it('with several memberships it adds nothing until one is chosen, then exactly that one', async () => {
    const { seedOrg } = await import('../helpers/world');
    const first = await seedOrg();
    const second = await seedOrg();
    const here = await first.member({ role: 'subject_teacher' });
    const there = await second.member({ role: 'guardian', userId: here.userId });

    expect(await claimsFor(here.userId)).not.toHaveProperty('org_id');
    const chosen = await claimsFor(here.userId, { membership_id: there.membershipId });
    expect(chosen).toMatchObject({
      org_id: second.orgId,
      kind: 'guardian',
      membership_id: there.membershipId,
    });
    expect(chosen).not.toHaveProperty('staff_id');
  });

  it('a guardian’s token names their children and family; a student’s names only themself; the API reads the same', async () => {
    const { seedOrg, TEST_NOW } = await import('../helpers/world');
    const { makeStudent, linkGuardian } = await import('../helpers/people');
    const { loadAccess } = await import('@takhti/core');
    const school = await seedOrg();
    // The first guardian and the first student of a test school are parent and child.
    const father = await school.member({ role: 'guardian' });
    const daughter = await school.member({ role: 'student' });
    // A second child of the same guardian, and a child of the same family the guardian is not linked to.
    const base = { orgId: school.orgId, now: TEST_NOW };
    const { son, cousin, familyId } = await withAdminTx(async (tx) => {
      const [row] = rowsOf<{ family_id: string }>(
        await tx.execute(sql`select family_id from guardians where id = ${father.personId}::uuid`),
      );
      const family = row?.family_id as string;
      const boy = await makeStudent(tx, {
        ...base,
        branchId: school.mainBranchId,
        fullName: 'Hamza Ahmed',
        familyId: family,
      });
      await linkGuardian(tx, {
        ...base,
        studentId: boy.studentId,
        guardianId: father.personId,
        isPrimary: false,
      });
      const other = await makeStudent(tx, {
        ...base,
        branchId: school.mainBranchId,
        fullName: 'Zara Ahmed',
        familyId: family,
      });
      return { son: boy.studentId, cousin: other.studentId, familyId: family };
    });

    const fatherClaims = await claimsFor(father.userId);
    expect(fatherClaims).toMatchObject({
      kind: 'guardian',
      guardian_id: father.personId,
      family_id: familyId,
      student_ids: [daughter.personId, son].sort(),
    });
    expect(fatherClaims.student_ids).not.toContain(cousin);

    const daughterClaims = await claimsFor(daughter.userId);
    expect(daughterClaims).toMatchObject({
      kind: 'student',
      family_id: familyId,
      student_ids: [daughter.personId],
    });
    expect(daughterClaims).not.toHaveProperty('guardian_id');

    // What the API works out for itself on every request is the same answer.
    const fatherAccess = await loadAccess(father.membershipId);
    expect(fatherAccess?.studentIds).toEqual([daughter.personId, son].sort());
    expect(fatherAccess?.familyId).toBe(familyId);
    expect(fatherAccess?.guardianId).toBe(father.personId);
    const daughterAccess = await loadAccess(daughter.membershipId);
    expect(daughterAccess?.studentIds).toEqual([daughter.personId]);
    expect(daughterAccess?.familyId).toBe(familyId);

    // Taking the link away takes the child out of the guardian's reach.
    await adminDb().execute(
      sql`update student_guardians set deleted_at = now() where guardian_id = ${father.personId}::uuid and student_id = ${son}::uuid`,
    );
    expect((await claimsFor(father.userId)).student_ids).toEqual([daughter.personId]);
  });

  it('a membership that is suspended, or someone else’s, or in a suspended school, gives no claims', async () => {
    const { seedOrg } = await import('../helpers/world');
    const school = await seedOrg();
    const suspended = await school.member({ role: 'cashier', status: 'suspended' });
    const other = await school.member({ role: 'librarian' });
    expect(await claimsFor(suspended.userId)).not.toHaveProperty('org_id');
    expect(
      await claimsFor(suspended.userId, { membership_id: other.membershipId }),
    ).not.toHaveProperty('org_id');

    await adminDb().execute(
      sql`update orgs set status = 'suspended' where id = ${school.orgId}::uuid`,
    );
    expect(await claimsFor(other.userId)).not.toHaveProperty('org_id');
  });

  it('claims left over from an earlier token are removed, and nonsense never blocks a sign-in', async () => {
    const stranger = '0198c1de-0000-7000-8000-00000000ffff';
    const cleaned = await claimsFor(
      stranger,
      {},
      { org_id: 'left-over', caps: ['payroll'], all_branches: true },
    );
    expect(cleaned).not.toHaveProperty('org_id');
    expect(cleaned).not.toHaveProperty('caps');
    expect(cleaned).not.toHaveProperty('all_branches');

    const broken = rowsOf<{ event: unknown }>(
      await adminDb().execute(
        sql`select public.custom_access_token_hook('{"user_id":"not-a-uuid","claims":{"sub":"x"}}'::jsonb) as event`,
      ),
    );
    expect(broken[0]?.event).toEqual({ user_id: 'not-a-uuid', claims: { sub: 'x' } });
  });

  it('only the Auth service may call it', async () => {
    await expect(
      withAdminTx(async (tx) => {
        await tx.execute(sql`set local role authenticated`);
        await tx.execute(sql`select public.custom_access_token_hook('{}'::jsonb)`);
      }),
    ).rejects.toThrow();
  });
});

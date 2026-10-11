import { sql, type SQL } from 'drizzle-orm';
import { getTableConfig, PgDialect, timestamp, uuid, type PgTable } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adminDb,
  baseColumns,
  branchIdColumn,
  defineTable,
  enumText,
  findRegisteredTable,
  type RegisteredTable,
} from '@takhti/db';
import { probeTable, type ProbeResult } from '../../helpers/rls';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { fixtureOverrides } from './rls-fixtures';

/*
 * The generated security tests are only worth having if they fail when a policy is wrong.
 * Each test here damages one table's protection on purpose and checks that the probe notices.
 * This file has a database of its own, so the damage reaches no other test.
 */

/*
 * Two tables that exist only in this file's database. Between them they use every shape of rule
 * `defineTable` can turn into policies, so the policy builder and the probe are proved against
 * each other, and against expectations written out by hand below.
 */
const probeStates = ['draft', 'returned', 'published', 'closed'] as const;

const ruleProbe = defineTable(
  'zz_rule_probe',
  {
    module: 'M00',
    scope: 'branch',
    // Everyone in the school reads what is published.
    member: { read: { status: 'published' } },
    // A family sees its own child's row in any state, may add one as a draft, change it while it is
    // a draft or was returned, and remove it only while it is a draft.
    family: 'studentId',
    familyRule: {
      read: true,
      insert: { status: 'draft' },
      update: { status: ['draft', 'returned'] },
      delete: { status: 'draft' },
    },
  },
  {
    ...baseColumns,
    branchId: branchIdColumn(),
    studentId: uuid().notNull(),
    status: enumText(probeStates).notNull(),
  },
);

const ownerProbe = defineTable(
  'zz_owner_probe',
  {
    module: 'M00',
    scope: 'org',
    staff: 'read',
    household: true,
    householdRule: 'append',
    guardian: 'guardianId',
    guardianRule: { read: true, update: true },
    self: 'userId',
    selfAccess: 'read',
  },
  {
    ...baseColumns,
    familyId: uuid().notNull(),
    guardianId: uuid().notNull(),
    userId: uuid().notNull(),
  },
);

const setProbe = defineTable(
  'zz_set_probe',
  // Members read a row once it has been published, whatever else is true of it.
  { module: 'M00', scope: 'org', member: { read: { publishedAt: { set: true } } } },
  { ...baseColumns, publishedAt: timestamp({ withTimezone: true, mode: 'string' }) },
);

const baseDdl = `
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz`;

/** Creates a table in the database with exactly the policies its definition carries. */
async function createInDatabase(table: PgTable, columns: string): Promise<void> {
  const config = getTableConfig(table);
  const dialect = new PgDialect();
  const text = (part: SQL | undefined) => (part ? dialect.sqlToQuery(part).sql : undefined);
  const run = (statement: string) => adminDb().execute(sql.raw(statement));
  await run(`create table "${config.name}" (${columns})`);
  await run(`alter table "${config.name}" enable row level security`);
  for (const policy of config.policies) {
    const using = text(policy.using);
    const check = text(policy.withCheck);
    await run(
      `create policy "${policy.name}" on "${config.name}" as ${policy.as ?? 'permissive'} for ${policy.for ?? 'all'} to authenticated` +
        (using ? ` using (${using})` : '') +
        (check ? ` with check (${check})` : ''),
    );
  }
}

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
  await createInDatabase(
    ruleProbe,
    `${baseDdl}, branch_id uuid not null, student_id uuid not null,
     status text not null check (status in ('draft', 'returned', 'published', 'closed'))`,
  );
  await createInDatabase(setProbe, `${baseDdl}, published_at timestamptz`);
  await createInDatabase(
    ownerProbe,
    `${baseDdl}, family_id uuid not null, guardian_id uuid not null, user_id uuid not null`,
  );
});
afterAll(async () => {
  await db.destroy();
});

const tableNamed = (name: string): RegisteredTable => {
  const table = findRegisteredTable(name);
  if (!table) throw new Error(`No table "${name}" in the registry`);
  return table;
};

/** The lines of the report where what happened differs from what the registry says. */
function differences(
  result: ProbeResult,
): Record<string, { actual: string[] | undefined; expected: string[] | undefined }> {
  const out: Record<string, { actual: string[] | undefined; expected: string[] | undefined }> = {};
  for (const key of new Set([...Object.keys(result.actual), ...Object.keys(result.expected)])) {
    if (JSON.stringify(result.actual[key]) !== JSON.stringify(result.expected[key])) {
      out[key] = { actual: result.actual[key], expected: result.expected[key] };
    }
  }
  return out;
}

const probe = (name: string) => probeTable(tableNamed(name), fixtureOverrides);

describe('rules that go beyond the scope templates', () => {
  it('a rule that depends on the state of the row: everyone reads what is published, a family changes its own draft', async () => {
    const result = await probe('zz_rule_probe');
    expect(differences(result)).toEqual({});

    const can = result.actual;
    // In no particular state ("closed"): only the child's own family, and staff, see the row.
    expect(can['guardian of family 1 can read']).toEqual(['home']);
    expect(can['guardian of another family can read']).toEqual([]);
    expect(can['staff with every branch can read']).toEqual(['away', 'home']);
    // Published: every member of the school reads it; another school still reads only its own row.
    expect(can['guardian of family 1 can read when status=published']).toEqual(['away', 'home']);
    expect(can['guardian of another family can read when status=published']).toEqual([
      'away',
      'home',
    ]);
    expect(can['staff of another organisation can read when status=published']).toEqual([
      'foreign',
    ]);
    expect(can['signed in without claims can read when status=published']).toEqual([]);
    // The branch limit on staff holds whatever else lets them read.
    expect(can['staff of branch 1 only can read when status=published']).toEqual(['home']);
    // A family changes its own row while it is a draft or was returned, and at no other time.
    expect(can['guardian of family 1 can update when status=draft']).toEqual(['home']);
    expect(can['guardian of family 1 can update when status=returned']).toEqual(['home']);
    expect(can['guardian of family 1 can update when status=published']).toEqual([]);
    expect(can['guardian of family 1 can update']).toEqual([]);
    // ... and removes it only while it is a draft.
    expect(can['guardian of family 1 can delete when status=draft']).toEqual(['home']);
    expect(can['guardian of family 1 can delete when status=returned']).toEqual([]);
    // It may add a row for its own child as a draft: in no other state, and never for another's child.
    expect(can['guardian of family 1 can insert when status=draft']).toEqual(['home']);
    expect(can['guardian of family 1 can insert when status=published']).toEqual([]);
    expect(can['guardian of family 1 can insert']).toEqual([]);
    expect(can['guardian of another family can insert when status=draft']).toEqual([]);
    // Staff add rows in any state, at their own branches.
    expect(can['staff of branch 1 only can insert when status=published']).toEqual(['home']);
    expect(can['guardian of another family can update when status=draft']).toEqual([]);
  });

  it('rows a family, a guardian and a user own: each reaches only its own, and only as far as its rule goes', async () => {
    const result = await probe('zz_owner_probe');
    expect(differences(result)).toEqual({});

    const can = result.actual;
    // The row at home belongs to family 1, to its guardian and to the signed-in user, all at once.
    expect(can['guardian of family 1 can read']).toEqual(['home']);
    expect(can['guardian of family 1 can insert']).toEqual(['home']); // the family may add
    expect(can['guardian of family 1 can update']).toEqual(['home']); // the guardian may change
    expect(can['guardian of family 1 can delete']).toEqual([]); // nobody may remove
    expect(can['guardian of another family can read']).toEqual([]);
    expect(can['guardian of another family can insert']).toEqual([]);
    // Staff were given reading only.
    expect(can['staff with every branch can read']).toEqual(['away', 'home']);
    expect(can['staff with every branch can insert']).toEqual([]);
    expect(can['staff with every branch can update']).toEqual([]);
    // Another school's staff read their own school's rows and none of this one's.
    expect(can['staff of another organisation can read']).toEqual(['foreign', 'foreignMine']);
  });

  it('a rule that holds once a column has a value: members read what has been published', async () => {
    const result = await probe('zz_set_probe');
    expect(differences(result)).toEqual({});

    const can = result.actual;
    expect(can['guardian of family 1 can read']).toEqual([]);
    expect(can['guardian of family 1 can read when publishedAt=set']).toEqual(['away', 'home']);
    expect(can['staff with every branch can read']).toEqual(['away', 'home']);
    expect(can['staff of another organisation can read when publishedAt=set']).toEqual([
      'foreign',
    ]);
    expect(can['guardian of family 1 can update when publishedAt=set']).toEqual([]);
  });

  it('a state condition that goes missing is noticed: families would read drafts', async () => {
    await adminDb().execute(sql`drop policy zz_rule_probe_member_read on zz_rule_probe`);
    await adminDb().execute(
      sql`create policy zz_rule_probe_member_read on zz_rule_probe for select to authenticated using (org_id = (select app.org_id()))`,
    );
    const found = differences(await probe('zz_rule_probe'));
    expect(found['guardian of another family can read']).toEqual({
      actual: ['away', 'home'],
      expected: [],
    });
    expect(found['guardian of another family can read when status=draft']).toEqual({
      actual: ['away', 'home'],
      expected: [],
    });
  });

  it('a family rule that is too generous is noticed: a guardian would change a published row', async () => {
    await adminDb().execute(sql`drop policy zz_rule_probe_family_update on zz_rule_probe`);
    await adminDb().execute(
      sql`create policy zz_rule_probe_family_update on zz_rule_probe for update to authenticated
          using (org_id = (select app.org_id()) and student_id = any ((select app.student_ids())::uuid[]))
          with check (org_id = (select app.org_id()) and student_id = any ((select app.student_ids())::uuid[]))`,
    );
    const found = differences(await probe('zz_rule_probe'));
    expect(found['guardian of family 1 can update when status=published']).toEqual({
      actual: ['home'],
      expected: [],
    });
  });

  it('a guardian rule that forgets the organisation is noticed', async () => {
    await adminDb().execute(sql`drop policy zz_owner_probe_guardian_read on zz_owner_probe`);
    await adminDb().execute(
      sql`create policy zz_owner_probe_guardian_read on zz_owner_probe for select to authenticated using (true)`,
    );
    const found = differences(await probe('zz_owner_probe'));
    expect(found['staff of another organisation can read']?.actual).toEqual([
      'away',
      'foreign',
      'foreignMine',
      'home',
    ]);
  });
});

describe('the generated security tests notice damage', () => {
  it('an untouched table shows no difference', async () => {
    expect(differences(await probe('rooms'))).toEqual({});
  });

  it('a missing branch policy: staff of one branch would reach another branch', async () => {
    await adminDb().execute(sql`drop policy rooms_branch on rooms`);
    const found = differences(await probe('rooms'));
    expect(found['staff of branch 1 only can read']).toEqual({
      actual: ['away', 'home'],
      expected: ['home'],
    });
    expect(found['staff of branch 1 only can insert']).toEqual({
      actual: ['away', 'home'],
      expected: ['home'],
    });
  });

  it('a missing staff policy: staff would be locked out', async () => {
    await adminDb().execute(sql`drop policy wings_staff on wings`);
    const found = differences(await probe('wings'));
    expect(found['staff with every branch can read']).toEqual({
      actual: [],
      expected: ['away', 'home'],
    });
  });

  it('a policy that is too wide: another organisation would read the rows', async () => {
    await adminDb().execute(
      sql`create policy leak on notes for select to authenticated using (true)`,
    );
    const found = differences(await probe('notes'));
    expect(found['staff of another organisation can read']?.actual).toEqual([
      'away',
      'foreign',
      'home',
    ]);
    expect(found['signed in without claims can read']?.actual).toEqual(['away', 'foreign', 'home']);
    expect(found['guardian of family 1 can read']?.actual).toEqual(['away', 'foreign', 'home']);
  });

  it('row-level security switched off: everyone would reach everything', async () => {
    await adminDb().execute(sql`alter table org_settings disable row level security`);
    const found = differences(await probe('org_settings'));
    expect(found['staff of another organisation can read']?.actual).toEqual([
      'away',
      'foreign',
      'home',
    ]);
    expect(found['signed in without claims can delete']?.actual).toEqual([
      'away',
      'foreign',
      'home',
    ]);
  });

  it('a self policy that forgets the organisation: a user would reach their rows across organisations', async () => {
    await adminDb().execute(sql`drop policy saved_views_self on saved_views`);
    await adminDb().execute(
      sql`create policy saved_views_self on saved_views for all to authenticated using (user_id = (select app.user_id())) with check (user_id = (select app.user_id()))`,
    );
    const found = differences(await probe('saved_views'));
    expect(found['guardian of family 1 can read']).toEqual({
      actual: ['foreignMine', 'home'],
      expected: ['home'],
    });
    expect(found['guardian of family 1 can insert']).toEqual({
      actual: ['foreignMine', 'home'],
      expected: ['home'],
    });
  });

  it('an append-only table that lost its trigger: the privileged connection could rewrite history', async () => {
    await adminDb().execute(sql`drop trigger forbid_change on domain_events`);
    const result = await probe('domain_events');
    expect(result.appendOnly).toEqual({ update: undefined, delete: undefined });
  });

  it('a members-may-read policy added by mistake: families would read staff-only rows', async () => {
    await adminDb().execute(
      sql`create policy roles_member_read on roles for select to authenticated using (org_id = (select app.org_id()))`,
    );
    const found = differences(await probe('roles'));
    expect(found['guardian of family 1 can read']).toEqual({
      actual: ['away', 'home'],
      expected: [],
    });
  });

  it('a guardian who could read every guardian: the probe sees the other family’s row', async () => {
    await adminDb().execute(sql`drop policy guardians_guardian_read on guardians`);
    await adminDb().execute(
      sql`create policy guardians_guardian_read on guardians for select to authenticated using (org_id = (select app.org_id()))`,
    );
    const found = differences(await probe('guardians'));
    expect(found['guardian of family 1 can read']).toEqual({
      actual: ['away', 'home'],
      expected: ['home'],
    });
  });

  it('a capability wall that is missing: staff without the capability would read private staff details', async () => {
    await adminDb().execute(sql`drop policy staff_private_cap on staff_private`);
    const found = differences(await probe('staff_private'));
    expect(found['staff without capabilities can read']).toEqual({
      actual: ['away', 'home'],
      expected: ['home'],
    });
  });
});

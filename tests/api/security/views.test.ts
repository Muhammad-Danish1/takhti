import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withAdminTx } from '@takhti/db';
import { actors, cast, sandbox, sqlState, type Actor } from '../../helpers/rls';
import { createTestDb, type TestDb } from '../../helpers/test-db';

/*
 * A view runs with its owner's rights, so row-level security on the tables beneath it does not
 * protect what it shows. Each view therefore filters by organisation itself, and is proved here.
 * tests/db/foundation.test.ts lists every view in the database; each must have a section in this file.
 */

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.destroy();
});

const actor = (name: string): Actor => {
  const found = actors.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`No actor "${name}"`);
  return found;
};

const staffMember = actor('staff with every branch');
const guardian = actor('guardian of family 1');
const outsider = actor('staff of another organisation');
const nobody = actor('signed in without claims');
const DENIED = '42501';

describe('staff_directory: what a family may know about the staff of its school', () => {
  const ids = {
    teacher: randomUUID(),
    formerTeacher: randomUUID(),
    removed: randomUUID(),
    elsewhere: randomUUID(),
  };
  const person = (
    id: string,
    org: string,
    name: string,
    options: { status?: string; deleted?: boolean } = {},
  ) => sql`
    insert into staff (id, org_id, employee_no, full_name, gender, designation_id, home_branch_id,
                       staff_type, employment_type, joined_on, status, work_phone, work_email, deleted_at)
    values (${id}::uuid, ${org}::uuid, ${`E-${id.slice(0, 6)}`}, ${name}, 'female', ${randomUUID()}::uuid,
            ${randomUUID()}::uuid, 'teaching', 'permanent', '2024-04-01', ${options.status ?? 'active'},
            '+923001112233', 'teacher@roshan.test', ${options.deleted ? sql`now()` : sql`null`})`;
  const seed = [
    person(ids.teacher, cast.orgA, 'Nadia Hussain'),
    person(ids.formerTeacher, cast.orgA, 'Sadia Malik', { status: 'left' }),
    person(ids.removed, cast.orgA, 'Entered By Mistake', { deleted: true }),
    person(ids.elsewhere, cast.orgB, 'Hina Baig'),
  ];
  const label = new Map<string, string>(Object.entries(ids).map(([name, id]) => [id, name]));
  const names = (rows: { id: string }[]) => rows.map((row) => label.get(row.id) ?? '?').sort();

  it('a guardian sees the staff of their own school, and only a name, a photograph and whether they still work there', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      const rows = await run<Record<string, unknown> & { id: string }>(
        sql`select * from staff_directory`,
      );
      expect(names(rows)).toEqual(['formerTeacher', 'teacher']);
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
        'full_name',
        'full_name_ur',
        'gender',
        'id',
        'is_active',
        'org_id',
        'photo_file_id',
      ]);
      const byName = new Map(rows.map((row) => [label.get(row.id), row.is_active]));
      expect(byName.get('teacher')).toBe(true);
      expect(byName.get('formerTeacher')).toBe(false);
    });
  });

  it('the guardian still reads nothing from the staff table itself', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      expect(await run(sql`select id from staff`)).toEqual([]);
    });
  });

  it('staff see the directory of their own school; another school and a user without claims see nothing of it', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(staffMember);
      expect(names(await run<{ id: string }>(sql`select id from staff_directory`))).toEqual([
        'formerTeacher',
        'teacher',
      ]);
      await as(outsider);
      expect(names(await run<{ id: string }>(sql`select id from staff_directory`))).toEqual([
        'elsewhere',
      ]);
      await as(nobody);
      expect(await run(sql`select id from staff_directory`)).toEqual([]);
    });
  });

  it('nobody can write through the view: not a guardian, not staff', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      for (const who of [guardian, staffMember]) {
        await as(who);
        expect(
          (
            await attempt(
              sql`update staff_directory set full_name = 'Changed' where id = ${ids.teacher}::uuid`,
            )
          ).error,
        ).toBe(DENIED);
        expect(
          (await attempt(sql`delete from staff_directory where id = ${ids.teacher}::uuid`)).error,
        ).toBe(DENIED);
        expect(
          (
            await attempt(
              sql`insert into staff_directory (id, org_id, full_name, gender) values (gen_random_uuid(), ${cast.orgA}::uuid, 'New', 'female')`,
            )
          ).error,
        ).toBe(DENIED);
      }
    });
  });

  it('a visitor who is not signed in cannot read it', async () => {
    let code: string | undefined;
    try {
      await withAdminTx(async (tx) => {
        await tx.execute(sql`set local role anon`);
        await tx.execute(sql`select id from staff_directory limit 1`);
      });
    } catch (error) {
      code = sqlState(error);
    }
    expect(code).toBe(DENIED);
  });
});

describe('house_point_totals: what a family may see of house points', () => {
  const houses = { jinnah: randomUUID(), iqbal: randomUUID(), elsewhere: randomUUID() };
  const year = randomUUID();
  const points = (org: string, branch: string, house: string, value: number, student?: string) => sql`
    insert into house_points (org_id, branch_id, house_id, student_id, points, reason, source, academic_year_id, awarded_on, awarded_by)
    values (${org}::uuid, ${branch}::uuid, ${house}::uuid, ${student ?? null}::uuid, ${value},
            'Won the debate', 'manual', ${year}::uuid, '2026-09-01', ${randomUUID()}::uuid)`;
  const seed = [
    points(cast.orgA, cast.branch1, houses.jinnah, 10, cast.student1),
    points(cast.orgA, cast.branch1, houses.jinnah, 5, cast.student2),
    points(cast.orgA, cast.branch1, houses.jinnah, -3),
    points(cast.orgA, cast.branch1, houses.iqbal, 8, cast.student2),
    points(cast.orgB, cast.branchB, houses.elsewhere, 50),
  ];
  const label = new Map<string, string>(Object.entries(houses).map(([name, id]) => [id, name]));
  const totals = sql`select house_id::text as house, points from house_point_totals order by points desc`;

  it('a guardian sees the totals of the houses of their own school, added up', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      const rows = await run<{ house: string; points: number }>(totals);
      expect(rows.map((row) => [label.get(row.house), Number(row.points)])).toEqual([
        ['jinnah', 12],
        ['iqbal', 8],
      ]);
    });
  });

  it('the view names no student and gives no reason, and the guardian reads no row of the table itself', async () => {
    await sandbox(async ({ run, as }) => {
      for (const statement of seed) await run(statement);
      await as(guardian);
      const rows = await run<Record<string, unknown>>(sql`select * from house_point_totals`);
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
        'academic_year_id',
        'branch_id',
        'house_id',
        'org_id',
        'points',
      ]);
      expect(await run(sql`select id from house_points`)).toEqual([]);
    });
  });

  it('another school sees only its own totals, and nobody can write through the view', async () => {
    await sandbox(async ({ run, as, attempt }) => {
      for (const statement of seed) await run(statement);
      await as(outsider);
      const rows = await run<{ house: string; points: number }>(totals);
      expect(rows.map((row) => [label.get(row.house), Number(row.points)])).toEqual([
        ['elsewhere', 50],
      ]);
      await as(staffMember);
      expect((await attempt(sql`update house_point_totals set points = 100`)).error).toBeDefined();
      expect((await attempt(sql`delete from house_point_totals`)).error).toBeDefined();
    });
  });
});

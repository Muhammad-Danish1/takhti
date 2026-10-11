/*
 * Prints what the seeded data in the local database holds, school by school.
 *
 *   pnpm db:seed-stats
 *
 * The figures in docs/plan/30-reference/seed-data.md are taken from this output.
 */
import { sql } from 'drizzle-orm';
import { closeDatabase, rowsOf, withAdminTx } from '../client';
import { assertLocalDatabase, requireEnv } from './local';

assertLocalDatabase(requireEnv('DATABASE_ADMIN_URL'), 'read the seeded data');

const lines = [
  ['staff', sql`select count(*) from staff x where x.org_id = o.id`],
  [
    '  working now',
    sql`select count(*) from staff x where x.org_id = o.id and x.status in ('active', 'on_leave')`,
  ],
  [
    '  teachers',
    sql`select count(*) from staff x where x.org_id = o.id and x.staff_type = 'teaching' and x.status <> 'left'`,
  ],
  [
    'sections this year',
    sql`select count(*) from sections x join academic_years y on y.id = x.academic_year_id and y.status = 'active' where x.org_id = o.id`,
  ],
  ['students', sql`select count(*) from students x where x.org_id = o.id`],
  ['  active', sql`select count(*) from students x where x.org_id = o.id and x.status = 'active'`],
  [
    '  left this year',
    sql`select count(*) from students x where x.org_id = o.id and x.status = 'left'`,
  ],
  [
    '  children of staff',
    sql`select count(*) from students x where x.org_id = o.id and x.staff_parent_id is not null`,
  ],
  ['  orphans', sql`select count(*) from students x where x.org_id = o.id and x.is_orphan`],
  [
    '  with a B-Form number',
    sql`select count(*) from students x where x.org_id = o.id and x.b_form_no is not null`,
  ],
  [
    '  moved between campuses',
    sql`select count(*) from transfer_requests x where x.org_id = o.id and x.status = 'completed'`,
  ],
  ['families', sql`select count(*) from families x where x.org_id = o.id`],
  [
    '  with more than one child',
    sql`select count(*) from (select family_id from students x where x.org_id = o.id group by family_id having count(*) > 1) f`,
  ],
  ['guardians', sql`select count(*) from guardians x where x.org_id = o.id`],
  ['enrolments', sql`select count(*) from enrollments x where x.org_id = o.id`],
  ['promotion batches', sql`select count(*) from promotion_batches x where x.org_id = o.id`],
  ['sign-in memberships', sql`select count(*) from memberships x where x.org_id = o.id`],
] as const;

try {
  await withAdminTx(async (tx) => {
    const orgs = rowsOf<{ id: string; name: string }>(
      await tx.execute(sql`select id, name from orgs where deleted_at is null order by name desc`),
    );
    for (const org of orgs) {
      console.log(`\n${org.name}`);
      const branches = rowsOf<{ code: string; students: number; staff: number; sections: number }>(
        await tx.execute(sql`
          select b.code,
            (select count(*)::int from students s where s.branch_id = b.id and s.status = 'active') as students,
            (select count(*)::int from staff s where s.home_branch_id = b.id and s.status <> 'left') as staff,
            (select count(*)::int from sections c join academic_years y on y.id = c.academic_year_id and y.status = 'active' where c.branch_id = b.id) as sections
          from branches b where b.org_id = ${org.id}::uuid order by b.code desc`),
      );
      for (const branch of branches)
        console.log(
          `  ${branch.code}: ${branch.students} students in ${branch.sections} sections, ${branch.staff} staff`,
        );
      for (const [label, query] of lines) {
        const [row] = rowsOf<{ count: number | string }>(
          await tx.execute(
            sql`select (${query}) as count from orgs o where o.id = ${org.id}::uuid`,
          ),
        );
        console.log(`  ${label.padEnd(26)} ${row?.count ?? '?'}`);
      }
    }
  });
} finally {
  await closeDatabase();
}

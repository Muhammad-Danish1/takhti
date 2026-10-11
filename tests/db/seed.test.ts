import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadAccess } from '@takhti/core';
import { adminDb, rowsOf, withAdminTx } from '@takhti/db';
import {
  platformAccounts,
  seedAccounts,
  seedCheckCount,
  seededSchools,
  seedId,
  seedSchool,
  verifySeed,
  type SeedRun,
} from '@takhti/db/seed';
import { createTestDb, type TestDb } from '../helpers/test-db';

/*
 * The seed, written into a fresh test database and checked. No sign-in service is involved: the
 * schools are written by the same code `pnpm db:seed` uses, with the user ids it would have got.
 * The small size is used, which has every named record and every kind of case the standard one has.
 */

const TODAY = '2026-10-10';
const run = (tx: SeedRun['tx']): SeedRun => ({
  tx,
  today: TODAY,
  now: `${TODAY}T07:00:00.000Z`,
  size: 'small',
});
const userIds = new Map(
  [...seedAccounts, ...platformAccounts].map((account) => [
    account.email,
    seedId(`user:${account.email}`),
  ]),
);

let db: TestDb;
const summaries: Record<string, string | undefined> = {};
beforeAll(async () => {
  db = await createTestDb();
  for (const school of seededSchools) {
    summaries[school.slug] = await withAdminTx((tx) => seedSchool(run(tx), school.slug, userIds));
  }
}, 300_000);
afterAll(async () => {
  await db.destroy();
});

const count = async (query: ReturnType<typeof sql>): Promise<number> =>
  Number(rowsOf<{ n: number | string }>(await adminDb().execute(query))[0]?.n ?? -1);
const roshan = seedId('org:roshan');
const alnoor = seedId('org:alnoor');

describe('the seed', () => {
  it('writes both schools', () => {
    expect(summaries.roshan).toMatch(/staff, 33 sections, \d+ students enrolled in \d+ families/);
    expect(summaries.alnoor).toMatch(/staff, 5 sections, 20 students enrolled in \d+ families/);
  });

  it(`passes every one of its ${seedCheckCount} integrity checks`, async () => {
    expect(await withAdminTx((tx) => verifySeed(tx))).toEqual([]);
  });

  it('changes nothing when it is run again', async () => {
    const before = await count(sql`select count(*) as n from students`);
    for (const school of seededSchools) {
      expect(await withAdminTx((tx) => seedSchool(run(tx), school.slug, userIds))).toBeUndefined();
    }
    expect(await count(sql`select count(*) as n from students`)).toBe(before);
  });

  it('places the school year around the given day', async () => {
    const years = rowsOf<{ slug: string; name: string; start_date: string; status: string }>(
      await adminDb().execute(sql`
        select o.slug, y.name, y.start_date::text, y.status from academic_years y
        join orgs o on o.id = y.org_id order by o.slug, y.start_date`),
    );
    expect(years).toEqual([
      { slug: 'alnoor', name: '2025–26', start_date: '2025-08-01', status: 'closed' },
      { slug: 'alnoor', name: '2026–27', start_date: '2026-08-01', status: 'active' },
      { slug: 'roshan', name: '2025–26', start_date: '2025-04-01', status: 'closed' },
      { slug: 'roshan', name: '2026–27', start_date: '2026-04-01', status: 'active' },
    ]);
    // An Eid that has not happened yet is tentative; one that has, is not.
    const eids = rowsOf<{ name: string; start_date: string; is_tentative: boolean }>(
      await adminDb().execute(sql`
        select name, start_date::text, is_tentative from holidays
        where org_id = ${roshan}::uuid and kind = 'religious' order by start_date`),
    );
    expect(eids.map((eid) => eid.name)).toEqual([
      'Eid ul-Adha',
      'Ashura',
      'Eid Milad-un-Nabi',
      'Eid ul-Fitr',
    ]);
    expect(eids.map((eid) => eid.is_tentative)).toEqual([false, false, false, true]);
  });

  it('has the families and students the plan names, where it says they are', async () => {
    const rows = rowsOf<{ full_name: string; class: string; branch: string; status: string }>(
      await adminDb().execute(sql`
        select s.full_name, g.short_name || '-' || c.name as class, b.code as branch, s.status
        from students s
        join enrollments e on e.student_id = s.id and e.deleted_at is null and e.status in ('active', 'left')
        join academic_years y on y.id = e.academic_year_id and y.status = 'active'
        join sections c on c.id = e.section_id
        join grades g on g.id = e.grade_id
        join branches b on b.id = e.branch_id
        where s.org_id = ${roshan}::uuid and s.full_name in (
          'Hassan Ahmed', 'Maryam Ahmed', 'Usman Ahmed', 'Sara Malik', 'Omar Malik', 'Ayesha Raza',
          'Bilal Khan', 'Fatima Noor', 'Daniel Masih', 'Noor Fatima', 'Ibrahim Qureshi', 'Sana Javed', 'Adeel Shah')
          and s.id in (${sql.join(
            [
              'hassan-ahmed',
              'maryam-ahmed',
              'usman-ahmed',
              'sara-malik',
              'omar-malik',
              'ayesha-raza',
              'bilal-khan',
              'fatima-noor',
              'daniel-masih',
              'noor-fatima',
              'ibrahim-qureshi',
              'sana-javed',
              'adeel-shah',
            ].map((key) =>
              key === 'maryam-ahmed'
                ? sql`${seedId('person:student@roshan.test')}::uuid`
                : sql`${seedId(`roshan:student:named:${key}`)}::uuid`,
            ),
            sql`, `,
          )})
        order by s.full_name`),
    );
    expect(rows).toEqual([
      { full_name: 'Adeel Shah', class: '8-B', branch: 'MC', status: 'left' },
      { full_name: 'Ayesha Raza', class: '7-B', branch: 'MC', status: 'active' },
      { full_name: 'Bilal Khan', class: '9-A', branch: 'MC', status: 'active' },
      { full_name: 'Daniel Masih', class: '9-B', branch: 'MC', status: 'active' },
      { full_name: 'Fatima Noor', class: '5-A', branch: 'MC', status: 'active' },
      { full_name: 'Hassan Ahmed', class: '3-A', branch: 'MC', status: 'active' },
      { full_name: 'Ibrahim Qureshi', class: '4-B', branch: 'MC', status: 'active' },
      { full_name: 'Maryam Ahmed', class: '6-B', branch: 'MC', status: 'active' },
      { full_name: 'Noor Fatima', class: '10-A', branch: 'MC', status: 'active' },
      { full_name: 'Omar Malik', class: '8-A', branch: 'MC', status: 'active' },
      { full_name: 'Sana Javed', class: '6-A', branch: 'MC', status: 'active' },
      { full_name: 'Sara Malik', class: '4-A', branch: 'CC', status: 'active' },
      { full_name: 'Usman Ahmed', class: '9-A', branch: 'MC', status: 'active' },
    ]);
  });

  it('joins each sign-in to its person: a father reaches his three children, a father without custody none', async () => {
    const father = await loadAccess(seedId('membership:guardian@roshan.test'));
    expect(father?.kind).toBe('guardian');
    expect(father?.studentIds).toHaveLength(3);
    expect(father?.familyId).toBe(seedId('roshan:family:ahmed'));

    const daughter = await loadAccess(seedId('membership:student@roshan.test'));
    expect(daughter?.studentIds).toEqual([seedId('person:student@roshan.test')]);
    expect(daughter?.familyId).toBe(seedId('roshan:family:ahmed'));

    // Bilal Khan's father is on record in the family, and linked to nobody.
    const linked = await count(sql`
      select count(*) as n from student_guardians
      where guardian_id = ${seedId('roshan:guardian:khan:father')}::uuid and deleted_at is null`);
    expect(linked).toBe(0);
    const mother = await count(sql`
      select count(*) as n from student_guardians
      where guardian_id = ${seedId('roshan:guardian:khan:mother')}::uuid and is_primary and deleted_at is null`);
    expect(mother).toBe(1);
  });

  it('gives one sign-in two memberships where the plan says so', async () => {
    const memberships = rowsOf<{ email: string; slug: string; kind: string }>(
      await adminDb().execute(sql`
        select p.email, o.slug, m.kind from memberships m
        join profiles p on p.id = m.user_id join orgs o on o.id = m.org_id
        where p.email in ('teacher.parent@roshan.test', 'guardian.both@roshan.test')
        order by p.email, o.slug, m.kind`),
    );
    expect(memberships).toEqual([
      { email: 'guardian.both@roshan.test', slug: 'alnoor', kind: 'guardian' },
      { email: 'guardian.both@roshan.test', slug: 'roshan', kind: 'guardian' },
      { email: 'teacher.parent@roshan.test', slug: 'roshan', kind: 'guardian' },
      { email: 'teacher.parent@roshan.test', slug: 'roshan', kind: 'staff' },
    ]);
  });

  it('has staff in every state the plan describes', async () => {
    const states = rowsOf<{ status: string; n: number }>(
      await adminDb().execute(sql`
        select status, count(*)::int as n from staff where org_id = ${roshan}::uuid group by status order by status`),
    );
    const byStatus = Object.fromEntries(states.map((row) => [row.status, row.n]));
    expect(byStatus.left).toBe(2);
    expect(byStatus.notice).toBe(1);
    expect(byStatus.suspended).toBe(1);
    expect(byStatus.active).toBeGreaterThan(60);

    // Mr Kamran Yousaf's probation ends ten days from the seed's today.
    const probation = rowsOf<{ full_name: string; ends: string }>(
      await adminDb().execute(sql`
        select full_name, probation_ends_on::text as ends from staff
        where org_id = ${roshan}::uuid and employment_type = 'probation' order by probation_ends_on`),
    );
    expect(probation[0]).toEqual({ full_name: 'Kamran Yousaf', ends: '2026-10-20' });
    // Mr Waqas Latif left and came back: both steps are in his history, and he is working.
    const waqas = rowsOf<{ kind: string }>(
      await adminDb().execute(sql`
        select m.kind from staff_movements m join staff s on s.id = m.staff_id
        where s.full_name = 'Waqas Latif' order by m.effective_on`),
    );
    expect(waqas.map((row) => row.kind)).toEqual(['joined', 'confirmed', 'left', 'rejoined']);
  });

  it('leaves exactly four subjects without a teacher, as the plan asks, and none at the second school', async () => {
    expect(
      await count(sql`
        select count(*) as n from section_subjects where org_id = ${roshan}::uuid and teacher_id is null`),
    ).toBe(4);
    expect(
      await count(sql`
        select count(*) as n from section_subjects where org_id = ${alnoor}::uuid and teacher_id is null`),
    ).toBe(0);
  });

  it('has an admissions pipeline in every state, and the boy admitted this week came through it', async () => {
    const enquiries = rowsOf<{ status: string; n: number }>(
      await adminDb().execute(sql`
        select status, count(*)::int as n from admission_enquiries where org_id = ${roshan}::uuid group by status`),
    );
    expect(Object.fromEntries(enquiries.map((row) => [row.status, row.n]))).toEqual({
      new: 20,
      contacted: 30,
      visit_scheduled: 15,
      visited: 15,
      applied: 20,
      converted: 8,
      lost: 12,
    });
    const applications = rowsOf<{ status: string; n: number }>(
      await adminDb().execute(sql`
        select status, count(*)::int as n from admission_applications where org_id = ${roshan}::uuid group by status`),
    );
    const byStatus = Object.fromEntries(applications.map((row) => [row.status, row.n]));
    expect(byStatus).toMatchObject({ accepted: 6, waitlisted: 4, enrolled: 1 });
    expect(Object.values(byStatus).reduce((sum, n) => sum + n, 0)).toBe(45);
    expect(
      await count(sql`
        select count(*) as n from admission_applications where org_id = ${roshan}::uuid and submitted_via = 'public_form'`),
    ).toBe(3);

    const ibrahim = rowsOf<{ full_name: string; application: string | null }>(
      await adminDb().execute(sql`
        select s.full_name, a.status as application from students s
        left join admission_applications a on a.id = s.source_application_id
        where s.id = ${seedId('roshan:student:named:ibrahim-qureshi')}::uuid`),
    );
    expect(ibrahim).toEqual([{ full_name: 'Ibrahim Qureshi', application: 'enrolled' }]);
  });

  it('has certificates and gate passes in every state, three visitors still inside, and three classes of alumni', async () => {
    const certificates = rowsOf<{ status: string; n: number }>(
      await adminDb().execute(sql`
        select status, count(*)::int as n from certificates where org_id = ${roshan}::uuid group by status`),
    );
    expect(Object.fromEntries(certificates.map((row) => [row.status, row.n]))).toEqual({
      issued: 29,
      revoked: 1,
      requested: 4,
      pending_approval: 3,
    });
    expect(
      await count(sql`
        select count(*) as n from certificates where org_id = ${roshan}::uuid and is_duplicate_copy`),
    ).toBe(1);

    const passes = rowsOf<{ status: string }>(
      await adminDb().execute(
        sql`select distinct status from gate_passes where org_id = ${roshan}::uuid order by 1`,
      ),
    );
    expect(passes.map((row) => row.status)).toEqual([
      'approved',
      'cancelled',
      'exited',
      'expired',
      'rejected',
      'requested',
      'returned',
    ]);
    expect(
      await count(sql`
        select count(*) as n from visitors where org_id = ${roshan}::uuid and checked_out_at is null`),
    ).toBe(3);

    const classes = rowsOf<{ graduation_year: number; n: number }>(
      await adminDb().execute(sql`
        select graduation_year, count(*)::int as n from alumni where org_id = ${roshan}::uuid
        group by graduation_year order by graduation_year`),
    );
    expect(classes.map((row) => row.graduation_year)).toEqual([2024, 2025, 2026]);
    expect(new Set(classes.map((row) => row.n)).size).toBe(1);
  });

  it('gives every campus a published timetable, and Ms Rabia Anwar’s lessons a substitute this week', async () => {
    const timetables = rowsOf<{ code: string; status: string; n: number }>(
      await adminDb().execute(sql`
        select b.code, t.status, count(e.id)::int as n from timetables t
        join branches b on b.id = t.branch_id
        left join timetable_entries e on e.timetable_id = t.id
        where t.status = 'published' group by b.code, t.status order by b.code`),
    );
    expect(timetables.map((row) => row.code)).toEqual(['AN', 'CC', 'MC']);
    expect(timetables.every((row) => row.n > 100)).toBe(true);

    const cover = rowsOf<{ status: string; covered: boolean }>(
      await adminDb().execute(sql`
        select x.status, x.substitute_teacher_id is not null as covered from substitutions x
        join staff s on s.id = x.absent_teacher_id where s.full_name = 'Rabia Anwar'`),
    );
    expect(cover.length).toBeGreaterThanOrEqual(8);
    expect(cover.some((row) => row.covered)).toBe(true);
    expect(cover.some((row) => row.status === 'planned' && !row.covered)).toBe(true);
  });

  it('keeps a register for every school day of the year, with today half done and Grades 9 and 10 marked lesson by lesson', async () => {
    const days = await count(sql`
      select count(distinct session_date) as n from attendance_sessions
      where org_id = ${roshan}::uuid and status <> 'cancelled'`);
    expect(days).toBeGreaterThan(60);

    // The last school day before the seed's Saturday: some registers are in, some part-way, some not started.
    const today = rowsOf<{ status: string; n: number }>(
      await adminDb().execute(sql`
        select s.status, count(*)::int as n from attendance_sessions s
        where s.org_id = ${roshan}::uuid and s.session_date = '2026-10-09' and s.lesson_no = 0
        group by s.status`),
    );
    const byStatus = Object.fromEntries(today.map((row) => [row.status, row.n]));
    expect(byStatus.submitted).toBeGreaterThan(8);
    expect(byStatus.draft).toBeGreaterThan(3);
    expect((byStatus.submitted ?? 0) + (byStatus.draft ?? 0)).toBeLessThan(29);

    const byLesson = await count(sql`
      select count(distinct s.section_id) as n from attendance_sessions s
      where s.org_id = ${roshan}::uuid and s.lesson_no > 0`);
    expect(byLesson).toBe(4);

    const share = rowsOf<{ came: number; all: number }>(
      await adminDb().execute(sql`
        select count(*) filter (where status in ('present', 'late'))::int as came, count(*)::int as all
        from attendance_records where org_id = ${roshan}::uuid`),
    )[0];
    expect((share?.came ?? 0) / (share?.all ?? 1)).toBeGreaterThan(0.9);
    expect((share?.came ?? 0) / (share?.all ?? 1)).toBeLessThan(0.97);

    const leave = rowsOf<{ status: string }>(
      await adminDb().execute(
        sql`select distinct status from student_leave_requests where org_id = ${roshan}::uuid order by 1`,
      ),
    );
    expect(leave.map((row) => row.status)).toEqual([
      'approved',
      'cancelled',
      'pending',
      'rejected',
    ]);
    expect(
      await count(
        sql`select count(*) as n from attendance_corrections where org_id = ${roshan}::uuid`,
      ),
    ).toBe(8);
  });

  it('has a syllabus for every subject, term plans, lesson plans in every state, a diary and homework', async () => {
    const plans = rowsOf<{ status: string }>(
      await adminDb().execute(
        sql`select distinct status from lesson_plans where org_id = ${roshan}::uuid order by 1`,
      ),
    );
    expect(plans.map((row) => row.status)).toEqual([
      'approved',
      'draft',
      'returned',
      'submitted',
      'taught',
    ]);
    expect(
      await count(sql`
        select count(distinct teacher_id) as n from lesson_plans where org_id = ${roshan}::uuid`),
    ).toBe(12);
    // Every subject a section studies has chapters to teach from.
    expect(
      await count(sql`
        select count(*) as n from section_subjects a
        join sections c on c.id = a.section_id
        join academic_years y on y.id = c.academic_year_id and y.status = 'active'
        where not exists (
          select from syllabus_units u where u.grade_subject_id = a.grade_subject_id and u.kind = 'chapter')`),
    ).toBe(0);
    // Two classes without a teacher have fallen far behind their plan.
    expect(
      await count(sql`
        select count(*) as n from schemes_of_work where org_id = ${roshan}::uuid and status = 'approved'`),
    ).toBeGreaterThan(100);

    const submissions = rowsOf<{ status: string }>(
      await adminDb().execute(
        sql`select distinct status from homework_submissions where org_id = ${roshan}::uuid order by 1`,
      ),
    );
    expect(submissions.map((row) => row.status)).toEqual(
      expect.arrayContaining(['checked', 'late', 'missing', 'pending', 'submitted']),
    );
    // Mr Farhan Ahmed confirmed reading the diary of his three children on most days.
    expect(
      await count(sql`
        select count(distinct k.student_id) as n from diary_acknowledgements k
        join profiles p on p.id = k.acknowledged_by where p.email = 'guardian@roshan.test'`),
    ).toBe(3);
  });

  it('keeps the two schools apart: nothing of one names anything of the other', async () => {
    const crossed = await count(sql`
      select count(*) as n from enrollments e
      join students s on s.id = e.student_id
      join sections c on c.id = e.section_id
      where e.org_id <> s.org_id or e.org_id <> c.org_id`);
    expect(crossed).toBe(0);
    // The father with children at both schools is two guardian records, one in each.
    const both = rowsOf<{ slug: string }>(
      await adminDb().execute(sql`
        select o.slug from guardians g join orgs o on o.id = g.org_id
        where g.email = 'guardian.both@roshan.test' order by o.slug`),
    );
    expect(both.map((row) => row.slug)).toEqual(['alnoor', 'roshan']);
  });
});

import { and, eq, isNull, sql } from 'drizzle-orm';
import { moduleKeys, type ModuleKey } from '@takhti/contracts';
import type { Tx } from '../client';
import { addMember, ensureProfile, provisionOrg } from '../provision';
import { orgs, rooms, wings } from '../schema';
import { seedAccounts, type SeedAccount } from './accounts';
import { schoolOf, seedId, timed, type School, type SeedRun } from './context';
import {
  seedCurriculum,
  seedSections,
  type CurriculumRefs,
  type SectionRef,
} from './wave1/academics';
import { sectionPlan } from './wave1/plan';
import { seedSetup, type SetupRefs } from './wave1/setup';
import { seedStaff, type StaffRefs } from './wave1/staff';
import { seedStudents, type StudentRefs } from './wave1/students';
import { seedAdmissions } from './wave2/admissions';
import { seedAlumni } from './wave2/alumni';
import { seedCertificates } from './wave2/certificates';
import { seedFrontOffice } from './wave2/front-office';
import { seedIntegrations } from './wave2/integrations';
import { seedWave3 } from './wave3';

/** What Wave 1 leaves behind for the waves after it: the calendar, the people and the classes. */
export interface Wave1 {
  setup: SetupRefs;
  curriculum: CurriculumRefs;
  staff: StaffRefs;
  sections: SectionRef[];
  students: StudentRefs;
}

/*
 * The two seeded schools, written with nothing but a database transaction: no sign-in service, no
 * file storage. `run.ts` adds those around it for a developer's machine; the tests call this file
 * directly, so the seed is proved on every test run.
 */

async function orgExists(tx: Tx, slug: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: orgs.id })
    .from(orgs)
    .where(and(eq(orgs.slug, slug), isNull(orgs.deletedAt)))
    .limit(1);
  return row !== undefined;
}

/**
 * Joins every sign-in account that belongs at this school to the person record the seed made for it.
 * One sign-in may hold two memberships: a teacher who is also a parent, a parent at two schools.
 */
async function addMembers(
  school: School,
  userIds: ReadonlyMap<string, string>,
  staff: StaffRefs,
  students: StudentRefs,
): Promise<void> {
  const { tx, now } = school;
  const join = async (account: SeedAccount, role: SeedAccount['role'], membershipLabel: string) => {
    const userId = userIds.get(account.email);
    if (!userId) throw new Error(`No sign-in account was made for ${account.email}`);
    await ensureProfile(tx, { id: userId, fullName: account.fullName, email: account.email, now });
    const kind = role === 'guardian' ? 'guardian' : role === 'student' ? 'student' : 'staff';
    const family = students.accounts.get(account.email);
    const personId =
      kind === 'staff'
        ? staff.byEmail(account.email).id
        : family?.kind === kind
          ? family.personId
          : undefined;
    if (!personId)
      throw new Error(`The seed made no ${kind} record at ${school.key} for ${account.email}`);
    await addMember(tx, {
      id: seedId(membershipLabel),
      orgId: school.orgId,
      userId,
      kind,
      personId,
      roleKeys: [role],
      allBranches: kind === 'staff' && !account.branches,
      branchIds:
        kind === 'staff'
          ? (account.branches ?? []).map((code) => school.branchIds[code] as string)
          : [],
      now,
    });
  };

  for (const account of seedAccounts) {
    if (account.school === school.key)
      await join(account, account.role, `membership:${account.email}`);
    for (const extra of account.also ?? []) {
      if (extra.school === school.key)
        await join(
          account,
          extra.role,
          `membership:${account.email}:${extra.school}:${extra.role}`,
        );
    }
  }
}

/** Everything for one school, wave by wave: the calendar, staff, classes and students; who signs in as whom; then each later wave. */
async function seedPeople(
  school: School,
  userIds: ReadonlyMap<string, string>,
  board: string,
): Promise<string> {
  const accounts = seedAccounts.filter((account) => account.school === school.key);
  const plan = sectionPlan(school);
  const wave1 = await timed(
    school,
    'setup, staff, classes and students',
    async (): Promise<Wave1> => {
      const setup = await seedSetup(school);
      const curriculum = await seedCurriculum(
        school,
        setup,
        new Set(plan.map((section) => section.grade)),
      );
      const staff = await seedStaff(school, setup, curriculum.subjectIds, plan, accounts);
      const sections = await seedSections(school, setup, curriculum, staff, plan);
      const students = await seedStudents(school, setup, curriculum, sections, staff);
      await addMembers(school, userIds, staff, students);
      return { setup, curriculum, staff, sections, students };
    },
  );
  const { staff, sections, students } = wave1;

  // Wave 2 · the front door.
  await timed(school, 'admissions, certificates, front office and alumni', async () => {
    await seedIntegrations(school, wave1);
    await seedAdmissions(school, wave1);
    await seedCertificates(school, wave1);
    await seedFrontOffice(school, wave1);
    await seedAlumni(school, wave1);
  });

  // Wave 3 · academics.
  await seedWave3(school, wave1, userIds);

  // The board the school registers its Grade 9 and 10 students with.
  await school.tx.execute(sql`
    update branches set board_id = (select id from boards where key = ${board} and deleted_at is null)
    where org_id = ${school.orgId}::uuid
  `);
  const enrolled = students.roster.filter((student) => student.status === 'active').length;
  return `${staff.all.length} staff, ${sections.length} sections, ${enrolled} students enrolled in ${students.counts.families} families`;
}

async function seedRoshan(run: SeedRun, userIds: ReadonlyMap<string, string>): Promise<string> {
  const { tx, now } = run;
  const org = await provisionOrg(tx, {
    id: seedId('org:roshan'),
    name: 'Roshan Public School',
    nameUr: 'روشن پبلک اسکول',
    slug: 'roshan',
    city: 'Lahore',
    province: 'punjab',
    academicYearStartMonth: 4,
    fiscalYearStartMonth: 7,
    modules: 'all',
    branches: [
      {
        id: seedId('branch:roshan:MC'),
        code: 'MC',
        name: 'Main Campus',
        nameUr: 'مین کیمپس',
        address: '12 Canal Bank Road, Johar Town',
        city: 'Lahore',
        gender: 'mixed',
      },
      {
        id: seedId('branch:roshan:CC'),
        code: 'CC',
        name: 'City Campus',
        nameUr: 'سٹی کیمپس',
        address: '48 Mall Road',
        city: 'Lahore',
        gender: 'girls',
      },
    ],
    now,
  });
  const school = schoolOf(run, 'roshan', org, 4);
  const main = org.branchIds.MC as string;
  const city = org.branchIds.CC as string;
  const stamps = school.stamps;

  const wing = (
    branch: 'MC' | 'CC',
    key: string,
    name: string,
    nameUr: string,
    from: number,
    to: number,
  ) => ({
    id: seedId(`wing:${branch}:${key}`),
    ...stamps,
    branchId: branch === 'MC' ? main : city,
    name,
    nameUr,
    gradeFrom: from,
    gradeTo: to,
  });
  await tx
    .insert(wings)
    .values([
      wing('MC', 'primary', 'Primary', 'پرائمری', 1, 5),
      wing('MC', 'middle', 'Middle', 'مڈل', 6, 8),
      wing('MC', 'secondary', 'Secondary', 'سیکنڈری', 9, 10),
      wing('CC', 'primary', 'Primary', 'پرائمری', 1, 5),
      wing('CC', 'middle', 'Middle', 'مڈل', 6, 8),
    ]);

  const special = [
    { name: 'Science Lab', kind: 'lab' as const, capacity: 36, isBookable: true },
    { name: 'Computer Lab', kind: 'lab' as const, capacity: 40, isBookable: true },
    { name: 'Library', kind: 'library' as const, capacity: 60, isBookable: false },
    { name: 'Assembly Hall', kind: 'hall' as const, capacity: 500, isBookable: true },
  ];
  const roomsFor = (code: string, branchId: string, classrooms: number, extras: typeof special) => [
    ...Array.from({ length: classrooms }, (_unused, index) => ({
      id: seedId(`room:${code}:${index + 1}`),
      ...stamps,
      branchId,
      name: `Room ${index + 1}`,
      kind: 'classroom' as const,
      capacity: 40,
      floor: index < classrooms / 2 ? 'Ground' : 'First',
    })),
    ...extras.map((room) => ({
      id: seedId(`room:${code}:${room.name}`),
      ...stamps,
      branchId,
      ...room,
    })),
  ];
  // Main Campus: 24 rooms. City Campus: 14.
  await tx
    .insert(rooms)
    .values([
      ...roomsFor('MC', main, 20, special),
      ...roomsFor('CC', city, 11, special.slice(0, 3)),
    ]);

  return seedPeople(school, userIds, 'bise-lahore');
}

async function seedAlnoor(run: SeedRun, userIds: ReadonlyMap<string, string>): Promise<string> {
  // A few modules are off here, so "this module is not part of your plan" is always exercised.
  const off: ModuleKey[] = ['transport', 'hostel', 'shop'];
  const org = await provisionOrg(run.tx, {
    id: seedId('org:alnoor'),
    name: 'Al-Noor Grammar School',
    nameUr: 'النور گرامر اسکول',
    slug: 'alnoor',
    city: 'Karachi',
    province: 'sindh',
    academicYearStartMonth: 8,
    fiscalYearStartMonth: 7,
    modules: moduleKeys.filter((key) => !off.includes(key)),
    branches: [
      {
        id: seedId('branch:alnoor:AN'),
        code: 'AN',
        name: 'Al-Noor Campus',
        address: '21 Shahrah-e-Faisal',
        city: 'Karachi',
      },
    ],
    now: run.now,
  });
  return seedPeople(schoolOf(run, 'alnoor', org, 8), userIds, 'bsek');
}

export const seededSchools = [
  { slug: 'roshan', name: 'Roshan Public School', seed: seedRoshan },
  { slug: 'alnoor', name: 'Al-Noor Grammar School', seed: seedAlnoor },
] as const;

/**
 * Writes one of the seeded schools, unless it is already there. Call it inside one transaction:
 * a school is then either wholly written or not at all. Returns a one-line summary, or nothing
 * when the school existed.
 */
export async function seedSchool(
  run: SeedRun,
  slug: (typeof seededSchools)[number]['slug'],
  userIds: ReadonlyMap<string, string>,
): Promise<string | undefined> {
  if (await orgExists(run.tx, slug)) return undefined;
  const school = seededSchools.find((candidate) => candidate.slug === slug);
  if (!school) throw new Error(`There is no seeded school "${slug}"`);
  return school.seed(run, userIds);
}

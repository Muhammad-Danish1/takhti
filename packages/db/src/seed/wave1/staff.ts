import { sql } from 'drizzle-orm';
import type { RoleKey } from '@takhti/contracts';
import {
  applicantInterviews,
  departments,
  designations,
  employmentContracts,
  jobApplicants,
  jobOpenings,
  staff,
  staffBankAccounts,
  staffChangeRequests,
  staffExits,
  staffExperience,
  staffMovements,
  staffPrivate,
  staffQualifications,
} from '../../schema';
import type { SeedAccount } from '../accounts';
import {
  addDays,
  addMonths,
  addYears,
  branchOf,
  insertAll,
  noonOn,
  random,
  seedId,
  setCounter,
  type Random,
  type School,
} from '../context';
import {
  addressIn,
  femaleNames,
  fullName,
  genderOf,
  identityNumber,
  maleNames,
  mobileNumber,
  surnames,
  urduOf,
} from '../people';
import { teacherKinds, teachersNeeded, type SectionPlan, type TeacherKind } from './plan';
import type { SetupRefs } from './setup';

/*
 * M26 · Staff and recruitment: departments, designations, everyone who works at the school with
 * their private details, bank account, qualifications, contract and history, and a small
 * recruitment pipeline.
 *
 * Documents (CNIC copies, degrees) are not seeded here: a document is an uploaded file, and files
 * arrive with the phase that builds uploads.
 */

export interface StaffRef {
  id: string;
  fullName: string;
  gender: 'male' | 'female';
  /** Home branch code. */
  branch: string;
  /** Set for teachers: what they teach. */
  kind?: TeacherKind;
  /** Set for people who have a sign-in account. */
  email?: string;
  status: 'active' | 'on_leave' | 'suspended' | 'notice' | 'left';
}

export interface StaffRefs {
  all: StaffRef[];
  /** Teachers of a kind at a branch who are working now, in a fixed order. */
  teachers(branch: string, kind: TeacherKind): StaffRef[];
  byEmail(email: string): StaffRef;
  /** People the plan names, by a short key: `nadia`, `imran`, `kamran`. */
  named: Record<string, StaffRef>;
}

interface Person extends StaffRef {
  designation: string;
  department: string;
  employmentType: 'permanent' | 'probation' | 'contract' | 'part_time';
  joinedOn: string;
  probationEndsOn?: string;
  contractEndsOn?: string;
  confirmedOn?: string;
  lastWorkingDay?: string;
  /** Position in the employee numbering. */
  serial: number;
}

const departmentList = [
  { code: 'ADM', name: 'Administration', nameUr: 'انتظامیہ' },
  { code: 'PRI', name: 'Academics – Primary', nameUr: 'تدریس – پرائمری' },
  { code: 'MID', name: 'Academics – Middle', nameUr: 'تدریس – مڈل' },
  { code: 'SEC', name: 'Academics – Secondary', nameUr: 'تدریس – سیکنڈری' },
  { code: 'FIN', name: 'Finance', nameUr: 'مالیات' },
  { code: 'HR', name: 'Human Resources', nameUr: 'انسانی وسائل' },
  { code: 'OPS', name: 'Operations', nameUr: 'آپریشنز' },
  { code: 'SS', name: 'Student Services', nameUr: 'طلبہ خدمات' },
] as const;

type Category = (typeof designations.$inferInsert)['category'];

const designationList: readonly (readonly [
  name: string,
  category: Category,
  teaching?: boolean,
])[] = [
  ['Owner', 'leadership'],
  ['Director', 'leadership'],
  ['Group Finance Head', 'finance'],
  ['Group Academic Head', 'leadership'],
  ['Internal Auditor', 'finance'],
  ['Principal', 'leadership'],
  ['Vice Principal', 'leadership'],
  ['Branch Administrator', 'administration'],
  ['Section Head', 'academic_support'],
  ['Academic Coordinator', 'academic_support'],
  ['Exam Controller', 'academic_support'],
  ['Senior Teacher', 'teaching', true],
  ['Teacher', 'teaching', true],
  ['Junior Teacher', 'teaching', true],
  ['Subject Specialist', 'teaching', true],
  ['Nazra Teacher', 'teaching', true],
  ['Physical Education Instructor', 'teaching', true],
  ['Counsellor', 'academic_support'],
  ['Accountant', 'finance'],
  ['Cashier', 'finance'],
  ['HR Manager', 'administration'],
  ['Payroll Officer', 'finance'],
  ['Admissions Officer', 'administration'],
  ['Receptionist', 'administration'],
  ['Librarian', 'academic_support'],
  ['Library Assistant', 'academic_support'],
  ['Lab Assistant', 'academic_support'],
  ['Transport Manager', 'transport'],
  ['Driver', 'transport'],
  ['Store Keeper', 'support'],
  ['Nurse', 'medical'],
  ['Hostel Warden', 'support'],
  ['Security Guard', 'security'],
  ['IT Administrator', 'administration'],
  ['Office Assistant', 'support'],
  ['Helper', 'support'],
];

/** Where a person with a sign-in role sits in the organisation. */
const byRole: Partial<Record<RoleKey, { designation: string; department: string }>> = {
  owner: { designation: 'Owner', department: 'ADM' },
  director: { designation: 'Director', department: 'ADM' },
  finance_head: { designation: 'Group Finance Head', department: 'FIN' },
  academic_head: { designation: 'Group Academic Head', department: 'SEC' },
  auditor: { designation: 'Internal Auditor', department: 'FIN' },
  principal: { designation: 'Principal', department: 'ADM' },
  vice_principal: { designation: 'Vice Principal', department: 'ADM' },
  branch_admin: { designation: 'Branch Administrator', department: 'ADM' },
  section_head: { designation: 'Section Head', department: 'PRI' },
  coordinator: { designation: 'Academic Coordinator', department: 'MID' },
  exam_controller: { designation: 'Exam Controller', department: 'SEC' },
  class_teacher: { designation: 'Senior Teacher', department: 'MID' },
  subject_teacher: { designation: 'Subject Specialist', department: 'SEC' },
  counsellor: { designation: 'Counsellor', department: 'SS' },
  accountant: { designation: 'Accountant', department: 'FIN' },
  cashier: { designation: 'Cashier', department: 'FIN' },
  hr_manager: { designation: 'HR Manager', department: 'HR' },
  payroll_officer: { designation: 'Payroll Officer', department: 'HR' },
  admissions_officer: { designation: 'Admissions Officer', department: 'SS' },
  receptionist: { designation: 'Receptionist', department: 'ADM' },
  librarian: { designation: 'Librarian', department: 'SS' },
  transport_manager: { designation: 'Transport Manager', department: 'OPS' },
  driver: { designation: 'Driver', department: 'OPS' },
  store_keeper: { designation: 'Store Keeper', department: 'OPS' },
  nurse: { designation: 'Nurse', department: 'SS' },
  hostel_warden: { designation: 'Hostel Warden', department: 'OPS' },
  security_guard: { designation: 'Security Guard', department: 'OPS' },
  it_admin: { designation: 'IT Administrator', department: 'ADM' },
};

const teacherPlace: Record<TeacherKind, { designation: string; department: string }> = {
  class: { designation: 'Teacher', department: 'PRI' },
  english: { designation: 'Subject Specialist', department: 'MID' },
  urdu: { designation: 'Subject Specialist', department: 'MID' },
  maths: { designation: 'Subject Specialist', department: 'SEC' },
  science: { designation: 'Subject Specialist', department: 'MID' },
  social: { designation: 'Subject Specialist', department: 'MID' },
  physics: { designation: 'Subject Specialist', department: 'SEC' },
  chemistry: { designation: 'Subject Specialist', department: 'SEC' },
  biology: { designation: 'Subject Specialist', department: 'SEC' },
  computer: { designation: 'Subject Specialist', department: 'SEC' },
  islamiyat: { designation: 'Nazra Teacher', department: 'PRI' },
  activities: { designation: 'Physical Education Instructor', department: 'SS' },
};

/** Support staff a campus has besides those with a sign-in account: [designation, department, gender]. */
const supportAt: Record<string, readonly (readonly [string, string, 'male' | 'female' | 'any'])[]> =
  {
    MC: [
      ['Lab Assistant', 'SEC', 'any'],
      ['Office Assistant', 'ADM', 'male'],
      ['Helper', 'OPS', 'female'],
    ],
    CC: [
      ['Branch Administrator', 'ADM', 'female'],
      ['Accountant', 'FIN', 'female'],
      ['Cashier', 'FIN', 'female'],
      ['Receptionist', 'ADM', 'female'],
      ['Librarian', 'SS', 'female'],
      ['Driver', 'OPS', 'male'],
      ['Driver', 'OPS', 'male'],
      ['Security Guard', 'OPS', 'male'],
      ['Office Assistant', 'ADM', 'female'],
      ['Helper', 'OPS', 'female'],
    ],
    AN: [],
  };

const banks = ['HBL', 'UBL', 'MCB Bank', 'Meezan Bank', 'Allied Bank', 'Bank Alfalah'];
const universities = [
  'University of the Punjab',
  'Allama Iqbal Open University',
  'Government College University, Lahore',
  'University of Education, Lahore',
  'Lahore College for Women University',
  'University of Karachi',
];

export async function seedStaff(
  school: School,
  setup: SetupRefs,
  subjectIds: Record<string, string>,
  sections: readonly SectionPlan[],
  accounts: readonly SeedAccount[],
): Promise<StaffRefs> {
  const { tx, stamps, today } = school;
  const rand = random(`${school.key}:staff`);
  const city = school.key === 'roshan' ? 'Lahore' : 'Karachi';
  const branches = Object.keys(school.branchIds);
  const home = branches[0] as string;

  // ---- departments and designations
  const departmentIds = Object.fromEntries(
    departmentList.map((department) => [
      department.code,
      school.id(`department:${department.code}`),
    ]),
  );
  await insertAll(
    tx,
    departments,
    departmentList.map((department) => ({
      id: departmentIds[department.code] as string,
      ...stamps,
      name: department.name,
      nameUr: department.nameUr,
      code: department.code,
    })),
  );
  const designationIds = Object.fromEntries(
    designationList.map(([name]) => [name, school.id(`designation:${name}`)]),
  );
  await insertAll(
    tx,
    designations,
    designationList.map(([name, category, teaching], index) => ({
      id: designationIds[name] as string,
      ...stamps,
      name,
      category,
      isTeaching: teaching === true,
      payGrade: 20 - Math.min(index, 19),
    })),
  );

  // ---- who works here
  const people: Person[] = [];
  const usedNames = new Set<string>(accounts.map((account) => account.fullName));
  const takeName = (gender: 'male' | 'female', label: string): string => {
    const pick = random(`${school.key}:staff-name:${label}`);
    for (let attempt = 0; attempt < 200; attempt++) {
      const name = fullName(
        pick.pick(gender === 'male' ? maleNames : femaleNames),
        pick.pick(surnames),
      ).en;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
    throw new Error(`Ran out of names for ${label}`);
  };
  const yearsAgo = (min: number, max: number, pick: Random) =>
    addDays(addYears(today, -pick.int(min, max)), -pick.int(0, 300));
  const add = (
    person: Omit<Person, 'serial' | 'employmentType' | 'joinedOn' | 'status'> &
      Partial<Pick<Person, 'employmentType' | 'joinedOn' | 'status'>>,
  ): Person => {
    const pick = random(`${school.key}:staff-dates:${person.id}`);
    const joinedOn = person.joinedOn ?? yearsAgo(1, 11, pick);
    const employmentType = person.employmentType ?? 'permanent';
    const full: Person = {
      status: 'active',
      ...person,
      employmentType,
      joinedOn,
      serial: people.length + 1,
      ...(employmentType === 'permanent' &&
        !person.confirmedOn && { confirmedOn: addMonths(joinedOn, 3) }),
    };
    people.push(full);
    return full;
  };

  // People with a sign-in account. A staff account's record id is fixed by its email.
  const accountKinds: Record<string, TeacherKind> = {
    'class.teacher@roshan.test': 'english',
    'subject.teacher@roshan.test': 'maths',
    'teacher.parent@roshan.test': 'science',
    'teacher@alnoor.test': 'class',
  };
  for (const account of accounts) {
    if (account.role === 'guardian' || account.role === 'student') continue;
    const kind = accountKinds[account.email];
    const place =
      kind && account.role === 'class_teacher' && school.key === 'alnoor'
        ? teacherPlace.class
        : (byRole[account.role] ?? { designation: 'Office Assistant', department: 'ADM' });
    add({
      id: seedId(`person:${account.email}`),
      fullName: account.fullName,
      gender: genderOf(account.fullName),
      branch: account.branches?.[0] ?? home,
      email: account.email,
      designation: place.designation,
      department: place.department,
      ...(kind && { kind }),
    });
  }

  // People the plan names, at the demonstration school only.
  const named: Record<string, Person> = {};
  if (school.key === 'roshan') {
    named.rabia = add({
      id: school.id('staff:rabia-anwar'),
      fullName: 'Rabia Anwar',
      gender: 'female',
      branch: 'MC',
      kind: 'urdu',
      ...teacherPlace.urdu,
    });
    // On probation that ends in ten days: the reminder and the "confirm" action have something to show.
    named.kamran = add({
      id: school.id('staff:kamran-yousaf'),
      fullName: 'Kamran Yousaf',
      gender: 'male',
      branch: 'MC',
      kind: 'class',
      ...teacherPlace.class,
      designation: 'Junior Teacher',
      employmentType: 'probation',
      joinedOn: addDays(today, -80),
      probationEndsOn: addDays(today, 10),
    });
    named.secondProbation = add({
      id: school.id('staff:probation-2'),
      fullName: 'Kinza Abbasi',
      gender: 'female',
      branch: 'CC',
      kind: 'class',
      ...teacherPlace.class,
      designation: 'Junior Teacher',
      employmentType: 'probation',
      joinedOn: addDays(today, -66),
      probationEndsOn: addDays(today, 24),
    });
    // Left in August, came back in October, on the same employee number.
    named.waqas = add({
      id: school.id('staff:waqas-latif'),
      fullName: 'Waqas Latif',
      gender: 'male',
      branch: 'MC',
      kind: 'social',
      ...teacherPlace.social,
      joinedOn: addYears(today, -4),
    });
    named.onContract = add({
      id: school.id('staff:contract-1'),
      fullName: 'Owais Tahir',
      gender: 'male',
      branch: 'MC',
      kind: 'computer',
      ...teacherPlace.computer,
      employmentType: 'contract',
      joinedOn: setup.current.start,
      contractEndsOn: setup.current.end,
    });
    named.contractNurse = add({
      id: school.id('staff:contract-2'),
      fullName: 'Haleema Rizvi',
      gender: 'female',
      branch: 'CC',
      designation: 'Nurse',
      department: 'SS',
      employmentType: 'contract',
      joinedOn: setup.current.start,
      contractEndsOn: setup.current.end,
    });
    named.suspended = add({
      id: school.id('staff:suspended'),
      fullName: 'Nadeem Awan',
      gender: 'male',
      branch: 'MC',
      designation: 'Office Assistant',
      department: 'ADM',
      status: 'suspended',
    });
    // Resigned and serving notice: the clearance is under way.
    named.onNotice = add({
      id: school.id('staff:on-notice'),
      fullName: 'Sajid Niazi',
      gender: 'male',
      branch: 'MC',
      designation: 'Library Assistant',
      department: 'SS',
      status: 'notice',
      lastWorkingDay: addDays(today, 18),
    });
    named.leftTeacher = add({
      id: school.id('staff:left-1'),
      fullName: 'Uzma Kazmi',
      gender: 'female',
      branch: 'MC',
      kind: 'english',
      ...teacherPlace.english,
      status: 'left',
      lastWorkingDay: addDays(today, -110),
    });
    named.leftDriver = add({
      id: school.id('staff:left-2'),
      fullName: 'Babar Gill',
      gender: 'male',
      branch: 'MC',
      designation: 'Driver',
      department: 'OPS',
      status: 'left',
      lastWorkingDay: addDays(today, -75),
    });
  }

  // Teachers each campus still needs for its sections, then its support staff.
  for (const branch of branches) {
    const needed = teachersNeeded(sections.filter((section) => section.branch === branch));
    const womenOnly = school.key === 'roshan' && branch === 'CC';
    for (const kind of Object.keys(teacherKinds) as TeacherKind[]) {
      const have = people.filter(
        (person) => person.branch === branch && person.kind === kind && person.status !== 'left',
      ).length;
      for (let index = have; index < needed[kind]; index++) {
        const label = `${branch}:${kind}:${index}`;
        const gender =
          womenOnly || random(`${school.key}:gender:${label}`).chance(0.7) ? 'female' : 'male';
        add({
          id: school.id(`staff:teacher:${label}`),
          fullName: takeName(gender, label),
          gender,
          branch,
          kind,
          ...teacherPlace[kind],
        });
      }
    }
    for (const [index, [designation, department, wanted]] of (supportAt[branch] ?? []).entries()) {
      const label = `${branch}:support:${index}`;
      const gender =
        wanted === 'any'
          ? random(`${school.key}:gender:${label}`).chance(0.5)
            ? 'female'
            : 'male'
          : wanted;
      add({
        id: school.id(`staff:${label}`),
        fullName: takeName(gender, label),
        gender,
        branch,
        designation,
        department,
      });
    }
  }

  // ---- the staff table
  const wingOf = (person: Person): string | null => {
    if (school.key !== 'roshan' || !person.kind) return null;
    const stage = { PRI: 'primary', MID: 'middle', SEC: 'secondary' }[person.department];
    // City Campus has no secondary wing, and some teachers belong to no wing.
    if (!stage || (person.branch === 'CC' && stage === 'secondary')) return null;
    return seedId(`wing:${person.branch}:${stage}`);
  };
  // Staff numbers come from a part of the seed's block that guardians never reach.
  let phone = school.key === 'roshan' ? 3_000_000 : 3_100_000;
  await insertAll(
    tx,
    staff,
    people.map((person) => ({
      id: person.id,
      ...stamps,
      employeeNo: `E-${String(person.serial).padStart(4, '0')}`,
      fullName: person.fullName,
      fullNameUr: urduOf(person.fullName),
      gender: person.gender,
      designationId: designationIds[person.designation] as string,
      departmentId: departmentIds[person.department] as string,
      homeBranchId: branchOf(school, person.branch),
      wingId: wingOf(person),
      staffType: person.kind ? ('teaching' as const) : ('non_teaching' as const),
      employmentType: person.employmentType,
      joinedOn: person.joinedOn,
      probationEndsOn: person.probationEndsOn ?? null,
      confirmedOn: person.confirmedOn ?? null,
      contractEndsOn: person.contractEndsOn ?? null,
      lastWorkingDay: person.lastWorkingDay ?? null,
      status: person.status,
      workPhone: mobileNumber(phone++),
      workEmail: person.email ?? null,
      shiftId: setup.shiftIds[person.branch] ?? null,
      teachableSubjectIds: person.kind
        ? teacherKinds[person.kind].map((code) => subjectIds[code] as string)
        : [],
      // A class teacher keeps time for their class; a subject specialist may fill the week.
      maxLessonsPerWeek: person.kind ? (person.kind === 'class' ? 30 : 36) : null,
    })),
  );

  // Who reports to whom: a campus to its principal, principals and group heads to the director, the director to the owner.
  const byRoleAt = (role: RoleKey, branch?: string) =>
    people.find((person) => {
      const account = accounts.find((candidate) => candidate.email === person.email);
      return account?.role === role && (!branch || person.branch === branch);
    });
  const owner = byRoleAt('owner');
  const director = byRoleAt('director') ?? owner;
  for (const person of people) {
    const principal = byRoleAt('principal', person.branch);
    const account = accounts.find((candidate) => candidate.email === person.email);
    const boss =
      person === owner
        ? undefined
        : person === director
          ? owner
          : !account?.branches || account.role === 'principal'
            ? director
            : principal;
    const reportsTo = account ? boss : (principal ?? director);
    if (reportsTo && reportsTo !== person)
      await tx.execute(
        sql`update staff set reports_to_staff_id = ${reportsTo.id}::uuid where id = ${person.id}::uuid`,
      );
  }
  const heads: Record<string, Person | undefined> = {
    ADM: director,
    FIN: byRoleAt('finance_head') ?? byRoleAt('accountant'),
    HR: byRoleAt('hr_manager'),
    SEC: byRoleAt('academic_head'),
    MID: byRoleAt('coordinator'),
    PRI: byRoleAt('section_head'),
    OPS: byRoleAt('transport_manager'),
    SS: byRoleAt('counsellor'),
  };
  for (const [code, head] of Object.entries(heads)) {
    if (head)
      await tx.execute(
        sql`update departments set head_staff_id = ${head.id}::uuid where id = ${departmentIds[code] as string}::uuid`,
      );
  }

  // ---- private details, bank account, qualifications, experience, contract, history
  const privateRows: (typeof staffPrivate.$inferInsert)[] = [];
  const bankRows: (typeof staffBankAccounts.$inferInsert)[] = [];
  const qualificationRows: (typeof staffQualifications.$inferInsert)[] = [];
  const experienceRows: (typeof staffExperience.$inferInsert)[] = [];
  const contractRows: (typeof employmentContracts.$inferInsert)[] = [];
  const movementRows: (typeof staffMovements.$inferInsert)[] = [];
  const append = { orgId: school.orgId, createdAt: school.now };

  for (const person of people) {
    const pick = random(`${school.key}:staff-detail:${person.id}`);
    const ageAtJoining = pick.int(22, 40);
    privateRows.push({
      id: school.id(`staff-private:${person.id}`),
      ...stamps,
      staffId: person.id,
      cnic: identityNumber(person.serial + (school.key === 'roshan' ? 0 : 5000), 0),
      cnicExpiresOn: addYears(today, pick.int(1, 9)),
      dateOfBirth: addDays(addYears(person.joinedOn, -ageAtJoining), -pick.int(0, 364)),
      maritalStatus: pick.chance(0.7) ? 'married' : 'single',
      religion: 'Islam',
      personalPhone: mobileNumber(phone++),
      address: addressIn(city, pick),
      city,
      emergencyName: fullName(
        pick.pick(pick.chance(0.5) ? maleNames : femaleNames),
        pick.pick(surnames),
      ).en,
      emergencyPhone: mobileNumber(phone++),
      emergencyRelation: pick.pick(['Spouse', 'Father', 'Brother', 'Sister', 'Mother']),
    });
    bankRows.push({
      id: school.id(`staff-bank:${person.id}`),
      ...stamps,
      staffId: person.id,
      bankName: pick.pick(banks),
      accountTitle: person.fullName,
      accountNo: String(pick.int(10_000_000, 99_999_999)) + String(pick.int(100_000, 999_999)),
      isPrimary: true,
    });
    if (person.kind) {
      const subject = teacherKinds[person.kind][0];
      qualificationRows.push({
        id: school.id(`staff-qualification:${person.id}:1`),
        ...stamps,
        staffId: person.id,
        level:
          person.kind === 'islamiyat'
            ? 'dars_e_nizami'
            : pick.chance(0.55)
              ? 'masters'
              : 'bachelors',
        title:
          person.kind === 'islamiyat'
            ? 'Shahadat-ul-Aalamiya'
            : person.kind === 'class'
              ? 'BA Education'
              : `MSc ${subject === 'ENG' ? 'English' : subject === 'URD' ? 'Urdu' : subject === 'MATH' ? 'Mathematics' : 'Sciences'}`,
        institution: pick.pick(universities),
        year: Number(person.joinedOn.slice(0, 4)) - pick.int(1, 6),
        isVerified: pick.chance(0.8),
      });
      if (pick.chance(0.6))
        qualificationRows.push({
          id: school.id(`staff-qualification:${person.id}:2`),
          ...stamps,
          staffId: person.id,
          level: 'b_ed',
          title: 'B.Ed',
          institution: 'Allama Iqbal Open University',
          year: Number(person.joinedOn.slice(0, 4)) - pick.int(0, 3),
          isVerified: true,
        });
    }
    if (pick.chance(0.4)) {
      const from = addYears(person.joinedOn, -pick.int(2, 6));
      experienceRows.push({
        id: school.id(`staff-experience:${person.id}`),
        ...stamps,
        staffId: person.id,
        employer: pick.pick([
          'The City Scholars School',
          'Al-Falah Public School',
          'Bright Future Academy',
          'Crescent Model School',
        ]),
        role: person.designation,
        fromDate: from,
        toDate: addDays(person.joinedOn, -pick.int(10, 60)),
        reasonForLeaving: 'Better opportunity',
      });
    }
    contractRows.push({
      id: school.id(`staff-contract:${person.id}`),
      ...stamps,
      staffId: person.id,
      kind: 'appointment',
      startsOn: person.joinedOn,
      endsOn: person.contractEndsOn ?? null,
      status: person.status === 'left' ? 'terminated' : 'active',
    });
    movementRows.push({
      id: school.id(`staff-movement:${person.id}:joined`),
      ...append,
      staffId: person.id,
      kind: 'joined',
      effectiveOn: person.joinedOn,
      toValue: { branchId: branchOf(school, person.branch), status: 'active' },
    });
    if (person.confirmedOn && person.confirmedOn <= today)
      movementRows.push({
        id: school.id(`staff-movement:${person.id}:confirmed`),
        ...append,
        staffId: person.id,
        kind: 'confirmed',
        effectiveOn: person.confirmedOn,
      });
  }

  // ---- exits: one in clearance, three finished (one of whom came back)
  const exitRows: (typeof staffExits.$inferInsert)[] = [];
  const cleared = (status: 'pending' | 'clear') => [
    { key: 'library', label: 'Library books returned', ownerRole: 'librarian', status },
    { key: 'inventory', label: 'School property returned', ownerRole: 'store_keeper', status },
    { key: 'finance', label: 'Advances and loans settled', ownerRole: 'accountant', status },
    { key: 'it', label: 'Accounts closed', ownerRole: 'it_admin', status },
  ];
  if (named.onNotice) {
    exitRows.push({
      id: school.id('staff-exit:on-notice'),
      ...stamps,
      staffId: named.onNotice.id,
      kind: 'resignation',
      noticeDate: addDays(today, -12),
      lastWorkingDay: named.onNotice.lastWorkingDay as string,
      reason: 'Moving to another city',
      clearance: [
        { ...cleared('clear')[0], doneAt: noonOn(addDays(today, -3)) },
        ...cleared('pending').slice(1),
      ],
      status: 'clearance',
    });
  }
  for (const person of [named.leftTeacher, named.leftDriver]) {
    if (!person?.lastWorkingDay) continue;
    exitRows.push({
      id: school.id(`staff-exit:${person.id}`),
      ...stamps,
      staffId: person.id,
      kind: person === named.leftDriver ? 'contract_end' : 'resignation',
      noticeDate: addDays(person.lastWorkingDay, -30),
      lastWorkingDay: person.lastWorkingDay,
      reason: person === named.leftDriver ? 'Contract not renewed' : 'Family reasons',
      clearance: cleared('clear'),
      rehireEligible: true,
      status: 'closed',
    });
    movementRows.push({
      id: school.id(`staff-movement:${person.id}:left`),
      ...append,
      staffId: person.id,
      kind: 'left',
      effectiveOn: person.lastWorkingDay,
      fromValue: { status: 'active' },
      toValue: { status: 'left' },
    });
  }
  if (named.waqas) {
    const left = addDays(today, -62);
    const back = addDays(today, -8);
    exitRows.push({
      id: school.id('staff-exit:waqas'),
      ...stamps,
      staffId: named.waqas.id,
      kind: 'resignation',
      noticeDate: addDays(left, -30),
      lastWorkingDay: left,
      reason: 'Went abroad',
      clearance: cleared('clear'),
      rehireEligible: true,
      status: 'closed',
    });
    movementRows.push(
      {
        id: school.id('staff-movement:waqas:left'),
        ...append,
        staffId: named.waqas.id,
        kind: 'left',
        effectiveOn: left,
        fromValue: { status: 'active' },
        toValue: { status: 'left' },
      },
      {
        id: school.id('staff-movement:waqas:rejoined'),
        ...append,
        staffId: named.waqas.id,
        kind: 'rejoined',
        effectiveOn: back,
        fromValue: { status: 'left' },
        toValue: { status: 'active' },
        reason: 'Rejoined on the same employee number',
      },
    );
  }
  // A few promotions and transfers, so the history screen has more than a first line.
  const namedIds = new Set(Object.values(named).map((person) => person.id));
  const movers = people
    .filter((person) => person.status === 'active' && !person.email && !namedIds.has(person.id))
    .slice(0, 8);
  for (const [index, person] of movers.entries()) {
    const on = addMonths(person.joinedOn, 14 + index);
    if (on >= today) continue;
    movementRows.push({
      id: school.id(`staff-movement:${person.id}:step`),
      ...append,
      staffId: person.id,
      kind: index % 2 === 0 ? 'promotion' : 'redesignation',
      effectiveOn: on,
      fromValue: { designationId: designationIds['Junior Teacher'] },
      toValue: { designationId: designationIds[person.designation] },
      orderNo: `OO-${on.slice(0, 4)}-${String(index + 1).padStart(3, '0')}`,
    });
  }

  await insertAll(tx, staffPrivate, privateRows);
  await insertAll(tx, staffBankAccounts, bankRows);
  await insertAll(tx, staffQualifications, qualificationRows);
  await insertAll(tx, staffExperience, experienceRows);
  await insertAll(tx, employmentContracts, contractRows);
  await insertAll(tx, staffMovements, movementRows);
  await insertAll(tx, staffExits, exitRows);

  // ---- requests to correct one's own details
  const askers = people.filter((person) => person.status === 'active' && person.kind).slice(0, 3);
  await insertAll(
    tx,
    staffChangeRequests,
    askers.map((person, index) => ({
      id: school.id(`staff-change:${index}`),
      ...stamps,
      staffId: person.id,
      changes:
        index === 0
          ? { personalPhone: mobileNumber(phone++) }
          : index === 1
            ? { address: addressIn(city, rand) }
            : { emergencyPhone: mobileNumber(phone++) },
      status: index === 2 ? ('approved' as const) : ('pending' as const),
      reviewedAt: index === 2 ? noonOn(addDays(today, -4)) : null,
      reviewNote: index === 2 ? 'Updated' : null,
    })),
  );

  // ---- recruitment: five openings, forty applicants, a few interviews
  if (school.key === 'roshan') {
    const openings = [
      {
        key: 'maths',
        title: 'Mathematics Teacher (Secondary)',
        designation: 'Subject Specialist',
        department: 'SEC',
        branch: 'MC',
        status: 'open',
        isPublic: true,
        positions: 1,
      },
      {
        key: 'primary',
        title: 'Primary Class Teacher',
        designation: 'Teacher',
        department: 'PRI',
        branch: 'CC',
        status: 'open',
        isPublic: true,
        positions: 2,
      },
      {
        key: 'accounts',
        title: 'Accounts Assistant',
        designation: 'Accountant',
        department: 'FIN',
        branch: 'MC',
        status: 'on_hold',
        isPublic: false,
        positions: 1,
      },
      {
        key: 'driver',
        title: 'Van Driver',
        designation: 'Driver',
        department: 'OPS',
        branch: 'CC',
        status: 'filled',
        isPublic: false,
        positions: 1,
      },
      {
        key: 'it',
        title: 'IT Support Officer',
        designation: 'IT Administrator',
        department: 'ADM',
        branch: 'MC',
        status: 'draft',
        isPublic: false,
        positions: 1,
      },
    ] as const;
    await insertAll(
      tx,
      jobOpenings,
      openings.map((opening, index) => ({
        id: school.id(`opening:${opening.key}`),
        ...stamps,
        title: opening.title,
        designationId: designationIds[opening.designation] as string,
        departmentId: departmentIds[opening.department] as string,
        branchId: branchOf(school, opening.branch),
        positions: opening.positions,
        employmentType: 'permanent',
        description: `${opening.title} at ${opening.branch === 'MC' ? 'Main Campus' : 'City Campus'}.`,
        requirements: 'A relevant degree and at least two years of experience.',
        salaryMin: (35_000 + index * 5_000) * 100,
        salaryMax: (55_000 + index * 8_000) * 100,
        opensOn: addDays(today, -30 + index * 3),
        closesOn: opening.status === 'filled' ? addDays(today, -5) : addDays(today, 15),
        isPublic: opening.isPublic,
        status: opening.status,
      })),
    );
    const stages = [
      'applied',
      'applied',
      'shortlisted',
      'interview',
      'demo_lesson',
      'offered',
      'hired',
      'rejected',
      'withdrawn',
    ] as const;
    const applicantRows: (typeof jobApplicants.$inferInsert)[] = [];
    const interviewRows: (typeof applicantInterviews.$inferInsert)[] = [];
    const panel = [byRoleAt('principal', 'MC'), byRoleAt('hr_manager')].flatMap((person) =>
      person ? [person.id] : [],
    );
    for (let index = 0; index < 40; index++) {
      const pick = random(`${school.key}:applicant:${index}`);
      const opening = openings[index % 4] as (typeof openings)[number];
      const gender = pick.chance(0.6) ? 'female' : 'male';
      const stage =
        opening.status === 'filled' && index < 4
          ? 'hired'
          : (stages[index % stages.length] as (typeof stages)[number]);
      const id = school.id(`applicant:${index}`);
      applicantRows.push({
        id,
        ...stamps,
        openingId: school.id(`opening:${opening.key}`),
        fullName: fullName(
          pick.pick(gender === 'male' ? maleNames : femaleNames),
          pick.pick(surnames),
        ).en,
        phone: mobileNumber(phone++),
        gender,
        highestQualification: pick.pick(['BA', 'BSc', 'MA', 'MSc', 'B.Ed', 'Intermediate']),
        experienceYears: pick.int(0, 12),
        expectedSalary: pick.int(30, 70) * 1000 * 100,
        source: pick.pick(['website', 'walk_in', 'referral', 'job_portal', 'newspaper'] as const),
        stage,
        rating: ['applied', 'withdrawn'].includes(stage) ? null : pick.int(2, 5),
        rejectedReason: stage === 'rejected' ? 'Not enough experience' : null,
      });
      if (['interview', 'demo_lesson', 'offered', 'hired', 'rejected'].includes(stage)) {
        interviewRows.push({
          id: school.id(`interview:${index}`),
          ...stamps,
          applicantId: id,
          kind: stage === 'demo_lesson' ? 'demo_lesson' : 'interview',
          scheduledAt: noonOn(
            addDays(today, stage === 'interview' ? 2 + (index % 4) : -3 - (index % 9)),
          ),
          panelStaffIds: panel,
          result: stage === 'interview' ? 'pending' : stage === 'rejected' ? 'fail' : 'pass',
          score: stage === 'interview' ? null : pick.int(50, 95),
        });
      }
    }
    await insertAll(tx, jobApplicants, applicantRows);
    await insertAll(tx, applicantInterviews, interviewRows);
  }

  await setCounter(school, 'employee', people.length + 1);

  const working = (person: Person) => person.status === 'active' || person.status === 'on_leave';
  return {
    all: people,
    teachers: (branch, kind) =>
      people.filter(
        (person) => person.branch === branch && person.kind === kind && working(person),
      ),
    byEmail: (email) => {
      const found = people.find((person) => person.email === email);
      if (!found) throw new Error(`No staff record was seeded for ${email}`);
      return found;
    },
    named,
  };
}

import { sql } from 'drizzle-orm';
import {
  enrollments,
  families,
  guardians,
  profileChangeRequests,
  promotionBatches,
  promotionItems,
  sectionChanges,
  studentGuardians,
  studentStatusHistory,
  studentSubjectOverrides,
  studentWithdrawals,
  students,
  transferRequests,
} from '../../schema';
import {
  addDays,
  branchOf,
  insertAll,
  noonOn,
  random,
  seedId,
  setCounter,
  ymd,
  type School,
} from '../context';
import {
  addressIn,
  femaleNames,
  identityNumber,
  maleNames,
  mobileNumber,
  occupations,
  surnames,
  urduOf,
} from '../people';
import type { CurriculumRefs, SectionRef } from './academics';
import { sectionKey } from './plan';
import type { SetupRefs } from './setup';
import type { StaffRef, StaffRefs } from './staff';

/*
 * M07 · Students: families, guardians and students with their enrolments for this year and the
 * last, the promotion that carried them forward, and a few of everything that can happen to a
 * student record: a transfer between campuses, a withdrawal, a request for a correction.
 *
 * Documents (B-Forms, previous results) are not seeded here: a document is an uploaded file, and
 * files arrive with the phase that builds uploads.
 */

type Gender = 'male' | 'female';

interface Child {
  /** A short name tests and other seeds use: `maryam-ahmed`. */
  key?: string;
  first: string;
  /** The whole name, when it is not the first name followed by the family's surname. */
  fullName?: string;
  gender: Gender;
  /** `MC:6-B`. */
  section: string;
  /** A sign-in account whose student record this is. */
  account?: string;
  medicalAlert?: string;
  religion?: 'islam' | 'christianity';
  isOrphan?: boolean;
  /** Days before today the child was admitted, for a recent admission. */
  admittedDaysAgo?: number;
  /** Came from this section of another campus, this many days ago. */
  transferredFrom?: { section: string; daysAgo: number };
  /** Withdrew this many days ago; the seat is then empty. */
  leftDaysAgo?: number;
  /** The staff member whose child this is: `nadia` or an account email. */
  staffParent?: string;
}

interface NamedFamily {
  key: string;
  surname: string;
  father?: { first: string; account?: string; deceased?: boolean; noCustody?: boolean };
  mother?: { first: string; account?: string };
  children: Child[];
}

const roshanFamilies: readonly NamedFamily[] = [
  {
    // Three siblings: sibling discounts, one family challan, one message for three children.
    key: 'ahmed',
    surname: 'Ahmed',
    father: { first: 'Farhan', account: 'guardian@roshan.test' },
    mother: { first: 'Samina' },
    children: [
      { key: 'hassan-ahmed', first: 'Hassan', gender: 'male', section: 'MC:3-A' },
      {
        key: 'maryam-ahmed',
        first: 'Maryam',
        gender: 'female',
        section: 'MC:6-B',
        account: 'student@roshan.test',
      },
      { key: 'usman-ahmed', first: 'Usman', gender: 'male', section: 'MC:9-A' },
    ],
  },
  {
    // Children at two campuses: family dues and credit across branches.
    key: 'malik',
    surname: 'Malik',
    father: { first: 'Tariq' },
    mother: { first: 'Bushra' },
    children: [
      { key: 'sara-malik', first: 'Sara', gender: 'female', section: 'CC:4-A' },
      { key: 'omar-malik', first: 'Omar', gender: 'male', section: 'MC:8-A' },
    ],
  },
  {
    // The family that falls behind with fees.
    key: 'hussain',
    surname: 'Hussain',
    father: { first: 'Shahid' },
    children: [
      { key: 'ali-hussain', first: 'Ali', gender: 'male', section: 'MC:5-B' },
      { key: 'hina-hussain', first: 'Hina', gender: 'female', section: 'MC:7-A' },
    ],
  },
  {
    key: 'sheikh',
    surname: 'Sheikh',
    father: { first: 'Imran' },
    children: [{ key: 'zara-sheikh', first: 'Zara', gender: 'female', section: 'CC:2-A' }],
  },
  {
    // A staff child: her mother, Ms Nadia Raza, teaches at the school.
    key: 'raza',
    surname: 'Raza',
    father: { first: 'Asad' },
    mother: { first: 'Nadia' },
    children: [
      {
        key: 'ayesha-raza',
        first: 'Ayesha',
        gender: 'female',
        section: 'MC:7-B',
        staffParent: 'class.teacher@roshan.test',
      },
    ],
  },
  {
    // A father who has no custody: he is in the family, and reaches nothing of the child.
    key: 'khan',
    surname: 'Khan',
    father: { first: 'Junaid', noCustody: true },
    mother: { first: 'Saba' },
    children: [{ key: 'bilal-khan', first: 'Bilal', gender: 'male', section: 'MC:9-A' }],
  },
  {
    key: 'noor',
    surname: 'Noor',
    father: { first: 'Yasir' },
    mother: { first: 'Asma' },
    children: [
      {
        key: 'fatima-noor',
        first: 'Fatima',
        gender: 'female',
        section: 'MC:5-A',
        medicalAlert: 'Severe nut allergy. Carries an adrenaline pen; call the nurse at once.',
      },
    ],
  },
  {
    key: 'tariq',
    surname: 'Tariq',
    father: { first: 'Salman' },
    children: [{ key: 'hamza-tariq', first: 'Hamza', gender: 'male', section: 'MC:8-A' }],
  },
  {
    key: 'ali',
    surname: 'Ali',
    father: { first: 'Asif' },
    mother: { first: 'Uzma' },
    children: [{ key: 'zainab-ali', first: 'Zainab', gender: 'female', section: 'CC:6-A' }],
  },
  {
    // Takes Ethics in place of Islamiyat.
    key: 'masih',
    surname: 'Masih',
    father: { first: 'Yusuf' },
    children: [
      {
        key: 'daniel-masih',
        first: 'Daniel',
        gender: 'male',
        section: 'MC:9-B',
        religion: 'christianity',
      },
    ],
  },
  {
    // An orphan: her father has died and her mother is her guardian.
    key: 'aslam',
    surname: 'Aslam',
    father: { first: 'Muhammad', deceased: true },
    mother: { first: 'Rubina' },
    children: [
      {
        key: 'noor-fatima',
        first: 'Noor',
        fullName: 'Noor Fatima',
        gender: 'female',
        section: 'MC:10-A',
        isOrphan: true,
      },
    ],
  },
  {
    key: 'qureshi',
    surname: 'Qureshi',
    father: { first: 'Faisal' },
    children: [
      {
        key: 'ibrahim-qureshi',
        first: 'Ibrahim',
        gender: 'male',
        section: 'MC:4-B',
        admittedDaysAgo: 3,
      },
    ],
  },
  {
    key: 'javed',
    surname: 'Javed',
    father: { first: 'Naveed' },
    children: [
      {
        key: 'sana-javed',
        first: 'Sana',
        gender: 'female',
        section: 'MC:6-A',
        transferredFrom: { section: 'CC:6-A', daysAgo: 30 },
      },
    ],
  },
  {
    key: 'shah',
    surname: 'Shah',
    father: { first: 'Zubair' },
    children: [
      { key: 'adeel-shah', first: 'Adeel', gender: 'male', section: 'MC:8-B', leftDaysAgo: 24 },
    ],
  },
  {
    // A teacher who is also a parent here: one sign-in, two memberships.
    key: 'arif',
    surname: 'Arif',
    father: { first: 'Kashif' },
    mother: { first: 'Sobia', account: 'teacher.parent@roshan.test' },
    children: [
      {
        key: 'rayyan-arif',
        first: 'Rayyan',
        gender: 'male',
        section: 'MC:3-B',
        staffParent: 'teacher.parent@roshan.test',
      },
    ],
  },
  {
    // A father with a child here and another at Al-Noor.
    key: 'mehmood',
    surname: 'Mehmood',
    father: { first: 'Kashif', account: 'guardian.both@roshan.test' },
    children: [{ key: 'zain-mehmood', first: 'Zain', gender: 'male', section: 'MC:2-B' }],
  },
];

const alnoorFamilies: readonly NamedFamily[] = [
  {
    key: 'memon',
    surname: 'Memon',
    father: { first: 'Rashid', account: 'guardian@alnoor.test' },
    children: [
      {
        key: 'zainab-memon',
        first: 'Zainab',
        gender: 'female',
        section: 'AN:5-A',
        account: 'student@alnoor.test',
      },
    ],
  },
  {
    key: 'mehmood',
    surname: 'Mehmood',
    father: { first: 'Kashif', account: 'guardian.both@roshan.test' },
    children: [{ key: 'dua-mehmood', first: 'Dua', gender: 'female', section: 'AN:3-A' }],
  },
];

interface FamilyRow {
  id: string;
  code: string;
  surname: string;
  fatherFirst: string;
  fatherId?: string;
  motherId?: string;
  primaryGuardianId: string;
  /** Guardians who may be linked to the family's children: [id, relation, isPrimary, linked]. */
  guardians: { id: string; relation: 'father' | 'mother'; primary: boolean; linked: boolean }[];
  children: number;
  grades: Set<number>;
  branch: string;
  fatherDeceased: boolean;
  /** Whether the seed may add another child to this family. Named families stay exactly as the plan describes them. */
  open: boolean;
}

interface StudentRow {
  id: string;
  key?: string;
  family: FamilyRow;
  fullName: string;
  gender: Gender;
  section: SectionRef;
  admissionGrade: number;
  admittedOn: string;
  admissionBranch: string;
  status: 'active' | 'left';
  leftOn?: string;
  transferredFrom?: { section: SectionRef; on: string };
  detainedLastYear?: boolean;
}

/** A seeded student, as later waves need to know them. */
export interface SeededStudent {
  id: string;
  /** Set for the students the plan names: `maryam-ahmed`. */
  key?: string;
  fullName: string;
  gender: 'male' | 'female';
  /** Branch code. */
  branch: string;
  grade: number;
  section: SectionRef;
  familyId: string;
  /** The primary guardian. */
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
  status: 'active' | 'left';
  leftOn?: string;
  /** Roll number in the section above; nobody who has left holds one. */
  rollNo?: number;
  /**
   * Where the student has sat this year, oldest first. One entry for most; two for a child who moved
   * to another campus or to the other section of their grade. Attendance, homework and marks of a
   * day belong to the section the student was in on that day.
   */
  stays: StudentStay[];
}

export interface StudentStay {
  section: SectionRef;
  /** The enrolment the student held in that section. */
  enrollmentId: string;
  /** The first day in the section. */
  from: string;
  /** The last day in the section; left out while the student is still there. */
  to?: string;
}

/** The section a student sat in on a date, or nothing when they were not enrolled that day. */
export const stayOn = (student: SeededStudent, date: string): StudentStay | undefined =>
  student.stays.find((stay) => stay.from <= date && (stay.to === undefined || date <= stay.to));

export interface StudentRefs {
  /** Every student written, enrolled or left, in a fixed order. */
  roster: SeededStudent[];
  /** Named students by key (`maryam-ahmed`) → ids. */
  named: Record<string, { studentId: string; familyId: string }>;
  /** Sign-in email → the guardian or student record it belongs to at this school. */
  accounts: Map<string, { kind: 'guardian' | 'student'; personId: string }>;
  counts: { students: number; families: number; guardians: number };
}

export async function seedStudents(
  school: School,
  setup: SetupRefs,
  curriculum: CurriculumRefs,
  sections: readonly SectionRef[],
  staff: StaffRefs,
): Promise<StudentRefs> {
  const { tx, stamps, today } = school;
  const city = school.key === 'roshan' ? 'Lahore' : 'Karachi';
  const append = { orgId: school.orgId, createdAt: school.now };
  const sectionByKey = new Map(sections.map((section) => [sectionKey(section), section]));
  const sectionOf = (key: string): SectionRef => {
    const found = sectionByKey.get(key);
    if (!found) throw new Error(`${school.key} has no section ${key}`);
    return found;
  };

  const familyRows: (typeof families.$inferInsert)[] = [];
  const guardianRows: (typeof guardians.$inferInsert)[] = [];
  const linkRows: (typeof studentGuardians.$inferInsert)[] = [];
  const studentRows: (typeof students.$inferInsert)[] = [];
  const familyList: FamilyRow[] = [];
  const studentList: StudentRow[] = [];
  const accounts: StudentRefs['accounts'] = new Map();
  const named: StudentRefs['named'] = {};

  let familySerial = 0;
  let phoneSerial = school.key === 'roshan' ? 0 : 2_500_000;
  let identitySerial = school.key === 'roshan' ? 100_000 : 900_000;
  const admissionCounters = new Map<string, number>();

  // ------------------------------------------------------------------ families and guardians

  function makeFamily(input: {
    key: string;
    surname: string;
    branch: string;
    father?: NamedFamily['father'];
    mother?: NamedFamily['mother'];
    open?: boolean;
  }): FamilyRow {
    const pick = random(`${school.key}:family:${input.key}`);
    const id = school.id(`family:${input.key}`);
    const code = `F-${String(++familySerial).padStart(5, '0')}`;
    const address = addressIn(city, pick);
    const family: FamilyRow = {
      id,
      code,
      surname: input.surname,
      fatherFirst: input.father?.first ?? pick.pick(maleNames).en,
      primaryGuardianId: '',
      guardians: [],
      children: 0,
      grades: new Set(),
      branch: input.branch,
      fatherDeceased: input.father?.deceased === true,
      open: input.open === true,
    };
    const addGuardian = (
      relation: 'father' | 'mother',
      first: string,
      options: { account?: string; deceased?: boolean; noCustody?: boolean } = {},
    ) => {
      // A guardian with a sign-in has an id fixed by the email and the school: one person may be a
      // guardian at two schools, and a teacher's own staff record already uses the plain email.
      const guardianId = options.account
        ? seedId(`person:${options.account}:guardian:${school.key}`)
        : school.id(`guardian:${input.key}:${relation}`);
      const name = `${first} ${input.surname}`;
      const phone = mobileNumber(phoneSerial++);
      guardianRows.push({
        id: guardianId,
        ...stamps,
        familyId: id,
        fullName: name,
        fullNameUr: urduOf(name),
        cnic: pick.chance(0.85) || options.account ? identityNumber(identitySerial++, 0) : null,
        phone,
        whatsappPhone: pick.chance(0.8) ? phone : null,
        email: options.account ?? null,
        occupation:
          relation === 'father'
            ? pick.pick(occupations)
            : pick.chance(0.3)
              ? 'Teacher'
              : 'Homemaker',
        isDeceased: options.deceased === true,
      });
      family.guardians.push({
        id: guardianId,
        relation,
        primary: false,
        linked: !options.deceased && !options.noCustody,
      });
      if (relation === 'father') family.fatherId = guardianId;
      else family.motherId = guardianId;
      if (options.account)
        accounts.set(options.account, { kind: 'guardian', personId: guardianId });
    };

    addGuardian('father', family.fatherFirst, input.father);
    const fatherUsable = !input.father?.deceased && !input.father?.noCustody;
    if (input.mother || !fatherUsable || pick.chance(0.4))
      addGuardian('mother', input.mother?.first ?? pick.pick(femaleNames).en, input.mother);
    // The primary guardian: the father, unless he has died or has no custody.
    const primary =
      family.guardians.find((guardian) => guardian.linked && guardian.relation === 'father') ??
      family.guardians.find((guardian) => guardian.linked);
    if (!primary) throw new Error(`Family ${input.key} has nobody to be its primary guardian`);
    primary.primary = true;
    family.primaryGuardianId = primary.id;

    familyRows.push({
      id,
      ...stamps,
      familyCode: code,
      address,
      city,
      isTaxFiler: pick.chance(0.15),
      incomeBand: pick.pick([
        'not_stated',
        'under_50k',
        '50k_100k',
        '100k_250k',
        'over_250k',
      ] as const),
    });
    familyList.push(family);
    return family;
  }

  // ------------------------------------------------------------------ students

  const yearStart = (startYear: number) => ymd(startYear, school.yearStartMonth, 1);

  function makeStudent(input: {
    label: string;
    family: FamilyRow;
    first: string;
    gender: Gender;
    section: SectionRef;
    child?: Child;
    staffParent?: StaffRef;
    status?: 'active' | 'left';
    leftOn?: string;
    transferredFrom?: NonNullable<Child['transferredFrom']>;
  }): StudentRow {
    const { section, family, child } = input;
    const pick = random(`${school.key}:student:${input.label}`);
    const id = child?.account
      ? seedId(`person:${child.account}`)
      : school.id(`student:${input.label}`);
    const grade = section.grade;
    const cameFrom = child?.transferredFrom ?? input.transferredFrom;

    // Most children joined in Grade 1; some came later, a few this year.
    let admissionGrade = pick.chance(0.7) ? 1 : pick.int(1, grade);
    // A child who changed campus this year was already at the school last year.
    if (cameFrom && admissionGrade === grade) admissionGrade = Math.max(1, grade - 1);
    let admittedOn = addDays(
      yearStart(setup.current.startYear - (grade - admissionGrade)),
      pick.int(0, 20),
    );
    if (child?.admittedDaysAgo !== undefined) {
      admissionGrade = grade;
      admittedOn = addDays(today, -child.admittedDaysAgo);
    }
    if (admittedOn > today) admittedOn = today;

    const transferredFrom = cameFrom
      ? { section: sectionOf(cameFrom.section), on: addDays(today, -cameFrom.daysAgo) }
      : undefined;
    const admissionBranch = transferredFrom?.section.branch ?? section.branch;
    const counterKey = `${admissionBranch}:${admittedOn.slice(2, 4)}`;
    const serial = (admissionCounters.get(counterKey) ?? 0) + 1;
    admissionCounters.set(counterKey, serial);

    // A child in Grade 1 turns six around the start of the year.
    const birthYear = setup.current.startYear - (grade + 5);
    const dateOfBirth = ymd(birthYear, pick.int(1, 12), pick.int(1, 28));
    const fullName = child?.fullName ?? `${input.first} ${family.surname}`;
    const status = input.status ?? 'active';

    studentRows.push({
      id,
      ...stamps,
      branchId: branchOf(school, section.branch),
      familyId: family.id,
      admissionNo: `${admissionBranch}-${admittedOn.slice(2, 4)}-${String(serial).padStart(4, '0')}`,
      fullName,
      fullNameUr: urduOf(fullName),
      fatherName: `${family.fatherFirst} ${family.surname}`,
      gender: input.gender,
      dateOfBirth,
      placeOfBirth: city,
      bFormNo: pick.chance(0.6) || grade >= 9 ? identityNumber(identitySerial++, 1) : null,
      religion: child?.religion ?? 'islam',
      motherTongue: pick.pick(['Urdu', 'Punjabi', 'Urdu', 'Pashto', 'Urdu', 'Sindhi']),
      bloodGroup: pick.chance(0.4)
        ? 'unknown'
        : pick.pick(['a_pos', 'b_pos', 'o_pos', 'ab_pos', 'a_neg', 'b_neg', 'o_neg'] as const),
      admittedOn,
      admissionGradeId: curriculum.gradeIds[admissionGrade] as string,
      status,
      leftOn: input.leftOn ?? null,
      leavingReason: status === 'left' ? 'Moved to another school' : null,
      isOrphan: child?.isOrphan === true || family.fatherDeceased,
      staffParentId: input.staffParent?.id ?? null,
      medicalAlert: child?.medicalAlert ?? null,
    });

    for (const guardian of family.guardians) {
      const deceased = guardian.id === family.fatherId && family.fatherDeceased;
      linkRows.push({
        id: school.id(`student-guardian:${id}:${guardian.relation}`),
        ...stamps,
        studentId: id,
        guardianId: guardian.id,
        relation: guardian.relation,
        isPrimary: guardian.primary,
        canPickup: guardian.linked,
        receivesMessages: guardian.linked,
        isEmergencyContact: guardian.primary,
        // A guardian without custody keeps a record of the link, but it is no longer in force.
        deletedAt: guardian.linked || deceased ? null : school.now,
      });
    }

    family.children += 1;
    family.grades.add(grade);
    const row: StudentRow = {
      id,
      ...(child?.key && { key: child.key }),
      family,
      fullName,
      gender: input.gender,
      section,
      admissionGrade,
      admittedOn,
      admissionBranch,
      status,
      ...(input.leftOn && { leftOn: input.leftOn }),
      ...(transferredFrom && { transferredFrom }),
    };
    studentList.push(row);
    if (child?.key) named[child.key] = { studentId: id, familyId: family.id };
    if (child?.account) accounts.set(child.account, { kind: 'student', personId: id });
    return row;
  }

  // ---- the families the plan names
  const seats = new Map(sections.map((section) => [sectionKey(section), section.size]));
  const takeSeat = (key: string) => seats.set(key, Math.max(0, (seats.get(key) ?? 0) - 1));
  const staffParent = (who: string | undefined): StaffRef | undefined =>
    who ? staff.byEmail(who) : undefined;

  for (const definition of school.key === 'roshan' ? roshanFamilies : alnoorFamilies) {
    const first = definition.children[0] as Child;
    const family = makeFamily({
      key: definition.key,
      surname: definition.surname,
      branch: first.section.split(':')[0] as string,
      ...(definition.father && { father: definition.father }),
      ...(definition.mother && { mother: definition.mother }),
    });
    for (const child of definition.children) {
      const section = sectionOf(child.section);
      const left = child.leftDaysAgo !== undefined;
      const parent = staffParent(child.staffParent);
      makeStudent({
        label: `named:${child.key}`,
        family,
        first: child.first,
        gender: child.gender,
        section,
        child,
        ...(parent && { staffParent: parent }),
        ...(left && {
          status: 'left' as const,
          leftOn: addDays(today, -(child.leftDaysAgo as number)),
        }),
      });
      if (!left) takeSeat(child.section);
    }
  }

  // ---- children of staff: the family carries the staff member's surname
  const girlsOnly = (branch: string) => school.key === 'roshan' && branch === 'CC';
  if (school.key === 'roshan') {
    const parents = staff.all.filter((person) => person.status === 'active' && !person.email);
    const wanted = Math.min(school.size === 'small' ? 6 : 28, parents.length);
    for (let index = 0; index < wanted; index++) {
      const parent = parents[(index * 2) % parents.length] as StaffRef;
      const pick = random(`${school.key}:staff-child:${index}`);
      const candidates = sections.filter(
        (section) => section.branch === parent.branch && (seats.get(sectionKey(section)) ?? 0) > 0,
      );
      if (candidates.length === 0) continue;
      const section = pick.pick(candidates);
      const [parentFirst, ...rest] = parent.fullName.split(' ');
      const surname = rest.join(' ') || 'Khan';
      const family = makeFamily({
        key: `staff-child:${index}`,
        surname,
        branch: parent.branch,
        ...(parent.gender === 'male'
          ? { father: { first: parentFirst as string } }
          : { mother: { first: parentFirst as string } }),
      });
      const gender: Gender = girlsOnly(section.branch) || pick.chance(0.5) ? 'female' : 'male';
      makeStudent({
        label: `staff-child:${index}`,
        family,
        first: pick.pick(gender === 'male' ? maleNames : femaleNames).en,
        gender,
        section,
        staffParent: parent,
      });
      takeSeat(sectionKey(section));
    }
  }

  // ---- everyone else: each remaining seat is filled, about a third of the time by a sibling
  const orphanEvery = school.size === 'small' ? 60 : 46;
  let generated = 0;
  for (const section of sections) {
    const open = seats.get(sectionKey(section)) ?? 0;
    for (let seat = 0; seat < open; seat++) {
      const label = `${sectionKey(section)}:${seat}`;
      const pick = random(`${school.key}:seat:${label}`);
      generated += 1;
      let family: FamilyRow | undefined;
      if (pick.chance(0.32)) {
        const start = pick.int(0, Math.max(0, familyList.length - 1));
        for (let step = 0; step < 40 && !family; step++) {
          const candidate = familyList[(start + step) % familyList.length];
          if (
            candidate?.open &&
            candidate.children < 3 &&
            !candidate.grades.has(section.grade) &&
            // A girls' campus takes the daughters of families at either campus; otherwise siblings share a campus.
            (candidate.branch === section.branch || girlsOnly(section.branch))
          )
            family = candidate;
        }
      }
      family ??= makeFamily({
        key: `generated:${label}`,
        surname: pick.pick(surnames).en,
        branch: section.branch,
        open: true,
        // About one family in forty-six has lost the father: some 25 orphans in the standard seed.
        ...(generated % orphanEvery === 0 && {
          father: { first: pick.pick(maleNames).en, deceased: true },
        }),
      });
      const gender: Gender = girlsOnly(section.branch) || pick.chance(0.48) ? 'female' : 'male';
      // A few girls in Grades 2 to 8 came from the other campus this year.
      const other = section.branch === 'MC' ? 'CC' : 'MC';
      const cameFrom =
        school.key === 'roshan' &&
        school.size !== 'small' &&
        gender === 'female' &&
        section.grade >= 2 &&
        section.grade <= 8 &&
        generated % 37 === 11 &&
        sectionByKey.has(`${other}:${section.grade}-A`)
          ? { section: `${other}:${section.grade}-A`, daysAgo: 20 + (generated % 9) * 6 }
          : undefined;
      makeStudent({
        label,
        family,
        first: pick.pick(gender === 'male' ? maleNames : femaleNames).en,
        gender,
        section,
        ...(cameFrom && { transferredFrom: cameFrom }),
      });
    }
  }

  // ---- students who left during this year: they hold no seat
  const leavers = school.key === 'roshan' ? (school.size === 'small' ? 6 : 40) : 0;
  for (let index = 0; index < leavers; index++) {
    const pick = random(`${school.key}:leaver:${index}`);
    const section = pick.pick(sections);
    const family = makeFamily({
      key: `leaver:${index}`,
      surname: pick.pick(surnames).en,
      branch: section.branch,
    });
    const gender: Gender = girlsOnly(section.branch) || pick.chance(0.5) ? 'female' : 'male';
    const earliest = addDays(setup.current.start, 20);
    const span = Math.max(
      1,
      Math.floor((Date.parse(today) - Date.parse(earliest)) / 86_400_000) - 10,
    );
    makeStudent({
      label: `leaver:${index}`,
      family,
      first: pick.pick(gender === 'male' ? maleNames : femaleNames).en,
      gender,
      section,
      status: 'left',
      leftOn: addDays(earliest, pick.int(0, span)),
    });
  }

  // ------------------------------------------------------------------ write people

  await insertAll(tx, families, familyRows);
  await insertAll(tx, guardians, guardianRows);
  for (let start = 0; start < familyList.length; start += 500) {
    const part = familyList.slice(start, start + 500);
    await tx.execute(sql`
      update families set primary_guardian_id = data.guardian_id
      from unnest(${`{${part.map((family) => family.id).join(',')}}`}::uuid[],
                  ${`{${part.map((family) => family.primaryGuardianId).join(',')}}`}::uuid[]) as data(family_id, guardian_id)
      where families.id = data.family_id
    `);
  }
  await insertAll(tx, students, studentRows);
  await insertAll(tx, studentGuardians, linkRows);

  // ------------------------------------------------------------------ enrolments, this year and last

  const enrollmentRows: (typeof enrollments.$inferInsert)[] = [];
  const currentEnrollmentId = (student: StudentRow) =>
    school.id(`enrollment:${student.id}:current`);
  const previousEnrollmentId = (student: StudentRow) =>
    school.id(`enrollment:${student.id}:previous`);
  const groupId = (section: SectionRef) =>
    section.group ? curriculum.groupIds[section.group] : null;

  // Roll numbers follow the alphabet within each section.
  const rollNo = new Map<string, number>();
  const bySection = new Map<string, StudentRow[]>();
  for (const student of studentList) {
    if (student.status !== 'active') continue;
    const list = bySection.get(student.section.id) ?? [];
    list.push(student);
    bySection.set(student.section.id, list);
  }
  for (const list of bySection.values()) {
    list
      .sort((a, b) => a.fullName.localeCompare(b.fullName) || a.id.localeCompare(b.id))
      .forEach((student, index) => rollNo.set(student.id, index + 1));
  }

  // A handful were kept back last year: same grade again.
  const detained = new Set(
    studentList
      .filter(
        (student) =>
          !student.key &&
          student.status === 'active' &&
          !student.transferredFrom &&
          student.section.grade >= 2 &&
          student.admittedOn < setup.previous.start,
      )
      .filter((_student, index) => index % 190 === 7)
      .map((student) => student.id),
  );

  const historyRows: (typeof studentStatusHistory.$inferInsert)[] = [];
  for (const student of studentList) {
    const { section } = student;
    const joinedOn =
      student.admittedOn > setup.current.start ? student.admittedOn : setup.current.start;
    const movedOn = student.transferredFrom?.on;

    if (student.transferredFrom && movedOn) {
      // The enrolment at the old campus is closed; a new one opens at the new campus.
      const old = student.transferredFrom.section;
      enrollmentRows.push({
        id: school.id(`enrollment:${student.id}:before-transfer`),
        ...stamps,
        branchId: branchOf(school, old.branch),
        studentId: student.id,
        academicYearId: setup.current.id,
        gradeId: curriculum.gradeIds[old.grade] as string,
        sectionId: old.id,
        subjectGroupId: groupId(old),
        status: 'transferred',
        joinedOn,
        leftOn: movedOn,
        outcomeNote: `Transferred to ${section.branch}`,
      });
    }
    enrollmentRows.push({
      id: currentEnrollmentId(student),
      ...stamps,
      branchId: branchOf(school, section.branch),
      studentId: student.id,
      academicYearId: setup.current.id,
      gradeId: curriculum.gradeIds[section.grade] as string,
      sectionId: section.id,
      rollNo: rollNo.get(student.id) ?? null,
      subjectGroupId: groupId(section),
      status: student.status === 'left' ? 'left' : 'active',
      joinedOn: movedOn ?? joinedOn,
      leftOn: student.leftOn ?? null,
    });
    if (student.status === 'left' && student.leftOn) {
      historyRows.push({
        id: school.id(`status-history:${student.id}:left`),
        ...append,
        branchId: branchOf(school, section.branch),
        studentId: student.id,
        fromStatus: 'active',
        toStatus: 'left',
        effectiveOn: student.leftOn,
        reason: 'Withdrawn by the family',
      });
    }

    // Last year: the grade below (or the same grade, when kept back), at the campus the child was then in.
    if (student.admittedOn >= setup.current.start) continue;
    const keptBack = detained.has(student.id);
    const thenBranch = student.transferredFrom?.section.branch ?? section.branch;
    const thenGrade = keptBack ? section.grade : section.grade - 1;
    if (thenGrade < 1) continue;
    const thenName = student.transferredFrom?.section.name ?? section.name;
    const then = sectionByKey.get(`${thenBranch}:${thenGrade}-${thenName}`);
    if (!then) continue;
    student.detainedLastYear = keptBack;
    enrollmentRows.push({
      id: previousEnrollmentId(student),
      ...stamps,
      branchId: branchOf(school, thenBranch),
      studentId: student.id,
      academicYearId: setup.previous.id,
      gradeId: curriculum.gradeIds[thenGrade] as string,
      sectionId: then.previousId,
      status: keptBack ? 'detained' : 'promoted',
      joinedOn:
        student.admittedOn > setup.previous.start ? student.admittedOn : setup.previous.start,
      leftOn: setup.previous.end,
    });
  }
  await insertAll(tx, enrollments, enrollmentRows);
  await insertAll(tx, studentStatusHistory, historyRows);

  // ------------------------------------------------------------------ last year's promotion

  const withPrevious = new Set(
    enrollmentRows
      .filter((row) => row.academicYearId === setup.previous.id)
      .map((row) => row.studentId),
  );
  const batchRows: (typeof promotionBatches.$inferInsert)[] = [];
  const itemRows: (typeof promotionItems.$inferInsert)[] = [];
  const batches = new Map<string, { id: string; promote: number; detain: number }>();
  for (const student of studentList) {
    if (!withPrevious.has(student.id)) continue;
    const thenBranch = student.transferredFrom?.section.branch ?? student.section.branch;
    const fromGrade = student.detainedLastYear ? student.section.grade : student.section.grade - 1;
    const key = `${thenBranch}:${fromGrade}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = {
        id: school.id(`promotion-batch:${setup.previous.startYear}:${key}`),
        promote: 0,
        detain: 0,
      };
      batches.set(key, batch);
    }
    const decision = student.detainedLastYear ? 'detain' : 'promote';
    batch[decision] += 1;
    itemRows.push({
      id: school.id(`promotion-item:${student.id}`),
      ...stamps,
      branchId: branchOf(school, thenBranch),
      batchId: batch.id,
      studentId: student.id,
      enrollmentId: previousEnrollmentId(student),
      decision,
      suggestedDecision: decision,
      toGradeId: curriculum.gradeIds[student.section.grade] as string,
      toSectionId: student.transferredFrom
        ? student.transferredFrom.section.id
        : student.section.id,
      newEnrollmentId: student.transferredFrom
        ? school.id(`enrollment:${student.id}:before-transfer`)
        : currentEnrollmentId(student),
      status: 'done',
    });
  }
  const committedAt = noonOn(addDays(setup.previous.end, 3));
  for (const [key, batch] of batches) {
    const [branch, grade] = key.split(':') as [string, string];
    batchRows.push({
      id: batch.id,
      ...stamps,
      branchId: branchOf(school, branch),
      fromAcademicYearId: setup.previous.id,
      toAcademicYearId: setup.current.id,
      gradeId: curriculum.gradeIds[Number(grade)] as string,
      status: 'committed',
      committedAt,
      summary: { promote: batch.promote, detain: batch.detain },
    });
  }
  await insertAll(tx, promotionBatches, batchRows);
  await insertAll(tx, promotionItems, itemRows);

  // ------------------------------------------------------------------ transfers, withdrawals, corrections

  const active = studentList.filter((student) => student.status === 'active' && !student.key);
  const transferRows: (typeof transferRequests.$inferInsert)[] = studentList
    .filter((student) => student.transferredFrom)
    .map((student) => {
      const moved = student.transferredFrom as NonNullable<StudentRow['transferredFrom']>;
      return {
        id: school.id(`transfer:${student.id}`),
        ...stamps,
        studentId: student.id,
        fromBranchId: branchOf(school, moved.section.branch),
        toBranchId: branchOf(school, student.section.branch),
        toSectionId: student.section.id,
        effectiveOn: moved.on,
        reason: 'The family moved house',
        status: 'completed' as const,
        decidedAt: noonOn(addDays(moved.on, -3)),
      };
    });
  // Two that are still open: one waiting for a decision, one approved for next week.
  if (school.key === 'roshan') {
    const waiting = active.filter(
      (student) =>
        student.section.grade <= 8 && student.gender === 'female' && !student.transferredFrom,
    );
    for (const [index, status] of (['requested', 'approved'] as const).entries()) {
      const student = waiting[11 + index * 53];
      if (!student) continue;
      const other = student.section.branch === 'MC' ? 'CC' : 'MC';
      transferRows.push({
        id: school.id(`transfer:open:${index}`),
        ...stamps,
        studentId: student.id,
        fromBranchId: branchOf(school, student.section.branch),
        toBranchId: branchOf(school, other),
        toSectionId:
          status === 'approved'
            ? (sectionByKey.get(`${other}:${student.section.grade}-A`)?.id ?? null)
            : null,
        effectiveOn: addDays(today, 7),
        reason: 'Closer to home',
        status,
        decidedAt: status === 'approved' ? noonOn(addDays(today, -1)) : null,
      });
    }
  }
  await insertAll(tx, transferRequests, transferRows);

  const withdrawalRows: (typeof studentWithdrawals.$inferInsert)[] = [];
  const clear = {
    fees: 'clear',
    library: 'clear',
    inventory: 'clear',
    transport: 'clear',
    hostel: 'clear',
  };
  const adeel = studentList.find((student) => student.key === 'adeel-shah');
  if (adeel?.leftOn) {
    withdrawalRows.push({
      id: school.id('withdrawal:adeel-shah'),
      ...stamps,
      branchId: branchOf(school, adeel.section.branch),
      studentId: adeel.id,
      requestedOn: addDays(adeel.leftOn, -12),
      lastAttendanceOn: addDays(adeel.leftOn, -1),
      reason: 'other_school',
      detail: 'The family is moving to Islamabad.',
      status: 'completed',
      clearance: clear,
      completedAt: noonOn(adeel.leftOn),
    });
  }
  for (const [index, status] of (['requested', 'clearance'] as const).entries()) {
    const student = active[23 + index * 71];
    if (!student || school.key !== 'roshan') continue;
    withdrawalRows.push({
      id: school.id(`withdrawal:open:${index}`),
      ...stamps,
      branchId: branchOf(school, student.section.branch),
      studentId: student.id,
      requestedOn: addDays(today, -6 + index * 2),
      lastAttendanceOn: addDays(today, 10),
      reason: index === 0 ? 'relocation' : 'financial',
      status,
      clearance:
        status === 'clearance'
          ? { ...clear, fees: 'pending', library: 'pending' }
          : {
              fees: 'pending',
              library: 'pending',
              inventory: 'pending',
              transport: 'pending',
              hostel: 'pending',
            },
      duesOutstanding: status === 'clearance' ? 1_250_000 : 0,
    });
  }
  await insertAll(tx, studentWithdrawals, withdrawalRows);

  // Corrections guardians asked for: five waiting, one accepted, one refused.
  const changeRows: (typeof profileChangeRequests.$inferInsert)[] = [];
  if (school.key === 'roshan') {
    const changes = [
      {
        changes: { dateOfBirth: '2015-03-11' },
        note: 'The date on the B-Form is the 11th, not the 10th.',
      },
      { changes: { address: 'House 14, Street 3, Wapda Town, Lahore' }, note: 'We have moved.' },
      { changes: { fullName: 'Muhammad Zain Abbasi' }, note: 'His full name as on the B-Form.' },
      { changes: { phone: mobileNumber(phoneSerial++) }, note: 'New number.' },
      { changes: { bloodGroup: 'b_pos' }, note: 'From the lab report.' },
      { changes: { address: 'House 2, Street 9, Garden Town, Lahore' }, note: 'New address.' },
      { changes: { fatherName: 'Asif Mehmood Butt' }, note: 'Please add his middle name.' },
    ];
    for (const [index, change] of changes.entries()) {
      const student = active[5 + index * 43];
      if (!student) continue;
      const aboutGuardian = index === 3;
      changeRows.push({
        id: school.id(`profile-change:${index}`),
        ...stamps,
        studentId: aboutGuardian ? null : student.id,
        guardianId: aboutGuardian ? student.family.primaryGuardianId : null,
        changes: change.changes,
        note: change.note,
        status: index < 5 ? 'pending' : index === 5 ? 'approved' : 'rejected',
        decisionNote: index === 6 ? 'The B-Form shows the name as recorded.' : null,
      });
    }
  }
  await insertAll(tx, profileChangeRequests, changeRows);

  // Five children moved to the other section of their grade this year.
  const changeOfSection: (typeof sectionChanges.$inferInsert)[] = [];
  const sectionMoves = new Map<string, { from: SectionRef; on: string }>();
  for (let index = 0; index < 5; index++) {
    const student = active[31 + index * 59];
    if (!student || school.key !== 'roshan') continue;
    const other = sectionByKey.get(
      `${student.section.branch}:${student.section.grade}-${student.section.name === 'A' ? 'B' : 'A'}`,
    );
    if (!other) continue;
    const changedOn = addDays(today, -(25 + index * 9));
    // Someone who joined after that day was never in the other section.
    if (student.transferredFrom || student.admittedOn >= changedOn) continue;
    sectionMoves.set(student.id, { from: other, on: changedOn });
    changeOfSection.push({
      id: school.id(`section-change:${index}`),
      ...append,
      branchId: branchOf(school, student.section.branch),
      enrollmentId: currentEnrollmentId(student),
      fromSectionId: other.id,
      toSectionId: student.section.id,
      changedOn,
      reason: 'To balance the two sections',
    });
  }
  await insertAll(tx, sectionChanges, changeOfSection);

  // Daniel Masih takes Ethics in place of Islamiyat.
  const daniel = studentList.find((student) => student.key === 'daniel-masih');
  if (daniel) {
    const grade = daniel.section.grade;
    await insertAll(
      tx,
      studentSubjectOverrides,
      (['ISL', 'ETH'] as const).map((code) => ({
        id: school.id(`subject-override:daniel:${code}`),
        ...stamps,
        branchId: branchOf(school, daniel.section.branch),
        enrollmentId: currentEnrollmentId(daniel),
        studentId: daniel.id,
        gradeSubjectId: curriculum.gradeSubjectId(setup.current, grade, code),
        action: code === 'ISL' ? ('drop' as const) : ('add' as const),
        reason: 'religion_alternative' as const,
      })),
    );
  }

  // ------------------------------------------------------------------ numbering continues from here

  await setCounter(school, 'family', familySerial + 1);
  for (const [key, last] of admissionCounters) {
    const [branch, period] = key.split(':') as [string, string];
    await setCounter(school, 'admission', last + 1, { branchId: branchOf(school, branch), period });
  }

  const guardianById = new Map(guardianRows.map((guardian) => [guardian.id, guardian]));
  const roster: SeededStudent[] = studentList.map((student) => {
    const guardian = guardianById.get(student.family.primaryGuardianId);
    const joinedOn =
      student.admittedOn > setup.current.start ? student.admittedOn : setup.current.start;
    // The last day at school is the day before the leaving date.
    const lastDay = student.leftOn ? { to: addDays(student.leftOn, -1) } : {};
    const current = currentEnrollmentId(student);
    const moved = sectionMoves.get(student.id);
    const stays: StudentStay[] = student.transferredFrom
      ? [
          {
            section: student.transferredFrom.section,
            enrollmentId: school.id(`enrollment:${student.id}:before-transfer`),
            from: joinedOn,
            to: addDays(student.transferredFrom.on, -1),
          },
          {
            section: student.section,
            enrollmentId: current,
            from: student.transferredFrom.on,
            ...lastDay,
          },
        ]
      : moved
        ? [
            {
              section: moved.from,
              enrollmentId: current,
              from: joinedOn,
              to: addDays(moved.on, -1),
            },
            { section: student.section, enrollmentId: current, from: moved.on, ...lastDay },
          ]
        : [{ section: student.section, enrollmentId: current, from: joinedOn, ...lastDay }];
    const roll = rollNo.get(student.id);
    return {
      id: student.id,
      ...(student.key && { key: student.key }),
      fullName: student.fullName,
      gender: student.gender,
      branch: student.section.branch,
      grade: student.section.grade,
      section: student.section,
      familyId: student.family.id,
      guardianId: student.family.primaryGuardianId,
      guardianName: guardian?.fullName ?? '',
      guardianPhone: guardian?.phone ?? '',
      status: student.status,
      ...(student.leftOn && { leftOn: student.leftOn }),
      ...(roll !== undefined && { rollNo: roll }),
      stays,
    };
  });

  return {
    roster,
    named,
    accounts,
    counts: {
      students: studentList.length,
      families: familyList.length,
      guardians: guardianRows.length,
    },
  };
}

import { sql } from 'drizzle-orm';
import {
  gradeSubjects,
  grades,
  sectionSubjects,
  sections,
  subjectGroups,
  subjects,
} from '../../schema';
import { branchOf, insertAll, seedId, type School } from '../context';
import {
  curriculumOf,
  sectionKey,
  stageOf,
  subjectList,
  type GroupKey,
  type SectionPlan,
  type TeacherKind,
} from './plan';
import type { SetupRefs, YearRef } from './setup';
import type { StaffRef, StaffRefs } from './staff';

/*
 * M11 · Academic structure: the ten grades, the subjects and streams, the curriculum of every grade
 * for both academic years, the sections of each campus, and who teaches what to whom.
 */

export interface CurriculumRefs {
  /** Grade level (1 to 10) → id. */
  gradeIds: Record<number, string>;
  /** Subject code → id. */
  subjectIds: Record<string, string>;
  groupIds: Record<GroupKey, string>;
  /** `year start:grade:subject code:group` → the id of that line of the curriculum. */
  gradeSubjectId(year: YearRef, grade: number, code: string, group?: GroupKey): string;
}

const gradeNamesUr = [
  'پہلی',
  'دوسری',
  'تیسری',
  'چوتھی',
  'پانچویں',
  'چھٹی',
  'ساتویں',
  'آٹھویں',
  'نویں',
  'دسویں',
];

const groupList: readonly { key: GroupKey; name: string; nameUr: string }[] = [
  { key: 'science_bio', name: 'Science (Biology)', nameUr: 'سائنس (حیاتیات)' },
  { key: 'science_cs', name: 'Science (Computer Science)', nameUr: 'سائنس (کمپیوٹر سائنس)' },
  { key: 'humanities', name: 'Humanities', nameUr: 'آرٹس' },
];

export async function seedCurriculum(
  school: School,
  setup: SetupRefs,
  offered: ReadonlySet<number>,
): Promise<CurriculumRefs> {
  const { tx, stamps } = school;

  const gradeIds: Record<number, string> = {};
  for (let level = 1; level <= 10; level++) gradeIds[level] = school.id(`grade:${level}`);
  // Highest first, so each grade's "next grade" already exists when it is written.
  for (let level = 10; level >= 1; level--) {
    await tx.insert(grades).values({
      id: gradeIds[level] as string,
      ...stamps,
      level,
      name: `Grade ${level}`,
      nameUr: `${gradeNamesUr[level - 1]} جماعت`,
      shortName: String(level),
      stage: stageOf(level),
      nextGradeId: level < 10 ? (gradeIds[level + 1] as string) : null,
      gradingSchemeId: level >= 9 ? setup.schemes.national : setup.schemes.primary,
      isOffered: offered.has(level),
    });
  }

  const subjectIds = Object.fromEntries(
    subjectList.map((subject) => [subject.code, school.id(`subject:${subject.code}`)]),
  );
  // A subject that replaces another is written after the one it replaces.
  const ordered = [...subjectList].sort(
    (a, b) => Number(Boolean(a.alternativeOf)) - Number(Boolean(b.alternativeOf)),
  );
  await insertAll(
    tx,
    subjects,
    ordered.map((subject) => ({
      id: subjectIds[subject.code] as string,
      ...stamps,
      code: subject.code,
      name: subject.name,
      nameUr: subject.nameUr,
      kind: subject.kind,
      hasPractical: subject.hasPractical ?? false,
      alternativeOfId: subject.alternativeOf ? (subjectIds[subject.alternativeOf] as string) : null,
    })),
  );

  const groupIds = Object.fromEntries(
    groupList.map((group) => [group.key, school.id(`group:${group.key}`)]),
  ) as Record<GroupKey, string>;
  await insertAll(
    tx,
    subjectGroups,
    groupList.map((group) => ({
      id: groupIds[group.key],
      ...stamps,
      key: group.key,
      name: group.name,
      nameUr: group.nameUr,
    })),
  );

  const gradeSubjectId = (year: YearRef, grade: number, code: string, group?: GroupKey) =>
    school.id(`grade-subject:${year.startYear}:${grade}:${code}:${group ?? ''}`);
  const periods = new Map(subjectList.map((subject) => [subject.code, subject.periods]));
  const rows = [setup.previous, setup.current].flatMap((year) =>
    Array.from({ length: 10 }, (_unused, index) => index + 1).flatMap((grade) =>
      curriculumOf(grade).map((item, index) => ({
        id: gradeSubjectId(year, grade, item.code, item.group),
        ...stamps,
        academicYearId: year.id,
        gradeId: gradeIds[grade] as string,
        subjectId: subjectIds[item.code] as string,
        subjectGroupId: item.group ? groupIds[item.group] : null,
        isCompulsory: item.compulsory ?? true,
        periodsPerWeek: periods.get(item.code) ?? 2,
        theoryMarks: item.theory,
        practicalMarks: item.practical ?? 0,
        countsInResult: item.counts ?? true,
        sortOrder: index + 1,
      })),
    ),
  );
  await insertAll(tx, gradeSubjects, rows);

  return { gradeIds, subjectIds, groupIds, gradeSubjectId };
}

export interface SectionRef extends SectionPlan {
  id: string;
  /** The same class in the year before, when it existed. */
  previousId: string;
  classTeacher?: StaffRef;
  /** What the section studies this year, and who teaches each subject (nobody, for the four cells left empty). */
  subjects: SectionSubjectRef[];
}

export interface SectionSubjectRef {
  /** The id of the `section_subjects` row. */
  id: string;
  /** Subject code: `ENG`. */
  code: string;
  gradeSubjectId: string;
  teacher?: StaffRef;
  periods: number;
  theory: number;
  practical: number;
  /** False for subjects that are taught but do not count towards a result. */
  counts: boolean;
}

/** The kind of teacher who takes a subject in a grade. */
function teacherKindFor(code: string, grade: number): TeacherKind {
  switch (code) {
    case 'ISL':
      return 'islamiyat';
    case 'ETH':
      return 'social';
    case 'NAZ':
      return grade <= 5 ? 'class' : 'islamiyat';
    case 'COMP':
    case 'CS':
      return 'computer';
    case 'DRW':
    case 'PE':
      return 'activities';
    case 'PHY':
      return 'physics';
    case 'CHEM':
      return 'chemistry';
    case 'BIO':
      return 'biology';
    case 'PST':
      return 'social';
    case 'GMATH':
      return 'maths';
    default:
      break;
  }
  if (grade <= 5) return 'class';
  return ({ ENG: 'english', URD: 'urdu', MATH: 'maths', SCI: 'science', SST: 'social' } as const)[
    code as 'ENG' | 'URD' | 'MATH' | 'SCI' | 'SST'
  ];
}

export async function seedSections(
  school: School,
  setup: SetupRefs,
  curriculum: CurriculumRefs,
  staff: StaffRefs,
  plan: readonly SectionPlan[],
): Promise<SectionRef[]> {
  const { tx, stamps } = school;
  const refs: SectionRef[] = plan.map((section) => ({
    ...section,
    id: school.id(`section:${setup.current.startYear}:${sectionKey(section)}`),
    previousId: school.id(`section:${setup.previous.startYear}:${sectionKey(section)}`),
    subjects: [],
  }));

  // ---- class teachers. In the primary years the class teacher teaches most subjects; later it is
  // one of the section's subject teachers, a different person for each section where there are enough.
  const taken = new Set<string>();
  const pools = new Map<string, StaffRef[]>();
  const pool = (branch: string, kind: TeacherKind) => {
    const key = `${branch}:${kind}`;
    if (!pools.has(key)) pools.set(key, staff.teachers(branch, kind));
    return pools.get(key) as StaffRef[];
  };
  const nadia = school.key === 'roshan' ? staff.byEmail('class.teacher@roshan.test') : undefined;
  for (const section of refs) {
    // Ms Nadia Raza is the class teacher of 7-B at Main Campus.
    if (nadia && sectionKey(section) === 'MC:7-B') {
      section.classTeacher = nadia;
      taken.add(nadia.id);
    }
  }
  for (const section of refs) {
    if (section.classTeacher) continue;
    const kinds: TeacherKind[] =
      section.grade <= 5
        ? ['class']
        : [
            'english',
            'urdu',
            'maths',
            'science',
            'social',
            'physics',
            'chemistry',
            'biology',
            'computer',
          ];
    const free = kinds
      .flatMap((kind) => pool(section.branch, kind))
      .find((person) => !taken.has(person.id));
    if (free) {
      section.classTeacher = free;
      taken.add(free.id);
    }
  }

  const roomId = (section: SectionRef, index: number): string | null => {
    if (school.key !== 'roshan') return null;
    const classrooms = section.branch === 'MC' ? 20 : 11;
    return index < classrooms ? seedId(`room:${section.branch}:${index + 1}`) : null;
  };
  const wingId = (section: SectionRef): string | null => {
    if (school.key !== 'roshan') return null;
    const stage = stageOf(section.grade);
    return section.branch === 'CC' && stage === 'secondary'
      ? null
      : seedId(`wing:${section.branch}:${stage}`);
  };
  const girlsOnly = (section: SectionPlan) => school.key === 'roshan' && section.branch === 'CC';

  const perBranch = new Map<string, number>();
  const sectionRows = refs.flatMap((section) => {
    const index = perBranch.get(section.branch) ?? 0;
    perBranch.set(section.branch, index + 1);
    const shared = {
      ...stamps,
      branchId: branchOf(school, section.branch),
      gradeId: curriculum.gradeIds[section.grade] as string,
      name: section.name,
      capacity: 40,
      roomId: roomId(section, index),
      shiftId: setup.shiftIds[section.branch] ?? null,
      wingId: wingId(section),
      gender: girlsOnly(section) ? ('girls' as const) : ('mixed' as const),
    };
    return [
      {
        ...shared,
        id: section.previousId,
        academicYearId: setup.previous.id,
        classTeacherId: null,
        status: 'closed' as const,
      },
      {
        ...shared,
        id: section.id,
        academicYearId: setup.current.id,
        classTeacherId: section.classTeacher?.id ?? null,
        status: 'active' as const,
      },
    ];
  });
  await insertAll(tx, sections, sectionRows);

  // ---- who teaches each subject to each section of the current year
  const turn = new Map<string, number>();
  const nextFrom = (branch: string, kind: TeacherKind, except?: string): StaffRef | undefined => {
    const list = pool(branch, kind).filter((person) => person.id !== except);
    if (list.length === 0) return undefined;
    const key = `${branch}:${kind}`;
    const at = turn.get(key) ?? 0;
    turn.set(key, at + 1);
    return list[at % list.length];
  };
  const imran = school.key === 'roshan' ? staff.byEmail('subject.teacher@roshan.test') : undefined;
  // Four cells are left without a teacher on purpose, so "unassigned" has something to show.
  const unassigned = new Set(['MC:6-A:PE', 'MC:9-B:CS', 'CC:5-B:COMP', 'CC:8-A:SST']);

  const ethicsSections = new Set(school.key === 'roshan' ? ['MC:9-B'] : []);
  const periodsOf = new Map(subjectList.map((subject) => [subject.code, subject.periods]));
  const assignmentRows: (typeof sectionSubjects.$inferInsert)[] = [];
  for (const section of refs) {
    for (const item of curriculumOf(section.grade)) {
      if (item.group && item.group !== section.group) continue;
      // Ethics is taught only where a student takes it in place of Islamiyat.
      if (item.code === 'ETH' && !ethicsSections.has(sectionKey(section))) continue;
      const kind = teacherKindFor(item.code, section.grade);
      let teacher: StaffRef | undefined;
      if (unassigned.has(`${sectionKey(section)}:${item.code}`)) teacher = undefined;
      else if (kind === 'class') teacher = section.classTeacher;
      // Mr Imran Siddiqui teaches Mathematics to Grades 8 to 10 at Main Campus.
      else if (imran && item.code === 'MATH' && section.branch === 'MC' && section.grade >= 8)
        teacher = imran;
      // A class teacher above the primary years teaches their own subject to their own class.
      else if (section.classTeacher?.kind === kind) teacher = section.classTeacher;
      // His week is already full with those six classes, so the other sections go to his colleagues.
      else teacher = nextFrom(section.branch, kind, item.code === 'MATH' ? imran?.id : undefined);
      const gradeSubjectId = curriculum.gradeSubjectId(
        setup.current,
        section.grade,
        item.code,
        item.group,
      );
      section.subjects.push({
        id: school.id(`section-subject:${sectionKey(section)}:${item.code}`),
        code: item.code,
        gradeSubjectId,
        ...(teacher && { teacher }),
        periods: periodsOf.get(item.code) ?? 2,
        theory: item.theory,
        practical: item.practical ?? 0,
        counts: item.counts ?? true,
      });
      assignmentRows.push({
        id: school.id(`section-subject:${sectionKey(section)}:${item.code}`),
        ...stamps,
        branchId: branchOf(school, section.branch),
        sectionId: section.id,
        gradeSubjectId: curriculum.gradeSubjectId(
          setup.current,
          section.grade,
          item.code,
          item.group,
        ),
        teacherId: teacher?.id ?? null,
      });
    }
  }
  await insertAll(tx, sectionSubjects, assignmentRows);

  // The principal of each campus is recorded on the branch, and each wing gets its head.
  if (school.key === 'roshan') {
    for (const [code, email] of [
      ['MC', 'principal@roshan.test'],
      ['CC', 'principal.cc@roshan.test'],
    ] as const) {
      await tx.execute(
        sql`update branches set principal_staff_id = ${staff.byEmail(email).id}::uuid where id = ${branchOf(school, code)}::uuid`,
      );
    }
    await tx.execute(
      sql`update wings set head_staff_id = ${staff.byEmail('section.head@roshan.test').id}::uuid where id = ${seedId('wing:MC:primary')}::uuid`,
    );
  }

  return refs;
}

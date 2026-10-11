import type { School } from '../context';

/*
 * The shape of each seeded school: which classes exist and how many children sit in each.
 * Staff, sections and students are all built from this one description, so they always agree.
 * The sizes are those of docs/plan/30-reference/seed-data.md.
 */

export type GroupKey = 'science_bio' | 'science_cs' | 'humanities';

export interface SectionPlan {
  /** Branch code. */
  branch: string;
  /** 1 to 10. */
  grade: number;
  /** `A`, `B`, … */
  name: string;
  /** The stream of a Grade 9 or 10 section. */
  group?: GroupKey;
  /** How many students the seed enrols. */
  size: number;
}

export const stageOf = (grade: number): 'primary' | 'middle' | 'secondary' =>
  grade <= 5 ? 'primary' : grade <= 8 ? 'middle' : 'secondary';

const letters = 'ABCDEFGH';

function campus(
  branch: string,
  grades: readonly number[],
  sectionsFor: (grade: number) => number,
  sizeFor: (grade: number) => number,
): SectionPlan[] {
  return grades.flatMap((grade) =>
    Array.from({ length: sectionsFor(grade) }, (_unused, index): SectionPlan => {
      // In Grades 9 and 10 the first half of the sections study Biology, the second half Computer Science.
      const group: GroupKey | undefined =
        grade >= 9 ? (index < sectionsFor(grade) / 2 ? 'science_bio' : 'science_cs') : undefined;
      return {
        branch,
        grade,
        name: letters[index] as string,
        ...(group && { group }),
        size: sizeFor(grade),
      };
    }),
  );
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_unused, index) => from + index);

export function sectionPlan(school: School): SectionPlan[] {
  if (school.key === 'alnoor')
    return campus(
      'AN',
      range(1, 5),
      () => 1,
      () => 4,
    );

  if (school.size === 'small') {
    return [
      ...campus(
        'MC',
        range(1, 10),
        () => 2,
        () => 4,
      ),
      ...campus(
        'CC',
        range(1, 8),
        (grade) => (grade <= 5 ? 2 : 1),
        () => 3,
      ),
    ];
  }
  if (school.size === 'large') {
    return [
      ...campus(
        'MC',
        range(1, 10),
        (grade) => (grade <= 8 ? 8 : 4),
        () => 40,
      ),
      ...campus(
        'CC',
        range(1, 8),
        (grade) => (grade <= 5 ? 6 : 4),
        () => 40,
      ),
    ];
  }
  // Main Campus: 20 sections, 720 students. City Campus: 13 sections, about 430.
  return [
    ...campus(
      'MC',
      range(1, 10),
      () => 2,
      () => 36,
    ),
    ...campus(
      'CC',
      range(1, 8),
      (grade) => (grade <= 5 ? 2 : 1),
      (grade) => (grade <= 5 ? 33 : 34),
    ),
  ];
}

export const sectionKey = (plan: Pick<SectionPlan, 'branch' | 'grade' | 'name'>) =>
  `${plan.branch}:${plan.grade}-${plan.name}`;

// ---------------------------------------------------------------- subjects and who can teach them

export interface SubjectDef {
  code: string;
  name: string;
  nameUr: string;
  kind: 'core' | 'language' | 'religious' | 'elective' | 'activity';
  hasPractical?: boolean;
  /** The subject this one replaces for some students. */
  alternativeOf?: string;
  periods: number;
}

export const subjectList: readonly SubjectDef[] = [
  { code: 'ENG', name: 'English', nameUr: 'انگریزی', kind: 'language', periods: 6 },
  { code: 'URD', name: 'Urdu', nameUr: 'اردو', kind: 'language', periods: 5 },
  { code: 'MATH', name: 'Mathematics', nameUr: 'ریاضی', kind: 'core', periods: 6 },
  { code: 'SCI', name: 'General Science', nameUr: 'جنرل سائنس', kind: 'core', periods: 4 },
  { code: 'SST', name: 'Social Studies', nameUr: 'معاشرتی علوم', kind: 'core', periods: 3 },
  { code: 'ISL', name: 'Islamiyat', nameUr: 'اسلامیات', kind: 'religious', periods: 3 },
  {
    code: 'ETH',
    name: 'Ethics',
    nameUr: 'اخلاقیات',
    kind: 'religious',
    alternativeOf: 'ISL',
    periods: 3,
  },
  { code: 'NAZ', name: 'Nazra', nameUr: 'ناظرہ قرآن', kind: 'religious', periods: 2 },
  { code: 'COMP', name: 'Computer', nameUr: 'کمپیوٹر', kind: 'core', periods: 2 },
  { code: 'PST', name: 'Pakistan Studies', nameUr: 'مطالعہ پاکستان', kind: 'core', periods: 3 },
  { code: 'PHY', name: 'Physics', nameUr: 'طبیعیات', kind: 'core', hasPractical: true, periods: 4 },
  {
    code: 'CHEM',
    name: 'Chemistry',
    nameUr: 'کیمیا',
    kind: 'core',
    hasPractical: true,
    periods: 4,
  },
  {
    code: 'BIO',
    name: 'Biology',
    nameUr: 'حیاتیات',
    kind: 'elective',
    hasPractical: true,
    periods: 4,
  },
  {
    code: 'CS',
    name: 'Computer Science',
    nameUr: 'کمپیوٹر سائنس',
    kind: 'elective',
    hasPractical: true,
    periods: 4,
  },
  {
    code: 'GMATH',
    name: 'General Mathematics',
    nameUr: 'جنرل ریاضی',
    kind: 'elective',
    periods: 5,
  },
  { code: 'DRW', name: 'Drawing', nameUr: 'ڈرائنگ', kind: 'activity', periods: 1 },
  { code: 'PE', name: 'Physical Education', nameUr: 'جسمانی تعلیم', kind: 'activity', periods: 1 },
];

/** A subject a grade studies. `group` is set when only one stream takes it. */
export interface CurriculumLine {
  code: string;
  group?: GroupKey;
  theory: number;
  practical?: number;
  /** False for the alternative of a compulsory subject. */
  compulsory?: boolean;
  /** False for subjects that are taught and reported but do not count towards the result. */
  counts?: boolean;
}

const line = (
  code: string,
  theory: number,
  extra: Partial<CurriculumLine> = {},
): CurriculumLine => ({
  code,
  theory,
  ...extra,
});

/** The curriculum of a grade. Marks are the school's own for Grades 1 to 8 and board-style for 9 and 10. */
export function curriculumOf(grade: number): CurriculumLine[] {
  const common = [
    line('ENG', 100),
    line('URD', 100),
    line('MATH', 100),
    line('SCI', 100),
    line('ISL', 100),
    line('ETH', 100, { compulsory: false }),
  ];
  const activities = [line('DRW', 50, { counts: false }), line('PE', 50, { counts: false })];
  if (grade <= 3) return [...common, line('NAZ', 50, { counts: false }), ...activities];
  if (grade <= 5)
    return [
      ...common,
      line('SST', 100),
      line('NAZ', 50, { counts: false }),
      line('COMP', 50),
      ...activities,
    ];
  if (grade <= 8)
    return [
      ...common,
      line('SST', 100),
      line('COMP', 50),
      line('NAZ', 50, { counts: false }),
      line('PE', 50, { counts: false }),
    ];
  return [
    line('ENG', 75),
    line('URD', 75),
    line('MATH', 75),
    line('ISL', 50),
    line('ETH', 50, { compulsory: false }),
    line('PST', 50),
    line('PHY', 60, { practical: 15 }),
    line('CHEM', 60, { practical: 15 }),
    line('BIO', 60, { practical: 15, group: 'science_bio' }),
    line('CS', 50, { practical: 25, group: 'science_cs' }),
    line('GMATH', 75, { group: 'humanities' }),
  ];
}

/** The kinds of teacher a campus needs, with the subjects each can teach. */
export const teacherKinds = {
  class: ['ENG', 'URD', 'MATH', 'SCI', 'SST', 'NAZ'],
  english: ['ENG'],
  urdu: ['URD'],
  maths: ['MATH', 'GMATH'],
  science: ['SCI'],
  social: ['SST', 'PST', 'ETH'],
  physics: ['PHY', 'MATH'],
  chemistry: ['CHEM', 'SCI'],
  biology: ['BIO', 'SCI'],
  computer: ['COMP', 'CS'],
  islamiyat: ['ISL', 'NAZ'],
  activities: ['DRW', 'PE'],
} as const;

export type TeacherKind = keyof typeof teacherKinds;

/** How many teachers of each kind a campus needs for its sections. */
export function teachersNeeded(sections: readonly SectionPlan[]): Record<TeacherKind, number> {
  const count = (test: (section: SectionPlan) => boolean) => sections.filter(test).length;
  const primary = count((section) => section.grade <= 5);
  const middle = count((section) => section.grade >= 6 && section.grade <= 8);
  const secondary = count((section) => section.grade >= 9);
  const upper = middle + secondary;
  const share = (lessons: number, each: number) => (lessons > 0 ? Math.ceil(lessons / each) : 0);
  return {
    class: primary,
    english: share(upper, 5),
    urdu: share(upper, 5),
    maths: share(upper, 5),
    science: share(middle, 6),
    social: share(upper, 8),
    physics: share(secondary, 6),
    chemistry: share(secondary, 6),
    biology: share(
      count((section) => section.group === 'science_bio'),
      6,
    ),
    computer: share(
      count((section) => section.grade >= 4),
      12,
    ),
    islamiyat: share(sections.length, 8),
    activities: share(sections.length, 20),
  };
}

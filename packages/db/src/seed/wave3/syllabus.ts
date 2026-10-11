import {
  learningOutcomes,
  lessonPlans,
  schemeWeeks,
  schemesOfWork,
  syllabusProgress,
  syllabusUnits,
} from '../../schema';
import { addDays, at, branchOf, insertAll, type School } from '../context';
import type { Wave1 } from '../schools';
import type { SectionRef, SectionSubjectRef } from '../wave1/academics';
import { sectionKey } from '../wave1/plan';
import type { StaffRef } from '../wave1/staff';
import { mondayOf, type Actors, type Calendar } from './shared';
import { fullTrees, outline, topicSteps } from './syllabus-data';
import type { TimetableRefs } from './timetable';

/*
 * M13 · Syllabus and lesson plans: a syllabus tree for every subject each grade studies, the term
 * plans built on it, how far each section has really got, and two weeks of lesson plans.
 *
 * One plan runs through all of it: a subject's chapters are spread evenly over the school days of the
 * year. The schemes of work say so week by week, progress follows it (a few sections trail it on
 * purpose), and homework, quizzes and exam papers ask about the chapters a class has reached.
 */

export interface ChapterRef {
  id: string;
  title: string;
  /** The unit the chapter belongs to. */
  unitId: string;
  unitTitle: string;
  /** Lessons the chapter is expected to take. */
  periods: number;
  /** Topics under the chapter, for subjects with a full tree. */
  topics: { id: string; title: string; outcomeId: string }[];
  /** Position in teaching order, from 0. */
  index: number;
}

export interface SyllabusRefs {
  /** The chapters of a grade subject, in teaching order. Empty for a subject without a tree. */
  chaptersOf(gradeSubjectId: string): readonly ChapterRef[];
  /** The chapters a section had finished by a date, as its progress records them. */
  coveredBy(subject: SectionSubjectRef, date: string): readonly ChapterRef[];
  /** The chapter a section was working on on a date. */
  chapterOn(subject: SectionSubjectRef, date: string): ChapterRef | undefined;
}

const urduSubjects = new Set(['URD', 'ISL', 'NAZ']);

/** How far behind its plan a section subject is, as a share of the plan. */
function lagOf(school: School, key: string, order: number, hasTeacher: boolean): number {
  if (school.key !== 'roshan') return 0;
  // Two classes without a teacher have fallen far behind; a third is slipping.
  if (key === 'MC:9-B:CS' || key === 'CC:8-A:SST') return 0.3;
  if (key === 'CC:5-B:COMP') return 0.15;
  if (!hasTeacher) return 0;
  // Seven more trail their plan, spread over both campuses.
  return order % 31 === 17 ? 0.15 : 0;
}

export async function seedSyllabus(
  school: School,
  wave1: Wave1,
  actors: Actors,
  calendars: ReadonlyMap<string, Calendar>,
  timetable: TimetableRefs,
): Promise<SyllabusRefs> {
  const { tx, stamps } = school;
  const { setup, sections } = wave1;
  const year = setup.current;

  // ------------------------------------------------------------------ the trees

  const unitRows: (typeof syllabusUnits.$inferInsert)[] = [];
  const outcomeRows: (typeof learningOutcomes.$inferInsert)[] = [];
  const chapters = new Map<string, ChapterRef[]>();
  const taught = new Map<string, { grade: number; code: string; periods: number }>();
  for (const section of sections)
    for (const subject of section.subjects)
      taught.set(subject.gradeSubjectId, {
        grade: section.grade,
        code: subject.code,
        periods: subject.periods,
      });

  for (const [gradeSubjectId, { grade, code, periods }] of taught) {
    const full = fullTrees[`${grade}:${code}`];
    const pool = outline[code];
    const units: { title: string; titleUr?: string; chapters: readonly string[] }[] = full
      ? full.map(([title, list]) => ({ title, chapters: list }))
      : pool
        ? Array.from({ length: Math.min(6, pool.length) }, (_unused, index) => {
            const unit = pool[(grade - 1 + index) % pool.length] as (typeof pool)[number];
            return unit;
          })
        : [];
    if (units.length === 0) continue;
    const chapterCount = units.reduce((sum, unit) => sum + unit.chapters.length, 0);
    // About 34 teaching weeks in a year, shared between the chapters.
    const perChapter = Math.max(2, Math.round((periods * 34) / chapterCount));
    const list: ChapterRef[] = [];
    const label = `${grade}:${code}`;
    units.forEach((unit, unitIndex) => {
      const unitId = school.id(`syllabus:${label}:u${unitIndex + 1}`);
      unitRows.push({
        id: unitId,
        ...stamps,
        gradeSubjectId,
        kind: 'unit',
        code: `${code}-${String(grade).padStart(2, '0')}-${String(unitIndex + 1).padStart(2, '0')}`,
        title: unit.title,
        titleUr: unit.titleUr ?? null,
        estimatedPeriods: perChapter * unit.chapters.length,
        sortOrder: unitIndex + 1,
      });
      unit.chapters.forEach((title, chapterIndex) => {
        const chapterId = school.id(`syllabus:${label}:u${unitIndex + 1}:c${chapterIndex + 1}`);
        unitRows.push({
          id: chapterId,
          ...stamps,
          gradeSubjectId,
          parentId: unitId,
          kind: 'chapter',
          title,
          estimatedPeriods: perChapter,
          sortOrder: chapterIndex + 1,
          // One imported tree and one drafted by the assistant, so both sources have something to show.
          source: label === '10:ENG' ? 'import' : label === '9:BIO' ? 'ai' : 'manual',
          aiConfidence: label === '9:BIO' ? 0.86 : null,
        });
        const chapter: ChapterRef = {
          id: chapterId,
          title,
          unitId,
          unitTitle: unit.title,
          periods: perChapter,
          topics: [],
          index: list.length,
        };
        if (full) {
          topicSteps.forEach((step, stepIndex) => {
            const topicId = school.id(
              `syllabus:${label}:u${unitIndex + 1}:c${chapterIndex + 1}:t${stepIndex + 1}`,
            );
            const outcomeId = school.id(
              `outcome:${label}:u${unitIndex + 1}:c${chapterIndex + 1}:t${stepIndex + 1}`,
            );
            unitRows.push({
              id: topicId,
              ...stamps,
              gradeSubjectId,
              parentId: chapterId,
              kind: 'topic',
              title: `${title}: ${step.toLowerCase()}`,
              estimatedPeriods: Math.max(1, Math.round(perChapter / topicSteps.length)),
              sortOrder: stepIndex + 1,
            });
            outcomeRows.push({
              id: outcomeId,
              ...stamps,
              unitId: topicId,
              code: `${code}-${String(grade).padStart(2, '0')}-${String(unitIndex + 1).padStart(2, '0')}-${chapterIndex + 1}${'abc'[stepIndex]}`,
              statement:
                stepIndex === 0
                  ? `Define the terms of “${title}” and explain them in their own words.`
                  : stepIndex === 1
                    ? `Apply “${title}” to solve questions of the kind set in the textbook.`
                    : `Judge which method fits a new question on “${title}” and check the answer.`,
              level: (['understand', 'apply', 'evaluate'] as const)[stepIndex] ?? 'understand',
              sortOrder: stepIndex + 1,
            });
            chapter.topics.push({ id: topicId, title: step, outcomeId });
          });
        }
        list.push(chapter);
      });
    });
    chapters.set(gradeSubjectId, list);
  }
  // Parents first: units, then chapters, then topics.
  for (const kind of ['unit', 'chapter', 'topic'] as const)
    await insertAll(
      tx,
      syllabusUnits,
      unitRows.filter((row) => row.kind === kind),
    );
  await insertAll(tx, learningOutcomes, outcomeRows);

  // ------------------------------------------------------------------ the plan for the year

  /** Every school day of the year at a campus, and where "today" falls among them. */
  const yearDays = new Map<string, { days: string[]; index: Map<string, number>; today: number }>();
  for (const branch of Object.keys(school.branchIds)) {
    const days = setup.schoolDays(year.start, year.end, branch);
    const index = new Map(days.map((day, position) => [day, position]));
    const today = calendars.get(branch)?.today;
    yearDays.set(branch, { days, index, today: today ? (index.get(today) ?? -1) : -1 });
  }
  /** The school days a chapter is planned over: first and last position in the year. */
  const spanOf = (chapter: ChapterRef, count: number, days: number): [number, number] => [
    Math.floor((chapter.index * days) / count),
    Math.floor(((chapter.index + 1) * days) / count) - 1,
  ];

  // ------------------------------------------------------------------ schemes of work

  const schemeRows: (typeof schemesOfWork.$inferInsert)[] = [];
  const weekRows: (typeof schemeWeeks.$inferInsert)[] = [];
  const reviewer = (branch: string, notUser: string) => {
    const head = actors.desk(branch, 'head');
    return head === notUser ? actors.desk(branch, 'exams') : head;
  };
  // One scheme per campus, term and grade subject, written by whoever teaches it to the first section.
  const owners = new Map<string, { branch: string; subject: SectionSubjectRef; grade: number }>();
  for (const section of sections)
    for (const subject of section.subjects) {
      if (!chapters.has(subject.gradeSubjectId) || subject.periods < 2) continue;
      const key = `${section.branch}|${subject.gradeSubjectId}`;
      if (!owners.has(key))
        owners.set(key, { branch: section.branch, subject, grade: section.grade });
    }
  let schemeNo = 0;
  for (const [key, { branch, subject }] of owners) {
    const calendar = yearDays.get(branch);
    const list = chapters.get(subject.gradeSubjectId) ?? [];
    if (!calendar || list.length === 0) continue;
    for (const [termIndex, term] of setup.terms.entries()) {
      if (term.start > school.today) continue;
      schemeNo += 1;
      const current = term.end >= school.today;
      const status =
        !current || school.key !== 'roshan'
          ? ('approved' as const)
          : schemeNo % 17 === 3
            ? ('submitted' as const)
            : schemeNo % 17 === 9
              ? ('returned' as const)
              : schemeNo % 23 === 5
                ? ('draft' as const)
                : ('approved' as const);
      const author = actors.enteredBy(subject.teacher, branch);
      const id = school.id(`scheme:${key}:${termIndex + 1}`);
      schemeRows.push({
        id,
        ...stamps,
        branchId: branchOf(school, branch),
        academicYearId: year.id,
        termId: term.id,
        gradeSubjectId: subject.gradeSubjectId,
        status,
        submittedBy: status === 'draft' ? null : author,
        approvedBy: status === 'approved' ? reviewer(branch, author) : null,
        approvedAt: status === 'approved' ? at(addDays(term.start, 4), '13:30') : null,
        returnNote:
          status === 'returned'
            ? 'Weeks 6 to 8 plan more periods than the timetable gives. Please spread the unit out.'
            : null,
        draftedByAi: status === 'draft' || schemeNo % 11 === 4,
      });
      let weekNo = 0;
      for (let monday = mondayOf(term.start); monday <= term.end; monday = addDays(monday, 7)) {
        const start = monday < term.start ? term.start : monday;
        const sunday = addDays(monday, 6);
        const end = sunday > term.end ? term.end : sunday;
        weekNo += 1;
        const positions: number[] = [];
        for (let day = start; day <= end; day = addDays(day, 1)) {
          const position = calendar.index.get(day);
          if (position !== undefined) positions.push(position);
        }
        const first = positions[0];
        const last = positions[positions.length - 1];
        const planned =
          first === undefined || last === undefined
            ? []
            : list.filter((chapter) => {
                const [from, to] = spanOf(chapter, list.length, calendar.days.length);
                return from <= last && to >= first;
              });
        weekRows.push({
          id: school.id(`scheme-week:${key}:${termIndex + 1}:${weekNo}`),
          ...stamps,
          branchId: branchOf(school, branch),
          schemeId: id,
          weekNo,
          startDate: start,
          endDate: end,
          unitIds: planned.map((chapter) => chapter.id),
          // Never more than the timetable gives the subject in the days the school is open that week.
          periodsPlanned: Math.floor((subject.periods * positions.length) / 5),
          activities:
            planned.length > 0 && weekNo % 4 === 0
              ? 'Group activity and a short presentation'
              : null,
          assessment:
            planned.length > 0 && weekNo % 3 === 0 ? 'Short written test on the week’s work' : null,
          note: positions.length === 0 ? 'No school this week' : null,
        });
      }
    }
  }
  await insertAll(tx, schemesOfWork, schemeRows);
  await insertAll(tx, schemeWeeks, weekRows);

  // ------------------------------------------------------------------ progress

  const progressRows: (typeof syllabusProgress.$inferInsert)[] = [];
  /** Section subject → [chapter, first day, last day (when finished)] for every chapter begun. */
  const reached = new Map<string, { chapter: ChapterRef; from: string; to?: string }[]>();
  let order = 0;
  for (const section of sections) {
    const calendar = yearDays.get(section.branch);
    if (!calendar || calendar.today < 0) continue;
    for (const subject of section.subjects) {
      const list = chapters.get(subject.gradeSubjectId) ?? [];
      if (list.length === 0 || subject.periods < 2) continue;
      order += 1;
      const lag = lagOf(
        school,
        `${sectionKey(section)}:${subject.code}`,
        order,
        subject.teacher !== undefined,
      );
      const log: { chapter: ChapterRef; from: string; to?: string }[] = [];
      for (const chapter of list) {
        const [from, to] = spanOf(chapter, list.length, calendar.days.length);
        // A class behind its plan reaches every chapter later by the same share.
        const startsAt = Math.round(from / (1 - lag));
        const endsAt = Math.round(to / (1 - lag));
        if (startsAt > calendar.today) break;
        const started = calendar.days[startsAt] as string;
        const finished = endsAt < calendar.today ? calendar.days[endsAt] : undefined;
        log.push({ chapter, from: started, ...(finished && { to: finished }) });
        progressRows.push({
          id: school.id(`progress:${subject.id}:${chapter.id}`),
          ...stamps,
          branchId: branchOf(school, section.branch),
          sectionSubjectId: subject.id,
          unitId: chapter.id,
          status: finished ? 'completed' : 'in_progress',
          startedOn: started,
          completedOn: finished ?? null,
          periodsUsed: finished
            ? chapter.periods + (lag > 0 ? 1 : 0)
            : Math.max(
                1,
                Math.round(
                  (chapter.periods * (calendar.today - startsAt + 1)) /
                    Math.max(1, endsAt - startsAt + 1),
                ),
              ),
        });
      }
      reached.set(subject.id, log);
    }
  }
  await insertAll(tx, syllabusProgress, progressRows);

  const refs: SyllabusRefs = {
    chaptersOf: (gradeSubjectId) => chapters.get(gradeSubjectId) ?? [],
    coveredBy: (subject, date) =>
      (reached.get(subject.id) ?? [])
        .filter((entry) => entry.to !== undefined && entry.to <= date)
        .map((entry) => entry.chapter),
    chapterOn: (subject, date) => {
      const log = reached.get(subject.id) ?? [];
      const found =
        log.find((entry) => entry.from <= date && (entry.to === undefined || date <= entry.to)) ??
        [...log].reverse().find((entry) => entry.from <= date);
      return found?.chapter ?? chapters.get(subject.gradeSubjectId)?.[0];
    },
  };

  // ------------------------------------------------------------------ lesson plans

  if (school.key !== 'roshan') return refs;
  const main = calendars.get('MC');
  const today = main?.today;
  if (!main || !today) return refs;

  // Twelve teachers plan their lessons in the system: the three with a sign-in, and nine colleagues.
  const withSignIn = wave1.staff.all.filter((person) => person.kind && person.email);
  const others = wave1.staff.all
    .filter((person) => person.kind && !person.email && person.status === 'active')
    .filter((_person, index) => index % 5 === 2)
    .slice(0, 12 - withSignIn.length);
  const planners: StaffRef[] = [...withSignIn, ...others];

  const thisWeek = main.days.filter((day) => day >= mondayOf(today));
  const nextMonday = addDays(mondayOf(today), 7);
  const nextWeek = main.ahead(7).filter((day) => day >= nextMonday && day < addDays(nextMonday, 7));
  const sectionOf = new Map<string, SectionRef>(sections.map((section) => [section.id, section]));

  const planRows: (typeof lessonPlans.$inferInsert)[] = [];
  let planNo = 0;
  for (const teacher of planners) {
    const mine = timetable.lessons.filter((lesson) => lesson.teacher?.id === teacher.id);
    for (const date of [...thisWeek, ...nextWeek]) {
      const weekday = timetable.weekdayOf(date);
      if (!weekday) continue;
      const calendar = calendars.get(teacher.branch);
      if (!calendar?.isSchoolDay(date)) continue;
      const seen = new Map<string, string>(); // grade subject → the plan written first that day
      const todays = mine
        .filter((lesson) => lesson.weekday === weekday)
        .sort((a, b) => a.lessonNo - b.lessonNo);
      const once = new Set<string>();
      for (const lesson of todays) {
        // One plan for a subject in a class on a day, even when it has two lessons.
        if (once.has(lesson.subject.id)) continue;
        once.add(lesson.subject.id);
        const section = sectionOf.get(lesson.section.id);
        const chapter = refs.chapterOn(lesson.subject, date > today ? today : date);
        if (!section || !chapter) continue;
        planNo += 1;
        const past = date <= today;
        const status = past
          ? planNo % 10 === 6
            ? ('approved' as const)
            : ('taught' as const)
          : ((
              [
                'submitted',
                'approved',
                'draft',
                'submitted',
                'returned',
                'draft',
                'approved',
              ] as const
            )[planNo % 7] ?? 'draft');
        const topic = chapter.topics[planNo % Math.max(1, chapter.topics.length)];
        const id = school.id(`lesson-plan:${teacher.id}:${date}:${lesson.subject.id}`);
        const copiedFrom = seen.get(lesson.subject.gradeSubjectId);
        if (!copiedFrom) seen.set(lesson.subject.gradeSubjectId, id);
        const reviewed = status === 'approved' || status === 'returned' || status === 'taught';
        planRows.push({
          id,
          ...stamps,
          branchId: branchOf(school, section.branch),
          sectionSubjectId: lesson.subject.id,
          teacherId: teacher.id,
          planDate: date,
          lessonNo: lesson.lessonNo,
          unitId: topic?.id ?? chapter.id,
          outcomeIds: topic ? [topic.outcomeId] : [],
          title: topic ? `${chapter.title}: ${topic.title.toLowerCase()}` : chapter.title,
          objectives: `By the end of the lesson students can explain “${chapter.title}” and answer textbook questions on it without help.`,
          activities: [
            {
              minutes: 5,
              teacher: 'Recap the last lesson with three quick questions',
              students: 'Answer orally',
            },
            {
              minutes: 15,
              teacher: `Explain “${chapter.title}” on the board with two examples`,
              students: 'Take notes and ask questions',
            },
            {
              minutes: 15,
              teacher: 'Set a short task and move round the class',
              students: 'Work in pairs on the task',
            },
            {
              minutes: 5,
              teacher: 'Sum up and give the homework',
              students: 'Write the homework in the diary',
            },
          ],
          resources: 'Textbook, board, chart',
          classwork: `Exercise on ${chapter.title}, questions 1 to 5`,
          homework: planNo % 3 === 0 ? `Finish the exercise on ${chapter.title}` : null,
          assessment: 'Oral questions and a check of the classwork',
          differentiation:
            planNo % 4 === 0
              ? 'Extra worked example for those who need it; a challenge question for those who finish early'
              : null,
          reflection:
            status === 'taught'
              ? planNo % 5 === 0
                ? 'The class needed more time on the examples. Revisit at the start of the next lesson.'
                : 'Went as planned.'
              : null,
          language: urduSubjects.has(lesson.subject.code) ? 'ur' : 'en',
          status,
          reviewedBy: reviewed ? actors.desk(section.branch, 'academics') : null,
          reviewNote:
            status === 'returned'
              ? 'Please add how you will check understanding before the homework.'
              : null,
          draftedByAi: planNo % 9 === 4,
          copiedFromId: copiedFrom ?? null,
        });
      }
    }
  }
  // A plan copied to another section is written after the one it was copied from.
  await insertAll(
    tx,
    lessonPlans,
    planRows.filter((row) => !row.copiedFromId),
  );
  await insertAll(
    tx,
    lessonPlans,
    planRows.filter((row) => row.copiedFromId),
  );
  return refs;
}

import {
  bellPeriods,
  bellSchedules,
  substitutions,
  teacherAvailability,
  timetableEntries,
  timetables,
} from '../../schema';
import { addDays, at, branchOf, insertAll, weekdayOf, type School } from '../context';
import type { Wave1 } from '../schools';
import type { SectionRef, SectionSubjectRef } from '../wave1/academics';
import { sectionKey } from '../wave1/plan';
import type { StaffRef } from '../wave1/staff';

/*
 * M12 · Timetable: the bell schedules of each campus, one published timetable per campus with every
 * weekly period of every section placed, a few teachers' limits, and this week's substitutions.
 *
 * The timetable is worked out here, not copied from anywhere: no teacher is in two classes at once,
 * and no section has two lessons at once. The database would refuse it otherwise.
 */

export const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
export type Weekday = (typeof weekdays)[number];

export interface Lesson {
  /** The id of the timetable entry. */
  id: string;
  section: SectionRef;
  subject: SectionSubjectRef;
  weekday: Weekday;
  lessonNo: number;
  teacher?: StaffRef;
}

export interface TimetableRefs {
  lessons: Lesson[];
  /** The lessons of a section on a weekday, in order. */
  lessonsOf(section: SectionRef, weekday: Weekday): Lesson[];
  /** How many lessons a weekday has. */
  lessonCount(weekday: Weekday): number;
  weekdayOf(date: string): Weekday | undefined;
}

const lessonsOn = (weekday: Weekday) => (weekday === 'fri' ? 5 : 8);
const slots = weekdays.flatMap((weekday) =>
  Array.from({ length: lessonsOn(weekday) }, (_unused, index) => ({
    weekday,
    lessonNo: index + 1,
    key: `${weekday}:${index + 1}`,
  })),
);

const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** The rows of one bell schedule: an assembly, then lessons, with a break after `breakAfter` lessons. */
function periodsOf(input: {
  starts: number;
  lessons: number;
  minutes: number;
  breakAfter: number;
  breakMinutes: number;
  prayerAtEnd?: boolean;
}) {
  const rows: {
    kind: 'lesson' | 'break' | 'assembly' | 'prayer';
    name: string;
    lessonNo?: number;
    from: number;
    to: number;
  }[] = [];
  let time = input.starts;
  rows.push({ kind: 'assembly', name: 'Assembly', from: time, to: time + 15 });
  time += 15;
  for (let lesson = 1; lesson <= input.lessons; lesson++) {
    rows.push({
      kind: 'lesson',
      name: `Period ${lesson}`,
      lessonNo: lesson,
      from: time,
      to: time + input.minutes,
    });
    time += input.minutes;
    if (lesson === input.breakAfter) {
      rows.push({ kind: 'break', name: 'Break', from: time, to: time + input.breakMinutes });
      time += input.breakMinutes;
    }
  }
  if (input.prayerAtEnd)
    rows.push({ kind: 'prayer', name: 'Friday prayer', from: time, to: time + 45 });
  return rows;
}

/**
 * Places every weekly period of every section of one campus. The busiest teachers are placed first;
 * a lesson that finds no free slot takes one from another lesson of the same section that can move.
 */
function buildTimetable(
  sections: readonly SectionRef[],
): Map<string, { section: SectionRef; subject: SectionSubjectRef }> {
  const placed = new Map<string, { section: SectionRef; subject: SectionSubjectRef }>(); // `${sectionId}|${slot}`
  const busy = new Set<string>(); // `${teacherId}|${slot}`
  const perDay = new Map<string, number>(); // `${sectionId}|${code}|${weekday}`
  const load = new Map<string, number>();
  for (const section of sections)
    for (const subject of section.subjects)
      if (subject.teacher)
        load.set(subject.teacher.id, (load.get(subject.teacher.id) ?? 0) + subject.periods);

  const wanted = sections
    .flatMap((section) => section.subjects.map((subject) => ({ section, subject })))
    // Ethics runs beside Islamiyat for the few who take it, so it has no slot of its own.
    .filter(({ subject }) => subject.code !== 'ETH')
    .sort(
      (a, b) =>
        (load.get(b.subject.teacher?.id ?? '') ?? 0) -
          (load.get(a.subject.teacher?.id ?? '') ?? 0) ||
        b.subject.periods - a.subject.periods ||
        a.section.id.localeCompare(b.section.id) ||
        a.subject.code.localeCompare(b.subject.code),
    );

  const free = (
    section: SectionRef,
    subject: SectionSubjectRef,
    slot: (typeof slots)[number],
    limit: number,
  ) =>
    !placed.has(`${section.id}|${slot.key}`) &&
    (!subject.teacher || !busy.has(`${subject.teacher.id}|${slot.key}`)) &&
    (perDay.get(`${section.id}|${subject.code}|${slot.weekday}`) ?? 0) < limit;
  const put = (section: SectionRef, subject: SectionSubjectRef, slot: (typeof slots)[number]) => {
    placed.set(`${section.id}|${slot.key}`, { section, subject });
    if (subject.teacher) busy.add(`${subject.teacher.id}|${slot.key}`);
    const day = `${section.id}|${subject.code}|${slot.weekday}`;
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  };
  const take = (section: SectionRef, subject: SectionSubjectRef, slot: (typeof slots)[number]) => {
    placed.delete(`${section.id}|${slot.key}`);
    if (subject.teacher) busy.delete(`${subject.teacher.id}|${slot.key}`);
    const day = `${section.id}|${subject.code}|${slot.weekday}`;
    perDay.set(day, (perDay.get(day) ?? 1) - 1);
  };

  let turn = 0;
  for (const { section, subject } of wanted) {
    for (let period = 0; period < subject.periods; period++) {
      // Spread a subject over the week: start looking from a different slot each time.
      const order = slots.map(
        (_slot, index) => slots[(index + turn * 7) % slots.length] as (typeof slots)[number],
      );
      turn += 1;
      const slot =
        order.find((candidate) => free(section, subject, candidate, 1)) ??
        order.find((candidate) => free(section, subject, candidate, 2));
      if (slot) {
        put(section, subject, slot);
        continue;
      }
      // No slot is free for both the class and the teacher: move another lesson of this class out of
      // a slot the teacher has free, into a slot that class and its own teacher both have free.
      let moved = false;
      for (const candidate of order) {
        if (subject.teacher && busy.has(`${subject.teacher.id}|${candidate.key}`)) continue;
        const other = placed.get(`${section.id}|${candidate.key}`);
        if (!other) continue;
        const target = order.find(
          (spare) => spare.key !== candidate.key && free(section, other.subject, spare, 2),
        );
        if (!target) continue;
        take(section, other.subject, candidate);
        put(section, other.subject, target);
        put(section, subject, candidate);
        moved = true;
        break;
      }
      if (!moved)
        throw new Error(
          `The seed could not place ${subject.code} for ${sectionKey(section)}: its teacher has no free period left`,
        );
    }
  }
  return placed;
}

export async function seedTimetable(school: School, wave1: Wave1): Promise<TimetableRefs> {
  const { tx, stamps } = school;
  const { setup, sections, staff } = wave1;
  const year = setup.current;

  const scheduleRows: (typeof bellSchedules.$inferInsert)[] = [];
  const periodRows: (typeof bellPeriods.$inferInsert)[] = [];
  const timetableRows: (typeof timetables.$inferInsert)[] = [];
  const entryRows: (typeof timetableEntries.$inferInsert)[] = [];
  const lessons: Lesson[] = [];

  for (const [branch, branchId] of Object.entries(school.branchIds)) {
    const shiftId = setup.shiftIds[branch] as string;
    const summerEnds = `${year.startYear}-10-31`;
    const schedules = [
      {
        key: 'summer',
        name: 'Summer',
        from: year.start,
        to: summerEnds,
        days: ['mon', 'tue', 'wed', 'thu'],
        status: 'active',
        shape: { starts: 7 * 60 + 45, lessons: 8, minutes: 40, breakAfter: 4, breakMinutes: 20 },
      },
      {
        key: 'winter',
        name: 'Winter',
        from: addDays(summerEnds, 1),
        to: year.end,
        days: ['mon', 'tue', 'wed', 'thu'],
        status: 'active',
        shape: { starts: 8 * 60 + 15, lessons: 8, minutes: 35, breakAfter: 4, breakMinutes: 20 },
      },
      {
        key: 'friday',
        name: 'Friday',
        from: year.start,
        to: year.end,
        days: ['fri'],
        status: 'active',
        shape: {
          starts: 7 * 60 + 45,
          lessons: 5,
          minutes: 40,
          breakAfter: 3,
          breakMinutes: 15,
          prayerAtEnd: true,
        },
      },
      {
        key: 'ramadan',
        name: 'Ramadan',
        from: year.start,
        to: null,
        days: ['mon', 'tue', 'wed', 'thu'],
        status: 'draft',
        shape: { starts: 8 * 60, lessons: 6, minutes: 30, breakAfter: 3, breakMinutes: 10 },
      },
    ] as const;
    for (const schedule of schedules) {
      const id = school.id(`bell-schedule:${branch}:${schedule.key}`);
      scheduleRows.push({
        id,
        ...stamps,
        branchId,
        name: schedule.name,
        shiftId,
        validFrom: schedule.from,
        validTo: schedule.to,
        weekdays: [...schedule.days],
        lessonCount: schedule.shape.lessons,
        status: schedule.status,
      });
      periodsOf(schedule.shape).forEach((period, index) =>
        periodRows.push({
          id: school.id(`bell-period:${branch}:${schedule.key}:${index + 1}`),
          ...stamps,
          branchId,
          bellScheduleId: id,
          sequence: index + 1,
          kind: period.kind,
          lessonNo: period.lessonNo ?? null,
          name: period.name,
          startTime: clock(period.from),
          endTime: clock(period.to),
        }),
      );
    }

    // ---- the published timetable of the campus, and a draft copy being prepared for the winter
    const timetableId = school.id(`timetable:${branch}:published`);
    timetableRows.push(
      {
        id: timetableId,
        ...stamps,
        branchId,
        academicYearId: year.id,
        shiftId,
        name: `${year.name} timetable`,
        effectiveFrom: year.start,
        status: 'published',
        publishedAt: at(addDays(year.start, -3), '14:00'),
      },
      {
        id: school.id(`timetable:${branch}:draft`),
        ...stamps,
        branchId,
        academicYearId: year.id,
        shiftId,
        name: 'Winter changes (draft)',
        effectiveFrom: addDays(summerEnds, 1),
        status: 'draft',
        copiedFromId: timetableId,
      },
    );
    const here = sections.filter((section) => section.branch === branch);
    for (const [key, { section, subject }] of buildTimetable(here)) {
      const [, slot] = key.split('|') as [string, string];
      const [weekday, lessonNo] = slot.split(':') as [Weekday, string];
      const id = school.id(`timetable-entry:${sectionKey(section)}:${slot}`);
      entryRows.push({
        id,
        ...stamps,
        branchId,
        timetableId,
        sectionId: section.id,
        weekday,
        lessonNo: Number(lessonNo),
        sectionSubjectId: subject.id,
        teacherId: subject.teacher?.id ?? null,
      });
      lessons.push({
        id,
        section,
        subject,
        weekday,
        lessonNo: Number(lessonNo),
        ...(subject.teacher && { teacher: subject.teacher }),
      });
    }
  }
  await insertAll(tx, bellSchedules, scheduleRows);
  await insertAll(tx, bellPeriods, periodRows);
  // The published timetable first: the draft is a copy of it.
  await insertAll(
    tx,
    timetables,
    timetableRows.filter((row) => !row.copiedFromId),
  );
  await insertAll(
    tx,
    timetables,
    timetableRows.filter((row) => row.copiedFromId),
  );
  await insertAll(tx, timetableEntries, entryRows);

  const bySectionDay = new Map<string, Lesson[]>();
  for (const lesson of lessons) {
    const key = `${lesson.section.id}|${lesson.weekday}`;
    const list = bySectionDay.get(key) ?? [];
    list.push(lesson);
    bySectionDay.set(key, list);
  }
  for (const list of bySectionDay.values()) list.sort((a, b) => a.lessonNo - b.lessonNo);
  const refs: TimetableRefs = {
    lessons,
    lessonsOf: (section, weekday) => bySectionDay.get(`${section.id}|${weekday}`) ?? [],
    lessonCount: lessonsOn,
    weekdayOf: (date) => weekdays[weekdayOf(date) - 1],
  };

  if (school.key !== 'roshan') return refs;

  // ---- six teachers who cannot take certain periods; the timetable already keeps them free
  const busyAt = new Set(
    lessons.flatMap((lesson) =>
      lesson.teacher ? [`${lesson.teacher.id}|${lesson.weekday}:${lesson.lessonNo}`] : [],
    ),
  );
  const teachers = staff.all.filter((person) => person.kind && person.status === 'active');
  const limitRows: (typeof teacherAvailability.$inferInsert)[] = [];
  for (const [index, teacher] of teachers
    .filter((_person, at) => at % 7 === 3)
    .slice(0, 6)
    .entries()) {
    const spare = slots.filter((slot) => !busyAt.has(`${teacher.id}|${slot.key}`)).slice(0, 3);
    spare.forEach((slot, order) =>
      limitRows.push({
        id: school.id(`teacher-availability:${teacher.id}:${slot.key}`),
        ...stamps,
        branchId: branchOf(school, teacher.branch),
        staffId: teacher.id,
        weekday: slot.weekday,
        lessonNo: slot.lessonNo,
        kind: order === 2 ? 'preferred' : 'unavailable',
        reason:
          order === 2
            ? null
            : index % 2 === 0
              ? 'Teaches at the evening academy'
              : 'Part-time on this day',
      }),
    );
  }
  await insertAll(tx, teacherAvailability, limitRows);

  // ---- this week's substitutions: Ms Rabia Anwar is on leave, so her lessons need covering
  const rabia = staff.named.rabia;
  const substitutionRows: (typeof substitutions.$inferInsert)[] = [];
  // The last day the school was open: on a weekend or a holiday nobody needs covering.
  const today = rabia && setup.schoolDays(year.start, school.today, rabia.branch).at(-1);
  if (rabia && today) {
    const hers = lessons
      .filter((lesson) => lesson.teacher?.id === rabia.id)
      .sort(
        (a, b) =>
          weekdays.indexOf(a.weekday) - weekdays.indexOf(b.weekday) || a.lessonNo - b.lessonNo,
      );
    const monday = addDays(today, 1 - weekdayOf(today));
    const todayName = refs.weekdayOf(today) as Weekday;
    // Six already covered, two for today that still need someone, and two left as free periods.
    const plan: { lesson: Lesson; cover: 'assigned' | 'needed' | 'free' }[] = [];
    const todays = hers.filter((lesson) => lesson.weekday === todayName);
    const others = hers.filter((lesson) => lesson.weekday !== todayName);
    todays.slice(0, 2).forEach((lesson) => plan.push({ lesson, cover: 'needed' }));
    others.slice(0, 6).forEach((lesson) => plan.push({ lesson, cover: 'assigned' }));
    others.slice(6, 8).forEach((lesson) => plan.push({ lesson, cover: 'free' }));
    const taken = new Set<string>();
    for (const [index, { lesson, cover }] of plan.entries()) {
      const date = addDays(monday, weekdays.indexOf(lesson.weekday));
      if (!setup.isSchoolDay(date, rabia.branch)) continue;
      const slotKey = `${lesson.weekday}:${lesson.lessonNo}`;
      const substitute =
        cover === 'assigned'
          ? teachers.find(
              (person) =>
                person.branch === rabia.branch &&
                person.id !== rabia.id &&
                !busyAt.has(`${person.id}|${slotKey}`) &&
                !taken.has(`${person.id}|${date}|${lesson.lessonNo}`),
            )
          : undefined;
      if (substitute) taken.add(`${substitute.id}|${date}|${lesson.lessonNo}`);
      substitutionRows.push({
        id: school.id(`substitution:${index}`),
        ...stamps,
        branchId: branchOf(school, lesson.section.branch),
        substitutionDate: date,
        timetableEntryId: lesson.id,
        sectionId: lesson.section.id,
        lessonNo: lesson.lessonNo,
        absentTeacherId: rabia.id,
        substituteTeacherId: substitute?.id ?? null,
        reason: 'leave',
        // A lesson nobody could be found for is still waiting, whatever was intended.
        status:
          cover === 'needed' || (cover === 'assigned' && !substitute) ? 'planned' : 'confirmed',
        note: cover === 'free' ? 'Free period: the class works in the library' : null,
      });
    }
  }
  await insertAll(tx, substitutions, substitutionRows);
  return refs;
}

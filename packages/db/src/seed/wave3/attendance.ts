import {
  attendanceCorrections,
  attendanceRecords,
  attendanceSessions,
  studentLeaveRequests,
} from '../../schema';
import { addDays, at, branchOf, insertAll, random, weekdayOf, type School } from '../context';
import type { Wave1 } from '../schools';
import { stayOn, type SeededStudent } from '../wave1/students';
import type { Actors, Calendar, Rolls } from './shared';
import type { TimetableRefs } from './timetable';

/*
 * M14 · Student attendance: the register of every section for every school day of the year so far,
 * leave requests in every state, corrections, and two weeks of lesson-by-lesson registers for
 * Grades 9 and 10 at Main Campus.
 *
 * The register is worked out student by student, one day after another, so absences come the way
 * they do in a school: a child who is ill stays away for two or three days, a class has a bad week,
 * a few children are away far too often. Approved leave is written into the register as leave, and
 * nothing else is: the two always agree.
 */

export type DayStatus = NonNullable<(typeof attendanceRecords.$inferInsert)['status']>;
type LeaveReason = (typeof studentLeaveRequests.$inferInsert)['reason'];

export interface AttendanceRefs {
  /** What the register says for a student on a day; nothing when they were not enrolled, or the day is not marked. */
  statusOn(studentId: string, date: string): DayStatus | undefined;
  /** The reason of the approved leave a student was on that day. */
  leaveOn(studentId: string, date: string): LeaveReason | undefined;
  /** Marked days in a range, and how many of them the student came to school. */
  count(studentId: string, from: string, to: string): { present: number; total: number };
}

const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** How often a student is away, as a chance per school day. Most are almost never; a few far too often. */
function absenceRate(student: SeededStudent, schoolKey: string): number {
  const draw = random(`${schoolKey}:absence-rate:${student.id}`).next();
  return draw < 0.7 ? 0.018 : draw < 0.9 ? 0.04 : draw < 0.98 ? 0.075 : 0.14;
}

export async function seedAttendance(
  school: School,
  wave1: Wave1,
  actors: Actors,
  calendars: ReadonlyMap<string, Calendar>,
  rolls: Rolls,
  timetable: TimetableRefs,
): Promise<AttendanceRefs> {
  const { tx, stamps } = school;
  const { sections, students, setup } = wave1;
  const active = students.roster.filter((student) => student.status === 'active');

  // ------------------------------------------------------------------ leave requests

  type LeaveStatus = NonNullable<(typeof studentLeaveRequests.$inferInsert)['status']>;
  const leaveRows: (typeof studentLeaveRequests.$inferInsert)[] = [];
  /** `student|date` → the reason, for approved leave. */
  const onLeave = new Map<string, LeaveReason>();
  const reasons: readonly { reason: LeaveReason; detail: string; days: number }[] = [
    { reason: 'sick', detail: 'Fever. The doctor has advised rest.', days: 2 },
    { reason: 'family', detail: 'A wedding in the family, out of town.', days: 3 },
    { reason: 'sick', detail: 'Stomach infection.', days: 1 },
    { reason: 'travel', detail: 'Travelling to Karachi with the family.', days: 4 },
    { reason: 'religious', detail: 'Going for Umrah with the grandparents.', days: 10 },
    { reason: 'other', detail: 'An appointment at the passport office.', days: 1 },
    { reason: 'sick', detail: 'Eye infection; the doctor says it is contagious.', days: 3 },
    { reason: 'family', detail: 'A death in the family.', days: 2 },
  ];
  const plan: readonly LeaveStatus[] =
    school.key === 'roshan'
      ? [
          ...Array.from({ length: 16 }, () => 'approved' as const),
          ...Array.from({ length: 6 }, () => 'pending' as const),
          ...Array.from({ length: 4 }, () => 'rejected' as const),
          ...Array.from({ length: 4 }, () => 'cancelled' as const),
        ]
      : ['approved', 'pending'];
  const stride = Math.max(1, Math.floor(active.length / (plan.length + 1)));
  plan.forEach((status, index) => {
    const student = active[(7 + index * stride) % Math.max(1, active.length)];
    const calendar = student && calendars.get(student.branch);
    if (!student || !calendar?.today) return;
    const pick = random(`${school.key}:leave:${index}`);
    const what = reasons[index % reasons.length] as (typeof reasons)[number];
    // Decided requests lie in the past; those still waiting are for the days ahead.
    const upcoming = status === 'pending' || (status === 'cancelled' && index % 2 === 0);
    const from = upcoming
      ? (calendar.ahead(1 + pick.int(0, 6)).at(-1) ?? addDays(school.today, 1))
      : calendar.back(3 + pick.int(0, Math.min(45, Math.max(0, calendar.days.length - 4))));
    const enrolledFrom = student.stays[0]?.from;
    if (!from || !enrolledFrom || from < enrolledFrom) return;
    const to = addDays(from, what.days - 1);
    // Asked for the evening before; a request for the days ahead was sent in the last few evenings.
    const askedAt = at(
      addDays(upcoming ? school.today : from, upcoming ? -1 - pick.int(0, 2) : -1),
      '18:40',
    );
    const decided = status === 'approved' || status === 'rejected';
    leaveRows.push({
      id: school.id(`leave-request:${index}`),
      ...stamps,
      createdAt: askedAt,
      branchId: branchOf(school, student.branch),
      studentId: student.id,
      fromDate: from,
      toDate: to,
      reason: what.reason,
      detail: what.detail,
      requestedVia: index % 4 === 3 ? 'staff' : 'portal',
      status,
      decidedBy: decided ? actors.enteredBy(student.section.classTeacher, student.branch) : null,
      decidedAt: decided ? at(from, '07:50') : null,
      decisionNote:
        status === 'rejected' ? 'A test falls in these days. Please see the class teacher.' : null,
    });
    if (status === 'approved')
      for (let day = from; day <= to; day = addDays(day, 1))
        onLeave.set(`${student.id}|${day}`, what.reason);
  });
  await insertAll(tx, studentLeaveRequests, leaveRows);

  // ------------------------------------------------------------------ the register, day by day

  /** `student|date` → status, for every day the student was expected. */
  const register = new Map<string, DayStatus>();
  const minutesLate = new Map<string, number>();
  for (const [branch, calendar] of calendars) {
    const days = calendar.days;
    // Each section has one bad week in the year: something is going round.
    const badWeek = new Map<string, number>();
    for (const section of sections.filter((candidate) => candidate.branch === branch))
      badWeek.set(
        section.id,
        random(`${school.key}:bad-week:${section.id}`).int(0, Math.max(0, days.length - 6)),
      );
    for (const student of students.roster) {
      if (!student.stays.some((stay) => stay.section.branch === branch)) continue;
      const pick = random(`${school.key}:register:${student.id}:${branch}`);
      const base = absenceRate(student, school.key);
      let illFor = 0;
      days.forEach((day, position) => {
        const stay = stayOn(student, day);
        if (!stay || stay.section.branch !== branch) return;
        const key = `${student.id}|${day}`;
        if (onLeave.has(key)) {
          register.set(key, 'leave');
          illFor = 0;
          return;
        }
        let chance = base;
        const start = badWeek.get(stay.section.id) ?? -10;
        if (position >= start && position < start + 5) chance *= 4;
        if (weekdayOf(day) === 5) chance *= 1.3;
        // Bilal Khan has been missing more and more school over the last month.
        if (student.key === 'bilal-khan') chance = days.length - position <= 20 ? 0.3 : 0.06;
        if (illFor > 0) {
          illFor -= 1;
          register.set(key, 'absent');
          return;
        }
        const draw = pick.next();
        if (draw < chance) {
          register.set(key, 'absent');
          // Illness keeps a child away for a day or two more, about one time in three.
          if (pick.chance(0.35)) illFor = pick.int(1, 2);
          return;
        }
        const then = pick.next();
        if (then < 0.03) {
          register.set(key, 'late');
          minutesLate.set(key, 5 + pick.int(0, 30));
        } else if (then < 0.034) register.set(key, 'half_day');
        else register.set(key, 'present');
      });
    }
  }

  // ------------------------------------------------------------------ sessions and records

  const sessionRows: (typeof attendanceSessions.$inferInsert)[] = [];
  const recordRows: (typeof attendanceRecords.$inferInsert)[] = [];
  /** Days that count as marked: `student|date`. A draft register is not a marked day. */
  const marked = new Set<string>();

  for (const [index, section] of sections.entries()) {
    const calendar = calendars.get(section.branch);
    if (!calendar?.today) continue;
    const branchId = branchOf(school, section.branch);
    const taker = actors.enteredBy(section.classTeacher, section.branch);
    // Grades 9 and 10 at Main Campus moved to a register for every lesson two weeks ago.
    const byLesson =
      school.key === 'roshan' && section.branch === 'MC' && section.grade >= 9
        ? new Set(calendar.run(0, 10) ?? [])
        : new Set<string>();
    const pick = random(`${school.key}:sessions:${section.id}`);

    for (const day of calendar.days) {
      const seats = rolls.on(section, day);
      if (seats.length === 0) continue;
      const isToday = day === calendar.today;
      const isYesterday = day === calendar.back(1);
      const startsAt = 8 * 60 + pick.int(0, 12);

      if (byLesson.has(day)) {
        const weekday = timetable.weekdayOf(day);
        const lessons = weekday ? timetable.lessonsOf(section, weekday) : [];
        // Today the morning's lessons are in; the later ones have not been taken yet.
        const done = isToday
          ? lessons.filter((lesson) => lesson.lessonNo <= (index % 2 === 0 ? 4 : 2))
          : lessons;
        const firstLesson = lessons[0]?.lessonNo;
        for (const lesson of done) {
          const sessionId = school.id(`attendance-session:${section.id}:${day}:${lesson.lessonNo}`);
          const lessonTaker = actors.enteredBy(
            lesson.teacher ?? section.classTeacher,
            section.branch,
          );
          const submittedAt = at(day, clock(8 * 60 + 5 + (lesson.lessonNo - 1) * 42));
          sessionRows.push({
            id: sessionId,
            ...stamps,
            branchId,
            sectionId: section.id,
            sessionDate: day,
            lessonNo: lesson.lessonNo,
            sectionSubjectId: lesson.subject.id,
            takenBy: lessonTaker,
            status: isToday || isYesterday ? 'submitted' : 'locked',
            submittedAt,
            lockedAt: isToday || isYesterday ? null : at(addDays(day, 1), '13:45'),
          });
          const skip = random(`${school.key}:lesson:${section.id}:${day}:${lesson.lessonNo}`);
          for (const { student, enrollmentId } of seats) {
            const key = `${student.id}|${day}`;
            const whole = register.get(key) ?? 'present';
            let status: DayStatus =
              whole === 'late'
                ? lesson.lessonNo === firstLesson
                  ? 'late'
                  : 'present'
                : whole === 'half_day'
                  ? lesson.lessonNo <= 4
                    ? 'present'
                    : 'absent'
                  : whole;
            // Now and then a student who is at school misses one lesson; Bilal Khan more than most.
            if (status === 'present' && skip.chance(student.key === 'bilal-khan' ? 0.2 : 0.012))
              status = 'absent';
            recordRows.push({
              id: school.id(`attendance:${sessionId}:${student.id}`),
              ...stamps,
              branchId,
              sessionId,
              studentId: student.id,
              enrollmentId,
              sessionDate: day,
              status,
              minutesLate: status === 'late' ? (minutesLate.get(key) ?? 10) : null,
              markedAt: submittedAt,
              markedBy: lessonTaker,
              source: status === 'leave' ? 'leave_request' : 'manual',
            });
            marked.add(key);
          }
        }
        continue;
      }

      // The whole-day register. Today half the sections have handed theirs in, a quarter are part-way.
      const state = !isToday
        ? isYesterday
          ? 'submitted'
          : 'locked'
        : index % 4 <= 1
          ? 'submitted'
          : index % 4 === 2
            ? 'draft'
            : undefined;
      if (!state) continue;
      const sessionId = school.id(`attendance-session:${section.id}:${day}:0`);
      const markedAt = at(day, clock(startsAt));
      sessionRows.push({
        id: sessionId,
        ...stamps,
        branchId,
        sectionId: section.id,
        sessionDate: day,
        lessonNo: 0,
        takenBy: taker,
        status: state,
        submittedAt: state === 'draft' ? null : at(day, clock(startsAt + 4)),
        lockedAt: state === 'locked' ? at(addDays(day, 1), '13:45') : null,
      });
      // A register still being filled in has the first half of the class.
      const listed = state === 'draft' ? seats.slice(0, Math.ceil(seats.length / 2)) : seats;
      for (const { student, enrollmentId } of listed) {
        const key = `${student.id}|${day}`;
        const status = register.get(key) ?? 'present';
        recordRows.push({
          id: school.id(`attendance:${sessionId}:${student.id}`),
          ...stamps,
          branchId,
          sessionId,
          studentId: student.id,
          enrollmentId,
          sessionDate: day,
          status,
          minutesLate: status === 'late' ? (minutesLate.get(key) ?? 10) : null,
          note: status === 'half_day' ? 'Collected by a guardian before the last lessons' : null,
          markedAt,
          markedBy: taker,
          source: status === 'leave' ? 'leave_request' : 'manual',
        });
        if (state !== 'draft') marked.add(key);
      }
    }
  }

  // The day the district closed schools: three classes had opened their register before the order came.
  if (setup.closure && school.key === 'roshan') {
    for (const section of sections.filter((candidate) => candidate.branch === 'MC').slice(0, 3)) {
      sessionRows.push({
        id: school.id(`attendance-session:${section.id}:${setup.closure}:0`),
        ...stamps,
        branchId: branchOf(school, section.branch),
        sectionId: section.id,
        sessionDate: setup.closure,
        lessonNo: 0,
        takenBy: actors.enteredBy(section.classTeacher, section.branch),
        status: 'cancelled',
        note: 'The school was closed by order of the district before the register was handed in.',
      });
    }
  }

  // ------------------------------------------------------------------ corrections

  // Eight changes asked for after a register was locked: three made, three waiting, two refused.
  const correctionRows: (typeof attendanceCorrections.$inferInsert)[] = [];
  if (school.key === 'roshan') {
    const lastOpenDay = [...calendars.values()]
      .map((calendar) => calendar.back(1))
      .filter((day): day is string => day !== undefined)
      .sort()[0];
    const wholeDay = new Set(sessionRows.filter((row) => row.lessonNo === 0).map((row) => row.id));
    const locked = recordRows.filter(
      (row) =>
        wholeDay.has(row.sessionId) && lastOpenDay !== undefined && row.sessionDate < lastOpenDay,
    );
    const candidates = locked.filter((row) => row.status === 'absent');
    const lateOnes = locked.filter((row) => row.status === 'late');
    const cases = [
      {
        to: 'present',
        status: 'approved',
        reason: 'She was at the inter-school science fair with the school team.',
      },
      {
        to: 'late',
        status: 'approved',
        reason: 'He arrived at 8:40 with a note from the office; the register had been handed in.',
      },
      {
        to: 'present',
        status: 'approved',
        from: 'late',
        reason: 'The van was late that morning; the whole route arrived together.',
      },
      {
        to: 'present',
        status: 'pending',
        reason: 'His mother says he was in class; the monitor confirms it.',
      },
      {
        to: 'present',
        status: 'pending',
        reason: 'Marked absent by mistake; she sat the class test that day.',
      },
      {
        to: 'late',
        status: 'pending',
        reason: 'Came after the first lesson from a dentist’s appointment.',
      },
      {
        to: 'present',
        status: 'rejected',
        reason: 'The guardian says he was present.',
        note: 'The gate register shows he did not come in that day.',
      },
      {
        to: 'present',
        status: 'rejected',
        reason: 'Asked for by the guardian.',
        note: 'The class teacher confirms the absence.',
      },
    ] as const;
    cases.forEach((item, index) => {
      const pool = 'from' in item ? lateOnes : candidates;
      const record = pool[Math.floor(((index + 1) * pool.length) / (cases.length + 1))];
      if (!record) return;
      const section = sections.find(
        (candidate) => branchOf(school, candidate.branch) === record.branchId,
      );
      const branch = section?.branch ?? 'MC';
      correctionRows.push({
        id: school.id(`attendance-correction:${index}`),
        ...stamps,
        branchId: record.branchId,
        recordId: record.id as string,
        fromStatus: record.status,
        toStatus: item.to,
        reason: item.reason,
        status: item.status,
        decidedBy: item.status === 'pending' ? null : actors.desk(branch, 'pastoral'),
        decisionNote: 'note' in item ? item.note : null,
      });
      if (item.status === 'approved') {
        // The register now shows what was approved.
        const key = `${record.studentId}|${record.sessionDate}`;
        record.status = item.to;
        record.minutesLate = item.to === 'late' ? 40 : null;
        record.note = 'Corrected after the day was locked';
        register.set(key, item.to);
      }
    });
  }

  await insertAll(tx, attendanceSessions, sessionRows);
  await insertAll(tx, attendanceRecords, recordRows);
  await insertAll(tx, attendanceCorrections, correctionRows);

  return {
    statusOn: (studentId, date) => {
      const key = `${studentId}|${date}`;
      return marked.has(key) ? register.get(key) : undefined;
    },
    leaveOn: (studentId, date) => onLeave.get(`${studentId}|${date}`),
    count: (studentId, from, to) => {
      let present = 0;
      let total = 0;
      for (let day = from; day <= to; day = addDays(day, 1)) {
        const key = `${studentId}|${day}`;
        if (!marked.has(key)) continue;
        const status = register.get(key);
        total += 1;
        if (status === 'present' || status === 'late' || status === 'half_day') present += 1;
      }
      return { present, total };
    },
  };
}

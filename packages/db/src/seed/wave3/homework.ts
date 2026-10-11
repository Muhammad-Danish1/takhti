import { diaryAcknowledgements, diaryEntries, homework, homeworkSubmissions } from '../../schema';
import { at, branchOf, insertAll, random, weekdayOf, type School } from '../context';
import type { Wave1 } from '../schools';
import { sectionKey } from '../wave1/plan';
import type { AttendanceRefs } from './attendance';
import { takes, type Actors, type Calendar, type Rolls } from './shared';
import type { SyllabusRefs } from './syllabus';
import type { TimetableRefs } from './timetable';

/*
 * M15 · Homework and diary: three weeks of the class diary for every section, the homework given
 * in those weeks with what each student did about it, and the guardians who confirmed they read
 * the diary.
 *
 * Homework and diary entries come from the timetable: a subject can only give homework on a day it
 * had a lesson, and it asks about the chapter the class has reached.
 */

type Kind = NonNullable<(typeof homework.$inferInsert)['submission']>;
type SubmissionStatus = NonNullable<(typeof homeworkSubmissions.$inferInsert)['status']>;

const classNotes = [
  'Please check the diary every day and sign it.',
  'Tomorrow is library day. Please send the library book.',
  'The class did very well in today’s assembly presentation.',
  'Please send a water bottle every day; the weather is still warm.',
  'Art material is needed on Thursday: chart paper and poster colours.',
  'Fee challans were sent home today.',
  'Please make sure your child revises the week’s work over the weekend.',
  'Sports kit is needed tomorrow.',
];

const urduSubjects = new Set(['URD', 'ISL', 'NAZ']);

export async function seedHomework(
  school: School,
  wave1: Wave1,
  actors: Actors,
  calendars: ReadonlyMap<string, Calendar>,
  rolls: Rolls,
  timetable: TimetableRefs,
  syllabus: SyllabusRefs,
  attendance: AttendanceRefs,
): Promise<void> {
  const { tx, stamps } = school;
  const { sections } = wave1;

  const diaryRows: (typeof diaryEntries.$inferInsert)[] = [];
  const homeworkRows: (typeof homework.$inferInsert)[] = [];
  const submissionRows: (typeof homeworkSubmissions.$inferInsert)[] = [];
  const ackRows: (typeof diaryAcknowledgements.$inferInsert)[] = [];
  /** `section|date` for every day a section's diary was posted. */
  const posted = new Set<string>();
  // Two sections have a day with far too much due at once, so the warning has something to show.
  const heavy = new Set(school.key === 'roshan' ? ['MC:8-A', 'CC:5-A'] : []);
  /** Nothing the seed writes happened after the moment it was run. */
  const notAfterNow = (moment: string) => (moment > school.now ? school.now : moment);

  for (const section of sections) {
    const calendar = calendars.get(section.branch);
    const today = calendar?.today;
    if (!calendar || !today || !section.classTeacher) continue;
    const branchId = branchOf(school, section.branch);
    const days = calendar.run(0, 15) ?? calendar.days;
    const next = calendar.ahead(4);
    const dueAfter = (day: string, steps: number): string => {
      const position = calendar.days.indexOf(day);
      const later = [...calendar.days.slice(position + 1), ...next];
      return later[steps - 1] ?? later.at(-1) ?? day;
    };
    // A full day of lessons, so there are enough subjects to pile up: the last Monday to Thursday.
    const heavyDay = heavy.has(sectionKey(section))
      ? [...days].reverse().find((day) => weekdayOf(day) !== 5)
      : undefined;

    for (const day of days) {
      const weekday = timetable.weekdayOf(day);
      if (!weekday) continue;
      const pick = random(`${school.key}:diary:${section.id}:${day}`);
      const lessons = timetable.lessonsOf(section, weekday);
      const subjects = [...new Map(lessons.map((lesson) => [lesson.subject.id, lesson])).values()];
      const isToday = day === today;
      // On the very day the seed is run the school day is not over: the diary is still being written.
      const unfinished = day === school.today;

      // ---- the diary: about six days in seven
      if (pick.chance(0.85)) {
        if (!unfinished) posted.add(`${section.id}|${day}`);
        const publishedAt = at(day, '13:20');
        diaryRows.push({
          id: school.id(`diary:${section.id}:${day}:note`),
          ...stamps,
          branchId,
          sectionId: section.id,
          entryDate: day,
          body: pick.pick(classNotes),
          postedBy: section.classTeacher.id,
          // Today's note is written and waiting to go out with the afternoon digest.
          status: unfinished ? 'draft' : 'published',
          publishedAt: unfinished ? null : publishedAt,
        });
        for (const lesson of subjects) {
          if (unfinished || !lesson.teacher || !pick.chance(0.45)) continue;
          const chapter = syllabus.chapterOn(lesson.subject, day);
          diaryRows.push({
            id: school.id(`diary:${section.id}:${day}:${lesson.subject.id}`),
            ...stamps,
            branchId,
            sectionId: section.id,
            entryDate: day,
            sectionSubjectId: lesson.subject.id,
            body: chapter
              ? `Today we worked on “${chapter.title}” (${chapter.unitTitle}). Classwork is in the notebook.`
              : 'Revision of the week’s work.',
            postedBy: lesson.teacher.id,
            status: 'published',
            publishedAt,
          });
        }
      }

      // ---- homework: a subject that had a lesson may set some; never more than three, except on the heavy day
      let given = 0;
      for (const lesson of subjects) {
        if (!lesson.teacher || lesson.subject.periods < 2) continue;
        const forced = day === heavyDay && given < 5;
        if (!forced && (given >= 3 || !pick.chance(0.2))) continue;
        given += 1;
        const online = section.grade >= 6 && pick.chance(0.3);
        const kind: Kind = !online
          ? 'in_notebook'
          : pick.chance(0.5)
            ? 'online_text'
            : 'online_file';
        const due = forced
          ? dueAfter(day, 1)
          : dueAfter(day, pick.chance(0.75) ? 1 : pick.int(2, 3));
        const chapter = syllabus.chapterOn(lesson.subject, day);
        const maxMarks = pick.chance(0.3) ? 10 : null;
        const id = school.id(`homework:${lesson.subject.id}:${day}`);
        const overdue = due < today;
        // A teacher has usually checked the notebooks by the day after they were due.
        const checked = overdue && pick.chance(0.75);
        const checker = actors.enteredBy(lesson.teacher, section.branch);
        homeworkRows.push({
          id,
          ...stamps,
          branchId,
          sectionSubjectId: lesson.subject.id,
          sectionId: section.id,
          assignedBy: lesson.teacher.id,
          title: chapter ? `${chapter.title}: exercise` : 'Revision exercise',
          instructions: urduSubjects.has(lesson.subject.code)
            ? 'سبق کے آخر میں دیے گئے سوالات کے جوابات کاپی میں لکھیں۔'
            : kind === 'in_notebook'
              ? 'Answer the questions at the end of the chapter in your notebook.'
              : kind === 'online_text'
                ? 'Write your answer in a paragraph of about 100 words and submit it here.'
                : 'Do the work on paper, take a clear photograph and upload it.',
          assignedOn: day,
          dueDate: due,
          submission: kind,
          maxMarks,
          unitId: chapter?.id ?? null,
          allowLate: kind !== 'in_notebook',
          status:
            overdue && checked && calendar.ago(due) !== undefined && (calendar.ago(due) ?? 0) > 8
              ? 'closed'
              : 'published',
        });

        for (const { student } of rolls.on(section, day)) {
          if (!takes(student, lesson.subject.code)) continue;
          const draw = random(`${school.key}:submission:${id}:${student.id}`);
          const away = attendance.leaveOn(student.id, due) !== undefined;
          let status: SubmissionStatus = 'pending';
          let submittedAt: string | null = null;
          let marks: number | null = null;
          let remark: string | null = null;
          const done = draw.next();
          if (kind === 'in_notebook') {
            if (checked) status = away ? 'excused' : done < 0.9 ? 'checked' : 'missing';
          } else if (overdue) {
            // Online work: most hand it in on time, some late, a few not at all.
            if (away) status = 'excused';
            else if (done < 0.72) {
              status = checked ? (draw.chance(0.08) ? 'returned' : 'checked') : 'submitted';
              submittedAt = at(due, '07:10');
            } else if (done < 0.84) {
              status = checked && draw.chance(0.5) ? 'checked' : 'late';
              submittedAt = notAfterNow(
                at(dueAfter(due, 1) > today ? today : dueAfter(due, 1), '18:30'),
              );
            } else status = 'missing';
          } else if (done < 0.35 && day < school.today) {
            status = 'submitted';
            submittedAt = at(day, '19:15');
          }
          if (status === 'checked' && maxMarks !== null) marks = 5 + draw.int(0, 5);
          if (status === 'returned') remark = 'Please redo question 2 and submit again.';
          if (status === 'checked' && draw.chance(0.15)) remark = 'Good work. Keep it up.';
          const wasChecked =
            status === 'checked' || status === 'returned' || (kind === 'in_notebook' && checked);
          submissionRows.push({
            id: school.id(`submission:${id}:${student.id}`),
            ...stamps,
            branchId,
            homeworkId: id,
            studentId: student.id,
            status,
            answerText:
              kind === 'online_text' && submittedAt
                ? 'My answer is written below as asked in the instructions.'
                : null,
            submittedAt,
            checkedBy: wasChecked ? checker : null,
            checkedAt: wasChecked
              ? notAfterNow(at(dueAfter(due, 1) > today ? today : dueAfter(due, 1), '10:30'))
              : null,
            marks,
            remark,
          });
        }
      }

      // One piece written today, to go out tomorrow afternoon.
      const first = subjects[0];
      if (isToday && first?.teacher && section.grade >= 6 && pick.chance(0.25)) {
        const chapter = syllabus.chapterOn(first.subject, day);
        const tomorrow = dueAfter(day, 1);
        homeworkRows.push({
          id: school.id(`homework:${first.subject.id}:${day}:draft`),
          ...stamps,
          branchId,
          sectionSubjectId: first.subject.id,
          sectionId: section.id,
          assignedBy: first.teacher.id,
          title: chapter ? `${chapter.title}: worksheet` : 'Worksheet',
          instructions: 'Complete the worksheet handed out in class.',
          assignedOn: tomorrow,
          dueDate: dueAfter(day, 2),
          submission: 'in_notebook',
          unitId: chapter?.id ?? null,
          publishAt: at(tomorrow, '13:00'),
          status: 'draft',
        });
      }
    }
  }

  // ---- guardians who confirmed they read the diary: about six days in ten, for those who can sign in
  for (const student of wave1.students.roster) {
    const user = actors.familyUser(student.familyId);
    if (!user || student.status !== 'active') continue;
    const calendar = calendars.get(student.branch);
    for (const day of calendar?.run(0, 15) ?? calendar?.days ?? []) {
      if (!posted.has(`${student.section.id}|${day}`)) continue;
      const pick = random(`${school.key}:diary-read:${student.id}:${day}`);
      if (!pick.chance(0.6) || day === calendar?.today) continue;
      if (!rolls.on(student.section, day).some((seat) => seat.student.id === student.id)) continue;
      ackRows.push({
        id: school.id(`diary-read:${student.id}:${day}`),
        ...stamps,
        branchId: branchOf(school, student.branch),
        sectionId: student.section.id,
        entryDate: day,
        studentId: student.id,
        acknowledgedBy: user,
        acknowledgedAt: at(day, `${19 + pick.int(0, 2)}:${String(pick.int(10, 55))}`),
      });
    }
  }

  await insertAll(tx, diaryEntries, diaryRows);
  await insertAll(tx, homework, homeworkRows);
  await insertAll(tx, homeworkSubmissions, submissionRows);
  await insertAll(tx, diaryAcknowledgements, ackRows);
}

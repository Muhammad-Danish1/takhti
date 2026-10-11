import { timed, type School } from '../context';
import type { Wave1 } from '../schools';
import { seedAttendance } from './attendance';
import { seedHomework } from './homework';
import { actorsOf, calendarOf, rollsOf, type Calendar } from './shared';
import { seedSyllabus } from './syllabus';
import { seedTimetable } from './timetable';

/*
 * Wave 3 · Academics: what a school does with its classes once they exist. Each part hands the next
 * what it needs, so the whole agrees with itself: the timetable decides when a subject is taught,
 * the syllabus what is taught, attendance who was there, and marks and results follow from all three.
 */
export async function seedWave3(
  school: School,
  wave1: Wave1,
  userIds: ReadonlyMap<string, string>,
): Promise<void> {
  const actors = actorsOf(school, wave1, userIds);
  const calendars = new Map<string, Calendar>(
    Object.keys(school.branchIds).map((branch) => [branch, calendarOf(school, wave1, branch)]),
  );
  const rolls = rollsOf(wave1);

  const timetable = await timed(school, 'timetable', () => seedTimetable(school, wave1));
  const syllabus = await timed(school, 'syllabus', () =>
    seedSyllabus(school, wave1, actors, calendars, timetable),
  );
  const attendance = await timed(school, 'attendance', () =>
    seedAttendance(school, wave1, actors, calendars, rolls, timetable),
  );
  await timed(school, 'homework', () =>
    seedHomework(school, wave1, actors, calendars, rolls, timetable, syllabus, attendance),
  );
}

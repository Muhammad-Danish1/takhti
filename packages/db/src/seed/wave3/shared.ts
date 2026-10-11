import { addDays, weekdayOf, type School } from '../context';
import type { Wave1 } from '../schools';
import type { SectionRef } from '../wave1/academics';
import { stayOn, type SeededStudent } from '../wave1/students';
import type { StaffRef } from '../wave1/staff';

/*
 * What the Wave 3 seeds share: who acts under which sign-in, the school days of each campus counted
 * back from the seed's "today", and who sat in which section on which day.
 */

/** A kind of office work, done by whoever holds that desk at a campus. */
export type Desk = 'academics' | 'exams' | 'pastoral' | 'head' | 'counselling';

export interface Actors {
  /** The sign-in of a staff member, when they have one. */
  userOf(person: StaffRef | undefined): string | undefined;
  /**
   * The sign-in a record made by this staff member is entered under: their own, or the academic
   * office of their campus. The seed has one sign-in per role, so most teachers have none; their
   * registers and marks are keyed in by the office, as happens in a school that is still moving
   * its teachers on to the system.
   */
  enteredBy(person: StaffRef | undefined, branch: string): string;
  /** The sign-in of whoever holds a desk at a campus. */
  desk(branch: string, desk: Desk): string;
  /**
   * The sign-in of a guardian of a family, when one of them has a sign-in. Until guardians sign in
   * with their phone numbers (Phase 5) only four families do, so what only a guardian can do, such
   * as acknowledging the diary, is seeded for those families alone.
   */
  familyUser(familyId: string): string | undefined;
}

/** The seeded guardians who can sign in, each with a child of theirs. */
const guardianAccounts: Record<string, string> = {
  'guardian@roshan.test': 'hassan-ahmed',
  'teacher.parent@roshan.test': 'rayyan-arif',
  'guardian.both@roshan.test:roshan': 'zain-mehmood',
  'guardian.both@roshan.test:alnoor': 'dua-mehmood',
  'guardian@alnoor.test': 'zainab-memon',
};

const desks: Record<string, Record<Desk, string>> = {
  MC: {
    academics: 'coordinator@roshan.test',
    exams: 'exam.controller@roshan.test',
    pastoral: 'section.head@roshan.test',
    head: 'principal@roshan.test',
    counselling: 'counsellor@roshan.test',
  },
  // City Campus has one sign-in of its own; group roles cover the rest.
  CC: {
    academics: 'principal.cc@roshan.test',
    exams: 'academic.head@roshan.test',
    pastoral: 'principal.cc@roshan.test',
    head: 'principal.cc@roshan.test',
    counselling: 'principal.cc@roshan.test',
  },
  AN: {
    academics: 'teacher@alnoor.test',
    exams: 'owner@alnoor.test',
    pastoral: 'teacher@alnoor.test',
    head: 'owner@alnoor.test',
    counselling: 'owner@alnoor.test',
  },
};

export function actorsOf(
  school: School,
  wave1: Wave1,
  userIds: ReadonlyMap<string, string>,
): Actors {
  const user = (email: string): string => {
    const id = userIds.get(email);
    if (!id) throw new Error(`No sign-in account was made for ${email}`);
    return id;
  };
  const deskEmail = (branch: string, desk: Desk): string => {
    const email = desks[branch]?.[desk];
    if (!email) throw new Error(`${school.key} has nobody at the ${desk} desk of ${branch}`);
    return email;
  };
  const families = new Map<string, string>();
  for (const [account, child] of Object.entries(guardianAccounts)) {
    const [email, where] = account.split(':') as [string, string | undefined];
    const family = wave1.students.named[child]?.familyId;
    if (family && (where === undefined || where === school.key) && userIds.has(email))
      families.set(family, user(email));
  }
  const userOf = (person: StaffRef | undefined) =>
    person?.email ? userIds.get(person.email) : undefined;
  return {
    userOf,
    enteredBy: (person, branch) => userOf(person) ?? user(deskEmail(branch, 'academics')),
    desk: (branch, desk) => user(deskEmail(branch, desk)),
    familyUser: (familyId) => families.get(familyId),
  };
}

// ---------------------------------------------------------------- the school days of a campus

export interface Calendar {
  /** The last day students were at school on or before the seed's "today"; nothing in a year that has not begun. */
  today?: string;
  /** Every school day of the year up to that day, oldest first. */
  days: readonly string[];
  /** The school day `count` school days before the last one; nothing when the year is not that old yet. */
  back(count: number): string | undefined;
  /** `count` school days in a row, ending `endBack` school days before the last one, oldest first. */
  run(endBack: number, count: number): string[] | undefined;
  /** The first school day after the seed's "today", then the ones that follow. */
  ahead(count: number): string[];
  isSchoolDay(date: string): boolean;
  /** How many school days ago a date was; nothing for a date that was not a school day. */
  ago(date: string): number | undefined;
}

export function calendarOf(school: School, wave1: Wave1, branch: string): Calendar {
  const { setup } = wave1;
  const days = setup.schoolDays(setup.current.start, school.today, branch);
  const position = new Map(days.map((day, index) => [day, index]));
  const back = (count: number) => (count < 0 ? undefined : days[days.length - 1 - count]);
  const today = days[days.length - 1];
  return {
    ...(today !== undefined && { today }),
    days,
    back,
    run: (endBack, count) => {
      const end = days.length - 1 - endBack;
      const start = end - count + 1;
      return endBack < 0 || start < 0 ? undefined : days.slice(start, end + 1);
    },
    ahead: (count) => {
      const found: string[] = [];
      for (
        let day = addDays(school.today, 1);
        found.length < count && day <= setup.current.end;
        day = addDays(day, 1)
      ) {
        if (setup.isSchoolDay(day, branch)) found.push(day);
      }
      return found;
    },
    isSchoolDay: (date) => setup.isSchoolDay(date, branch),
    ago: (date) => {
      const at = position.get(date);
      return at === undefined ? undefined : days.length - 1 - at;
    },
  };
}

// ---------------------------------------------------------------- who sat where, and when

export interface Rolls {
  /** The students enrolled in a section on a date, in roll order, with the enrolment each held. */
  on(section: SectionRef, date: string): readonly Seat[];
  /** Everyone who sat in a section at any time this year. */
  ever(section: SectionRef): readonly SeededStudent[];
  /** The students in a section now, in roll order. */
  now(section: SectionRef): readonly SeededStudent[];
}

export interface Seat {
  student: SeededStudent;
  enrollmentId: string;
}

export function rollsOf(wave1: Wave1): Rolls {
  const ever = new Map<string, SeededStudent[]>();
  const now = new Map<string, SeededStudent[]>();
  for (const student of wave1.students.roster) {
    for (const stay of student.stays) {
      const list = ever.get(stay.section.id) ?? [];
      if (!list.includes(student)) list.push(student);
      ever.set(stay.section.id, list);
    }
    if (student.status === 'active') {
      const list = now.get(student.section.id) ?? [];
      list.push(student);
      now.set(student.section.id, list);
    }
  }
  const inRollOrder = (a: SeededStudent, b: SeededStudent) =>
    (a.rollNo ?? 999) - (b.rollNo ?? 999) ||
    a.fullName.localeCompare(b.fullName) ||
    a.id.localeCompare(b.id);
  for (const list of ever.values()) list.sort(inRollOrder);
  for (const list of now.values()) list.sort(inRollOrder);

  const cache = new Map<string, Seat[]>();
  return {
    on: (section, date) => {
      const key = `${section.id}|${date}`;
      let seats = cache.get(key);
      if (!seats) {
        seats = [];
        for (const student of ever.get(section.id) ?? []) {
          const stay = stayOn(student, date);
          if (stay?.section.id === section.id)
            seats.push({ student, enrollmentId: stay.enrollmentId });
        }
        cache.set(key, seats);
      }
      return seats;
    },
    ever: (section) => ever.get(section.id) ?? [],
    now: (section) => now.get(section.id) ?? [],
  };
}

/** Monday of the week a date falls in. */
export const mondayOf = (date: string): string => addDays(date, 1 - weekdayOf(date));

/** Whether a student studies a subject of their section. Islamiyat and Ethics are alternatives of each other. */
export const takes = (student: SeededStudent, code: string): boolean =>
  code === 'ETH'
    ? student.key === 'daniel-masih'
    : code === 'ISL'
      ? student.key !== 'daniel-masih'
      : true;

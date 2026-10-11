import { academicYears, gradeBands, gradingSchemes, holidays, shifts, terms } from '../../schema';
import {
  addDays,
  addMonths,
  addYears,
  insertAll,
  monthOf,
  noonOn,
  weekdayOf,
  workingDayOnOrBefore,
  yearOf,
  ymd,
  type School,
} from '../context';

/*
 * M04 · School setup: two academic years with their terms, the holidays of the current year,
 * a morning shift at every branch, and three grading schemes.
 */

export interface YearRef {
  id: string;
  name: string;
  start: string;
  end: string;
  /** The calendar year the academic year starts in. */
  startYear: number;
}

export interface SetupRefs {
  previous: YearRef;
  current: YearRef;
  /** Branch code → the morning shift's id. */
  shiftIds: Record<string, string>;
  schemes: { national: string; primary: string; old: string };
  /** The three terms of the current year, in order. */
  terms: { id: string; name: string; start: string; end: string }[];
  /**
   * Whether students are at school on a date: a weekday of the current year that no holiday covers.
   * Give a branch code to take that branch's own holidays into account.
   */
  isSchoolDay(date: string, branch?: string): boolean;
  /** The school days in a range, oldest first. */
  schoolDays(from: string, to: string, branch?: string): string[];
  /** The day the school was closed at short notice, when that day falls in the current year. */
  closure?: string;
}

function yearRef(school: School, startYear: number): YearRef {
  const start = ymd(startYear, school.yearStartMonth, 1);
  const end = addDays(addYears(start, 1), -1);
  const name =
    yearOf(end) === startYear ? String(startYear) : `${startYear}–${String(yearOf(end)).slice(2)}`;
  return { id: school.id(`year:${startYear}`), name, start, end, startYear };
}

// ---- holidays that follow the Islamic calendar

/** The day number of a date in the tabular Islamic calendar (the arithmetic one, good to a day either way). */
const hijriDay = (year: number, month: number, day: number) =>
  Math.floor((11 * year + 3) / 30) +
  354 * year +
  30 * month -
  Math.floor((month - 1) / 2) +
  day +
  1948440 -
  385;

function gregorianOf(dayNumber: number): string {
  let l = dayNumber + 68569;
  const n = Math.floor((4 * l) / 146097);
  l -= Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l) / 2447);
  const day = l - Math.floor((2447 * j) / 80);
  l = Math.floor(j / 11);
  return ymd(100 * (n - 49) + i + l, j + 2 - 12 * l, day);
}

const islamicHolidays = [
  { name: 'Eid ul-Fitr', nameUr: 'عید الفطر', month: 10, day: 1, days: 3 },
  { name: 'Eid ul-Adha', nameUr: 'عید الاضحیٰ', month: 12, day: 10, days: 3 },
  { name: 'Ashura', nameUr: 'عاشورہ', month: 1, day: 9, days: 2 },
  { name: 'Eid Milad-un-Nabi', nameUr: 'عید میلاد النبی', month: 3, day: 12, days: 1 },
];

const nationalHolidays = [
  { name: 'Labour Day', nameUr: 'یوم مزدور', month: 5, day: 1 },
  { name: 'Independence Day', nameUr: 'یوم آزادی', month: 8, day: 14 },
  { name: 'Iqbal Day', nameUr: 'یوم اقبال', month: 11, day: 9 },
  { name: 'Quaid-e-Azam Day', nameUr: 'یوم قائد اعظم', month: 12, day: 25 },
  { name: 'Kashmir Solidarity Day', nameUr: 'یوم یکجہتی کشمیر', month: 2, day: 5 },
  { name: 'Pakistan Day', nameUr: 'یوم پاکستان', month: 3, day: 23 },
];

const within = (date: string, year: YearRef) => date >= year.start && date <= year.end;

export async function seedSetup(school: School): Promise<SetupRefs> {
  const { tx, stamps, today } = school;
  const startYear = monthOf(today) >= school.yearStartMonth ? yearOf(today) : yearOf(today) - 1;
  const current = yearRef(school, startYear);
  const previous = yearRef(school, startYear - 1);

  await insertAll(tx, academicYears, [
    {
      id: previous.id,
      ...stamps,
      name: previous.name,
      startDate: previous.start,
      endDate: previous.end,
      status: 'closed',
      closedAt: noonOn(addDays(previous.end, 6)),
    },
    {
      id: current.id,
      ...stamps,
      name: current.name,
      startDate: current.start,
      endDate: current.end,
      status: 'active',
    },
  ]);

  // Three terms a year: the long first term holds the summer vacation.
  const termRows = [previous, current].flatMap((year) => {
    const secondStart = addDays(addMonths(year.start, 4), 14);
    const thirdStart = addMonths(year.start, 9);
    return [
      {
        key: 'first',
        name: 'First Term',
        nameUr: 'پہلی میعاد',
        start: year.start,
        end: addDays(secondStart, -1),
        weight: 30,
      },
      {
        key: 'second',
        name: 'Second Term',
        nameUr: 'دوسری میعاد',
        start: secondStart,
        end: addDays(thirdStart, -1),
        weight: 30,
      },
      {
        key: 'third',
        name: 'Third Term',
        nameUr: 'تیسری میعاد',
        start: thirdStart,
        end: year.end,
        weight: 40,
      },
    ].map((term, index) => ({
      id: school.id(`term:${year.startYear}:${term.key}`),
      ...stamps,
      academicYearId: year.id,
      name: term.name,
      nameUr: term.nameUr,
      sequence: index + 1,
      startDate: term.start,
      endDate: term.end,
      weightPercent: term.weight,
    }));
  });
  await insertAll(tx, terms, termRows);

  // Holidays of the current year. A date that follows the moon is tentative until it has passed.
  const holidayRows: (typeof holidays.$inferInsert)[] = [];
  const add = (
    key: string,
    row: Omit<typeof holidays.$inferInsert, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>,
  ) =>
    holidayRows.push({ id: school.id(`holiday:${current.startYear}:${key}`), ...stamps, ...row });

  for (const holiday of nationalHolidays) {
    for (const year of [current.startYear, current.startYear + 1]) {
      const date = ymd(year, holiday.month, holiday.day);
      if (!within(date, current)) continue;
      add(`${holiday.name}`, {
        name: holiday.name,
        nameUr: holiday.nameUr,
        startDate: date,
        endDate: date,
        kind: 'public',
      });
    }
  }
  const hijriYear = Math.floor(((current.startYear - 622) * 33) / 32);
  for (const holiday of islamicHolidays) {
    for (const year of [hijriYear - 1, hijriYear, hijriYear + 1, hijriYear + 2]) {
      const start = gregorianOf(hijriDay(year, holiday.month, holiday.day));
      if (!within(start, current)) continue;
      add(`${holiday.name}:${year}`, {
        name: holiday.name,
        nameUr: holiday.nameUr,
        startDate: start,
        endDate: addDays(start, holiday.days - 1),
        kind: 'religious',
        isTentative: start > today,
      });
    }
  }
  for (const year of [current.startYear, current.startYear + 1]) {
    const summer = { start: ymd(year, 6, 1), end: ymd(year, 8, 14) };
    if (within(summer.start, current)) {
      add(`summer:${year}`, {
        name: 'Summer vacation',
        nameUr: 'موسم گرما کی تعطیلات',
        startDate: summer.start,
        endDate: summer.end > current.end ? current.end : summer.end,
        kind: 'vacation',
        appliesTo: 'students_only',
      });
    }
    const winter = { start: ymd(year, 12, 22), end: ymd(year, 12, 31) };
    if (within(winter.start, current)) {
      add(`winter:${year}`, {
        name: 'Winter break',
        nameUr: 'موسم سرما کی تعطیلات',
        startDate: winter.start,
        endDate: winter.end,
        kind: 'vacation',
      });
    }
  }
  // One day the school had to close at short notice, and one that concerns a single campus.
  const closure = workingDayOnOrBefore(addDays(today, -12));
  if (within(closure, current))
    add('smog', {
      name: 'Closed by order of the district (smog)',
      nameUr: 'ضلعی انتظامیہ کے حکم پر بند (اسموگ)',
      startDate: closure,
      endDate: closure,
      kind: 'emergency',
    });
  const second = Object.keys(school.branchIds)[1];
  const local = workingDayOnOrBefore(addDays(today, 20));
  if (second && within(local, current))
    add('local', {
      branchId: school.branchIds[second] as string,
      name: 'Campus used as a polling station',
      nameUr: 'کیمپس پولنگ اسٹیشن کے طور پر استعمال',
      startDate: local,
      endDate: local,
      kind: 'local',
    });
  await insertAll(tx, holidays, holidayRows);

  const closed = holidayRows.map((row) => ({
    start: row.startDate,
    end: row.endDate,
    branchId: row.branchId ?? null,
  }));
  const isSchoolDay = (date: string, branch?: string): boolean => {
    if (weekdayOf(date) > 5 || !within(date, current)) return false;
    const branchId = branch ? school.branchIds[branch] : undefined;
    return !closed.some(
      (holiday) =>
        date >= holiday.start &&
        date <= holiday.end &&
        (holiday.branchId === null || holiday.branchId === branchId),
    );
  };
  const schoolDays = (from: string, to: string, branch?: string): string[] => {
    const days: string[] = [];
    for (let day = from; day <= to; day = addDays(day, 1)) {
      if (isSchoolDay(day, branch)) days.push(day);
    }
    return days;
  };

  const shiftIds: Record<string, string> = {};
  await insertAll(
    tx,
    shifts,
    Object.entries(school.branchIds).map(([code, branchId]) => {
      shiftIds[code] = school.id(`shift:${code}:morning`);
      return {
        id: shiftIds[code] as string,
        ...stamps,
        branchId,
        name: 'Morning',
        startTime: '07:45',
        endTime: '13:45',
        isDefault: true,
      };
    }),
  );

  // Grading schemes. Grade points are left empty: each board announces its own, and none is invented here.
  const schemes = {
    national: school.id('scheme:national-2026'),
    primary: school.id('scheme:primary'),
    old: school.id('scheme:pre-2026'),
  };
  await insertAll(tx, gradingSchemes, [
    {
      id: schemes.old,
      ...stamps,
      name: 'Pre-2026 (7-point, pass 33%)',
      description:
        'The seven-grade scale boards used before 2026. Kept so that past results print as issued.',
      passPercent: 33,
      appliesFrom: '2000-01-01',
      percentRounding: 'whole_half_up',
      status: 'archived',
    },
    {
      id: schemes.national,
      ...stamps,
      name: 'National 2026 (10-point, pass 40%)',
      description: 'The ten-point scale every board uses from the annual examination of 2026.',
      passPercent: 40,
      appliesFrom: ymd(Math.min(current.startYear, 2026), 1, 1),
      status: 'active',
      supersedesId: schemes.old,
    },
    {
      id: schemes.primary,
      ...stamps,
      name: 'Primary (5-band, pass 40%)',
      description: 'The school’s own scale for Grades 1 to 8.',
      passPercent: 40,
      appliesFrom: previous.start,
      status: 'active',
    },
  ]);

  const bands = (
    schemeId: string,
    key: string,
    list: readonly (readonly [grade: string, min: number, description: string])[],
    passPercent: number,
  ) =>
    list.map(([grade, min, description], index) => ({
      id: school.id(`band:${key}:${grade}`),
      ...stamps,
      schemeId,
      grade,
      minPercent: min,
      // A band runs up to where the next one begins; the top band ends at 100.
      maxPercent: index === 0 ? 100 : (list[index - 1]?.[1] as number),
      description,
      isPass: min >= passPercent,
      sortOrder: index + 1,
    }));
  await insertAll(tx, gradeBands, [
    ...bands(
      schemes.national,
      'national',
      [
        ['A++', 96, 'Extraordinary'],
        ['A+', 91, 'Exceptional'],
        ['A', 86, 'Outstanding'],
        ['B++', 81, 'Excellent'],
        ['B+', 76, 'Very good'],
        ['B', 71, 'Good'],
        ['C+', 61, 'Fairly good'],
        ['C', 51, 'Above average'],
        ['D', 40, 'Emerging'],
        ['U', 0, 'Unsatisfactory'],
      ],
      40,
    ),
    ...bands(
      schemes.old,
      'old',
      [
        ['A-1', 80, 'Outstanding'],
        ['A', 70, 'Excellent'],
        ['B', 60, 'Very good'],
        ['C', 50, 'Good'],
        ['D', 40, 'Fair'],
        ['E', 33, 'Satisfactory'],
        ['F', 0, 'Fail'],
      ],
      33,
    ),
    ...bands(
      schemes.primary,
      'primary',
      [
        ['A', 80, 'Excellent'],
        ['B', 65, 'Very good'],
        ['C', 50, 'Good'],
        ['D', 40, 'Satisfactory'],
        ['E', 0, 'Needs improvement'],
      ],
      40,
    ),
  ]);

  const currentTerms = termRows
    .filter((term) => term.academicYearId === current.id)
    .map((term) => ({ id: term.id, name: term.name, start: term.startDate, end: term.endDate }));
  return {
    previous,
    current,
    shiftIds,
    schemes,
    terms: currentTerms,
    isSchoolDay,
    schoolDays,
    ...(within(closure, current) && { closure }),
  };
}

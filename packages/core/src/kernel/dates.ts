import { daysInMonth, isCalendarDate } from '@takhti/contracts';

/*
 * Calendar dates are `YYYY-MM-DD` strings from the database to the screen, and every function here
 * works on those strings. Nothing in this file depends on the server's time zone.
 * "Today" is always the date in Pakistan (UTC+5, no daylight saving).
 *
 * This file and `context.ts` are the only places allowed to touch the JavaScript `Date` type.
 */

/** A calendar date, `YYYY-MM-DD`. */
export type DateStr = string;
/** A month, `YYYY-MM`. */
export type PeriodStr = string;

const MS_PER_DAY = 86_400_000;
const PAKISTAN_OFFSET_MS = 5 * 60 * 60 * 1000;

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

interface Parts {
  year: number;
  month: number;
  day: number;
}

function parts(date: DateStr): Parts {
  if (!isCalendarDate(date)) throw new Error(`Not a calendar date: "${date}"`);
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

const fromParts = ({ year, month, day }: Parts): DateStr =>
  `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

/** Days since 1970-01-01, for arithmetic. */
const toDayNumber = (date: DateStr): number => {
  const { year, month, day } = parts(date);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
};

const fromDayNumber = (dayNumber: number): DateStr =>
  new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);

/** A moment given as milliseconds since 1970, as ISO text. */
export const isoFromMs = (ms: number): string => new Date(ms).toISOString();

/** The current moment as ISO text. The one place the clock is read; `ctx.now` carries it from there. */
export const nowIso = (): string => new Date().toISOString();

/** The calendar date in Pakistan at the given moment. At 20:30 UTC it is already tomorrow in Pakistan. */
export function todayPk(now: string): DateStr {
  const ms = Date.parse(now);
  if (Number.isNaN(ms)) throw new Error(`Not a timestamp: "${now}"`);
  return new Date(ms + PAKISTAN_OFFSET_MS).toISOString().slice(0, 10);
}

/** The time of day in Pakistan at the given moment, `HH:MM`. */
export function timePk(now: string): string {
  const ms = Date.parse(now);
  if (Number.isNaN(ms)) throw new Error(`Not a timestamp: "${now}"`);
  return new Date(ms + PAKISTAN_OFFSET_MS).toISOString().slice(11, 16);
}

/** The moment a Pakistan calendar date and time of day refer to, as ISO text in UTC. */
export function pkToIso(date: DateStr, time = '00:00'): string {
  const { year, month, day } = parts(date);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hours ?? 0, minutes ?? 0) - PAKISTAN_OFFSET_MS,
  ).toISOString();
}

/** A timestamp moved by a number of seconds. */
export const addSeconds = (iso: string, seconds: number): string =>
  new Date(Date.parse(iso) + seconds * 1000).toISOString();

/**
 * Whether one moment is later than another. Moments read from the database are written differently
 * from `ctx.now` (`2026-10-12 06:00:00+00` against `2026-10-12T06:00:00.000Z`), so they are never
 * compared as text.
 */
export const isLaterMoment = (moment: string, than: string): boolean =>
  Date.parse(moment) > Date.parse(than);

export const addDays = (date: DateStr, days: number): DateStr =>
  fromDayNumber(toDayNumber(date) + days);

/** Adds months, keeping the day where it exists: 31 January plus one month is 28 or 29 February. */
export function addMonths(date: DateStr, months: number): DateStr {
  const { year, month, day } = parts(date);
  const index = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return fromParts({
    year: nextYear,
    month: nextMonth,
    day: Math.min(day, daysInMonth(nextYear, nextMonth)),
  });
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export const diffDays = (from: DateStr, to: DateStr): number => toDayNumber(to) - toDayNumber(from);

export const compareDates = (a: DateStr, b: DateStr): number => (a < b ? -1 : a > b ? 1 : 0);
export const isBefore = (a: DateStr, b: DateStr): boolean => a < b;
export const isAfter = (a: DateStr, b: DateStr): boolean => a > b;
export const isBetween = (date: DateStr, from: DateStr, to: DateStr): boolean =>
  date >= from && date <= to;
export const earliest = (a: DateStr, b: DateStr): DateStr => (a <= b ? a : b);
export const latest = (a: DateStr, b: DateStr): DateStr => (a >= b ? a : b);

export const periodOf = (date: DateStr): PeriodStr => {
  parts(date);
  return date.slice(0, 7);
};

export const startOfMonth = (date: DateStr): DateStr => `${periodOf(date)}-01`;

export function endOfMonth(date: DateStr): DateStr {
  const { year, month } = parts(date);
  return fromParts({ year, month, day: daysInMonth(year, month) });
}

/** The first day of a period: `2026-10` gives `2026-10-01`. */
export const periodStart = (period: PeriodStr): DateStr => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error(`Not a period: "${period}"`);
  return `${period}-01`;
};

export const periodEnd = (period: PeriodStr): DateStr => endOfMonth(periodStart(period));

export const addPeriods = (period: PeriodStr, months: number): PeriodStr =>
  periodOf(addMonths(periodStart(period), months));

/** Monday is 1, Sunday is 7. */
export function weekdayOf(date: DateStr): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  // 1970-01-01 was a Thursday (4).
  const weekday = (((toDayNumber(date) + 3) % 7) + 7) % 7;
  return (weekday + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/**
 * True when the date is a working day: its weekday is in `workingDays` and it is not a holiday.
 * `holidays` is any collection of dates; pass a Set for speed over long ranges.
 */
export function isWorkingDay(
  date: DateStr,
  workingDays: readonly number[],
  holidays: Iterable<DateStr> = [],
): boolean {
  if (!workingDays.includes(weekdayOf(date))) return false;
  const set = holidays instanceof Set ? (holidays as Set<DateStr>) : new Set(holidays);
  return !set.has(date);
}

/** Every date from `from` to `to`, both included. Empty when `to` is earlier. */
export function eachDay(from: DateStr, to: DateStr): DateStr[] {
  const start = toDayNumber(from);
  const end = toDayNumber(to);
  const days: DateStr[] = [];
  for (let day = start; day <= end; day++) days.push(fromDayNumber(day));
  return days;
}

/** Working days from `from` to `to`, both included. */
export function workingDaysBetween(
  from: DateStr,
  to: DateStr,
  workingDays: readonly number[],
  holidays: Iterable<DateStr> = [],
): number {
  const set = holidays instanceof Set ? (holidays as Set<DateStr>) : new Set(holidays);
  return eachDay(from, to).filter((date) => isWorkingDay(date, workingDays, set)).length;
}

/** The next working day on or after the given date. */
export function nextWorkingDay(
  date: DateStr,
  workingDays: readonly number[],
  holidays: Iterable<DateStr> = [],
): DateStr {
  if (workingDays.length === 0) throw new Error('A working week needs at least one working day');
  const set = holidays instanceof Set ? (holidays as Set<DateStr>) : new Set(holidays);
  let current = date;
  for (let guard = 0; guard < 400; guard++) {
    if (isWorkingDay(current, workingDays, set)) return current;
    current = addDays(current, 1);
  }
  throw new Error(`No working day found within a year of ${date}`);
}

/** Completed years between a date of birth and a date. */
export function ageOn(dateOfBirth: DateStr, date: DateStr): number {
  const born = parts(dateOfBirth);
  const on = parts(date);
  const hadBirthday = on.month > born.month || (on.month === born.month && on.day >= born.day);
  return on.year - born.year - (hadBirthday ? 0 : 1);
}

/**
 * The year a date falls in, for a year that starts in a given month.
 * With a July start, 2026-08-15 is in the year starting 2026 and 2026-03-01 in the year starting 2025.
 */
export function yearStarting(date: DateStr, startMonth: number): number {
  const { year, month } = parts(date);
  return month >= startMonth ? year : year - 1;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** A date as a person reads it in a message: `31 July 2027`. Screens format dates themselves, in the user's language. */
export function formatDay(date: DateStr): string {
  const { year, month, day } = parts(date);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** Pieces used by human-facing number formats: `26`, `2026`, `2610`. */
export function numberParts(date: DateStr): { yy: string; yyyy: string; yymm: string; mm: string } {
  const { year, month } = parts(date);
  const yyyy = pad(year, 4);
  return { yy: yyyy.slice(2), yyyy, yymm: `${yyyy.slice(2)}${pad(month)}`, mm: pad(month) };
}

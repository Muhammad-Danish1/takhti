import { createHash } from 'node:crypto';
import { sql, type InferInsertModel } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Tx } from '../client';

/*
 * What every part of the seed shares: fixed ids, repeatable "random" numbers, date arithmetic
 * relative to the seed's "today", and the school being filled.
 *
 * The seed is deterministic: the same "today" gives the same ids, names and numbers on every
 * machine, so a test or a bug report can name a seeded record.
 */

/** The same label gives the same id on every machine. */
export function seedId(label: string): string {
  const hex = createHash('sha256').update(`takhti-seed:${label}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export interface Random {
  /** A number from 0 up to, not including, 1. */
  next(): number;
  /** A whole number from `min` to `max`, both included. */
  int(min: number, max: number): number;
  pick<T>(list: readonly T[]): T;
  /** True with the given probability. */
  chance(probability: number): boolean;
}

/** A repeatable stream of numbers for one purpose: the same label always gives the same sequence. */
export function random(label: string): Random {
  let state =
    parseInt(createHash('sha256').update(`takhti-seed:${label}`).digest('hex').slice(0, 8), 16) >>>
    0;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)] as (typeof list)[number],
    chance: (probability) => next() < probability,
  };
}

// ---------------------------------------------------------------- calendar dates as text

const toDate = (date: string) => new Date(`${date}T00:00:00Z`);
const toText = (date: Date) => date.toISOString().slice(0, 10);

export const addDays = (date: string, days: number): string => {
  const moved = toDate(date);
  moved.setUTCDate(moved.getUTCDate() + days);
  return toText(moved);
};

/** The same day of a month `months` later; the last day of that month when it is shorter. */
export const addMonths = (date: string, months: number): string => {
  const from = toDate(date);
  const target = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(from.getUTCDate(), lastDay));
  return toText(target);
};

export const addYears = (date: string, years: number): string => addMonths(date, years * 12);

/** Monday is 1, Sunday is 7. */
export const weekdayOf = (date: string): number => toDate(date).getUTCDay() || 7;

export const yearOf = (date: string): number => Number(date.slice(0, 4));
export const monthOf = (date: string): number => Number(date.slice(5, 7));
export const ymd = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** The most recent Monday to Friday on or before the date. */
export const workingDayOnOrBefore = (date: string): string => {
  let day = date;
  while (weekdayOf(day) > 5) day = addDays(day, -1);
  return day;
};

/** Noon in Pakistan on a date, as a timestamp. */
export const noonOn = (date: string): string => `${date}T07:00:00.000Z`;

// ---------------------------------------------------------------- the run and the school

export type SeedSize = 'small' | 'standard' | 'large';

export interface SeedRun {
  tx: Tx;
  /** The day the seed is placed around, `YYYY-MM-DD`, in Pakistan. */
  today: string;
  /** Written to `created_at` and `updated_at`. */
  now: string;
  size: SeedSize;
  /** Print how long each part of the seed took (`pnpm db:seed --timing`). */
  timing?: boolean;
}

export interface School extends SeedRun {
  key: 'roshan' | 'alnoor';
  orgId: string;
  /** Branch code → id. */
  branchIds: Record<string, string>;
  /** Role key → id of this organisation's copy of the role. */
  roleIds: Record<string, string>;
  /** The month the academic year starts, 1 to 12. */
  yearStartMonth: number;
  /** A fixed id for a record of this school: `school.id('staff:principal')`. */
  id(label: string): string;
  /** The columns every tenant row is given by the seed. */
  stamps: { orgId: string; createdAt: string; updatedAt: string };
}

export function schoolOf(
  run: SeedRun,
  key: School['key'],
  org: { orgId: string; branchIds: Record<string, string>; roleIds: Record<string, string> },
  yearStartMonth: number,
): School {
  return {
    ...run,
    key,
    orgId: org.orgId,
    branchIds: org.branchIds,
    roleIds: org.roleIds,
    yearStartMonth,
    id: (label) => seedId(`${key}:${label}`),
    stamps: { orgId: org.orgId, createdAt: run.now, updatedAt: run.now },
  };
}

/** Runs one part of the seed, and says how long it took when the run asked for timings. */
export async function timed<T>(run: SeedRun, label: string, work: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  const result = await work();
  if (run.timing) console.log(`       ${label}: ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
  return result;
}

/** The branch id for a code, or an error that says which code is unknown. */
export const branchOf = (school: School, code: string): string => {
  const id = school.branchIds[code];
  if (!id) throw new Error(`${school.key} has no branch "${code}"`);
  return id;
};

// ---------------------------------------------------------------- writing rows

/** Inserts many rows, a batch at a time, so no single statement grows past what Postgres accepts. */
export async function insertAll<T extends PgTable>(
  tx: Tx,
  table: T,
  rows: readonly InferInsertModel<T>[],
  chunk?: number,
): Promise<void> {
  const first = rows[0];
  if (first === undefined) return;
  // Postgres takes at most 65,535 values in one statement; a row of thirty columns leaves room for some six hundred rows.
  const size = chunk ?? Math.max(50, Math.floor(20_000 / Math.max(1, Object.keys(first).length)));
  for (let start = 0; start < rows.length; start += size) {
    // The rows are checked against the table by the parameter's type; Drizzle's own overloads cannot follow a generic table.
    await tx.insert(table).values(rows.slice(start, start + size) as never);
  }
}

/**
 * Leaves a numbering counter where the seed stopped, so the first number the application issues
 * follows the last one the seed wrote. `next` is the value the next record will get.
 */
export async function setCounter(
  school: School,
  key: string,
  next: number,
  options: { branchId?: string; period?: string } = {},
): Promise<void> {
  await school.tx.execute(sql`
    insert into number_sequences (id, org_id, key, branch_id, period, next_value, created_at, updated_at)
    values (${seedId(`${school.key}:counter:${key}:${options.branchId ?? ''}:${options.period ?? ''}`)}::uuid,
            ${school.orgId}::uuid, ${key}, ${options.branchId ?? null}::uuid, ${options.period ?? ''},
            ${next}, ${school.now}::timestamptz, ${school.now}::timestamptz)
    on conflict (org_id, key, branch_id, period) do update set next_value = excluded.next_value
  `);
}

/** A moment on a date at a clock time in Pakistan (`'07:45'`), as a timestamp. */
export const at = (date: string, time: string): string =>
  new Date(Date.parse(`${date}T${time}:00+05:00`)).toISOString();

/** The last `count` working days up to and including the date, oldest first. */
export function workingDaysUpTo(date: string, count: number): string[] {
  const days: string[] = [];
  for (let day = workingDayOnOrBefore(date); days.length < count; day = addDays(day, -1)) {
    if (weekdayOf(day) <= 5) days.unshift(day);
  }
  return days;
}

/** A value that stands in for a secret or a hash in seeded rows: stable, and obviously not real. */
export const fakeHash = (label: string): string =>
  createHash('sha256').update(`takhti-seed:${label}`).digest('hex');

/** The item at a position, counting round to the start when the list is shorter: the small seed has fewer of everything. */
export function nth<T>(list: readonly T[], position: number): T {
  if (list.length === 0) throw new Error('The seed needs at least one item to choose from');
  return list[position % list.length] as T;
}

/** The next Monday to Friday on or after the date. */
export const workingDayOnOrAfter = (date: string): string => {
  let day = date;
  while (weekdayOf(day) > 5) day = addDays(day, 1);
  return day;
};

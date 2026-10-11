import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  addPeriods,
  ageOn,
  diffDays,
  eachDay,
  endOfMonth,
  isWorkingDay,
  nextWorkingDay,
  numberParts,
  periodEnd,
  periodOf,
  periodStart,
  pkToIso,
  startOfMonth,
  timePk,
  todayPk,
  weekdayOf,
  workingDaysBetween,
  yearStarting,
} from './dates';

describe('dates', () => {
  it('today in Pakistan is five hours ahead of UTC: the hour before midnight UTC is already tomorrow', () => {
    expect(todayPk('2026-10-12T18:59:59.000Z')).toBe('2026-10-12');
    expect(todayPk('2026-10-12T19:00:00.000Z')).toBe('2026-10-13');
    expect(todayPk('2026-12-31T19:30:00.000Z')).toBe('2027-01-01');
    expect(timePk('2026-10-12T19:00:00.000Z')).toBe('00:00');
    expect(pkToIso('2026-10-13', '00:00')).toBe('2026-10-12T19:00:00.000Z');
    expect(() => todayPk('not a time')).toThrow();
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(diffDays('2026-01-01', '2026-12-31')).toBe(364);
    expect(diffDays('2026-03-10', '2026-03-01')).toBe(-9);
  });

  it('adds months and keeps to the end of a shorter month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('knows leap years, including the century rule', () => {
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2100-02-01')).toBe('2100-02-28');
    expect(endOfMonth('2000-02-01')).toBe('2000-02-29');
  });

  it('works with periods', () => {
    expect(periodOf('2026-10-12')).toBe('2026-10');
    expect(startOfMonth('2026-10-12')).toBe('2026-10-01');
    expect(periodStart('2026-10')).toBe('2026-10-01');
    expect(periodEnd('2026-02')).toBe('2026-02-28');
    expect(addPeriods('2026-11', 3)).toBe('2027-02');
    expect(addPeriods('2026-01', -1)).toBe('2025-12');
  });

  it('numbers weekdays from Monday as 1 to Sunday as 7', () => {
    expect(weekdayOf('2026-10-12')).toBe(1);
    expect(weekdayOf('2026-10-16')).toBe(5);
    expect(weekdayOf('2026-10-18')).toBe(7);
  });

  it('counts working days for a Monday-to-Saturday week with a holiday', () => {
    const week = [1, 2, 3, 4, 5, 6];
    expect(isWorkingDay('2026-10-18', week)).toBe(false);
    expect(isWorkingDay('2026-10-17', week)).toBe(true);
    expect(isWorkingDay('2026-10-14', week, ['2026-10-14'])).toBe(false);
    expect(workingDaysBetween('2026-10-12', '2026-10-18', week)).toBe(6);
    expect(workingDaysBetween('2026-10-12', '2026-10-18', week, ['2026-10-14'])).toBe(5);
    expect(nextWorkingDay('2026-10-17', week)).toBe('2026-10-17'); // already a working day
    expect(nextWorkingDay('2026-10-18', week)).toBe('2026-10-19');
    expect(nextWorkingDay('2026-10-18', week, ['2026-10-19'])).toBe('2026-10-20');
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(eachDay('2026-11-02', '2026-10-30')).toEqual([]);
  });

  it('works out age on a date, including a leap-day birthday', () => {
    expect(ageOn('2015-03-14', '2026-03-13')).toBe(10);
    expect(ageOn('2015-03-14', '2026-03-14')).toBe(11);
    expect(ageOn('2016-02-29', '2027-02-28')).toBe(10);
    expect(ageOn('2016-02-29', '2027-03-01')).toBe(11);
  });

  it('finds the year a date belongs to when years start in April', () => {
    expect(yearStarting('2026-03-31', 4)).toBe(2025);
    expect(yearStarting('2026-04-01', 4)).toBe(2026);
    expect(yearStarting('2026-07-01', 7)).toBe(2026);
  });

  it('gives the parts used in document numbers', () => {
    expect(numberParts('2026-10-12')).toEqual({ yy: '26', yyyy: '2026', yymm: '2610', mm: '10' });
  });

  it('refuses a date that does not exist', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow();
    expect(() => weekdayOf('2026-13-01')).toThrow();
  });
});

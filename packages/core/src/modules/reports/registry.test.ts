import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  analysisProblems,
  combineKpi,
  defineReport,
  type MeasureDefinition,
} from './registry';

const measure = (
  key: `${string}.${string}`,
  permission: string,
  splitBy: string[],
  label: string,
): MeasureDefinition => ({
  key,
  module: 'fees',
  label: { en: label, ur: label },
  unit: 'money',
  splitBy,
  permission: permission as MeasureDefinition['permission'],
  run: () => [],
});
const vocabulary = new Map(
  [
    measure('fees.collected', 'fees:reports', ['branch', 'grade', 'month'], 'Fees collected'),
    measure('payroll.cost', 'payroll:reports', ['branch', 'department', 'month'], 'Payroll cost'),
  ].map((definition) => [definition.key as string, definition]),
);
const problems = (ask: { measures: string[]; splitBy: string[] }, held: string[]) =>
  analysisProblems(ask, new Set(held), (key) => vocabulary.get(key));

describe('R-reports-6 an analysis request is refused, not narrowed', () => {
  it('a request inside the vocabulary and the permissions of the person may run', () => {
    expect(
      problems({ measures: ['fees.collected'], splitBy: ['branch', 'month'] }, ['fees:reports']),
    ).toEqual([]);
  });

  it('F-reports-5 a measure the person lacks the permission for is refused by name', () => {
    expect(
      problems({ measures: ['fees.collected', 'payroll.cost'], splitBy: ['branch'] }, [
        'fees:reports',
      ]),
    ).toEqual(['You do not have access to Payroll cost']);
  });

  it('an unknown measure and a split a measure does not have are each named', () => {
    expect(
      problems({ measures: ['fees.collected', 'fees.imagined'], splitBy: ['department'] }, [
        'fees:reports',
      ]),
    ).toEqual(['Fees collected cannot be split by department', '"fees.imagined" is not a measure']);
  });

  it('one to three measures, split two ways at most', () => {
    expect(problems({ measures: [], splitBy: [] }, [])).toEqual(['Choose one to three measures']);
    expect(
      problems({ measures: ['fees.collected'], splitBy: ['branch', 'grade', 'month'] }, [
        'fees:reports',
      ]),
    ).toEqual(['A figure can be split two ways at most']);
  });
});

describe('R-reports-5 a figure across branches', () => {
  it('a count or an amount adds up', () => {
    expect(combineKpi('sum', [{ numerator: 420 }, { numerator: 310 }])).toBe(730);
  });

  it('T-reports-5 a rate is the summed numerators over the summed denominators, never an average of percentages', () => {
    // 90 of 100 present at one campus, 10 of 20 at another: 100 of 120 is 83.33%, not the 70% an average gives.
    expect(
      combineKpi('ratio', [
        { numerator: 90, denominator: 100 },
        { numerator: 10, denominator: 20 },
      ]),
    ).toBe(83.33);
  });

  it('with nothing to divide by, the rate is nothing rather than an error', () => {
    expect(combineKpi('ratio', [{ numerator: 0, denominator: 0 }])).toBe(0);
    expect(combineKpi('ratio', [])).toBe(0);
  });
});

describe('defining a report', () => {
  const base = {
    module: 'organisation',
    title: { en: 'Rooms', ur: 'Rooms' },
    permission: 'rooms:read',
    params: z.object({}),
    run: () => ({ rows: [] }),
  } as const;
  const column = (key: string) => ({
    key,
    label: { en: key, ur: key },
    type: 'text' as const,
  });

  it('a key that is not module.name is refused', () => {
    expect(() =>
      defineReport({ ...base, key: 'Rooms' as 'x.y', columns: [column('name')] }),
    ).toThrow(/module\.name/);
  });

  it('a column named twice, or pages grouped by a column the report does not have, is refused', () => {
    expect(() =>
      defineReport({ ...base, key: 'unit.twice', columns: [column('name'), column('name')] }),
    ).toThrow(/twice/);
    expect(() =>
      defineReport({
        ...base,
        key: 'unit.grouped',
        columns: [column('name')],
        pdf: { groupBy: 'grade' },
      }),
    ).toThrow(/does not have/);
  });
});

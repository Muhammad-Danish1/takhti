import { describe, expect, it } from 'vitest';
import {
  allocate,
  floorAtZero,
  formatRs,
  fraction,
  least,
  percentOf,
  roundToRupee,
  roundingDifference,
  rupees,
  sum,
  times,
  toRupees,
} from './money';

describe('money', () => {
  it('rupees and paisa convert without drift', () => {
    expect(rupees(100)).toBe(10_000);
    expect(rupees(8333.33)).toBe(833_333);
    expect(rupees(0.1) + rupees(0.2)).toBe(rupees(0.3));
    expect(toRupees(833_333)).toBe(8333.33);
  });

  it('refuses amounts that are not whole paisa', () => {
    expect(() => sum([100.5])).toThrow();
    expect(() => percentOf(1.5, 10)).toThrow();
  });

  it('formats in rupees with South Asian grouping left to the screen', () => {
    expect(formatRs(1_250_000)).toBe('Rs 12,500');
    expect(formatRs(1_250_050)).toBe('Rs 12,500.50');
    expect(formatRs(-50_000)).toBe('-Rs 500');
    expect(formatRs(0)).toBe('Rs 0');
  });

  it('rounds half up to the rupee', () => {
    expect(roundToRupee(149)).toBe(100);
    expect(roundToRupee(150)).toBe(200);
    expect(roundToRupee(151)).toBe(200);
    expect(roundingDifference(150)).toBe(50);
    expect(roundingDifference(149)).toBe(-49);
  });

  it('takes a percentage with half-up rounding: 7.5% of Rs 8,333', () => {
    expect(percentOf(rupees(8333), 7.5)).toBe(62_498); // 62,497.5 paisa rounds up
    expect(percentOf(rupees(1000), 10)).toBe(rupees(100));
    expect(percentOf(rupees(1000), 0)).toBe(0);
    expect(percentOf(rupees(1000), 100)).toBe(rupees(1000));
    expect(percentOf(1, 50)).toBe(1); // half a paisa rounds up
  });

  it('multiplies and takes fractions exactly', () => {
    expect(times(rupees(2500), 3)).toBe(rupees(7500));
    expect(fraction(rupees(30_000), 11, 30)).toBe(rupees(11_000));
    expect(fraction(rupees(100), 1, 3)).toBe(3333);
    expect(() => fraction(100, 1, 0)).toThrow();
  });

  it('splits Rs 100 across three siblings so the parts always add up', () => {
    const parts = allocate(rupees(100), [1, 1, 1]);
    expect(parts).toEqual([3334, 3333, 3333]);
    expect(sum(parts)).toBe(rupees(100));
  });

  it('splits by unequal weights, and gives nothing to a weight of zero', () => {
    const parts = allocate(rupees(1000), [3, 0, 1]);
    expect(parts).toEqual([75_000, 0, 25_000]);
    expect(sum(allocate(99_999, [5, 3, 2, 7, 11]))).toBe(99_999);
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
  });

  it('refuses a split with nothing to split across', () => {
    expect(() => allocate(100, [])).toThrow();
    expect(allocate(0, [])).toEqual([]);
    expect(() => allocate(100, [0, 0])).toThrow();
    expect(() => allocate(100, [1, -1])).toThrow();
  });

  it('small helpers', () => {
    expect(sum([])).toBe(0);
    expect(sum([1, 2, 3])).toBe(6);
    expect(least(5, 3)).toBe(3);
    expect(floorAtZero(-5)).toBe(0);
    expect(floorAtZero(5)).toBe(5);
  });
});

import { describe, expect, it } from 'vitest';
import {
  averageAfterReceipt,
  fromThousandths,
  quantityText,
  signedChange,
  toThousandths,
  valueOf,
} from './stock.rules';

describe('quantities', () => {
  it('are worked on as whole thousandths, so 0.1 and 0.2 make 0.3 exactly', () => {
    expect(toThousandths(0.1) + toThousandths(0.2)).toBe(300);
    expect(fromThousandths(300)).toBe(0.3);
    expect(toThousandths(2.5)).toBe(2500);
    expect(quantityText(2500)).toBe('2.5');
    expect(quantityText(10000)).toBe('10');
  });

  it('more than three decimal places is refused', () => {
    expect(() => toThousandths(1.2345)).toThrow(/three decimal places/);
    expect(() => toThousandths(Number.NaN)).toThrow();
  });
});

describe('R-inventory-1 which way a movement goes', () => {
  it.each([
    ['opening', 5, 5000],
    ['receipt', 5, 5000],
    ['transfer_in', 5, 5000],
    ['sale_return', 5, 5000],
    ['issue', 5, -5000],
    ['transfer_out', 5, -5000],
    ['sale', 5, -5000],
    ['write_off', 5, -5000],
    ['return_to_vendor', 5, -5000],
    ['count_adjustment', 5, 5000],
    ['count_adjustment', -5, -5000],
  ] as const)('%s of %d changes the store by %d thousandths', (kind, quantity, change) => {
    expect(signedChange(kind, quantity)).toBe(change);
  });

  it('a plain amount is expected: a negative issue, or a movement of nothing, is a mistake', () => {
    expect(() => signedChange('issue', -5)).toThrow(/plain amount/);
    expect(() => signedChange('receipt', 0)).toThrow(/needs a quantity/);
  });
});

describe('the worth of a quantity', () => {
  it.each([
    [10_000, 50_000, 500_000],
    [-4_000, 57_500, -230_000],
    // 2.5 kg at Rs 333.33 is Rs 833.325, which is Rs 833.33.
    [2_500, 33_333, 83_333],
    [1, 999, 1],
    [0, 50_000, 0],
  ])('%d thousandths at %d paisa is %d paisa', (thousandths, unitCost, expected) => {
    expect(valueOf(thousandths, unitCost)).toBe(expected);
  });
});

describe('T-inventory-2 the weighted average', () => {
  it('R-inventory-3 what is held and what comes in, each at its own cost, over the new quantity', () => {
    // 10 at Rs 500 and 30 at Rs 600 make 40 at Rs 575.
    expect(
      averageAfterReceipt({
        heldThousandths: 10_000,
        average: 50_000,
        receivedThousandths: 30_000,
        cost: 60_000,
      }),
    ).toBe(57_500);
  });

  it('F-inventory-5 with nothing held, the cost of what came in becomes the average', () => {
    expect(
      averageAfterReceipt({ heldThousandths: 0, average: 57_500, receivedThousandths: 5_000, cost: 70_000 }),
    ).toBe(70_000);
  });

  it('stock that comes in at the average leaves it where it was', () => {
    expect(
      averageAfterReceipt({
        heldThousandths: 7_000,
        average: 57_500,
        receivedThousandths: 3_000,
        cost: 57_500,
      }),
    ).toBe(57_500);
  });

  it('an average that does not divide evenly is rounded to the paisa', () => {
    // 1 at Rs 1.00 and 2 at Rs 2.00 make 3 worth Rs 5.00: Rs 1.67 each.
    expect(
      averageAfterReceipt({ heldThousandths: 1_000, average: 100, receivedThousandths: 2_000, cost: 200 }),
    ).toBe(167);
  });
});

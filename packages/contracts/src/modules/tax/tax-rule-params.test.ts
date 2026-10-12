import { describe, expect, it } from 'vitest';
import {
  parseTaxRuleParams,
  SalaryTaxParams,
  SocialSecurityParams,
  VendorWithholdingParams,
} from './tax-rule-params';

/*
 * EVERY FIGURE IN THIS FILE IS INVENTED FOR TESTING. None is a real rate, slab or threshold.
 */

const slab = (lower: number, upTo: number | null, fixed = 0, percentOverLower = 0) => ({
  lower,
  upTo,
  fixed,
  percentOverLower,
});
const messagesOf = (params: unknown) => {
  const result = SalaryTaxParams.safeParse(params);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('the figures of a salary tax rule', () => {
  it('slabs that run from zero upwards with no gap are accepted', () => {
    expect(
      messagesOf({ slabs: [slab(0, 600_000), slab(600_000, 1_200_000, 0, 10), slab(1_200_000, null, 60_000, 20)] }),
    ).toEqual([]);
  });

  it('F-tax-7 a gap between two slabs is refused, and the message shows the gap', () => {
    expect(
      messagesOf({ slabs: [slab(0, 600_000), slab(700_000, null, 0, 10)] }),
    ).toEqual(['There is a gap between Rs 600,000 and Rs 700,000: no slab covers it']);
  });

  it('a slab that starts inside the one before it is refused', () => {
    expect(messagesOf({ slabs: [slab(0, 600_000), slab(500_000, null)] })).toEqual([
      'This slab starts at Rs 500,000, inside the one before it, which runs to Rs 600,000',
    ]);
  });

  it.each([
    ['the first slab does not start at zero', [slab(100, null)], 'The first slab starts at Rs 0'],
    [
      'the last slab has an upper limit',
      [slab(0, 600_000)],
      'The last slab has no upper limit: leave it empty',
    ],
    [
      'a slab before the last has none',
      [slab(0, null), slab(0, null)],
      'Only the last slab may be without an upper limit',
    ],
    [
      'a slab ends at or below where it starts',
      [slab(0, 0), slab(0, null)],
      'The upper limit must be above the lower one',
    ],
  ])('refused when %s', (_name, slabs, message) => {
    expect(messagesOf({ slabs })).toContain(message);
  });

  it('a percentage is from 0 to 100, to at most four decimal places; an amount is whole rupees', () => {
    expect(messagesOf({ slabs: [slab(0, null, 0, 101)] }).length).toBe(1);
    expect(messagesOf({ slabs: [slab(0, null, 0, 12.34567)] })).toEqual([
      'Use at most four decimal places',
    ]);
    expect(messagesOf({ slabs: [slab(0, null, 0.5, 10)] }).length).toBe(1);
    expect(messagesOf({ slabs: [slab(0, null, 0, 12.3456)] })).toEqual([]);
  });
});

describe('the figures of the other rules', () => {
  it('a vendor withholding table cannot hold two rows for the same case', () => {
    const row = { vendorKind: 'company', supply: 'goods', filer: true, percent: 4 };
    const result = VendorWithholdingParams.safeParse({ rows: [row, { ...row, percent: 5 }] });
    expect(result.success).toBe(false);
  });

  it('a social security rule must say what happens above its ceiling', () => {
    expect(
      SocialSecurityParams.safeParse({ wageCeiling: 50_000, employerPercent: 6 }).success,
    ).toBe(false);
  });

  it('each kind of rule is read by its own shape', () => {
    expect(parseTaxRuleParams('minimum_wage', { monthly: 40_000 })).toEqual({ monthly: 40_000 });
    expect(() => parseTaxRuleParams('eobi', { monthly: 40_000 })).toThrow();
  });
});

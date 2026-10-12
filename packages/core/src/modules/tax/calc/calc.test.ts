import { describe, expect, it } from 'vitest';
import {
  EobiParams,
  FeeAdvanceTaxParams,
  ProvidentFundParams,
  SalaryTaxParams,
  SocialSecurityParams,
  VendorWithholdingParams,
  supplyKinds,
  vendorKinds,
} from '@takhti/contracts';
import { AppError } from '../../../kernel/errors';
import { rupees } from '../../../kernel/money';
import { eobi, providentFund, socialSecurity } from './contributions';
import { feeAdvanceTax } from './fee-advance-tax';
import { salaryTaxForMonth, slabTaxFor } from './salary-tax';
import { vendorWithholding } from './vendor-withholding';

/*
 * EVERY FIGURE IN THIS FILE IS INVENTED FOR TESTING. None is a real rate, slab, threshold or
 * ceiling, and none may be copied into a rule. Real figures are entered and confirmed by a
 * school's own tax adviser (docs/plan/10-modules/m25-tax-compliance.md, rule R-tax-1).
 */

const Rs = rupees;

const slabs = SalaryTaxParams.parse({
  slabs: [
    { lower: 0, upTo: 600_000, fixed: 0, percentOverLower: 0 },
    { lower: 600_000, upTo: 1_200_000, fixed: 0, percentOverLower: 10 },
    { lower: 1_200_000, upTo: 2_400_000, fixed: 60_000, percentOverLower: 20 },
    { lower: 2_400_000, upTo: null, fixed: 300_000, percentOverLower: 30 },
  ],
});
const slabsWithExtras = SalaryTaxParams.parse({
  slabs: slabs.slabs,
  surcharge: { above: 4_000_000, percent: 10 },
  teacherRebatePercent: 25,
});

describe('T-tax-1 salary tax', () => {
  it.each([
    [0, 0, 0],
    [600_000, 0, 0],
    [600_001, 0.1, 1],
    [1_200_000, 60_000, 1],
    [1_200_001, 60_000.2, 2],
    [2_400_000, 300_000, 2],
    [2_400_001, 300_000.3, 3],
    [5_000_000, 1_080_000, 3],
  ])('a year of Rs %d is taxed Rs %d, in slab %d', (income, tax, slabIndex) => {
    expect(slabTaxFor(slabs, Rs(income))).toEqual({ tax: Rs(tax), slabIndex });
  });

  /** A person's months one after another, each fed what the months before produced. */
  function year(pay: readonly number[], rule = slabs, options: { teacher?: boolean } = {}) {
    let taxableToDate = 0;
    let taxPaidToDate = 0;
    const deducted: number[] = [];
    pay.forEach((monthly, index) => {
      const { amount } = salaryTaxForMonth({
        rule,
        taxableToDate,
        taxPaidToDate,
        taxableThisMonth: Rs(monthly),
        monthsLeft: pay.length - 1 - index,
        ...options,
      });
      deducted.push(amount);
      taxableToDate += Rs(monthly);
      taxPaidToDate += amount;
    });
    return { deducted, total: taxPaidToDate, income: taxableToDate };
  }

  it('a full year on level pay: twelve equal months that add up to the year’s tax', () => {
    const { deducted, total } = year(Array.from({ length: 12 }, () => 150_000));
    expect(deducted).toEqual(Array.from({ length: 12 }, () => Rs(15_000)));
    expect(total).toBe(Rs(180_000));
  });

  it('a full year on pay that does not divide evenly: the months add up to the year’s tax to the rupee', () => {
    // 133,333 a month is 1,599,996 a year: 60,000 + 20% of 399,996 = 139,999.20, rounded to 139,999.
    const { deducted, total } = year(Array.from({ length: 12 }, () => 133_333));
    expect(total).toBe(Rs(139_999));
    for (const amount of deducted) {
      expect(amount % 100).toBe(0);
      expect(Math.abs(amount - Rs(11_667))).toBeLessThanOrEqual(Rs(1));
    }
  });

  it('a mid-year joiner with no earlier income pays on what they will earn here', () => {
    const first = salaryTaxForMonth({
      rule: slabs,
      taxableToDate: 0,
      taxPaidToDate: 0,
      taxableThisMonth: Rs(200_000),
      monthsLeft: 5,
    });
    expect(first.amount).toBe(Rs(10_000));
    expect(first.breakdown).toMatchObject({
      projectedAnnual: Rs(1_200_000),
      annualTax: Rs(60_000),
      months: 6,
    });
  });

  it('a mid-year joiner who declares earlier income and tax is taxed on the whole year, less what was paid', () => {
    const first = salaryTaxForMonth({
      rule: slabs,
      taxableToDate: Rs(900_000),
      taxPaidToDate: Rs(20_000),
      taxableThisMonth: Rs(200_000),
      monthsLeft: 5,
    });
    // 2,100,000 for the year: 60,000 + 20% of 900,000 = 240,000; 220,000 still owed over six months.
    expect(first.breakdown).toMatchObject({ annualTax: Rs(240_000), remaining: Rs(220_000) });
    expect(first.amount).toBe(Rs(36_667));
  });

  it('a mid-year raise corrects itself: the year ends on the tax of what was really earned', () => {
    const { deducted, total, income } = year([
      ...Array.from({ length: 6 }, () => 100_000),
      ...Array.from({ length: 6 }, () => 200_000),
    ]);
    expect(deducted.slice(0, 6)).toEqual(Array.from({ length: 6 }, () => Rs(5_000)));
    expect(deducted.slice(6)).toEqual(Array.from({ length: 6 }, () => Rs(25_000)));
    expect(total).toBe(slabTaxFor(slabs, income).tax);
  });

  it('a leaver’s last month settles the year on what was really earned; too much already taken is shown, never deducted below zero', () => {
    const last = salaryTaxForMonth({
      rule: slabs,
      taxableToDate: Rs(450_000),
      taxPaidToDate: Rs(45_000),
      taxableThisMonth: Rs(150_000),
      monthsLeft: 0,
    });
    expect(last.amount).toBe(0);
    expect(last.breakdown).toMatchObject({
      projectedAnnual: Rs(600_000),
      annualTax: 0,
      remaining: -Rs(45_000),
    });

    const owing = salaryTaxForMonth({
      rule: slabs,
      taxableToDate: Rs(1_000_000),
      taxPaidToDate: Rs(10_000),
      taxableThisMonth: Rs(200_000),
      monthsLeft: 0,
    });
    expect(owing.amount).toBe(Rs(50_000));
  });

  it('a teacher’s rebate comes off the slab tax, and the surcharge is taken of what remains', () => {
    const monthly = { taxableToDate: 0, taxPaidToDate: 0, taxableThisMonth: Rs(5_000_000), monthsLeft: 0 };
    const teacher = salaryTaxForMonth({ rule: slabsWithExtras, ...monthly, teacher: true });
    expect(teacher.breakdown).toMatchObject({
      slabTax: Rs(1_080_000),
      rebate: Rs(270_000),
      surcharge: Rs(81_000),
      annualTax: Rs(891_000),
    });
    const other = salaryTaxForMonth({ rule: slabsWithExtras, ...monthly });
    expect(other.breakdown).toMatchObject({ rebate: 0, surcharge: Rs(108_000) });
    expect(other.amount).toBe(Rs(1_188_000));
    // At the surcharge line itself there is none: it starts above it.
    const atLine = salaryTaxForMonth({
      rule: slabsWithExtras,
      ...monthly,
      taxableThisMonth: Rs(4_000_000),
    });
    expect(atLine.breakdown.surcharge).toBe(0);
  });

  it('months left must be a whole number from 0 to 11', () => {
    const input = { rule: slabs, taxableToDate: 0, taxPaidToDate: 0, taxableThisMonth: Rs(1) };
    expect(() => salaryTaxForMonth({ ...input, monthsLeft: 12 })).toThrow();
    expect(() => salaryTaxForMonth({ ...input, monthsLeft: -1 })).toThrow();
    expect(() => salaryTaxForMonth({ ...input, monthsLeft: 1.5 })).toThrow();
  });
});

describe('T-tax-2 advance tax on fees', () => {
  const rule = FeeAdvanceTaxParams.parse({
    enabled: true,
    annualThreshold: 200_000,
    percent: 5,
    appliesTo: 'non_filers',
    countHeads: 'flagged',
  });
  const voucher = (overrides: Partial<Parameters<typeof feeAdvanceTax>[0]> = {}) =>
    feeAdvanceTax({
      rule,
      annualFees: Rs(240_000),
      filer: 'non_filer',
      alreadyCollected: 0,
      thisVoucherBase: Rs(20_000),
      ...overrides,
    });

  it('below the threshold, and exactly on it, nothing is charged', () => {
    expect(voucher({ annualFees: Rs(180_000) })).toMatchObject({
      amount: 0,
      breakdown: { reason: 'below_threshold' },
    });
    expect(voucher({ annualFees: Rs(200_000) }).amount).toBe(0);
  });

  it('above the threshold the percentage of the voucher is charged, rounded to the rupee', () => {
    expect(voucher()).toMatchObject({ amount: Rs(1_000), breakdown: { reason: 'charged' } });
    expect(voucher({ thisVoucherBase: Rs(20_010) }).amount).toBe(Rs(1_001));
  });

  it('a family that crosses the threshold mid-year is charged from then on, not for the vouchers before', () => {
    expect(voucher({ annualFees: Rs(180_000), thisVoucherBase: Rs(15_000) }).amount).toBe(0);
    // A second child joins: the year's fees are now above the line.
    expect(
      voucher({ annualFees: Rs(260_000), thisVoucherBase: Rs(30_000), alreadyCollected: 0 }).amount,
    ).toBe(Rs(1_500));
  });

  it('a filer is not charged when the rule is for non-filers, and is when it is for all', () => {
    expect(voucher({ filer: 'filer' })).toMatchObject({
      amount: 0,
      breakdown: { reason: 'filer' },
    });
    expect(voucher({ filer: 'filer', rule: { ...rule, appliesTo: 'all' } }).amount).toBe(Rs(1_000));
  });

  it('F-tax-5 an unknown status is read as non-filer, and the result says so', () => {
    expect(voucher({ filer: 'unknown' })).toMatchObject({
      amount: Rs(1_000),
      breakdown: { treatedAsNonFiler: true },
    });
    expect(voucher({ filer: 'non_filer' }).breakdown.treatedAsNonFiler).toBe(false);
  });

  it('never more in a year than the percentage of the year’s fees', () => {
    // 5% of 240,000 is 12,000 for the year.
    expect(voucher({ alreadyCollected: Rs(11_500) })).toMatchObject({
      amount: Rs(500),
      breakdown: { reason: 'capped', annualCap: Rs(12_000) },
    });
    expect(voucher({ alreadyCollected: Rs(12_000) }).amount).toBe(0);
    expect(voucher({ alreadyCollected: Rs(13_000) }).amount).toBe(0);
  });

  it('a rule that is switched off charges nothing', () => {
    expect(voucher({ rule: { ...rule, enabled: false } })).toMatchObject({
      amount: 0,
      breakdown: { reason: 'off' },
    });
  });
});

describe('T-tax-3 vendor withholding', () => {
  // A different percentage in every row, so a wrong row cannot pass by accident.
  const rows = vendorKinds.flatMap((vendorKind, v) =>
    supplyKinds.flatMap((supply, s) =>
      [true, false].map((filer, f) => ({
        vendorKind,
        supply,
        filer,
        percent: 1 + v * 4 + s * 2 + f,
      })),
    ),
  );
  const rule = VendorWithholdingParams.parse({ rows });

  it.each(rows)(
    '$vendorKind, $supply, filer $filer: $percent% of the payment',
    ({ vendorKind, supply, filer, percent }) => {
      const result = vendorWithholding({
        rule,
        vendorKind,
        supply,
        filer,
        gross: Rs(100_000),
        exempt: false,
      });
      expect(result.amount).toBe(Rs(1_000 * percent));
      expect(result.net).toBe(Rs(100_000) - result.amount);
      expect(result.breakdown).toMatchObject({ reason: 'withheld', percent });
    },
  );

  it('the amount is rounded to the rupee', () => {
    const result = vendorWithholding({
      rule,
      vendorKind: 'company',
      supply: 'goods',
      filer: true,
      gross: Rs(12_345.67),
      exempt: false,
    });
    expect(result.amount).toBe(Rs(123));
  });

  it('a vendor with a valid exemption has nothing withheld; without one it applies again', () => {
    const payment = { rule, vendorKind: 'individual', supply: 'services', filer: false, gross: Rs(50_000) } as const;
    expect(vendorWithholding({ ...payment, exempt: true })).toMatchObject({
      amount: 0,
      net: Rs(50_000),
      breakdown: { reason: 'exempt' },
    });
    expect(vendorWithholding({ ...payment, exempt: false }).amount).toBeGreaterThan(0);
  });

  it('a payment below the row’s minimum has nothing withheld; one that reaches it has', () => {
    const withMinimum = VendorWithholdingParams.parse({
      rows: [
        { vendorKind: 'company', supply: 'goods', filer: true, percent: 4, minimumPayment: 75_000 },
      ],
    });
    const pay = (gross: number) =>
      vendorWithholding({
        rule: withMinimum,
        vendorKind: 'company',
        supply: 'goods',
        filer: true,
        gross: Rs(gross),
        exempt: false,
      });
    expect(pay(74_999)).toMatchObject({ amount: 0, breakdown: { reason: 'below_minimum' } });
    expect(pay(75_000).amount).toBe(Rs(3_000));
  });

  it('R-tax-3 a payment the table has no row for is refused; it is never assumed to be zero', () => {
    const partial = VendorWithholdingParams.parse({
      rows: [{ vendorKind: 'company', supply: 'goods', filer: true, percent: 4 }],
    });
    const attempt = () =>
      vendorWithholding({
        rule: partial,
        vendorKind: 'individual',
        supply: 'services',
        filer: false,
        gross: Rs(10_000),
        exempt: false,
      });
    expect(attempt).toThrow(AppError);
    expect(attempt).toThrow(/no row for an individual supplying services who is not a filer/);
  });
});

describe('T-tax-4 contributions', () => {
  it('EOBI: both shares are percentages of the rule’s wage base', () => {
    const rule = EobiParams.parse({ wageBase: 40_000, employeePercent: 1, employerPercent: 5 });
    expect(eobi({ rule })).toEqual({ employee: Rs(400), employer: Rs(2_000), base: Rs(40_000) });
  });

  it('social security: the school’s percentage of the wage, up to and including the ceiling', () => {
    const rule = SocialSecurityParams.parse({
      wageCeiling: 50_000,
      employerPercent: 6,
      aboveCeiling: 'not_covered',
    });
    expect(socialSecurity({ rule, wage: Rs(45_000) })).toEqual({
      employee: 0,
      employer: Rs(2_700),
      base: Rs(45_000),
      covered: true,
    });
    expect(socialSecurity({ rule, wage: Rs(50_000) }).employer).toBe(Rs(3_000));
  });

  it('social security above the ceiling: nothing when the rule says not covered, the ceiling’s share when it says capped', () => {
    const figures = { wageCeiling: 50_000, employerPercent: 6 };
    const notCovered = SocialSecurityParams.parse({ ...figures, aboveCeiling: 'not_covered' });
    const capped = SocialSecurityParams.parse({ ...figures, aboveCeiling: 'capped' });
    expect(socialSecurity({ rule: notCovered, wage: Rs(50_001) })).toMatchObject({
      employer: 0,
      covered: false,
    });
    expect(socialSecurity({ rule: capped, wage: Rs(60_000) })).toMatchObject({
      employer: Rs(3_000),
      base: Rs(50_000),
      covered: true,
    });
  });

  it('provident fund: percentages of the named pay components only, rounded to the rupee', () => {
    const rule = ProvidentFundParams.parse({
      employeePercent: 8,
      employerPercent: 10,
      onComponents: ['BASIC'],
    });
    const result = providentFund({
      rule,
      components: [
        { code: 'BASIC', amount: Rs(33_333) },
        { code: 'HOUSE_RENT', amount: Rs(20_000) },
      ],
    });
    // 8% of 33,333 is 2,666.64; 10% is 3,333.30.
    expect(result).toEqual({ employee: Rs(2_667), employer: Rs(3_333), base: Rs(33_333) });
  });
});

import type { SalaryTaxParams } from '@takhti/contracts';
import { floorAtZero, fraction, percentOf, roundToRupee, rupees, times } from '../../../kernel/money';
import type { Paisa } from '../../../kernel/money';

/*
 * Income tax on salary for one month, by projection over the tax year:
 * docs/plan/10-modules/m25-tax-compliance.md, section 4 and rule R-tax-5.
 *
 * No figure lives here. The slabs, the surcharge and the rebate all come from the rule, which the
 * school's adviser entered and confirmed.
 */

export interface SalaryTaxInput {
  rule: SalaryTaxParams;
  /** Taxable pay earlier in this tax year, including what a mid-year joiner declared. Paisa. */
  taxableToDate: Paisa;
  /** Tax already deducted earlier in this tax year. Paisa. */
  taxPaidToDate: Paisa;
  /** This month's taxable pay. Paisa. */
  taxableThisMonth: Paisa;
  /** Months of the tax year after this one in which the person will still be paid. 0 in the last. */
  monthsLeft: number;
  /** A full-time teacher, when the rule gives teachers a rebate. */
  teacher?: boolean;
}

export interface SalaryTaxResult {
  /** The tax to deduct this month, in whole rupees. */
  amount: Paisa;
  breakdown: {
    /** The year's taxable income, if this month's pay continues to the end of the year. */
    projectedAnnual: Paisa;
    /** Which slab that income falls in, counting from 0. */
    slabIndex: number;
    slabTax: Paisa;
    rebate: Paisa;
    surcharge: Paisa;
    /** The tax for the whole year, rounded to the rupee. */
    annualTax: Paisa;
    paidToDate: Paisa;
    /** The year's tax less what was already deducted; negative when too much was deducted. */
    remaining: Paisa;
    /** The months it is spread over: this one and those left. */
    months: number;
  };
}

/** The tax for a year's income, before any rebate or surcharge. */
export function slabTaxFor(
  rule: SalaryTaxParams,
  annualIncome: Paisa,
): { tax: Paisa; slabIndex: number } {
  const index = rule.slabs.findIndex(
    (slab) => slab.upTo === null || annualIncome <= rupees(slab.upTo),
  );
  const slab = rule.slabs[index];
  // A confirmed rule always ends with a slab that has no upper limit, so this cannot happen with
  // one; a rule that reached here unchecked must stop the payroll rather than charge nothing.
  if (!slab) throw new Error('The salary tax rule has no slab for this income');
  const over = floorAtZero(annualIncome - rupees(slab.lower));
  return { tax: rupees(slab.fixed) + percentOf(over, slab.percentOverLower), slabIndex: index };
}

export function salaryTaxForMonth(input: SalaryTaxInput): SalaryTaxResult {
  const { rule, taxableToDate, taxPaidToDate, taxableThisMonth, monthsLeft } = input;
  if (!Number.isInteger(monthsLeft) || monthsLeft < 0 || monthsLeft > 11)
    throw new Error(`monthsLeft must be a whole number from 0 to 11, got ${monthsLeft}`);
  const months = monthsLeft + 1;

  const projectedAnnual = taxableToDate + times(taxableThisMonth, months);
  const { tax: slabTax, slabIndex } = slabTaxFor(rule, projectedAnnual);
  const rebate =
    input.teacher && rule.teacherRebatePercent !== undefined
      ? percentOf(slabTax, rule.teacherRebatePercent)
      : 0;
  const afterRebate = slabTax - rebate;
  const surcharge =
    rule.surcharge && projectedAnnual > rupees(rule.surcharge.above)
      ? percentOf(afterRebate, rule.surcharge.percent)
      : 0;
  const annualTax = roundToRupee(afterRebate + surcharge);

  const remaining = annualTax - taxPaidToDate;
  // In the last month everything still owed is taken, so the months add up to the year exactly.
  const share = months === 1 ? remaining : roundToRupee(fraction(remaining, 1, months));
  return {
    amount: floorAtZero(share),
    breakdown: {
      projectedAnnual,
      slabIndex,
      slabTax,
      rebate,
      surcharge,
      annualTax,
      paidToDate: taxPaidToDate,
      remaining,
      months,
    },
  };
}

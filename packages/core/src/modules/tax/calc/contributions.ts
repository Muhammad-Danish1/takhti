import type { EobiParams, ProvidentFundParams, SocialSecurityParams } from '@takhti/contracts';
import { least, percentOf, roundToRupee, rupees, sum } from '../../../kernel/money';
import type { Paisa } from '../../../kernel/money';

/*
 * The contributions payroll works out each month: EOBI, provincial social security and the
 * provident fund. docs/plan/10-modules/m25-tax-compliance.md, section 4.
 * Every rate, wage base and ceiling comes from the rule.
 */

export interface ContributionResult {
  /** Deducted from the employee's pay. Whole rupees. */
  employee: Paisa;
  /** Paid by the school on top of the pay. Whole rupees. */
  employer: Paisa;
  /** What the percentages were taken of. */
  base: Paisa;
}

/** EOBI: both shares are a percentage of the rule's wage base, whatever the person earns. */
export function eobi(input: { rule: EobiParams }): ContributionResult {
  const base = rupees(input.rule.wageBase);
  return {
    employee: roundToRupee(percentOf(base, input.rule.employeePercent)),
    employer: roundToRupee(percentOf(base, input.rule.employerPercent)),
    base,
  };
}

export interface SocialSecurityResult extends ContributionResult {
  /** False when the wage is above the ceiling and the rule says such a person is not covered. */
  covered: boolean;
}

/** Social security: paid by the school alone, on the wage; the rule says what happens above its ceiling. */
export function socialSecurity(input: {
  rule: SocialSecurityParams;
  /** The month's wage. Paisa. */
  wage: Paisa;
}): SocialSecurityResult {
  const { rule, wage } = input;
  const ceiling = rupees(rule.wageCeiling);
  if (wage > ceiling && rule.aboveCeiling === 'not_covered')
    return { employee: 0, employer: 0, base: 0, covered: false };
  const base = least(wage, ceiling);
  return {
    employee: 0,
    employer: roundToRupee(percentOf(base, rule.employerPercent)),
    base,
    covered: true,
  };
}

/** Provident fund: percentages of the pay components the rule names. */
export function providentFund(input: {
  rule: ProvidentFundParams;
  /** The month's pay, component by component. */
  components: readonly { code: string; amount: Paisa }[];
}): ContributionResult {
  const { rule, components } = input;
  const counted = new Set(rule.onComponents);
  const base = sum(
    components.filter((component) => counted.has(component.code)).map((part) => part.amount),
  );
  return {
    employee: roundToRupee(percentOf(base, rule.employeePercent)),
    employer: roundToRupee(percentOf(base, rule.employerPercent)),
    base,
  };
}

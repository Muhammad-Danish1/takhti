import type { FeeAdvanceTaxParams, TaxPartyProfileFilerStatus } from '@takhti/contracts';
import { floorAtZero, least, percentOf, roundToRupee, rupees } from '../../../kernel/money';
import type { Paisa } from '../../../kernel/money';

/*
 * Advance tax collected with a fee voucher:
 * docs/plan/10-modules/m25-tax-compliance.md, section 4 and rule R-tax-6.
 * The threshold, the rate and who it applies to all come from the rule.
 */

export interface FeeAdvanceTaxInput {
  rule: FeeAdvanceTaxParams;
  /** The family's fees for the year on the heads that count. Paisa. */
  annualFees: Paisa;
  /** `unknown` is read as non-filer; the guardian is asked to declare their status. */
  filer: TaxPartyProfileFilerStatus;
  /** Advance tax already collected from the family this tax year. Paisa. */
  alreadyCollected: Paisa;
  /** The part of this voucher that counts. Paisa. */
  thisVoucherBase: Paisa;
}

export type FeeAdvanceTaxReason =
  | 'off'
  | 'filer'
  | 'below_threshold'
  | 'charged'
  /** Less than the percentage of this voucher: the year's tax was nearly collected already. */
  | 'capped';

export interface FeeAdvanceTaxResult {
  /** The tax line of this voucher, in whole rupees. */
  amount: Paisa;
  breakdown: {
    reason: FeeAdvanceTaxReason;
    annualFees: Paisa;
    threshold: Paisa;
    percent: number;
    base: Paisa;
    /** The most that may be collected in the year: the percentage of the annual fees. */
    annualCap: Paisa;
    /** True when the status was unknown and was read as non-filer. */
    treatedAsNonFiler: boolean;
  };
}

export function feeAdvanceTax(input: FeeAdvanceTaxInput): FeeAdvanceTaxResult {
  const { rule, annualFees, filer, alreadyCollected, thisVoucherBase } = input;
  const threshold = rupees(rule.annualThreshold);
  const annualCap = roundToRupee(percentOf(annualFees, rule.percent));
  const result = (amount: Paisa, reason: FeeAdvanceTaxReason): FeeAdvanceTaxResult => ({
    amount,
    breakdown: {
      reason,
      annualFees,
      threshold,
      percent: rule.percent,
      base: thisVoucherBase,
      annualCap,
      treatedAsNonFiler: filer === 'unknown' && rule.appliesTo === 'non_filers',
    },
  });

  if (!rule.enabled) return result(0, 'off');
  if (rule.appliesTo === 'non_filers' && filer === 'filer') return result(0, 'filer');
  if (annualFees <= threshold) return result(0, 'below_threshold');

  const onThisVoucher = roundToRupee(percentOf(thisVoucherBase, rule.percent));
  const stillAllowed = floorAtZero(annualCap - alreadyCollected);
  const amount = least(onThisVoucher, stillAllowed);
  return result(amount, amount < onThisVoucher ? 'capped' : 'charged');
}

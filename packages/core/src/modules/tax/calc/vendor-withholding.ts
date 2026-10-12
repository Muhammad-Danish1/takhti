import type { SupplyKind, VendorKind, VendorWithholdingParams } from '@takhti/contracts';
import { rule as refuse } from '../../../kernel/errors';
import { percentOf, roundToRupee, rupees } from '../../../kernel/money';
import type { Paisa } from '../../../kernel/money';

/*
 * Tax withheld from a payment to a vendor:
 * docs/plan/10-modules/m25-tax-compliance.md, section 4 and rule R-tax-7.
 * The table of rates comes from the rule; a payment the table has no row for is refused.
 */

export interface VendorWithholdingInput {
  rule: VendorWithholdingParams;
  vendorKind: VendorKind;
  supply: SupplyKind;
  /** A vendor whose status is unknown is passed as not a filer. */
  filer: boolean;
  /** The payment before withholding. Paisa. */
  gross: Paisa;
  /** The vendor holds an exemption certificate that is valid on the day of payment. */
  exempt: boolean;
}

export type VendorWithholdingReason = 'exempt' | 'below_minimum' | 'withheld';

export interface VendorWithholdingResult {
  /** The tax to withhold, in whole rupees. */
  amount: Paisa;
  /** What the vendor is paid: the gross less the tax. */
  net: Paisa;
  breakdown: {
    reason: VendorWithholdingReason;
    percent: number;
    gross: Paisa;
    /** The row's minimum payment, when it has one. */
    minimumPayment: Paisa | null;
  };
}

const words = { company: 'a company', individual: 'an individual' } as const;

export function vendorWithholding(input: VendorWithholdingInput): VendorWithholdingResult {
  const { rule, vendorKind, supply, filer, gross, exempt } = input;
  const row = rule.rows.find(
    (candidate) =>
      candidate.vendorKind === vendorKind &&
      candidate.supply === supply &&
      candidate.filer === filer,
  );
  // R-tax-3: never assume zero. The table must say, even when what it says is zero percent.
  if (!row)
    throw refuse(
      `The vendor withholding rule has no row for ${words[vendorKind]} supplying ${supply} who is ${filer ? 'a filer' : 'not a filer'}. Add the row to the rule, then try again.`,
    );
  const minimumPayment = row.minimumPayment === undefined ? null : rupees(row.minimumPayment);
  const result = (amount: Paisa, reason: VendorWithholdingReason): VendorWithholdingResult => ({
    amount,
    net: gross - amount,
    breakdown: { reason, percent: row.percent, gross, minimumPayment },
  });

  if (exempt) return result(0, 'exempt');
  if (minimumPayment !== null && gross < minimumPayment) return result(0, 'below_minimum');
  return result(roundToRupee(percentOf(gross, row.percent)), 'withheld');
}

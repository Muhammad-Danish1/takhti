import { z } from 'zod';
import { vendorKinds } from '../procurement/procurement.constants';
import type { TaxRuleKind } from './tax.constants';

/*
 * The figures of a tax rule: docs/plan/10-modules/m25-tax-compliance.md, section 4.
 * `tax_rules.params` holds one of these shapes, chosen by the rule's `kind`.
 *
 * Amounts are whole rupees and percentages; nothing here is a figure. Every rate, slab, threshold
 * and ceiling is entered and confirmed by the school's own adviser, with a note of where it came from.
 */

/** A whole number of rupees, zero or more. */
const RupeeFigure = z.int().min(0);
/** A percentage from 0 to 100, to at most four decimal places. */
const PercentFigure = z
  .number()
  .min(0)
  .max(100)
  .refine((value) => Math.abs(value * 10_000 - Math.round(value * 10_000)) < 1e-6, {
    message: 'Use at most four decimal places',
  });

/** `Rs 1,200,000`, for a message about a slab. */
const rs = (amount: number) => `Rs ${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

export const SalaryTaxSlab = z.object({
  /** The top of the slab; empty for the last, which has none. */
  upTo: RupeeFigure.nullable(),
  /** The tax on income up to `lower`. */
  fixed: RupeeFigure,
  /** The percentage charged on income above `lower`. */
  percentOverLower: PercentFigure,
  lower: RupeeFigure,
});
export type SalaryTaxSlab = z.output<typeof SalaryTaxSlab>;

/** Income tax on salary, per tax year. The slabs run from zero upwards with no gap and no overlap. */
export const SalaryTaxParams = z
  .object({
    slabs: z.array(SalaryTaxSlab).min(1),
    surcharge: z.object({ above: RupeeFigure, percent: PercentFigure }).optional(),
    teacherRebatePercent: PercentFigure.optional(),
  })
  .superRefine((params, context) => {
    const { slabs } = params;
    const at = (index: number, field: string, message: string) =>
      context.addIssue({ code: 'custom', path: ['slabs', index, field], message });
    slabs.forEach((slab, index) => {
      const previous = slabs[index - 1];
      const last = index === slabs.length - 1;
      if (index === 0 && slab.lower !== 0) at(index, 'lower', 'The first slab starts at Rs 0');
      if (previous && previous.upTo !== null && slab.lower > previous.upTo)
        at(
          index,
          'lower',
          `There is a gap between ${rs(previous.upTo)} and ${rs(slab.lower)}: no slab covers it`,
        );
      if (previous && previous.upTo !== null && slab.lower < previous.upTo)
        at(
          index,
          'lower',
          `This slab starts at ${rs(slab.lower)}, inside the one before it, which runs to ${rs(previous.upTo)}`,
        );
      if (last && slab.upTo !== null)
        at(index, 'upTo', 'The last slab has no upper limit: leave it empty');
      if (!last && slab.upTo === null)
        at(index, 'upTo', 'Only the last slab may be without an upper limit');
      if (slab.upTo !== null && slab.upTo <= slab.lower)
        at(index, 'upTo', 'The upper limit must be above the lower one');
    });
  });
export type SalaryTaxParams = z.output<typeof SalaryTaxParams>;

/** Advance tax collected with fees. */
export const FeeAdvanceTaxParams = z.object({
  enabled: z.boolean(),
  /** A family's fees for the year must be above this before any tax is charged. */
  annualThreshold: RupeeFigure,
  percent: PercentFigure,
  appliesTo: z.enum(['all', 'non_filers']),
  /** Which fee heads make up the base: those flagged as counting for advance tax. */
  countHeads: z.literal('flagged'),
});
export type FeeAdvanceTaxParams = z.output<typeof FeeAdvanceTaxParams>;

/** What a payment is for. A vendor may supply both; one payment is for one or the other. */
export const supplyKinds = ['goods', 'services'] as const;
export type SupplyKind = (typeof supplyKinds)[number];

/** Tax withheld from payments to vendors: one row for each kind of vendor, supply and filer status. */
export const VendorWithholdingParams = z
  .object({
    rows: z
      .array(
        z.object({
          vendorKind: z.enum(vendorKinds),
          supply: z.enum(supplyKinds),
          filer: z.boolean(),
          percent: PercentFigure,
          /** A payment below this is not subject to withholding. */
          minimumPayment: RupeeFigure.optional(),
        }),
      )
      .min(1),
  })
  .superRefine((params, context) => {
    const seen = new Set<string>();
    params.rows.forEach((row, index) => {
      const key = `${row.vendorKind}|${row.supply}|${row.filer}`;
      if (seen.has(key))
        context.addIssue({
          code: 'custom',
          path: ['rows', index],
          message: 'There is already a row for this kind of vendor, supply and filer status',
        });
      seen.add(key);
    });
  });
export type VendorWithholdingParams = z.output<typeof VendorWithholdingParams>;

export const EobiParams = z.object({
  /** The wage both contributions are a percentage of. */
  wageBase: RupeeFigure,
  employeePercent: PercentFigure,
  employerPercent: PercentFigure,
});
export type EobiParams = z.output<typeof EobiParams>;

export const SocialSecurityParams = z.object({
  wageCeiling: RupeeFigure,
  employerPercent: PercentFigure,
  /**
   * What happens to a wage above the ceiling: `not_covered` (no contribution) or `capped`
   * (the percentage of the ceiling). The rule must say; it is never assumed.
   */
  aboveCeiling: z.enum(['not_covered', 'capped']),
});
export type SocialSecurityParams = z.output<typeof SocialSecurityParams>;

export const ProvidentFundParams = z.object({
  employeePercent: PercentFigure,
  employerPercent: PercentFigure,
  /** The codes of the pay components the percentages are taken of. */
  onComponents: z.array(z.string().trim().min(1)).min(1),
});
export type ProvidentFundParams = z.output<typeof ProvidentFundParams>;

export const MinimumWageParams = z.object({ monthly: RupeeFigure });
export type MinimumWageParams = z.output<typeof MinimumWageParams>;

/** The shape of `params` for each kind of rule. */
export const taxRuleParams = {
  salary_tax: SalaryTaxParams,
  fee_advance_tax: FeeAdvanceTaxParams,
  vendor_withholding: VendorWithholdingParams,
  eobi: EobiParams,
  social_security: SocialSecurityParams,
  provident_fund: ProvidentFundParams,
  minimum_wage: MinimumWageParams,
} as const satisfies Record<TaxRuleKind, z.ZodType>;

export interface TaxRuleParamsByKind {
  salary_tax: SalaryTaxParams;
  fee_advance_tax: FeeAdvanceTaxParams;
  vendor_withholding: VendorWithholdingParams;
  eobi: EobiParams;
  social_security: SocialSecurityParams;
  provident_fund: ProvidentFundParams;
  minimum_wage: MinimumWageParams;
}

/** Checks a rule's figures against the shape of its kind. Throws a `ZodError` naming what is wrong. */
export function parseTaxRuleParams<K extends TaxRuleKind>(
  kind: K,
  params: unknown,
): TaxRuleParamsByKind[K] {
  return taxRuleParams[kind].parse(params) as TaxRuleParamsByKind[K];
}

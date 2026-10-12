import {
  taxRuleParams,
  type Province,
  type TaxRuleKind,
  type TaxRuleParamsByKind,
} from '@takhti/contracts';
import type { Ctx } from '../../kernel/context';
import { formatDay } from '../../kernel/dates';
import { rule } from '../../kernel/errors';
import { taxDb } from './tax.db-service';

/*
 * Finding the rule a calculation must use: docs/plan/10-modules/m25-tax-compliance.md,
 * rules R-tax-1 and R-tax-3. Payroll, fee vouchers and vendor payments call `ruleFor` and hand
 * what it returns to a calculator in `calc/`.
 */

const kindNames: Record<TaxRuleKind, string> = {
  salary_tax: 'salary tax',
  fee_advance_tax: 'advance tax on fees',
  vendor_withholding: 'vendor withholding',
  eobi: 'EOBI',
  social_security: 'social security',
  provident_fund: 'provident fund',
  minimum_wage: 'minimum wage',
};

const provinceNames: Record<Province, string> = {
  punjab: 'Punjab',
  sindh: 'Sindh',
  kp: 'Khyber Pakhtunkhwa',
  balochistan: 'Balochistan',
  ict: 'Islamabad',
  ajk: 'Azad Jammu and Kashmir',
  gb: 'Gilgit-Baltistan',
};

/** A confirmed rule, with its figures checked against the shape of its kind. */
export interface TaxRuleInForce<K extends TaxRuleKind> {
  id: string;
  kind: K;
  name: string;
  province: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  params: TaxRuleParamsByKind[K];
}

/**
 * The confirmed rule of a kind in force on a date. With a province, that province's own rule comes
 * first and a rule for the whole country second; another province's rule is never used (F-tax-8).
 *
 * R-tax-3: when there is none the operation that asked stops, with a message naming the kind and
 * the date. A draft is never used, and nothing is ever assumed to be zero.
 */
async function ruleFor<K extends TaxRuleKind>(
  ctx: Ctx,
  kind: K,
  date: string,
  province?: Province,
): Promise<TaxRuleInForce<K>> {
  const inForce = await taxDb.confirmedRulesOn(ctx, kind, date);
  const found =
    (province && inForce.find((candidate) => candidate.province === province)) ||
    inForce.find((candidate) => candidate.province === null);
  if (!found) {
    const where = province ? ` for ${provinceNames[province]}` : '';
    throw rule(
      `No confirmed ${kindNames[kind]} rule${where} covers ${formatDay(date)}. Enter and confirm one under Finance, Tax rules, then try again.`,
    );
  }
  const params = taxRuleParams[kind].safeParse(found.params);
  if (!params.success)
    throw rule(
      `The ${kindNames[kind]} rule "${found.name}" has figures that cannot be read. Open it under Finance, Tax rules, and correct it.`,
    );
  return {
    id: found.id,
    kind,
    name: found.name,
    province: found.province,
    effectiveFrom: found.effectiveFrom,
    effectiveTo: found.effectiveTo,
    params: params.data as TaxRuleParamsByKind[K],
  };
}

export const taxService = { ruleFor };

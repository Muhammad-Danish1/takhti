import { z } from 'zod';

/*
 * The fixed lists of the general ledger: docs/plan/10-modules/m23-accounting.md, section 4.
 * A school's chart of accounts is its own data; these are the names the product itself posts by.
 */

/**
 * Which account an automatic posting uses. A school maps each key to an account of its chart, and
 * may override it for one branch. A posting that needs a key with no account is refused by name.
 */
export const accountMappingKeys = [
  'cash.counter',
  'cash.petty',
  'fees.receivable',
  'fees.income',
  'fees.discounts',
  'fees.fine_income',
  'fees.advance',
  'fees.security_deposit',
  'fees.bad_debts',
  'fees.rounding',
  'cash.over_short',
  'gateway.clearing',
  'gateway.charges',
  'tax.fee_advance_payable',
  'tax.salary_payable',
  'tax.vendor_withholding_payable',
  'payroll.salary_expense',
  'payroll.employer_contributions',
  'payroll.salaries_payable',
  'payroll.eobi_payable',
  'payroll.social_security_payable',
  'payroll.provident_fund_payable',
  'payroll.loans',
  'payroll.advances',
  'ap.payable',
  'ap.advances_to_vendors',
  'inventory.asset',
  'inventory.consumed',
  'inventory.adjustment',
  'assets.fixed',
  'assets.depreciation_expense',
  'assets.accumulated_depreciation',
  'shop.sales',
  'shop.cost_of_sales',
  'shop.wallets',
  'bank.charges',
  'interbranch.due',
  'equity.opening_balance',
  'equity.retained_earnings',
] as const;
export const AccountMappingKey = z.enum(accountMappingKeys);
export type AccountMappingKey = (typeof accountMappingKeys)[number];

/** The journals every school has, by code, with the kind of each. */
export const systemJournals = [
  { code: 'GJ', name: 'General journal', kind: 'general' },
  { code: 'FEE', name: 'Fees journal', kind: 'fees' },
  { code: 'CASH', name: 'Cash journal', kind: 'cash' },
  { code: 'BANK', name: 'Bank journal', kind: 'bank' },
  { code: 'PAY', name: 'Payroll journal', kind: 'payroll' },
  { code: 'PUR', name: 'Purchases journal', kind: 'purchases' },
  { code: 'INV', name: 'Inventory journal', kind: 'inventory' },
  { code: 'OPEN', name: 'Opening balances', kind: 'opening' },
  { code: 'CLOSE', name: 'Year-end closing', kind: 'closing' },
] as const;
export const journalCodes = ['GJ', 'FEE', 'CASH', 'BANK', 'PAY', 'PUR', 'INV', 'OPEN', 'CLOSE'] as const;
export const JournalCode = z.enum(journalCodes);
export type JournalCode = (typeof journalCodes)[number];

/** What caused a journal entry. `manual` is one a person keyed in; every other names the record that posted it. */
export const journalSourceTypes = [
  'manual',
  'fee_generation_run',
  'fee_voucher',
  'fee_payment',
  'fee_adjustment',
  'fee_refund',
  'cash_session',
  'settlement',
  'payroll_run',
  'salary_payment',
  'expense',
  'vendor_bill',
  'vendor_payment',
  'stock_movement',
  'shop_sale',
  'wallet',
  'transfer',
  'depreciation',
  'opening',
  'closing',
  'bank_line',
] as const;
export const JournalSourceType = z.enum(journalSourceTypes);
export type JournalSourceType = (typeof journalSourceTypes)[number];

/** Each source posts at most once for each purpose. */
export const journalPurposes = ['post', 'reverse'] as const;
export type JournalPurpose = (typeof journalPurposes)[number];

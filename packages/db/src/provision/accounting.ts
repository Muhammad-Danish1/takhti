import { randomUUID } from 'node:crypto';
import {
  daysInMonth,
  systemJournals,
  type AccountMappingKey,
  type AccountSubtype,
  type AccountType,
} from '@takhti/contracts';
import type { Tx } from '../client';
import { accountMappings, accounts, fiscalPeriods, fiscalYears, journals } from '../schema';

/*
 * The accounting a new school group starts with (docs/plan/10-modules/m23-accounting.md, section 4):
 * a chart of accounts written for a Pakistani school, the journals, an account for every mapping
 * key, and the fiscal year that contains the day the school is created. With these in place the
 * first fee can be collected and posted without anyone setting up accounting first.
 *
 * It is a starting point, not a rule: the school renames, adds and regroups accounts afterwards,
 * and points a mapping key at another account whenever it wants.
 */

export interface ChartAccount {
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  /** The code of the group it sits under. */
  parent?: string;
  /** A group has children and takes no postings. */
  group?: true;
  /** Posted only by the system: its balance must always equal the records behind it. */
  control?: true;
  /** The automatic postings that use this account. */
  keys?: readonly AccountMappingKey[];
}

const group = (
  code: string,
  name: string,
  type: AccountType,
  subtype: AccountSubtype,
  parent?: string,
): ChartAccount => ({ code, name, type, subtype, group: true, ...(parent && { parent }) });

/** The leaves of one group, all of the same type. */
const under =
  (parent: string, type: AccountType, subtype: AccountSubtype) =>
  (
    code: string,
    name: string,
    options: { subtype?: AccountSubtype; control?: true; keys?: readonly AccountMappingKey[] } = {},
  ): ChartAccount => ({
    code,
    name,
    type,
    subtype: options.subtype ?? subtype,
    parent,
    ...(options.control && { control: true }),
    ...(options.keys && { keys: options.keys }),
  });

const cash = under('1100', 'asset', 'cash');
const receivable = under('1200', 'asset', 'receivable');
const stock = under('1300', 'asset', 'inventory');
const fixed = under('1400', 'asset', 'fixed_asset');
const payable = under('2100', 'liability', 'payable');
const statutory = under('2200', 'liability', 'tax');
const held = under('2300', 'liability', 'deposit_held');
const loan = under('2400', 'liability', 'other');
const equity = under('3000', 'equity', 'equity');
const feeIncome = under('4100', 'income', 'income');
const concession = under('4200', 'income', 'contra_income');
const shopIncome = under('4300', 'income', 'income');
const otherIncome = under('4400', 'income', 'income');
const staffCost = under('5100', 'expense', 'expense');
const goods = under('5200', 'expense', 'cost_of_sales');
const premises = under('5300', 'expense', 'expense');
const academic = under('5400', 'expense', 'expense');
const transport = under('5500', 'expense', 'expense');
const admin = under('5600', 'expense', 'expense');
const hostel = under('5700', 'expense', 'expense');
const finance = under('5800', 'expense', 'expense');
const otherExpense = under('5900', 'expense', 'expense');

export const defaultChart: readonly ChartAccount[] = [
  // ---------------------------------------------------------------------------------- assets
  group('1000', 'Assets', 'asset', 'other'),
  group('1100', 'Cash and bank', 'asset', 'cash', '1000'),
  cash('1110', 'Cash in hand: fee counter', { keys: ['cash.counter'] }),
  cash('1120', 'Petty cash', { keys: ['cash.petty'] }),
  // Each bank account of the school gets its own ledger account under this group.
  group('1130', 'Bank accounts', 'asset', 'bank', '1100'),
  cash('1140', 'Payment gateway clearing', {
    subtype: 'clearing',
    control: true,
    keys: ['gateway.clearing'],
  }),
  group('1200', 'Receivables and advances', 'asset', 'receivable', '1000'),
  receivable('1210', 'Fees receivable', { control: true, keys: ['fees.receivable'] }),
  receivable('1220', 'Loans to staff', {
    subtype: 'advance',
    control: true,
    keys: ['payroll.loans'],
  }),
  receivable('1230', 'Salary advances to staff', {
    subtype: 'advance',
    control: true,
    keys: ['payroll.advances'],
  }),
  receivable('1240', 'Advances to vendors', {
    subtype: 'advance',
    control: true,
    keys: ['ap.advances_to_vendors'],
  }),
  receivable('1250', 'Other receivables'),
  receivable('1260', 'Inter-branch account', {
    subtype: 'other',
    control: true,
    keys: ['interbranch.due'],
  }),
  receivable('1270', 'Advance income tax paid', { subtype: 'tax' }),
  receivable('1280', 'Prepaid expenses', { subtype: 'advance' }),
  receivable('1290', 'Security deposits paid', { subtype: 'other' }),
  group('1300', 'Stock', 'asset', 'inventory', '1000'),
  stock('1310', 'Stock in store', { control: true, keys: ['inventory.asset'] }),
  group('1400', 'Fixed assets', 'asset', 'fixed_asset', '1000'),
  fixed('1410', 'Land'),
  fixed('1420', 'Buildings'),
  fixed('1430', 'Furniture and fixtures'),
  fixed('1440', 'Computers and IT equipment'),
  fixed('1450', 'Laboratory equipment'),
  fixed('1460', 'Vehicles'),
  fixed('1470', 'Library books'),
  fixed('1480', 'Other equipment', { keys: ['assets.fixed'] }),
  fixed('1490', 'Accumulated depreciation', {
    subtype: 'depreciation',
    control: true,
    keys: ['assets.accumulated_depreciation'],
  }),

  // ----------------------------------------------------------------------------- liabilities
  group('2000', 'Liabilities', 'liability', 'other'),
  group('2100', 'Payables', 'liability', 'payable', '2000'),
  payable('2110', 'Payable to vendors', { control: true, keys: ['ap.payable'] }),
  payable('2120', 'Salaries payable', { control: true, keys: ['payroll.salaries_payable'] }),
  payable('2130', 'Accrued expenses'),
  payable('2140', 'Other payables'),
  group('2200', 'Taxes and contributions payable', 'liability', 'tax', '2000'),
  statutory('2210', 'Income tax withheld from salaries', {
    control: true,
    keys: ['tax.salary_payable'],
  }),
  statutory('2220', 'Income tax withheld from vendors', {
    control: true,
    keys: ['tax.vendor_withholding_payable'],
  }),
  statutory('2230', 'Advance tax collected on fees', {
    control: true,
    keys: ['tax.fee_advance_payable'],
  }),
  statutory('2240', 'EOBI payable', {
    subtype: 'payable',
    control: true,
    keys: ['payroll.eobi_payable'],
  }),
  statutory('2250', 'Social security payable', {
    subtype: 'payable',
    control: true,
    keys: ['payroll.social_security_payable'],
  }),
  statutory('2260', 'Provident fund payable', {
    subtype: 'payable',
    control: true,
    keys: ['payroll.provident_fund_payable'],
  }),
  group('2300', 'Held for families and students', 'liability', 'deposit_held', '2000'),
  held('2310', 'Fees received in advance', {
    subtype: 'advance',
    control: true,
    keys: ['fees.advance'],
  }),
  held('2320', 'Security deposits held', { control: true, keys: ['fees.security_deposit'] }),
  held('2330', 'Student wallets', { control: true, keys: ['shop.wallets'] }),
  group('2400', 'Loans', 'liability', 'other', '2000'),
  loan('2410', 'Bank loans'),
  loan('2420', 'Loans from directors'),

  // ---------------------------------------------------------------------------------- equity
  group('3000', 'Equity', 'equity', 'equity'),
  equity('3100', "Owner's capital"),
  equity('3200', 'Opening balances', { control: true, keys: ['equity.opening_balance'] }),
  equity('3300', 'Retained earnings', {
    subtype: 'retained_earnings',
    control: true,
    keys: ['equity.retained_earnings'],
  }),
  equity('3400', 'Drawings'),

  // ---------------------------------------------------------------------------------- income
  group('4000', 'Income', 'income', 'income'),
  group('4100', 'Fee income', 'income', 'income', '4000'),
  feeIncome('4110', 'Tuition fees'),
  feeIncome('4120', 'Admission fees'),
  feeIncome('4130', 'Registration fees'),
  feeIncome('4140', 'Annual charges'),
  feeIncome('4150', 'Examination fees'),
  feeIncome('4160', 'Computer and laboratory fees'),
  feeIncome('4170', 'Sports and activity fees'),
  feeIncome('4180', 'Transport fees'),
  feeIncome('4185', 'Hostel and mess fees'),
  feeIncome('4190', 'Other fee income', { keys: ['fees.income'] }),
  feeIncome('4195', 'Late payment fines', { keys: ['fees.fine_income'] }),
  group('4200', 'Fee concessions', 'income', 'contra_income', '4000'),
  concession('4210', 'Discounts, scholarships and waivers', { keys: ['fees.discounts'] }),
  concession('4220', 'Rounding of fee vouchers', { keys: ['fees.rounding'] }),
  group('4300', 'Shop and canteen', 'income', 'income', '4000'),
  shopIncome('4310', 'Shop and canteen sales', { control: true, keys: ['shop.sales'] }),
  group('4400', 'Other income', 'income', 'income', '4000'),
  otherIncome('4410', 'Profit on bank deposits'),
  otherIncome('4420', 'Rental income'),
  otherIncome('4430', 'Donations and grants received'),
  otherIncome('4440', 'Sale of prospectus and forms'),
  otherIncome('4450', 'Gain on disposal of assets'),
  otherIncome('4460', 'Miscellaneous income'),

  // -------------------------------------------------------------------------------- expenses
  group('5000', 'Expenses', 'expense', 'expense'),
  group('5100', 'Staff costs', 'expense', 'expense', '5000'),
  staffCost('5110', 'Salaries and wages', { control: true, keys: ['payroll.salary_expense'] }),
  staffCost('5120', 'Employer contributions', {
    control: true,
    keys: ['payroll.employer_contributions'],
  }),
  staffCost('5130', 'Staff welfare and benefits'),
  staffCost('5140', 'Staff training'),
  staffCost('5150', 'Visiting faculty and honoraria'),
  group('5200', 'Cost of goods', 'expense', 'cost_of_sales', '5000'),
  goods('5210', 'Cost of shop and canteen sales', {
    control: true,
    keys: ['shop.cost_of_sales'],
  }),
  goods('5220', 'Stores consumed', {
    subtype: 'expense',
    control: true,
    keys: ['inventory.consumed'],
  }),
  goods('5230', 'Stock adjustments', {
    subtype: 'expense',
    control: true,
    keys: ['inventory.adjustment'],
  }),
  group('5300', 'Premises', 'expense', 'expense', '5000'),
  premises('5310', 'Rent'),
  premises('5320', 'Electricity'),
  premises('5330', 'Gas'),
  premises('5340', 'Water and sanitation'),
  premises('5350', 'Repairs and maintenance'),
  premises('5360', 'Security services'),
  premises('5370', 'Cleaning and janitorial'),
  premises('5380', 'Generator fuel'),
  group('5400', 'Academic', 'expense', 'expense', '5000'),
  academic('5410', 'Books and teaching material'),
  academic('5420', 'Examination expenses'),
  academic('5430', 'Laboratory supplies'),
  academic('5440', 'Sports and activities'),
  academic('5450', 'Events and functions'),
  academic('5460', 'Board registration and affiliation'),
  academic('5470', 'Prizes and awards'),
  group('5500', 'Transport', 'expense', 'expense', '5000'),
  transport('5510', 'Fuel'),
  transport('5520', 'Vehicle repairs and maintenance'),
  transport('5530', 'Vehicle insurance and tokens'),
  transport('5540', 'Hired transport'),
  group('5600', 'Administration', 'expense', 'expense', '5000'),
  admin('5610', 'Printing and stationery'),
  admin('5620', 'Telephone and internet'),
  admin('5630', 'Software and subscriptions'),
  admin('5640', 'Postage and courier'),
  admin('5650', 'Advertising and marketing'),
  admin('5660', 'Legal and professional fees'),
  admin('5670', 'Audit fees'),
  admin('5680', 'Travelling and conveyance'),
  admin('5685', 'Refreshments and entertainment'),
  admin('5690', 'Insurance'),
  admin('5695', 'Fees, rates and licences'),
  group('5700', 'Hostel and mess', 'expense', 'expense', '5000'),
  hostel('5710', 'Mess provisions'),
  hostel('5720', 'Hostel supplies'),
  group('5800', 'Finance costs', 'expense', 'expense', '5000'),
  finance('5810', 'Bank charges', { keys: ['bank.charges'] }),
  finance('5820', 'Payment gateway charges', { keys: ['gateway.charges'] }),
  finance('5830', 'Mark-up on loans'),
  finance('5840', 'Cash over and short', { keys: ['cash.over_short'] }),
  group('5900', 'Other expenses', 'expense', 'expense', '5000'),
  otherExpense('5910', 'Depreciation', {
    subtype: 'depreciation',
    control: true,
    keys: ['assets.depreciation_expense'],
  }),
  otherExpense('5920', 'Fees written off', { keys: ['fees.bad_debts'] }),
  otherExpense('5930', 'Donations and charity'),
  otherExpense('5940', 'Loss on disposal of assets'),
  otherExpense('5950', 'Miscellaneous expenses'),
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const pad = (value: number) => String(value).padStart(2, '0');

export interface FiscalPeriodPlan {
  periodNo: number;
  /** "July 2026" */
  name: string;
  startsOn: string;
  endsOn: string;
}

export interface FiscalYearPlan {
  /** "FY 2026–27", or "FY 2026" for a year that runs January to December. */
  name: string;
  startsOn: string;
  endsOn: string;
  periods: FiscalPeriodPlan[];
}

/**
 * The fiscal year that contains a date, for a year starting in the given month, with its twelve
 * monthly periods. With a July start, 12 October 2026 is in "FY 2026–27", 1 July 2026 to 30 June 2027.
 */
export function fiscalYearContaining(date: string, startMonth: number): FiscalYearPlan {
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12)
    throw new Error(`A fiscal year starts in a month from 1 to 12, not ${startMonth}`);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const startYear = month >= startMonth ? year : year - 1;
  const periods: FiscalPeriodPlan[] = [];
  for (let index = 0; index < 12; index++) {
    const position = startMonth - 1 + index;
    const periodYear = startYear + Math.floor(position / 12);
    const periodMonth = (position % 12) + 1;
    periods.push({
      periodNo: index + 1,
      name: `${MONTHS[periodMonth - 1]} ${periodYear}`,
      startsOn: `${periodYear}-${pad(periodMonth)}-01`,
      endsOn: `${periodYear}-${pad(periodMonth)}-${pad(daysInMonth(periodYear, periodMonth))}`,
    });
  }
  const first = periods[0] as FiscalPeriodPlan;
  const last = periods[11] as FiscalPeriodPlan;
  const endYear = Number(last.endsOn.slice(0, 4));
  return {
    name:
      endYear === startYear
        ? `FY ${startYear}`
        : `FY ${startYear}–${String(endYear).slice(2)}`,
    startsOn: first.startsOn,
    endsOn: last.endsOn,
    periods,
  };
}

/** The calendar date in Pakistan (UTC+5) at a moment. */
const pakistanDate = (iso: string): string =>
  new Date(Date.parse(iso) + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

export interface NewAccounting {
  orgId: string;
  /** 1 to 12. */
  fiscalYearStartMonth: number;
  createdBy?: string | null;
  now: string;
}

/** Writes the chart, the journals, the mappings and the current fiscal year of a new organisation. */
export async function provisionAccounting(tx: Tx, input: NewAccounting): Promise<void> {
  const stamps = {
    orgId: input.orgId,
    createdAt: input.now,
    updatedAt: input.now,
    createdBy: input.createdBy ?? null,
    updatedBy: input.createdBy ?? null,
  };

  const idByCode = new Map(defaultChart.map((account) => [account.code, randomUUID()]));
  const idOf = (code: string): string => {
    const id = idByCode.get(code);
    if (!id) throw new Error(`The default chart has no account ${code}`);
    return id;
  };
  // Parents come before their children in the list, so one insert satisfies the foreign key in order.
  await tx.insert(accounts).values(
    defaultChart.map((account) => ({
      id: idOf(account.code),
      ...stamps,
      code: account.code,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      parentId: account.parent ? idOf(account.parent) : null,
      isGroup: account.group === true,
      isControl: account.control === true,
    })),
  );

  await tx.insert(journals).values(
    systemJournals.map((journal) => ({
      id: randomUUID(),
      ...stamps,
      code: journal.code,
      name: journal.name,
      kind: journal.kind,
      isSystem: true,
    })),
  );

  await tx.insert(accountMappings).values(
    defaultChart.flatMap((account) =>
      (account.keys ?? []).map((key) => ({
        id: randomUUID(),
        ...stamps,
        key,
        branchId: null,
        accountId: idOf(account.code),
      })),
    ),
  );

  const year = fiscalYearContaining(pakistanDate(input.now), input.fiscalYearStartMonth);
  const fiscalYearId = randomUUID();
  await tx.insert(fiscalYears).values({
    id: fiscalYearId,
    ...stamps,
    name: year.name,
    startsOn: year.startsOn,
    endsOn: year.endsOn,
  });
  await tx.insert(fiscalPeriods).values(
    year.periods.map((period) => ({
      id: randomUUID(),
      ...stamps,
      fiscalYearId,
      periodNo: period.periodNo,
      name: period.name,
      startsOn: period.startsOn,
      endsOn: period.endsOn,
    })),
  );
}

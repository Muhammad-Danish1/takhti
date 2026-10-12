import { describe, expect, it } from 'vitest';
import {
  assertBalanced,
  branchDifferences,
  fiscalYearLabel,
  reversalOf,
  sidesOf,
  withInterBranchLines,
  type LedgerLine,
} from './ledger.rules';

const MAIN = 'main';
const CITY = 'city';
const line = (
  accountId: string,
  branchId: string,
  debit: number,
  credit: number,
): LedgerLine => ({
  accountId,
  branchId,
  debit,
  credit,
});

describe('a line of an entry', () => {
  it.each([
    [{ debit: 850000 }, { debit: 850000, credit: 0 }],
    [{ credit: 5 }, { debit: 0, credit: 5 }],
    [{ debit: 0, credit: 0 }, undefined],
    [{}, undefined],
  ])('%j becomes %j', (given, expected) => {
    expect(sidesOf(given)).toEqual(expected);
  });

  it.each([
    [{ debit: 100, credit: 100 }, /either a debit or a credit/],
    [{ debit: -1 }, /whole number of paisa/],
    [{ credit: 10.5 }, /whole number of paisa/],
  ])('%j is refused', (given, message) => {
    expect(() => sidesOf(given)).toThrow(message);
  });
});

describe('R-acct-1 every posted entry balances', () => {
  it('equal debits and credits pass', () => {
    expect(() =>
      assertBalanced([line('cash', MAIN, 850000, 0), line('receivable', MAIN, 0, 850000)]),
    ).not.toThrow();
  });

  it('F-acct-3 a difference of one rupee is refused, and the message shows the difference', () => {
    expect(() =>
      assertBalanced([line('rent', MAIN, 5000000, 0), line('bank', MAIN, 0, 4999900)]),
    ).toThrow('a difference of Rs 1');
  });

  it.each([
    ['no lines', []],
    ['one line', [line('cash', MAIN, 100, 0)]],
  ])('an entry with %s is refused', (_name, lines) => {
    expect(() => assertBalanced(lines)).toThrow(/at least one debit and one credit/);
  });
});

describe('R-acct-2 every posted entry balances within each branch', () => {
  it('an entry inside one branch gains nothing', () => {
    const lines = [line('cash', MAIN, 100, 0), line('receivable', MAIN, 0, 100)];
    expect(withInterBranchLines(lines, () => 'due')).toEqual(lines);
  });

  it('F-acct-8 / T-acct-5 head office pays a campus bill: each branch is brought level and the added lines net to zero', () => {
    // City Campus's electricity, paid from Main Campus's bank.
    const lines = [line('electricity', CITY, 4200000, 0), line('bank', MAIN, 0, 4200000)];
    const result = withInterBranchLines(lines, (branchId) => `due-${branchId}`);

    expect(result.slice(2)).toEqual([
      // City received the value, so it owes head office.
      { accountId: 'due-city', branchId: CITY, debit: 0, credit: 4200000, description: 'Inter-branch balance' },
      { accountId: 'due-main', branchId: MAIN, debit: 4200000, credit: 0, description: 'Inter-branch balance' },
    ]);
    expect(branchDifferences(result).size).toBe(0);
    expect(() => assertBalanced(result)).not.toThrow();
    const added = result.slice(2);
    expect(added.reduce((net, entry) => net + entry.debit - entry.credit, 0)).toBe(0);
  });

  it('three branches, two of them out: only those two gain a line', () => {
    const lines = [
      line('expense', CITY, 300, 0),
      line('bank', MAIN, 0, 300),
      line('cash', 'north', 50, 0),
      line('income', 'north', 0, 50),
    ];
    const result = withInterBranchLines(lines, () => 'due');
    expect(result.slice(4).map((entry) => entry.branchId).sort()).toEqual([CITY, MAIN]);
  });
});

describe('T-acct-4 a reversal exchanges debits and credits', () => {
  it('every line changes side and nothing else', () => {
    const lines = [
      { ...line('cash', MAIN, 850000, 0), description: 'Receipt' },
      line('receivable', MAIN, 0, 850000),
    ];
    expect(reversalOf(lines)).toEqual([
      { ...line('cash', MAIN, 0, 850000), description: 'Receipt' },
      line('receivable', MAIN, 850000, 0),
    ]);
  });
});

describe('the fiscal year in an entry number', () => {
  it.each([
    ['2026-07-01', '2027-06-30', '2627'],
    ['2026-01-01', '2026-12-31', '2026'],
    ['2099-04-01', '2100-03-31', '9900'],
  ])('%s to %s is %s', (startsOn, endsOn, expected) => {
    expect(fiscalYearLabel(startsOn, endsOn)).toBe(expected);
  });
});

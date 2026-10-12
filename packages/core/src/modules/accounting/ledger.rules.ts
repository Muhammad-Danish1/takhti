import { rule } from '../../kernel/errors';
import { formatRs, sum, type Paisa } from '../../kernel/money';

/*
 * The arithmetic of the general ledger, with no database and no clock:
 * docs/plan/10-modules/m23-accounting.md, rules R-acct-1 and R-acct-2.
 * `ledger.ts` reads and writes; everything it decides about amounts is decided here.
 */

/** One line of an entry, with its account already found. */
export interface LedgerLine {
  accountId: string;
  branchId: string;
  debit: Paisa;
  credit: Paisa;
  description?: string | null;
  costCenterId?: string | null;
  partyType?: 'none' | 'family' | 'student' | 'staff' | 'vendor';
  partyId?: string | null;
}

/** What a caller may hand over: an amount on one side, the other left out. */
export interface LineAmounts {
  debit?: Paisa | undefined;
  credit?: Paisa | undefined;
}

/**
 * The two sides of a line as whole paisa, or undefined for a line of nothing, which is left out of
 * the entry. A line with an amount on both sides, a negative amount or a fraction of a paisa is a
 * mistake in the caller and is refused.
 */
export function sidesOf(line: LineAmounts): { debit: Paisa; credit: Paisa } | undefined {
  const debit = line.debit ?? 0;
  const credit = line.credit ?? 0;
  for (const amount of [debit, credit]) {
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw rule('An amount in a journal entry must be a whole number of paisa, zero or more');
  }
  if (debit > 0 && credit > 0)
    throw rule('A line of a journal entry is either a debit or a credit, not both');
  if (debit === 0 && credit === 0) return undefined;
  return { debit, credit };
}

export const totalDebit = (lines: readonly LineAmounts[]): Paisa =>
  sum(lines.map((line) => line.debit ?? 0));
export const totalCredit = (lines: readonly LineAmounts[]): Paisa =>
  sum(lines.map((line) => line.credit ?? 0));

/** R-acct-1: debits equal credits. The message carries the difference, which is what a person needs to find. */
export function assertBalanced(lines: readonly LineAmounts[]): void {
  if (lines.length < 2) throw rule('A journal entry needs at least one debit and one credit');
  const debit = totalDebit(lines);
  const credit = totalCredit(lines);
  if (debit === 0) throw rule('A journal entry needs at least one debit and one credit');
  if (debit !== credit) {
    const difference = debit > credit ? debit - credit : credit - debit;
    throw rule(
      `The entry does not balance: debits are ${formatRs(debit)} and credits ${formatRs(credit)}, a difference of ${formatRs(difference)}`,
    );
  }
}

/** For each branch, debits less credits. A branch that balances is left out. */
export function branchDifferences(lines: readonly LedgerLine[]): Map<string, Paisa> {
  const net = new Map<string, Paisa>();
  for (const line of lines)
    net.set(line.branchId, (net.get(line.branchId) ?? 0) + line.debit - line.credit);
  for (const [branchId, difference] of net) if (difference === 0) net.delete(branchId);
  return net;
}

/**
 * R-acct-2: every branch balances on its own. When an entry spans branches (head office pays a
 * campus's bill), each branch that is out is brought level with a line on its inter-branch account:
 * the branch that received value owes it (a credit), the branch that gave it is owed (a debit).
 * The added lines net to zero across the group, so an entry that balanced still does.
 */
export function withInterBranchLines(
  lines: readonly LedgerLine[],
  interBranchAccountOf: (branchId: string) => string,
): LedgerLine[] {
  const added: LedgerLine[] = [];
  for (const [branchId, difference] of branchDifferences(lines)) {
    added.push({
      accountId: interBranchAccountOf(branchId),
      branchId,
      debit: difference < 0 ? -difference : 0,
      credit: difference > 0 ? difference : 0,
      description: 'Inter-branch balance',
    });
  }
  return [...lines, ...added];
}

/** A reversal is the same entry with debits and credits exchanged. */
export function reversalOf<T extends { debit: Paisa; credit: Paisa }>(lines: readonly T[]): T[] {
  return lines.map((line) => ({ ...line, debit: line.credit, credit: line.debit }));
}

/**
 * The part of an entry number that names the fiscal year: `2627` for July 2026 to June 2027,
 * `2026` for a year that runs January to December.
 */
export function fiscalYearLabel(startsOn: string, endsOn: string): string {
  const start = startsOn.slice(0, 4);
  const end = endsOn.slice(0, 4);
  return start === end ? start : `${start.slice(2)}${end.slice(2)}`;
}

import type {
  AccountMappingKey,
  JournalCode,
  JournalPurpose,
  JournalSourceType,
} from '@takhti/contracts';
import { stampOf, type Ctx } from '../../kernel/context';
import { notFound, rule } from '../../kernel/errors';
import type { Paisa } from '../../kernel/money';
import { nextNumber } from '../../kernel/sequences';
import {
  ledgerDb,
  type AccountRow,
  type JournalEntryRow,
  type JournalLineRow,
} from './ledger.db-service';
import {
  assertBalanced,
  fiscalYearLabel,
  reversalOf,
  sidesOf,
  totalDebit,
  withInterBranchLines,
  type LedgerLine,
} from './ledger.rules';

/*
 * The posting service of the general ledger: docs/plan/10-modules/m23-accounting.md, section 4.
 *
 * Every module that moves money calls it, and none writes the journal tables itself:
 *
 *   await ledger.post(ctx, {
 *     journal: 'FEE', date, branchId, memo: 'Receipt R-2610-00042',
 *     source: { type: 'fee_payment', id: payment.id },
 *     lines: [
 *       { account: { key: 'cash.counter' }, branchId, debit: amount },
 *       { account: { key: 'fees.receivable' }, branchId, credit: amount, party: { type: 'family', id } },
 *     ],
 *   });
 *
 * It runs in the caller's transaction: the payment and its entry are saved together or not at all.
 * A refusal here (a closed period, a missing mapping) therefore refuses the whole operation.
 */

/** An account named by what it is for (`fees.receivable`), or directly: a bank's account, a fee head's income account. */
export type LedgerAccount = { key: AccountMappingKey } | { id: string };

export interface LedgerLineInput {
  account: LedgerAccount;
  /** The branch the amount belongs to. */
  branchId: string;
  /** Whole paisa. Give one side; a line of nothing is left out. */
  debit?: Paisa;
  credit?: Paisa;
  description?: string;
  costCenterId?: string;
  /** Whose balance the line changes: a family's dues, a vendor's bill. */
  party?: { type: 'family' | 'student' | 'staff' | 'vendor'; id: string };
}

export interface LedgerSource {
  /** `manual` for an entry a person keyed in; otherwise the kind of record that caused it. */
  type: JournalSourceType;
  /** That record's id. Each source posts once: a second call returns the first entry. */
  id?: string;
}

export interface LedgerPost {
  journal: JournalCode;
  /** The date of the entry. It must fall in an open period. */
  date: string;
  /** The branch that raised it. */
  branchId?: string;
  memo: string;
  source: LedgerSource;
  lines: readonly LedgerLineInput[];
}

export interface LedgerReversal {
  /** The date of the reversing entry. It must fall in an open period. */
  date: string;
  reason: string;
}

const describeAccount = (account: AccountRow) => `${account.code} ${account.name}`;

/** R-acct-4: the date falls in an open period of an open fiscal year. */
async function openPeriodOn(ctx: Ctx, date: string) {
  const found = await ledgerDb.periodOn(ctx, date);
  if (!found)
    throw rule(
      `No fiscal year covers ${date}. Create the fiscal year under Finance, Periods, then try again.`,
    );
  if (found.period.status !== 'open')
    throw rule(`${found.period.name} is closed, so nothing can be posted on ${date}`);
  if (found.year.status !== 'open')
    throw rule(`${found.year.name} is closed, so nothing can be posted on ${date}`);
  return found;
}

/** R-acct-12: the account each key stands for, the branch's own choice first. A key with none stops the posting, by name. */
async function resolveKeys(ctx: Ctx, wanted: readonly { key: string; branchId: string }[]) {
  const mappings = await ledgerDb.mappingsOf(ctx, [...new Set(wanted.map((item) => item.key))]);
  return (key: string, branchId: string): string => {
    const forKey = mappings.filter((mapping) => mapping.key === key);
    const chosen =
      forKey.find((mapping) => mapping.branchId === branchId) ??
      forKey.find((mapping) => mapping.branchId === null);
    if (!chosen)
      throw rule(
        `No account is set for \`${key}\`. Choose one under Finance, Account mappings, then try again.`,
      );
    return chosen.accountId;
  };
}

/** R-acct-5: postings go to active accounts that are not groups; a control account takes them only from the system. */
async function assertPostable(
  ctx: Ctx,
  lines: readonly LedgerLine[],
  byHand: boolean,
): Promise<void> {
  const found = await ledgerDb.accountsById(
    ctx,
    lines.map((line) => line.accountId),
  );
  for (const line of lines) {
    const account = found.get(line.accountId);
    if (!account) throw rule('An account of this entry does not exist any more');
    if (account.isGroup)
      throw rule(
        `${describeAccount(account)} is a group of accounts. Post to one of the accounts under it.`,
      );
    if (!account.isActive)
      throw rule(`${describeAccount(account)} is inactive, so nothing can be posted to it`);
    if (byHand && account.isControl)
      throw rule(
        `${describeAccount(account)} is kept by the system and cannot be posted to by hand`,
      );
  }
}

interface NewEntry {
  journal: { id: string; code: string };
  date: string;
  branchId: string | null;
  memo: string;
  sourceType: string;
  sourceId: string | null;
  purpose: JournalPurpose;
  reversesEntryId?: string;
  lines: readonly LedgerLine[];
}

/** Numbers and writes a posted entry with its lines. Everything has been checked by now. */
async function write(ctx: Ctx, entry: NewEntry): Promise<JournalEntryRow> {
  const { period, year } = await openPeriodOn(ctx, entry.date);
  const label = fiscalYearLabel(year.startsOn, year.endsOn);
  const entryNo = await nextNumber(ctx, `journal_entry.${entry.journal.code}`, {
    period: label,
    format: '{journal}-{fy}-{000000}',
    values: { journal: entry.journal.code, fy: label },
  });
  const row = await ledgerDb.entries.insert(ctx, {
    entryNo,
    journalId: entry.journal.id,
    branchId: entry.branchId,
    entryDate: entry.date,
    fiscalPeriodId: period.id,
    memo: entry.memo,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    purpose: entry.purpose,
    status: 'posted',
    total: totalDebit(entry.lines),
    reversesEntryId: entry.reversesEntryId ?? null,
    postedAt: ctx.now,
    postedBy: stampOf(ctx),
  });
  await ledgerDb.lines.insertMany(
    ctx,
    entry.lines.map((line, index) => ({
      entryId: row.id,
      lineNo: index + 1,
      accountId: line.accountId,
      branchId: line.branchId,
      debit: line.debit,
      credit: line.credit,
      description: line.description ?? null,
      costCenterId: line.costCenterId ?? null,
      partyType: line.partyType ?? 'none',
      partyId: line.partyId ?? null,
      entryDate: entry.date,
      isPosted: true,
    })),
  );
  return row;
}

/**
 * Posts one balanced entry. With a source id it is safe to call twice: the second call returns the
 * entry the first one made (R-acct-8).
 */
async function post(ctx: Ctx, input: LedgerPost): Promise<JournalEntryRow> {
  const { source } = input;
  if (source.id) {
    await ledgerDb.lockSource(ctx, source.type, source.id);
    const existing = await ledgerDb.entryBySource(ctx, source.type, source.id, 'post');
    if (existing) return existing;
  }

  const journal = await ledgerDb.journalByCode(ctx, input.journal);
  if (!journal) throw rule(`This school has no ${input.journal} journal`);

  // Lines of nothing are left out before anything is looked up.
  const given = input.lines.flatMap((line) => {
    const sides = sidesOf(line);
    return sides ? [{ ...line, ...sides }] : [];
  });
  const accountOf = await resolveKeys(ctx, [
    ...given.flatMap((line) =>
      'key' in line.account ? [{ key: line.account.key, branchId: line.branchId }] : [],
    ),
    // Asked for whether or not it turns out to be needed: one query answers for every key.
    ...given.map((line) => ({ key: 'interbranch.due', branchId: line.branchId })),
  ]);
  const found: LedgerLine[] = given.map((line) => ({
    accountId:
      'key' in line.account ? accountOf(line.account.key, line.branchId) : line.account.id,
    branchId: line.branchId,
    debit: line.debit,
    credit: line.credit,
    description: line.description ?? null,
    costCenterId: line.costCenterId ?? null,
    partyType: line.party?.type ?? 'none',
    partyId: line.party?.id ?? null,
  }));

  assertBalanced(found);
  const lines = withInterBranchLines(found, (branchId) => accountOf('interbranch.due', branchId));
  // A person keying an entry may not touch a control account; the inter-branch lines the service
  // adds for them are the system's own.
  await assertPostable(ctx, found, source.type === 'manual');
  await assertPostable(ctx, lines.slice(found.length), false);

  return write(ctx, {
    journal,
    date: input.date,
    branchId: input.branchId ?? null,
    memo: input.memo,
    sourceType: source.type,
    sourceId: source.id ?? null,
    purpose: 'post',
    lines,
  });
}

/** Reverses one entry: the same lines with debits and credits exchanged, dated in an open period. */
async function reverseRow(
  ctx: Ctx,
  original: JournalEntryRow,
  input: LedgerReversal,
): Promise<JournalEntryRow> {
  if (original.status === 'reversed' && original.reversedByEntryId)
    return ledgerDb.entries.get(ctx, original.reversedByEntryId);
  if (original.status !== 'posted') throw rule('Only a posted entry can be reversed');
  // R-acct-3: a correction is a reversal and then a new entry, never a reversal of a reversal.
  if (original.purpose === 'reverse')
    throw rule('A reversing entry cannot itself be reversed. Post a new entry instead.');

  const journal = await ledgerDb.journalById(ctx, original.journalId);
  if (!journal) throw notFound('Journal');
  const lines: LedgerLine[] = reversalOf(await ledgerDb.linesOf(ctx, original.id)).map(
    (line: JournalLineRow) => ({
      accountId: line.accountId,
      branchId: line.branchId,
      debit: line.debit,
      credit: line.credit,
      description: line.description,
      costCenterId: line.costCenterId,
      partyType: line.partyType,
      partyId: line.partyId,
    }),
  );
  // The accounts must still take postings; who posted the original is not asked again.
  await assertPostable(ctx, lines, false);

  const reversal = await write(ctx, {
    journal,
    date: input.date,
    branchId: original.branchId,
    memo: `Reversal of ${original.entryNo}: ${input.reason}`,
    sourceType: original.sourceType,
    sourceId: original.sourceId,
    purpose: 'reverse',
    reversesEntryId: original.id,
    lines,
  });
  await ledgerDb.entries.update(ctx, original.id, {
    status: 'reversed',
    reversedByEntryId: reversal.id,
  });
  return reversal;
}

/** Reverses what a source posted. Safe to call twice: the second call returns the first reversal. */
async function reverse(
  ctx: Ctx,
  input: LedgerReversal & { source: Required<LedgerSource> },
): Promise<JournalEntryRow> {
  const { source } = input;
  await ledgerDb.lockSource(ctx, source.type, source.id);
  const original = await ledgerDb.entryBySource(ctx, source.type, source.id, 'post');
  if (!original) throw rule('Nothing was posted for this record, so there is nothing to reverse');
  return reverseRow(ctx, original, input);
}

/** Reverses an entry by its id: for a manual entry, which has no source. */
async function reverseEntry(
  ctx: Ctx,
  entryId: string,
  input: LedgerReversal,
): Promise<JournalEntryRow> {
  return reverseRow(ctx, await ledgerDb.entries.lock(ctx, entryId), input);
}

export const ledger = {
  post,
  reverse,
  reverseEntry,
  /**
   * Refuses a date that falls in a closed period, naming the period. `post` checks this itself; a
   * service calls it first when it would rather say no before doing any of its own work.
   */
  assertOpen: async (ctx: Ctx, date: string): Promise<void> => {
    await openPeriodOn(ctx, date);
  },
  /** The lines of an entry, in order. */
  linesOf: (ctx: Ctx, entryId: string): Promise<JournalLineRow[]> =>
    ledgerDb.linesOf(ctx, entryId),
};

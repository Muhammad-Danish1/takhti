import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accountMappingKeys, systemJournals } from '@takhti/contracts';
import { ledger, type Actor, type LedgerPost } from '@takhti/core';
import {
  accountMappings,
  accounts,
  adminDb,
  defaultChart,
  fiscalPeriods,
  fiscalYears,
  journalEntries,
  journalLines,
  journals,
  withAdminTx,
} from '@takhti/db';
import { createTestDb, testEngine, type TestDb } from '../../helpers/test-db';
import { as, expectError, seedOrg, TEST_NOW, type TestOrg } from '../../helpers/world';

/*
 * The posting service every money module is built on.
 * Rules, failure cases and tests: docs/plan/10-modules/m23-accounting.md.
 */

let db: TestDb;
let school: TestOrg;
let accountant: Actor;
let cashier: Actor;

const DATE = '2026-10-12';
const Rs = (rupees: number) => rupees * 100;

async function accountId(org: TestOrg, code: string): Promise<string> {
  const [row] = await adminDb()
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.orgId, org.orgId), eq(accounts.code, code)));
  if (!row) throw new Error(`No account ${code}`);
  return row.id;
}

/** A fee receipt at Main Campus: cash in, the family's dues down. */
const receipt = (org: TestOrg, amount: number, sourceId: string = randomUUID()): LedgerPost => ({
  journal: 'FEE',
  date: DATE,
  branchId: org.mainBranchId,
  memo: 'Fee receipt',
  source: { type: 'fee_payment', id: sourceId },
  lines: [
    { account: { key: 'cash.counter' }, branchId: org.mainBranchId, debit: amount },
    { account: { key: 'fees.receivable' }, branchId: org.mainBranchId, credit: amount },
  ],
});

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  accountant = await school.actor('accountant', { branch: 'both' });
  cashier = await school.actor('cashier');
});
afterAll(async () => {
  await db.destroy();
});

describe('what a new school starts with', () => {
  it('a chart of accounts, the journals, an account for every mapping key and an open fiscal year', async () => {
    const chart = await adminDb().select().from(accounts).where(eq(accounts.orgId, school.orgId));
    expect(chart).toHaveLength(defaultChart.length);
    expect(chart.length).toBeGreaterThan(110);
    // A group takes no postings, so nothing is mapped to one; every child is of its parent's type.
    const byId = new Map(chart.map((account) => [account.id, account]));
    for (const account of chart) {
      if (account.parentId) {
        expect(byId.get(account.parentId)?.isGroup, account.code).toBe(true);
        expect(byId.get(account.parentId)?.type, account.code).toBe(account.type);
      }
    }

    const mapped = await adminDb()
      .select()
      .from(accountMappings)
      .where(eq(accountMappings.orgId, school.orgId));
    expect(mapped.map((mapping) => mapping.key).sort()).toEqual([...accountMappingKeys].sort());
    for (const mapping of mapped) expect(byId.get(mapping.accountId)?.isGroup).toBe(false);

    const held = await adminDb().select().from(journals).where(eq(journals.orgId, school.orgId));
    expect(held.map((journal) => journal.code).sort()).toEqual(
      systemJournals.map((journal) => journal.code).sort(),
    );

    const [year] = await adminDb()
      .select()
      .from(fiscalYears)
      .where(eq(fiscalYears.orgId, school.orgId));
    expect(year).toMatchObject({
      name: 'FY 2026–27',
      startsOn: '2026-07-01',
      endsOn: '2027-06-30',
      status: 'open',
    });
    const periods = await adminDb()
      .select()
      .from(fiscalPeriods)
      .where(eq(fiscalPeriods.orgId, school.orgId));
    expect(periods).toHaveLength(12);
    expect(periods.find((period) => period.periodNo === 8)).toMatchObject({
      name: 'February 2027',
      startsOn: '2027-02-01',
      endsOn: '2027-02-28',
      status: 'open',
    });
    expect(TEST_NOW.startsWith('2026-10')).toBe(true);
  });

  it('a second school gets its own, so two schools never share or clash on a mapping', async () => {
    const other = await seedOrg();
    expect(await accountId(other, '1110')).not.toBe(await accountId(school, '1110'));
  });
});

describe('ledger.post', () => {
  it('writes a posted, numbered entry with its lines, in the period of its date', async () => {
    const entry = await as(cashier, (ctx) => ledger.post(ctx, receipt(school, Rs(8500))));
    expect(entry).toMatchObject({
      status: 'posted',
      purpose: 'post',
      total: Rs(8500),
      entryDate: DATE,
      sourceType: 'fee_payment',
      branchId: school.mainBranchId,
      postedBy: cashier.userId,
    });
    expect(entry.entryNo).toMatch(/^FEE-2627-\d{6}$/);

    const lines = await as(cashier, (ctx) => ledger.linesOf(ctx, entry.id));
    expect(lines.map((line) => [line.lineNo, line.debit, line.credit, line.isPosted])).toEqual([
      [1, Rs(8500), 0, true],
      [2, 0, Rs(8500), true],
    ]);
    expect(lines[0]?.accountId).toBe(await accountId(school, '1110'));
    expect(lines[1]?.accountId).toBe(await accountId(school, '1210'));
    expect(lines.every((line) => line.entryDate === DATE)).toBe(true);

    const [period] = await adminDb()
      .select()
      .from(fiscalPeriods)
      .where(eq(fiscalPeriods.id, entry.fiscalPeriodId));
    expect(period?.name).toBe('October 2026');
  });

  it('numbers run one after another within a journal, and each journal has its own run', async () => {
    const numbers = await as(cashier, async (ctx) => {
      const first = await ledger.post(ctx, receipt(school, Rs(100)));
      const second = await ledger.post(ctx, receipt(school, Rs(200)));
      const other = await ledger.post(ctx, { ...receipt(school, Rs(300)), journal: 'CASH' });
      return [first.entryNo, second.entryNo, other.entryNo];
    });
    const counter = (entryNo: string | undefined) => Number(entryNo?.split('-')[2]);
    expect(counter(numbers[1])).toBe(counter(numbers[0]) + 1);
    expect(numbers[2]).toBe('CASH-2627-000001');
  });

  it('a line of nothing is left out, and the party a line names is kept', async () => {
    const familyId = randomUUID();
    const entry = await as(cashier, (ctx) =>
      ledger.post(ctx, {
        ...receipt(school, Rs(500)),
        lines: [
          { account: { key: 'cash.counter' }, branchId: school.mainBranchId, debit: Rs(500) },
          { account: { key: 'fees.discounts' }, branchId: school.mainBranchId, debit: 0 },
          {
            account: { key: 'fees.receivable' },
            branchId: school.mainBranchId,
            credit: Rs(500),
            party: { type: 'family', id: familyId },
          },
        ],
      }),
    );
    const lines = await as(cashier, (ctx) => ledger.linesOf(ctx, entry.id));
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ partyType: 'family', partyId: familyId });
  });

  it('R-acct-1 an entry that does not balance is refused, with the difference', async () => {
    const error = await expectError('RULE', () =>
      as(cashier, (ctx) =>
        ledger.post(ctx, {
          ...receipt(school, Rs(100)),
          lines: [
            { account: { key: 'cash.counter' }, branchId: school.mainBranchId, debit: Rs(100) },
            { account: { key: 'fees.receivable' }, branchId: school.mainBranchId, credit: Rs(99) },
          ],
        }),
      ),
    );
    expect(error.message).toContain('a difference of Rs 1');
  });

  it('R-acct-8 / T-acct-3 / F-acct-5 the same source posted twice returns the first entry and writes nothing more', async () => {
    const sourceId = randomUUID();
    const [first, second] = await as(cashier, async (ctx) => [
      await ledger.post(ctx, receipt(school, Rs(4000), sourceId)),
      await ledger.post(ctx, receipt(school, Rs(4000), sourceId)),
    ]);
    expect(second?.id).toBe(first?.id);
    // A retry in a later request, as a retried job makes it.
    const third = await as(cashier, (ctx) => ledger.post(ctx, receipt(school, Rs(4000), sourceId)));
    expect(third.id).toBe(first?.id);
    const stored = await adminDb()
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.sourceId, sourceId));
    expect(stored).toHaveLength(1);
  });

  it('T-acct-3 many requests posting one source at the same moment make one entry', async () => {
    const sourceId = randomUUID();
    const results = await Promise.all(
      Array.from({ length: testEngine() === 'postgres' ? 20 : 3 }, () =>
        as(cashier, (ctx) => ledger.post(ctx, receipt(school, Rs(750), sourceId))),
      ),
    );
    expect(new Set(results.map((entry) => entry.id)).size).toBe(1);
    const stored = await adminDb()
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.sourceId, sourceId));
    expect(stored).toHaveLength(1);
  });

  it('a branch that maps a key to its own account is posted there; the others use the group account', async () => {
    const own = randomUUID();
    // Looked up first: the in-process database is one session, and a query outside the
    // transaction below would wait for it for ever.
    const cashGroup = await accountId(school, '1100');
    await withAdminTx(async (tx) => {
      await tx.insert(accounts).values({
        id: own,
        orgId: school.orgId,
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
        code: '1115',
        name: 'Cash in hand: City Campus counter',
        type: 'asset',
        subtype: 'cash',
        parentId: cashGroup,
      });
      await tx.insert(accountMappings).values({
        id: randomUUID(),
        orgId: school.orgId,
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
        key: 'cash.counter',
        branchId: school.cityBranchId,
        accountId: own,
      });
    });
    const post = (branchId: string) =>
      as(accountant, async (ctx) => {
        const entry = await ledger.post(ctx, {
          ...receipt(school, Rs(100)),
          branchId,
          lines: [
            { account: { key: 'cash.counter' }, branchId, debit: Rs(100) },
            { account: { key: 'fees.receivable' }, branchId, credit: Rs(100) },
          ],
        });
        return (await ledger.linesOf(ctx, entry.id))[0]?.accountId;
      });
    expect(await post(school.cityBranchId)).toBe(own);
    expect(await post(school.mainBranchId)).toBe(await accountId(school, '1110'));
  });
});

describe('T-acct-2 what ledger.post refuses', () => {
  let other: TestOrg;
  let clerk: Actor;
  beforeAll(async () => {
    other = await seedOrg();
    clerk = await other.actor('accountant');
  });

  const setAccount = (code: string, change: { isActive?: boolean }) =>
    adminDb()
      .update(accounts)
      .set(change)
      .where(and(eq(accounts.orgId, other.orgId), eq(accounts.code, code)));

  it('R-acct-4 / F-acct-1 a date in a closed period, naming the period, and nothing is written', async () => {
    await adminDb()
      .update(fiscalPeriods)
      .set({ status: 'closed' })
      .where(and(eq(fiscalPeriods.orgId, other.orgId), eq(fiscalPeriods.name, 'August 2026')));
    const error = await expectError('RULE', () =>
      as(clerk, (ctx) => ledger.post(ctx, { ...receipt(other, Rs(100)), date: '2026-08-20' })),
    );
    expect(error.message).toBe('August 2026 is closed, so nothing can be posted on 2026-08-20');
    await expectError('RULE', () => as(clerk, (ctx) => ledger.assertOpen(ctx, '2026-08-20')));
    await as(clerk, (ctx) => ledger.assertOpen(ctx, '2026-09-01'));
    expect(
      await adminDb().select().from(journalEntries).where(eq(journalEntries.orgId, other.orgId)),
    ).toHaveLength(0);
  });

  it('R-acct-4 a date no fiscal year covers', async () => {
    const error = await expectError('RULE', () =>
      as(clerk, (ctx) => ledger.post(ctx, { ...receipt(other, Rs(100)), date: '2028-01-05' })),
    );
    expect(error.message).toContain('No fiscal year covers 2028-01-05');
  });

  it('R-acct-5 an inactive account', async () => {
    await setAccount('1110', { isActive: false });
    const error = await expectError('RULE', () =>
      as(clerk, (ctx) => ledger.post(ctx, receipt(other, Rs(100)))),
    );
    expect(error.message).toBe(
      '1110 Cash in hand: fee counter is inactive, so nothing can be posted to it',
    );
    await setAccount('1110', { isActive: true });
  });

  it('R-acct-5 a group account', async () => {
    const group = await accountId(other, '1100');
    const error = await expectError('RULE', () =>
      as(clerk, (ctx) =>
        ledger.post(ctx, {
          ...receipt(other, Rs(100)),
          lines: [
            { account: { id: group }, branchId: other.mainBranchId, debit: Rs(100) },
            { account: { key: 'fees.receivable' }, branchId: other.mainBranchId, credit: Rs(100) },
          ],
        }),
      ),
    );
    expect(error.message).toContain('1100 Cash and bank is a group of accounts');
  });

  it('R-acct-5 / F-acct-4 a control account, from an entry keyed in by hand; the system may post to it', async () => {
    const lines = [
      { account: { key: 'cash.counter' as const }, branchId: other.mainBranchId, debit: Rs(100) },
      {
        account: { key: 'fees.receivable' as const },
        branchId: other.mainBranchId,
        credit: Rs(100),
      },
    ];
    const error = await expectError('RULE', () =>
      as(clerk, (ctx) =>
        ledger.post(ctx, {
          journal: 'GJ',
          date: DATE,
          memo: 'Adjustment',
          source: { type: 'manual' },
          lines,
        }),
      ),
    );
    expect(error.message).toBe(
      '1210 Fees receivable is kept by the system and cannot be posted to by hand',
    );
    const posted = await as(clerk, (ctx) => ledger.post(ctx, { ...receipt(other, Rs(100)), lines }));
    expect(posted.status).toBe('posted');
  });

  it('R-acct-12 / F-acct-2 a key with no account stops the posting, by name, and never falls back', async () => {
    await adminDb()
      .update(accountMappings)
      .set({ deletedAt: TEST_NOW })
      .where(
        and(
          eq(accountMappings.orgId, other.orgId),
          eq(accountMappings.key, 'payroll.eobi_payable'),
        ),
      );
    const error = await expectError('RULE', () =>
      as(clerk, (ctx) =>
        ledger.post(ctx, {
          journal: 'PAY',
          date: DATE,
          memo: 'Payroll for October',
          source: { type: 'payroll_run', id: randomUUID() },
          lines: [
            {
              account: { key: 'payroll.employer_contributions' },
              branchId: other.mainBranchId,
              debit: Rs(370),
            },
            {
              account: { key: 'payroll.eobi_payable' },
              branchId: other.mainBranchId,
              credit: Rs(370),
            },
          ],
        }),
      ),
    );
    expect(error.message).toContain('No account is set for `payroll.eobi_payable`');
  });
});

describe('R-acct-2 an entry across branches', () => {
  it('T-acct-5 / F-acct-8 head office pays a campus bill: inter-branch lines are added, each branch balances, and they net to zero', async () => {
    const electricity = await accountId(school, '5320');
    const entry = await as(accountant, (ctx) =>
      ledger.post(ctx, {
        journal: 'BANK',
        date: DATE,
        branchId: school.mainBranchId,
        memo: 'City Campus electricity, paid by head office',
        source: { type: 'expense', id: randomUUID() },
        lines: [
          { account: { id: electricity }, branchId: school.cityBranchId, debit: Rs(42000) },
          { account: { key: 'cash.petty' }, branchId: school.mainBranchId, credit: Rs(42000) },
        ],
      }),
    );
    const lines = await as(accountant, (ctx) => ledger.linesOf(ctx, entry.id));
    expect(lines).toHaveLength(4);
    expect(entry.total).toBe(Rs(84000));

    const due = await accountId(school, '1260');
    const added = lines.filter((line) => line.accountId === due);
    expect(added.map((line) => [line.branchId, line.debit, line.credit])).toEqual([
      [school.cityBranchId, 0, Rs(42000)],
      [school.mainBranchId, Rs(42000), 0],
    ]);
    expect(added.reduce((net, line) => net + line.debit - line.credit, 0)).toBe(0);
    for (const branchId of [school.mainBranchId, school.cityBranchId]) {
      const mine = lines.filter((line) => line.branchId === branchId);
      expect(mine.reduce((net, line) => net + line.debit - line.credit, 0)).toBe(0);
    }
  });
});

describe('ledger.reverse', () => {
  it('T-acct-4 exchanges debits and credits, links both entries and marks the first reversed', async () => {
    const sourceId = randomUUID();
    const { original, reversal, lines } = await as(cashier, async (ctx) => {
      const posted = await ledger.post(ctx, receipt(school, Rs(6200), sourceId));
      const undone = await ledger.reverse(ctx, {
        source: { type: 'fee_payment', id: sourceId },
        date: '2026-10-13',
        reason: 'Cheque returned',
      });
      return { original: posted, reversal: undone, lines: await ledger.linesOf(ctx, undone.id) };
    });
    expect(reversal).toMatchObject({
      status: 'posted',
      purpose: 'reverse',
      reversesEntryId: original.id,
      sourceId,
      entryDate: '2026-10-13',
      total: Rs(6200),
      memo: `Reversal of ${original.entryNo}: Cheque returned`,
    });
    expect(lines.map((line) => [line.debit, line.credit])).toEqual([
      [0, Rs(6200)],
      [Rs(6200), 0],
    ]);
    const [stored] = await adminDb()
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, original.id));
    expect(stored).toMatchObject({ status: 'reversed', reversedByEntryId: reversal.id });

    // The two entries together leave every account where it was.
    const all = await adminDb()
      .select()
      .from(journalLines)
      .where(and(eq(journalLines.orgId, school.orgId), isNull(journalLines.deletedAt)));
    const mine = all.filter((line) => [original.id, reversal.id].includes(line.entryId));
    const net = new Map<string, number>();
    for (const line of mine)
      net.set(line.accountId, (net.get(line.accountId) ?? 0) + line.debit - line.credit);
    expect([...net.values()]).toEqual([0, 0]);
  });

  it('R-acct-8 reversing twice returns the first reversal; a reversal is never itself reversed', async () => {
    const sourceId = randomUUID();
    const reverse = { source: { type: 'fee_payment' as const, id: sourceId }, date: DATE, reason: 'Entered twice' };
    const [first, second] = await as(cashier, async (ctx) => {
      await ledger.post(ctx, receipt(school, Rs(900), sourceId));
      return [await ledger.reverse(ctx, reverse), await ledger.reverse(ctx, reverse)];
    });
    expect(second?.id).toBe(first?.id);
    const error = await expectError('RULE', () =>
      as(cashier, (ctx) => ledger.reverseEntry(ctx, first!.id, { date: DATE, reason: 'Again' })),
    );
    expect(error.message).toContain('cannot itself be reversed');
  });

  it('R-acct-4 a reversal dated in a closed period is refused, and the original stays posted', async () => {
    const other = await seedOrg();
    const clerk = await other.actor('accountant');
    const sourceId = randomUUID();
    const original = await as(clerk, (ctx) => ledger.post(ctx, receipt(other, Rs(300), sourceId)));
    await adminDb()
      .update(fiscalPeriods)
      .set({ status: 'closed' })
      .where(and(eq(fiscalPeriods.orgId, other.orgId), eq(fiscalPeriods.name, 'October 2026')));
    await expectError('RULE', () =>
      as(clerk, (ctx) =>
        ledger.reverse(ctx, {
          source: { type: 'fee_payment', id: sourceId },
          date: DATE,
          reason: 'Wrong family',
        }),
      ),
    );
    const [stored] = await adminDb()
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, original.id));
    expect(stored?.status).toBe('posted');
  });

  it('there is nothing to reverse for a source that never posted', async () => {
    await expectError('RULE', () =>
      as(cashier, (ctx) =>
        ledger.reverse(ctx, {
          source: { type: 'fee_payment', id: randomUUID() },
          date: DATE,
          reason: 'x',
        }),
      ),
    );
  });

  it('a manual entry, which has no source, is reversed by its id', async () => {
    const rent = await accountId(school, '5310');
    const reversal = await as(accountant, async (ctx) => {
      const entry = await ledger.post(ctx, {
        journal: 'GJ',
        date: DATE,
        branchId: school.mainBranchId,
        memo: 'Rent for October',
        source: { type: 'manual' },
        lines: [
          { account: { id: rent }, branchId: school.mainBranchId, debit: Rs(150000) },
          { account: { key: 'cash.petty' }, branchId: school.mainBranchId, credit: Rs(150000) },
        ],
      });
      return ledger.reverseEntry(ctx, entry.id, { date: DATE, reason: 'Posted to the wrong month' });
    });
    expect(reversal).toMatchObject({ purpose: 'reverse', sourceType: 'manual', sourceId: null });
  });
});

describe('T-acct-1 what the database itself refuses', () => {
  const stamps = () => ({ createdAt: TEST_NOW, updatedAt: TEST_NOW });

  /** Writes a posted entry with the given lines straight into the tables, as no service ever would. */
  async function writeDirectly(lines: { branchId: string; debit: number; credit: number }[]) {
    const [journal] = await adminDb()
      .select()
      .from(journals)
      .where(and(eq(journals.orgId, school.orgId), eq(journals.code, 'GJ')));
    const [period] = await adminDb()
      .select()
      .from(fiscalPeriods)
      .where(and(eq(fiscalPeriods.orgId, school.orgId), eq(fiscalPeriods.name, 'October 2026')));
    const cash = await accountId(school, '1120');
    const entryId = randomUUID();
    await withAdminTx(async (tx) => {
      await tx.insert(journalEntries).values({
        id: entryId,
        orgId: school.orgId,
        ...stamps(),
        entryNo: `GJ-TEST-${entryId.slice(0, 8)}`,
        journalId: journal!.id,
        entryDate: DATE,
        fiscalPeriodId: period!.id,
        memo: 'Written directly',
        sourceType: 'manual',
        status: 'posted',
        total: 0,
      });
      await tx.insert(journalLines).values(
        lines.map((line, index) => ({
          id: randomUUID(),
          orgId: school.orgId,
          ...stamps(),
          entryId,
          lineNo: index + 1,
          accountId: cash,
          entryDate: DATE,
          isPosted: true,
          ...line,
        })),
      );
    });
    return entryId;
  }

  it('R-acct-1 a posted entry whose debits and credits differ', async () => {
    await expect(
      writeDirectly([
        { branchId: school.mainBranchId, debit: 1000, credit: 0 },
        { branchId: school.mainBranchId, debit: 0, credit: 900 },
      ]),
    ).rejects.toThrow();
  });

  it('R-acct-2 a posted entry that balances in total but not within each branch', async () => {
    await expect(
      writeDirectly([
        { branchId: school.mainBranchId, debit: 1000, credit: 0 },
        { branchId: school.cityBranchId, debit: 0, credit: 1000 },
      ]),
    ).rejects.toThrow();
  });

  it('R-acct-3 a posted line is a permanent record: it can be neither changed nor removed', async () => {
    const entryId = await writeDirectly([
      { branchId: school.mainBranchId, debit: 1000, credit: 0 },
      { branchId: school.mainBranchId, debit: 0, credit: 1000 },
    ]);
    await expect(
      adminDb().update(journalLines).set({ debit: 5 }).where(eq(journalLines.entryId, entryId)),
    ).rejects.toThrow();
    await expect(
      adminDb().delete(journalLines).where(eq(journalLines.entryId, entryId)),
    ).rejects.toThrow();
  });
});

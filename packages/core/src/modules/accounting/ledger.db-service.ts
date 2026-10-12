import { and, asc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { ListParams } from '@takhti/contracts';
import {
  accountMappings,
  accounts,
  fiscalPeriods,
  fiscalYears,
  journalEntries,
  journalLines,
  journals,
} from '@takhti/db';
import type { Ctx } from '../../kernel/context';
import { createDbService, type RowOf } from '../../kernel/db-service';

/* Layer 3 for the general ledger: what `ledger.ts` reads and writes. No rule lives here. */

export type JournalEntryRow = RowOf<typeof journalEntries>;
export type JournalLineRow = RowOf<typeof journalLines>;
export type AccountRow = RowOf<typeof accounts>;
export type FiscalPeriodRow = RowOf<typeof fiscalPeriods>;
export type FiscalYearRow = RowOf<typeof fiscalYears>;

const journalLinesDb = createDbService<typeof journalLines, ListParams>(journalLines, {
  label: 'Journal line',
  sort: { createdAt: journalLines.createdAt },
});
const entriesDb = createDbService<typeof journalEntries, ListParams>(journalEntries, {
  label: 'Journal entry',
  sort: { createdAt: journalEntries.createdAt },
});

export const ledgerDb = {
  entries: entriesDb,
  lines: journalLinesDb,

  /**
   * Makes every posting for one source wait its turn until this transaction ends, so "is it posted
   * already?" and the posting that follows cannot be interleaved by a second request.
   */
  async lockSource(ctx: Ctx, sourceType: string, sourceId: string): Promise<void> {
    await ctx.db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`ledger:${ctx.actor.orgId}:${sourceType}:${sourceId}`}, 0))`,
    );
  },

  entryBySource(
    ctx: Ctx,
    sourceType: string,
    sourceId: string,
    purpose: string,
  ): Promise<JournalEntryRow | undefined> {
    return entriesDb.findBy(
      ctx,
      and(
        eq(journalEntries.sourceType, sourceType),
        eq(journalEntries.sourceId, sourceId),
        eq(journalEntries.purpose, purpose),
      ),
    );
  },

  async journalByCode(ctx: Ctx, code: string): Promise<{ id: string; code: string } | undefined> {
    const [row] = await ctx.db
      .select({ id: journals.id, code: journals.code })
      .from(journals)
      .where(and(eq(journals.code, code), isNull(journals.deletedAt)))
      .limit(1);
    return row;
  },

  async journalById(ctx: Ctx, id: string): Promise<{ id: string; code: string } | undefined> {
    const [row] = await ctx.db
      .select({ id: journals.id, code: journals.code })
      .from(journals)
      .where(eq(journals.id, id))
      .limit(1);
    return row;
  },

  /**
   * The period a date falls in, with its year. Both rows are held against change until the
   * transaction ends, so a period cannot be closed between this check and the posting it allows.
   */
  async periodOn(
    ctx: Ctx,
    date: string,
  ): Promise<{ period: FiscalPeriodRow; year: FiscalYearRow } | undefined> {
    const [row] = await ctx.db
      .select({ period: fiscalPeriods, year: fiscalYears })
      .from(fiscalPeriods)
      .innerJoin(fiscalYears, eq(fiscalYears.id, fiscalPeriods.fiscalYearId))
      .where(
        and(
          lte(fiscalPeriods.startsOn, date),
          gte(fiscalPeriods.endsOn, date),
          isNull(fiscalPeriods.deletedAt),
          isNull(fiscalYears.deletedAt),
        ),
      )
      .limit(1)
      .for('share');
    return row as { period: FiscalPeriodRow; year: FiscalYearRow } | undefined;
  },

  /** Every mapping of the given keys: the group's own and each branch's override. */
  async mappingsOf(
    ctx: Ctx,
    keys: readonly string[],
  ): Promise<{ key: string; branchId: string | null; accountId: string }[]> {
    if (keys.length === 0) return [];
    return ctx.db
      .select({
        key: accountMappings.key,
        branchId: accountMappings.branchId,
        accountId: accountMappings.accountId,
      })
      .from(accountMappings)
      .where(and(inArray(accountMappings.key, [...keys]), isNull(accountMappings.deletedAt)));
  },

  async accountsById(ctx: Ctx, ids: readonly string[]): Promise<Map<string, AccountRow>> {
    if (ids.length === 0) return new Map();
    const rows = (await ctx.db
      .select()
      .from(accounts)
      .where(and(inArray(accounts.id, [...new Set(ids)]), isNull(accounts.deletedAt)))) as AccountRow[];
    return new Map(rows.map((row) => [row.id, row]));
  },

  async linesOf(ctx: Ctx, entryId: string): Promise<JournalLineRow[]> {
    const rows = await ctx.db
      .select()
      .from(journalLines)
      .where(and(eq(journalLines.entryId, entryId), isNull(journalLines.deletedAt)))
      .orderBy(asc(journalLines.lineNo));
    return rows as JournalLineRow[];
  },
};

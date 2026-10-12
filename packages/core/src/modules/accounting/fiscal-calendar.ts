import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { fiscalPeriods, fiscalYearContaining, fiscalYears, journalEntries } from '@takhti/db';
import { audit } from '../../kernel/audit';
import { stampOf, type Ctx } from '../../kernel/context';

/*
 * The school's fiscal calendar while it is still new: docs/plan/10-modules/m02-organisation-branches.md,
 * rule R-org-8, and docs/plan/10-modules/m23-accounting.md.
 *
 * A school is given its first fiscal year when it is created, from the month its profile names.
 * Until that year is used, the month may still be corrected, and the year is rebuilt around today.
 * Afterwards the calendar belongs to the books and changes only through year-end.
 */

async function onlyYear(ctx: Ctx) {
  const years = await ctx.db
    .select()
    .from(fiscalYears)
    .where(isNull(fiscalYears.deletedAt))
    .limit(2);
  return years.length === 1 ? years[0] : undefined;
}

export const fiscalCalendar = {
  /**
   * Whether the fiscal calendar is still as it was made: one year, open, with every period open
   * and no journal entry in it.
   */
  async untouched(ctx: Ctx): Promise<boolean> {
    const year = await onlyYear(ctx);
    if (!year || year.status !== 'open') return false;
    const periods = await ctx.db
      .select({ id: fiscalPeriods.id, status: fiscalPeriods.status })
      .from(fiscalPeriods)
      .where(and(eq(fiscalPeriods.fiscalYearId, year.id), isNull(fiscalPeriods.deletedAt)));
    if (periods.some((period) => period.status !== 'open')) return false;
    if (periods.length === 0) return true;
    const [entry] = await ctx.db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(
        inArray(
          journalEntries.fiscalPeriodId,
          periods.map((period) => period.id),
        ),
      )
      .limit(1);
    return entry === undefined;
  },

  /**
   * Moves the untouched first fiscal year so that it starts in the given month and contains today.
   * The caller has checked `untouched`.
   */
  async rebuild(ctx: Ctx, startMonth: number): Promise<void> {
    const year = await onlyYear(ctx);
    if (!year) return;
    const plan = fiscalYearContaining(ctx.today, startMonth);
    const stamp = { updatedAt: ctx.now, updatedBy: stampOf(ctx) };
    await ctx.db
      .update(fiscalYears)
      .set({
        name: plan.name,
        startsOn: plan.startsOn,
        endsOn: plan.endsOn,
        version: sql`${fiscalYears.version} + 1`,
        ...stamp,
      })
      .where(eq(fiscalYears.id, year.id));
    for (const period of plan.periods) {
      await ctx.db
        .update(fiscalPeriods)
        .set({
          name: period.name,
          startsOn: period.startsOn,
          endsOn: period.endsOn,
          version: sql`${fiscalPeriods.version} + 1`,
          ...stamp,
        })
        .where(
          and(
            eq(fiscalPeriods.fiscalYearId, year.id),
            eq(fiscalPeriods.periodNo, period.periodNo),
            isNull(fiscalPeriods.deletedAt),
          ),
        );
    }
    await audit(ctx, 'fiscal-years', 'update', year.id, {
      before: { name: year.name, startsOn: year.startsOn, endsOn: year.endsOn },
      after: { name: plan.name, startsOn: plan.startsOn, endsOn: plan.endsOn },
      summary: `Moved the fiscal year: it is now ${plan.name}`,
    });
  },
};

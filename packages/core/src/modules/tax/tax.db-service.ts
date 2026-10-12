import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { TaxRuleKind } from '@takhti/contracts';
import { taxRules } from '@takhti/db';
import type { Ctx } from '../../kernel/context';
import type { RowOf } from '../../kernel/db-service';

/* Layer 3 for what the tax calculators need: the rules in force. No rule of the module lives here. */

export type TaxRuleRow = RowOf<typeof taxRules>;

export const taxDb = {
  /** Every confirmed rule of a kind whose span of dates holds the given day, newest first. */
  async confirmedRulesOn(ctx: Ctx, kind: TaxRuleKind, date: string): Promise<TaxRuleRow[]> {
    const rows = await ctx.db
      .select()
      .from(taxRules)
      .where(
        and(
          eq(taxRules.kind, kind),
          eq(taxRules.status, 'confirmed'),
          lte(taxRules.effectiveFrom, date),
          or(isNull(taxRules.effectiveTo), gte(taxRules.effectiveTo, date)),
          isNull(taxRules.deletedAt),
        ),
      )
      .orderBy(desc(taxRules.effectiveFrom));
    return rows as TaxRuleRow[];
  },
};

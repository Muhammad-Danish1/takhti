import { and, count, eq, ilike, isNull } from 'drizzle-orm';
import type { ListBranchesParams } from '@takhti/contracts';
import { branches, numberSequences } from '@takhti/db';
import type { Ctx } from '../../kernel/context';
import { createDbService } from '../../kernel/db-service';
import { escapeLike } from '../../kernel/search';

/** Layer 3 for branches: the reusable queries, plus the two only this module needs. */
export const branchesDb = {
  ...createDbService<typeof branches, ListBranchesParams>(branches, {
    label: 'Branch',
    search: [branches.name, branches.nameUr, branches.code, branches.city],
    sort: {
      name: branches.name,
      code: branches.code,
      city: branches.city,
      createdAt: branches.createdAt,
    },
    filters: (params) => [
      params.status && eq(branches.status, params.status),
      params.gender && eq(branches.gender, params.gender),
      params.city && ilike(branches.city, escapeLike(params.city)),
    ],
  }),

  /** How many branches of the group are active. */
  async countActive(ctx: Ctx): Promise<number> {
    const [row] = await ctx.db
      .select({ total: count() })
      .from(branches)
      .where(and(eq(branches.status, 'active'), isNull(branches.deletedAt)));
    return row?.total ?? 0;
  },

  /** Whether any admission number, voucher or receipt has been issued carrying this branch. */
  async hasIssuedNumbers(ctx: Ctx, branchId: string): Promise<boolean> {
    const [row] = await ctx.db
      .select({ id: numberSequences.id })
      .from(numberSequences)
      .where(eq(numberSequences.branchId, branchId))
      .limit(1);
    return row !== undefined;
  },
};

import { and, eq, gte, isNull, lte, ne } from 'drizzle-orm';
import type { ListWingsParams } from '@takhti/contracts';
import { wings } from '@takhti/db';
import type { Ctx } from '../../kernel/context';
import { createDbService, type RowOf } from '../../kernel/db-service';
import { branchFilter } from '../../kernel/scope';

export type WingRow = RowOf<typeof wings>;

/** Layer 3 for wings: the reusable queries, plus the one only this module needs. */
export const wingsDb = {
  ...createDbService<typeof wings, ListWingsParams>(wings, {
    label: 'Wing',
    search: [wings.name, wings.nameUr],
    sort: {
      name: wings.name,
      gradeFrom: wings.gradeFrom,
      createdAt: wings.createdAt,
    },
    filters: (params, ctx) => [
      branchFilter(ctx, wings.branchId),
      params.branchId && eq(wings.branchId, params.branchId),
      params.gender && eq(wings.gender, params.gender),
    ],
  }),

  /** The other wings of the branch that cover any grade from `gradeFrom` to `gradeTo`. */
  async sharingGrades(
    ctx: Ctx,
    wing: { branchId: string; gradeFrom: number; gradeTo: number; exceptId?: string },
  ): Promise<WingRow[]> {
    const rows = await ctx.db
      .select()
      .from(wings)
      .where(
        and(
          eq(wings.branchId, wing.branchId),
          isNull(wings.deletedAt),
          lte(wings.gradeFrom, wing.gradeTo),
          gte(wings.gradeTo, wing.gradeFrom),
          wing.exceptId ? ne(wings.id, wing.exceptId) : undefined,
        ),
      )
      .orderBy(wings.gradeFrom, wings.name);
    return rows as WingRow[];
  },
};

import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { ListParams } from '@takhti/contracts';
import {
  inventoryItems,
  stockCountLines,
  stockCounts,
  stockLevels,
  stockMovements,
  warehouses,
} from '@takhti/db';
import { stampOf, type Ctx } from '../../kernel/context';
import { createDbService, type RowOf } from '../../kernel/db-service';
import { newId } from '../../kernel/ids';

/* Layer 3 for stock: what `stock.ts` reads and writes. No rule lives here. */

export type StockLevelRow = RowOf<typeof stockLevels>;
export type InventoryItemRow = RowOf<typeof inventoryItems>;
export type WarehouseRow = RowOf<typeof warehouses>;
export type StockMovementRow = typeof stockMovements.$inferSelect;

const levelsDb = createDbService<typeof stockLevels, ListParams>(stockLevels, {
  label: 'Stock level',
  sort: { createdAt: stockLevels.createdAt },
});
const itemsDb = createDbService<typeof inventoryItems, ListParams>(inventoryItems, {
  label: 'Item',
  sort: { createdAt: inventoryItems.createdAt },
});
const storesDb = createDbService<typeof warehouses, ListParams>(warehouses, {
  label: 'Store',
  sort: { createdAt: warehouses.createdAt },
});

export const stockDb = {
  levels: levelsDb,
  items: itemsDb,
  stores: storesDb,

  /** The movement a source already made for an item, if it has. */
  async movementBySource(
    ctx: Ctx,
    source: { type: string; id: string },
    itemId: string,
    kind: string,
  ): Promise<StockMovementRow | undefined> {
    const [row] = await ctx.db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.sourceType, source.type),
          eq(stockMovements.sourceId, source.id),
          eq(stockMovements.itemId, itemId),
          eq(stockMovements.kind, kind as StockMovementRow['kind']),
        ),
      )
      .limit(1);
    return row;
  },

  /**
   * The level of an item in a store, held until the transaction ends. A store that never held the
   * item gets a level of nothing first, so there is always a row to hold: two people issuing the
   * last of an item wait for each other here.
   */
  async lockLevel(ctx: Ctx, store: WarehouseRow, itemId: string): Promise<StockLevelRow> {
    const stamp = stampOf(ctx);
    await ctx.db
      .insert(stockLevels)
      .values({
        id: newId(),
        orgId: ctx.actor.orgId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        createdBy: stamp,
        updatedBy: stamp,
        branchId: store.branchId,
        warehouseId: store.id,
        itemId,
      })
      .onConflictDoNothing();
    const [row] = await ctx.db
      .select()
      .from(stockLevels)
      .where(
        and(
          eq(stockLevels.warehouseId, store.id),
          eq(stockLevels.itemId, itemId),
          isNull(stockLevels.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (!row) throw new Error('The stock level could not be read back');
    return row as StockLevelRow;
  },

  /** Every store's level of an item. A school has a handful of stores, so this is a short list. */
  async levelsOfItem(ctx: Ctx, itemId: string): Promise<StockLevelRow[]> {
    const rows = await ctx.db
      .select()
      .from(stockLevels)
      .where(and(eq(stockLevels.itemId, itemId), isNull(stockLevels.deletedAt)));
    return rows as StockLevelRow[];
  },

  /** How much of an item the whole organisation holds, in thousandths. */
  async heldEverywhere(ctx: Ctx, itemId: string): Promise<number> {
    const [row] = await ctx.db
      .select({ total: sql<string>`coalesce(sum(${stockLevels.quantity}), 0) * 1000` })
      .from(stockLevels)
      .where(and(eq(stockLevels.itemId, itemId), isNull(stockLevels.deletedAt)));
    return Math.round(Number(row?.total ?? 0));
  },

  /** Whether a stock count that has not been posted or cancelled is counting this item in this store. */
  async isBeingCounted(ctx: Ctx, warehouseId: string, itemId: string): Promise<boolean> {
    const [row] = await ctx.db
      .select({ id: stockCountLines.id })
      .from(stockCountLines)
      .innerJoin(stockCounts, eq(stockCounts.id, stockCountLines.countId))
      .where(
        and(
          eq(stockCounts.warehouseId, warehouseId),
          inArray(stockCounts.status, ['counting', 'review']),
          eq(stockCountLines.itemId, itemId),
          isNull(stockCounts.deletedAt),
          isNull(stockCountLines.deletedAt),
        ),
      )
      .limit(1);
    return row !== undefined;
  },

  async addMovement(
    ctx: Ctx,
    values: Omit<typeof stockMovements.$inferInsert, 'id' | 'orgId' | 'createdAt' | 'createdBy'>,
  ): Promise<StockMovementRow> {
    const [row] = await ctx.db
      .insert(stockMovements)
      .values({
        ...values,
        id: newId(),
        orgId: ctx.actor.orgId,
        createdAt: ctx.now,
        createdBy: stampOf(ctx),
      })
      .returning();
    if (!row) throw new Error('The stock movement could not be written');
    return row;
  },
};

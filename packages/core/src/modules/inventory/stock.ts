import type { StockMovementKind } from '@takhti/contracts';
import type { Ctx } from '../../kernel/context';
import { rule } from '../../kernel/errors';
import type { Paisa } from '../../kernel/money';
import { nextNumber } from '../../kernel/sequences';
import { ledger, type LedgerAccount, type LedgerLineInput } from '../accounting/ledger';
import { stockDb, type StockMovementRow } from './stock.db-service';
import {
  averageAfterReceipt,
  fromThousandths,
  quantityText,
  signedChange,
  toThousandths,
  valueOf,
} from './stock.rules';

/*
 * The one service that changes stock: docs/plan/10-modules/m32-inventory-assets.md, section 4.
 *
 *   await stock.move(ctx, {
 *     warehouseId, itemId, kind: 'issue', quantity: 10,
 *     source: { type: 'issue_request', id: request.id }, departmentId,
 *   });
 *
 * Every change in quantity is a movement (R-inventory-1). It runs in the caller's transaction: the
 * issue, its movement, the new level and the ledger entry are saved together or not at all.
 * Purchasing, issues, transfers, counts and the shop all call it; nothing else writes
 * `stock_levels` or `stock_movements`.
 */

export interface StockSource {
  /** `goods_receipt`, `issue_request`, `stock_transfer`, `stock_count`, `shop_sale` or `manual`. */
  type: string;
  /** That record's id. A source moves each item once: a second call returns the first movement. */
  id?: string;
}

export interface StockMove {
  warehouseId: string;
  itemId: string;
  kind: StockMovementKind;
  /** A plain amount, to three decimal places. Only a `count_adjustment` is signed: more found is positive. */
  quantity: number;
  /**
   * The price of stock coming in, per unit. Left out, the item's average is used.
   * Stock going out is always costed at the average at that moment, whatever is given here.
   */
  unitCost?: Paisa;
  /** The day it moved. Default: today. */
  movedOn?: string;
  source: StockSource;
  /** Who consumed it. */
  departmentId?: string;
  issuedToStaffId?: string;
  costCenterId?: string;
  note?: string;
  /**
   * How the ledger hears of it. Left out, the kind decides (see the table in the specification).
   * `{ contra }` names the other side of a `receipt` or a `return_to_vendor`.
   * `false` when the caller posts one entry of its own for the whole operation.
   */
  ledger?: { contra: LedgerAccount } | false;
}

/** The two sides of the entry a movement posts, or nothing when its kind posts none. */
function postingFor(
  input: StockMove,
  worth: Paisa,
  incoming: boolean,
): { debit: LedgerAccount; credit: LedgerAccount } | undefined {
  if (input.ledger === false || worth === 0) return undefined;
  const asset: LedgerAccount = { key: 'inventory.asset' };
  const adjustment: LedgerAccount = { key: 'inventory.adjustment' };
  const contra = input.ledger?.contra;
  switch (input.kind) {
    case 'issue':
      return { debit: { key: 'inventory.consumed' }, credit: asset };
    case 'write_off':
      return { debit: adjustment, credit: asset };
    case 'count_adjustment':
      return incoming ? { debit: asset, credit: adjustment } : { debit: adjustment, credit: asset };
    case 'receipt':
      return contra && { debit: asset, credit: contra };
    case 'return_to_vendor':
      return contra && { debit: contra, credit: asset };
    // Opening stock is part of the opening balances entry; a transfer posts once, on receipt; a
    // sale and its return are one entry posted by the shop.
    default:
      return undefined;
  }
}

async function move(ctx: Ctx, input: StockMove): Promise<StockMovementRow> {
  const { source } = input;
  const change = signedChange(input.kind, input.quantity);
  const incoming = change > 0;

  // The item is held first, so two movements of one item anywhere in the organisation take turns:
  // its average cost is worked out from what is held everywhere.
  const item = await stockDb.items.lock(ctx, input.itemId);
  if (source.id) {
    const done = await stockDb.movementBySource(ctx, { type: source.type, id: source.id }, item.id, input.kind);
    if (done) return done;
  }
  const store = await stockDb.stores.get(ctx, input.warehouseId);
  if (!store.isActive) throw rule(`${store.name} is closed, so nothing can be moved in or out of it`);
  if (!item.isActive && incoming)
    throw rule(`${item.name} is no longer in use, so no more of it can be received`);

  // R-inventory-7: a count freezes what it is counting until it is posted or cancelled.
  if (
    input.kind !== 'count_adjustment' &&
    (await stockDb.isBeingCounted(ctx, store.id, item.id))
  )
    throw rule(
      `${item.name} is being counted in ${store.name}. Post or cancel the stock count first.`,
    );

  const level = await stockDb.lockLevel(ctx, store, item.id);
  const held = toThousandths(level.quantity);
  const after = held + change;
  // R-inventory-2: a store never goes below nothing.
  if (after < 0)
    throw rule(
      held === 0
        ? `There is no ${item.name} in ${store.name}`
        : `Only ${quantityText(held)} ${item.unit} of ${item.name} ${held === 1000 ? 'is' : 'are'} left in ${store.name}`,
    );

  // R-inventory-3: out at the average of the moment; in at its own price, which moves the average.
  const unitCost = incoming ? (input.unitCost ?? item.averageCost) : item.averageCost;
  if (!Number.isSafeInteger(unitCost) || unitCost < 0)
    throw new Error(`A unit cost is a whole number of paisa, zero or more, got ${unitCost}`);
  const worth = valueOf(change, unitCost);
  let average = item.averageCost;
  if (incoming) {
    average = averageAfterReceipt({
      heldThousandths: await stockDb.heldEverywhere(ctx, item.id),
      average: item.averageCost,
      receivedThousandths: change,
      cost: unitCost,
    });
    const lastCost = input.kind === 'receipt' || input.kind === 'opening' ? unitCost : item.lastCost;
    if (average !== item.averageCost || lastCost !== item.lastCost)
      await stockDb.items.update(ctx, item.id, { averageCost: average, lastCost });
    // The average is the item's across the organisation, so what every other store holds of it
    // is worth the new figure too.
    if (average !== item.averageCost) {
      for (const other of await stockDb.levelsOfItem(ctx, item.id)) {
        if (other.id === level.id) continue;
        const value = valueOf(toThousandths(other.quantity), average);
        if (value !== other.value) await stockDb.levels.update(ctx, other.id, { value });
      }
    }
  }

  const movedOn = input.movedOn ?? ctx.today;
  const movement = await stockDb.addMovement(ctx, {
    branchId: store.branchId,
    movementNo: await nextNumber(ctx, 'stock_movement', { format: 'SM-{yymm}-{000000}' }),
    warehouseId: store.id,
    itemId: item.id,
    kind: input.kind,
    quantity: fromThousandths(change),
    unitCost,
    value: worth,
    balanceAfter: fromThousandths(after),
    movedOn,
    sourceType: source.type,
    sourceId: source.id ?? null,
    departmentId: input.departmentId ?? null,
    issuedToStaffId: input.issuedToStaffId ?? null,
    costCenterId: input.costCenterId ?? null,
    note: input.note ?? null,
  });
  // What a store holds is worth its quantity at the item's average.
  await stockDb.levels.update(ctx, level.id, {
    quantity: fromThousandths(after),
    value: valueOf(after, average),
  });

  const amount = worth < 0 ? -worth : worth;
  const posting = postingFor(input, amount, incoming);
  if (posting) {
    const line = (account: LedgerAccount, side: 'debit' | 'credit'): LedgerLineInput => ({
      account,
      branchId: store.branchId,
      [side]: amount,
      description: `${item.name}: ${quantityText(Math.abs(change))} ${item.unit}`,
      // The cost center belongs to whoever consumed the stock, so to the expense side alone.
      ...(input.costCenterId && side === 'debit' && { costCenterId: input.costCenterId }),
    });
    await ledger.post(ctx, {
      journal: 'INV',
      date: movedOn,
      branchId: store.branchId,
      memo: `${movement.movementNo}: ${input.kind.replace(/_/g, ' ')} of ${item.name}, ${store.name}`,
      source: { type: 'stock_movement', id: movement.id },
      lines: [line(posting.debit, 'debit'), line(posting.credit, 'credit')],
    });
  }
  return movement;
}

export const stock = { move };

import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { stock, type Actor, type StockMove } from '@takhti/core';
import {
  accounts,
  adminDb,
  inventoryCategories,
  inventoryItems,
  journalEntries,
  journalLines,
  stockCountLines,
  stockCounts,
  stockLevels,
  stockMovements,
  warehouses,
} from '@takhti/db';
import { createTestDb, testEngine, type TestDb } from '../../helpers/test-db';
import { as, expectError, seedOrg, TEST_NOW, type TestOrg } from '../../helpers/world';

/*
 * The one service that changes stock.
 * Rules, failure cases and tests: docs/plan/10-modules/m32-inventory-assets.md.
 */

let db: TestDb;
const Rs = (rupees: number) => rupees * 100;
const DATE = '2026-10-12';

interface Store {
  school: TestOrg;
  keeper: Actor;
  /** Main Campus. */
  main: string;
  lab: string;
  /** City Campus. */
  city: string;
  categoryId: string;
}

const stamps = (org: TestOrg) => ({ orgId: org.orgId, createdAt: TEST_NOW, updatedAt: TEST_NOW });

/** A fresh school with three stores and nothing in them. */
async function stores(): Promise<Store> {
  const school = await seedOrg();
  const keeper = await school.actor('store_keeper', { branch: 'both' });
  const [main, lab, city, categoryId] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  await adminDb()
    .insert(inventoryCategories)
    .values({ id: categoryId, ...stamps(school), name: 'Stationery', kind: 'stationery' });
  await adminDb()
    .insert(warehouses)
    .values([
      { id: main, ...stamps(school), branchId: school.mainBranchId, name: 'Main store' },
      { id: lab, ...stamps(school), branchId: school.mainBranchId, name: 'Science lab', kind: 'lab' },
      { id: city, ...stamps(school), branchId: school.cityBranchId, name: 'City store' },
    ]);
  return { school, keeper, main, lab, city, categoryId };
}

async function item(s: Store, name = 'A4 paper', unit = 'ream'): Promise<string> {
  const id = randomUUID();
  await adminDb()
    .insert(inventoryItems)
    .values({
      id,
      ...stamps(s.school),
      sku: `SKU-${id.slice(0, 8)}`,
      name,
      categoryId: s.categoryId,
      unit,
    });
  return id;
}

const move = (s: Store, input: Omit<StockMove, 'source' | 'movedOn'> & Partial<StockMove>) =>
  as(s.keeper, (ctx) =>
    stock.move(ctx, { source: { type: 'manual' }, movedOn: DATE, ...input }),
  );

const levelOf = async (warehouseId: string, itemId: string) => {
  const [row] = await adminDb()
    .select()
    .from(stockLevels)
    .where(and(eq(stockLevels.warehouseId, warehouseId), eq(stockLevels.itemId, itemId)));
  return row;
};
const itemRow = async (id: string) =>
  (await adminDb().select().from(inventoryItems).where(eq(inventoryItems.id, id)))[0]!;

/** The entry a movement posted, as `[account code, debit, credit]` for each line; empty when it posted none. */
async function postingOf(s: Store, movementId: string): Promise<[string, number, number][]> {
  const [entry] = await adminDb()
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.sourceType, 'stock_movement'), eq(journalEntries.sourceId, movementId)));
  if (!entry) return [];
  const chart = await adminDb().select().from(accounts).where(eq(accounts.orgId, s.school.orgId));
  const codeOf = new Map(chart.map((account) => [account.id, account.code]));
  const lines = await adminDb().select().from(journalLines).where(eq(journalLines.entryId, entry.id));
  return lines
    .sort((a, b) => a.lineNo - b.lineNo)
    .map((line) => [codeOf.get(line.accountId) ?? '?', line.debit, line.credit]);
}

beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.destroy();
});

describe('T-inventory-1 stock.move', () => {
  it('R-inventory-1 a receipt writes a numbered movement and brings the level to match it', async () => {
    const s = await stores();
    const paper = await item(s);
    const movement = await move(s, {
      warehouseId: s.main,
      itemId: paper,
      kind: 'receipt',
      quantity: 10,
      unitCost: Rs(500),
      note: 'Donated by the parents’ association',
    });
    expect(movement).toMatchObject({
      kind: 'receipt',
      quantity: 10,
      unitCost: Rs(500),
      value: Rs(5000),
      balanceAfter: 10,
      movedOn: DATE,
      sourceType: 'manual',
      sourceId: null,
      branchId: s.school.mainBranchId,
      warehouseId: s.main,
    });
    expect(movement.movementNo).toMatch(/^SM-\d{4}-\d{6}$/);
    expect(await levelOf(s.main, paper)).toMatchObject({ quantity: 10, value: Rs(5000) });
    expect(await itemRow(paper)).toMatchObject({ averageCost: Rs(500), lastCost: Rs(500) });
  });

  it('every kind moves the store the right way and leaves the balance it says', async () => {
    const s = await stores();
    const paper = await item(s);
    const steps: [StockMove['kind'], number, number][] = [
      ['opening', 100, 100],
      ['receipt', 20, 120],
      ['issue', 30, 90],
      ['transfer_out', 10, 80],
      ['transfer_in', 5, 85],
      ['sale', 4, 81],
      ['sale_return', 1, 82],
      ['write_off', 2, 80],
      ['return_to_vendor', 10, 70],
      ['count_adjustment', -3, 67],
      ['count_adjustment', 1.5, 68.5],
    ];
    for (const [kind, quantity, balance] of steps) {
      const movement = await move(s, {
        warehouseId: s.main,
        itemId: paper,
        kind,
        quantity,
        unitCost: Rs(500),
      });
      expect(movement.balanceAfter, kind).toBe(balance);
    }
    expect((await levelOf(s.main, paper))?.quantity).toBe(68.5);
    const written = await adminDb()
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.itemId, paper));
    expect(written).toHaveLength(steps.length);
    // Into the store is positive, out of it negative.
    expect(written.reduce((sum, row) => sum + Math.round(row.quantity * 1000), 0)).toBe(68_500);
  });

  it('R-inventory-2 / F-inventory-1 a store never goes below nothing, and the refusal says what is left', async () => {
    const s = await stores();
    const paper = await item(s);
    await move(s, { warehouseId: s.main, itemId: paper, kind: 'receipt', quantity: 10, unitCost: Rs(500) });

    const error = await expectError('RULE', () =>
      move(s, { warehouseId: s.main, itemId: paper, kind: 'issue', quantity: 10.5 }),
    );
    expect(error.message).toBe('Only 10 ream of A4 paper are left in Main store');
    expect((await levelOf(s.main, paper))?.quantity).toBe(10);

    const empty = await expectError('RULE', () =>
      move(s, { warehouseId: s.lab, itemId: paper, kind: 'issue', quantity: 1 }),
    );
    expect(empty.message).toBe('There is no A4 paper in Science lab');
  });

  it('R-inventory-2 / F-inventory-1 two keepers issuing the last of an item at once: one is refused, and the level is never below nothing', async () => {
    const s = await stores();
    const paper = await item(s);
    await move(s, { warehouseId: s.main, itemId: paper, kind: 'receipt', quantity: 10, unitCost: Rs(500) });
    const attempts = testEngine() === 'postgres' ? 8 : 2;
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () =>
        move(s, { warehouseId: s.main, itemId: paper, kind: 'issue', quantity: 10 }),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await levelOf(s.main, paper))?.quantity).toBe(0);
  });

  it('a closed store takes nothing in and gives nothing out; an item no longer in use can still be issued', async () => {
    const s = await stores();
    const paper = await item(s);
    await move(s, { warehouseId: s.main, itemId: paper, kind: 'receipt', quantity: 5, unitCost: Rs(500) });
    await adminDb().update(inventoryItems).set({ isActive: false }).where(eq(inventoryItems.id, paper));
    await expectError('RULE', () =>
      move(s, { warehouseId: s.main, itemId: paper, kind: 'receipt', quantity: 1, unitCost: Rs(500) }),
    );
    await move(s, { warehouseId: s.main, itemId: paper, kind: 'issue', quantity: 1 });

    await adminDb().update(warehouses).set({ isActive: false }).where(eq(warehouses.id, s.main));
    const error = await expectError('RULE', () =>
      move(s, { warehouseId: s.main, itemId: paper, kind: 'issue', quantity: 1 }),
    );
    expect(error.message).toContain('Main store is closed');
  });
});

describe('T-inventory-2 the cost of stock', () => {
  it('R-inventory-3 a receipt moves the average for the whole organisation, and stock goes out at the average of the moment', async () => {
    const s = await stores();
    const paper = await item(s);
    await move(s, { warehouseId: s.main, itemId: paper, kind: 'receipt', quantity: 10, unitCost: Rs(500) });
    // Thirty more at Rs 600, into another store: 40 held at Rs 575.
    await move(s, { warehouseId: s.lab, itemId: paper, kind: 'receipt', quantity: 30, unitCost: Rs(600) });
    expect(await itemRow(paper)).toMatchObject({ averageCost: Rs(575), lastCost: Rs(600) });
    // What the first store holds is worth the new average too.
    expect(await levelOf(s.main, paper)).toMatchObject({ quantity: 10, value: Rs(5750) });
    expect(await levelOf(s.lab, paper)).toMatchObject({ quantity: 30, value: Rs(17250) });

    // A price given for stock going out is ignored: it leaves at the average.
    const issue = await move(s, {
      warehouseId: s.main,
      itemId: paper,
      kind: 'issue',
      quantity: 4,
      unitCost: Rs(1),
    });
    expect(issue).toMatchObject({ quantity: -4, unitCost: Rs(575), value: -Rs(2300), balanceAfter: 6 });
    expect(await levelOf(s.main, paper)).toMatchObject({ quantity: 6, value: Rs(3450) });
    expect((await itemRow(paper)).averageCost).toBe(Rs(575));
  });

  it('F-inventory-5 the first receipt after everything has gone sets the average to its own cost', async () => {
    const s = await stores();
    const paper = await item(s);
    await move(s, { warehouseId: s.main, itemId: paper, kind: 'receipt', quantity: 10, unitCost: Rs(500) });
    await move(s, { warehouseId: s.main, itemId: paper, kind: 'issue', quantity: 10 });
    expect(await levelOf(s.main, paper)).toMatchObject({ quantity: 0, value: 0 });
    await move(s, { warehouseId: s.main, itemId: paper, kind: 'receipt', quantity: 5, unitCost: Rs(700) });
    expect((await itemRow(paper)).averageCost).toBe(Rs(700));
    expect(await levelOf(s.main, paper)).toMatchObject({ quantity: 5, value: Rs(3500) });
  });

  it('quantities with decimals are exact, and their worth is rounded to the paisa', async () => {
    const s = await stores();
    const sugar = await item(s, 'Sugar', 'kg');
    const first = await move(s, {
      warehouseId: s.main,
      itemId: sugar,
      kind: 'receipt',
      quantity: 2.5,
      unitCost: 33_333,
    });
    expect(first.value).toBe(83_333);
    await move(s, { warehouseId: s.main, itemId: sugar, kind: 'issue', quantity: 0.1 });
    await move(s, { warehouseId: s.main, itemId: sugar, kind: 'issue', quantity: 0.2 });
    expect((await levelOf(s.main, sugar))?.quantity).toBe(2.2);
  });
});

describe('T-inventory-3 each source moves an item once', () => {
  it('the same source moving the same item again returns the first movement and changes nothing', async () => {
    const s = await stores();
    const paper = await item(s);
    const source = { type: 'goods_receipt', id: randomUUID() };
    const receive = () =>
      move(s, { warehouseId: s.main, itemId: paper, kind: 'receipt', quantity: 10, unitCost: Rs(500), source });
    const first = await receive();
    const second = await receive();
    expect(second.id).toBe(first.id);
    expect((await levelOf(s.main, paper))?.quantity).toBe(10);

    // The same source may move another item, and the same item another way.
    const pens = await item(s, 'Ball pens', 'box');
    await move(s, { warehouseId: s.main, itemId: pens, kind: 'receipt', quantity: 3, unitCost: Rs(120), source });
    await move(s, { warehouseId: s.main, itemId: paper, kind: 'return_to_vendor', quantity: 2, source });
    expect((await levelOf(s.main, paper))?.quantity).toBe(8);
  });
});

describe('R-inventory-7 a stock count in progress', () => {
  it('F-inventory-3 blocks other movements of the items it is counting, in that store, until it is posted or cancelled', async () => {
    const s = await stores();
    const paper = await item(s);
    const pens = await item(s, 'Ball pens', 'box');
    for (const itemId of [paper, pens])
      await move(s, { warehouseId: s.main, itemId, kind: 'receipt', quantity: 10, unitCost: Rs(100) });
    await move(s, { warehouseId: s.lab, itemId: paper, kind: 'receipt', quantity: 10, unitCost: Rs(100) });

    const countId = randomUUID();
    await adminDb()
      .insert(stockCounts)
      .values({
        id: countId,
        ...stamps(s.school),
        branchId: s.school.mainBranchId,
        warehouseId: s.main,
        countedOn: DATE,
        countedBy: s.keeper.userId,
      });
    await adminDb()
      .insert(stockCountLines)
      .values({
        id: randomUUID(),
        ...stamps(s.school),
        branchId: s.school.mainBranchId,
        countId,
        itemId: paper,
        systemQuantity: 10,
      });

    const error = await expectError('RULE', () =>
      move(s, { warehouseId: s.main, itemId: paper, kind: 'issue', quantity: 1 }),
    );
    expect(error.message).toBe(
      'A4 paper is being counted in Main store. Post or cancel the stock count first.',
    );
    // An item the count does not cover, the same item in another store, and the count's own
    // adjustment all go through.
    await move(s, { warehouseId: s.main, itemId: pens, kind: 'issue', quantity: 1 });
    await move(s, { warehouseId: s.lab, itemId: paper, kind: 'issue', quantity: 1 });
    await move(s, {
      warehouseId: s.main,
      itemId: paper,
      kind: 'count_adjustment',
      quantity: -2,
      source: { type: 'stock_count', id: countId },
    });

    await adminDb().update(stockCounts).set({ status: 'posted' }).where(eq(stockCounts.id, countId));
    await move(s, { warehouseId: s.main, itemId: paper, kind: 'issue', quantity: 1 });
    expect((await levelOf(s.main, paper))?.quantity).toBe(7);
  });
});

describe('T-inventory-7 what a movement posts', () => {
  it('an issue: stores consumed against stock, at cost, with the cost center on the expense', async () => {
    const s = await stores();
    const paper = await item(s);
    await move(s, { warehouseId: s.main, itemId: paper, kind: 'receipt', quantity: 10, unitCost: Rs(500) });
    const issue = await move(s, { warehouseId: s.main, itemId: paper, kind: 'issue', quantity: 4 });
    expect(await postingOf(s, issue.id)).toEqual([
      ['5220', Rs(2000), 0],
      ['1310', 0, Rs(2000)],
    ]);
    const [entry] = await adminDb()
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.sourceId, issue.id));
    expect(entry).toMatchObject({
      status: 'posted',
      entryDate: DATE,
      branchId: s.school.mainBranchId,
      memo: `${issue.movementNo}: issue of A4 paper, Main store`,
    });
    expect(entry!.entryNo).toMatch(/^INV-2627-/);
  });

  it('a write-off and a count adjustment, each way', async () => {
    const s = await stores();
    const paper = await item(s);
    await move(s, { warehouseId: s.main, itemId: paper, kind: 'receipt', quantity: 10, unitCost: Rs(500) });
    const writeOff = await move(s, { warehouseId: s.main, itemId: paper, kind: 'write_off', quantity: 1 });
    expect(await postingOf(s, writeOff.id)).toEqual([
      ['5230', Rs(500), 0],
      ['1310', 0, Rs(500)],
    ]);
    const less = await move(s, { warehouseId: s.main, itemId: paper, kind: 'count_adjustment', quantity: -2 });
    expect(await postingOf(s, less.id)).toEqual([
      ['5230', Rs(1000), 0],
      ['1310', 0, Rs(1000)],
    ]);
    const more = await move(s, { warehouseId: s.main, itemId: paper, kind: 'count_adjustment', quantity: 3 });
    expect(await postingOf(s, more.id)).toEqual([
      ['1310', Rs(1500), 0],
      ['5230', 0, Rs(1500)],
    ]);
  });

  it('a receipt and a return to the vendor post against the account the caller names, and nothing without one', async () => {
    const s = await stores();
    const paper = await item(s);
    const silent = await move(s, { warehouseId: s.main, itemId: paper, kind: 'receipt', quantity: 10, unitCost: Rs(500) });
    expect(await postingOf(s, silent.id)).toEqual([]);

    const received = await move(s, {
      warehouseId: s.main,
      itemId: paper,
      kind: 'receipt',
      quantity: 10,
      unitCost: Rs(500),
      ledger: { contra: { key: 'ap.payable' } },
    });
    expect(await postingOf(s, received.id)).toEqual([
      ['1310', Rs(5000), 0],
      ['2110', 0, Rs(5000)],
    ]);
    const returned = await move(s, {
      warehouseId: s.main,
      itemId: paper,
      kind: 'return_to_vendor',
      quantity: 2,
      ledger: { contra: { key: 'ap.payable' } },
    });
    expect(await postingOf(s, returned.id)).toEqual([
      ['2110', Rs(1000), 0],
      ['1310', 0, Rs(1000)],
    ]);
  });

  it('opening stock, a transfer, a sale and its return post nothing of their own; nor does any movement told not to', async () => {
    const s = await stores();
    const paper = await item(s);
    const kinds: [StockMove['kind'], number][] = [
      ['opening', 50],
      ['transfer_out', 5],
      ['transfer_in', 5],
      ['sale', 2],
      ['sale_return', 1],
    ];
    for (const [kind, quantity] of kinds) {
      const movement = await move(s, { warehouseId: s.main, itemId: paper, kind, quantity, unitCost: Rs(500) });
      expect(await postingOf(s, movement.id), kind).toEqual([]);
    }
    const quiet = await move(s, { warehouseId: s.main, itemId: paper, kind: 'issue', quantity: 1, ledger: false });
    expect(await postingOf(s, quiet.id)).toEqual([]);
  });

  it('an entry is posted in the branch of the store, and a movement worth nothing posts none', async () => {
    const s = await stores();
    const paper = await item(s);
    await move(s, { warehouseId: s.city, itemId: paper, kind: 'receipt', quantity: 10, unitCost: Rs(500) });
    const issue = await move(s, { warehouseId: s.city, itemId: paper, kind: 'issue', quantity: 1 });
    const [entry] = await adminDb()
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.sourceId, issue.id));
    expect(entry?.branchId).toBe(s.school.cityBranchId);

    const free = await item(s, 'Donated chalk', 'box');
    await move(s, { warehouseId: s.main, itemId: free, kind: 'receipt', quantity: 10, unitCost: 0 });
    const used = await move(s, { warehouseId: s.main, itemId: free, kind: 'issue', quantity: 1 });
    expect(await postingOf(s, used.id)).toEqual([]);
  });

  it('a movement that cannot be posted is not made: a closed period refuses the issue and the stock stays', async () => {
    const s = await stores();
    const paper = await item(s);
    await move(s, { warehouseId: s.main, itemId: paper, kind: 'receipt', quantity: 10, unitCost: Rs(500) });
    await expectError('RULE', () =>
      move(s, { warehouseId: s.main, itemId: paper, kind: 'issue', quantity: 1, movedOn: '2028-01-05' }),
    );
    expect((await levelOf(s.main, paper))?.quantity).toBe(10);
    expect(
      await adminDb().select().from(stockMovements).where(eq(stockMovements.itemId, paper)),
    ).toHaveLength(1);
  });
});

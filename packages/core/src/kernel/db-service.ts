import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
  type InferInsertModel,
  type InferSelectModel,
  type SQL,
} from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { CursorPage, ListParams, Page } from '@takhti/contracts';
import { stampOf, type Ctx } from './context';
import { invalid, notFound, stale } from './errors';
import { newId } from './ids';
import { searchCondition } from './search';

/*
 * Layer 3. `createDbService(table, config)` gives a table its reusable queries; a module's
 * db-service file adds the queries only that module needs next to them.
 *
 * Every query here: leaves out deleted rows, stamps who and when, and bumps `version` on a change.
 * Row-level security does the tenant filtering; nothing here needs to add `org_id = …`.
 */

/** Columns from `baseColumns` that this layer fills in. Callers never pass them. */
type ManagedColumn =
  'orgId' | 'version' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/** Any table built with `baseColumns`. */
export type TenantTable = PgTable & Record<'id' | ManagedColumn, AnyPgColumn>;

export type RowOf<T extends TenantTable> = InferSelectModel<T> & { id: string; version: number };
export type InsertOf<T extends TenantTable> = Omit<InferInsertModel<T>, ManagedColumn>;
/** A change to some columns. A key that is present but `undefined` means "leave this column alone", as it does in a PATCH body. */
export type PatchOf<T extends TenantTable> = {
  [K in keyof Omit<InsertOf<T>, 'id'>]?: Omit<InsertOf<T>, 'id'>[K] | undefined;
};

/** A condition, or nothing. Empty entries are skipped, so `cond && eq(...)` reads naturally. */
export type Condition = SQL | undefined | null | false | '';

export interface CursorParams {
  cursor?: string | undefined;
  limit: number;
}

export interface DbServiceConfig<TList extends ListParams> {
  /** Used in messages: "Student not found". */
  label: string;
  /** Columns the `q` search box looks in. */
  search?: AnyPgColumn[];
  /** Public sort name → column. A name missing here is a compile error, so the contract and the query cannot drift. */
  sort: Record<TList['sort'], AnyPgColumn>;
  /** Turns the module's filters into SQL conditions. */
  filters?: (params: TList, ctx: Ctx) => Condition[];
  /** A condition added to every read, for example "of the current academic year". */
  baseWhere?: (ctx: Ctx) => Condition;
  /** The column very long lists are paged by, newest first unless stated. Default: `createdAt`, newest first. */
  cursor?: { column: AnyPgColumn; order?: 'asc' | 'desc' };
  /**
   * Counting stops here. A list with more rows reports this number with `totalIsEstimate: true`
   * ("20,000+"), so one enormous list cannot make every page slow. Default 20,000.
   */
  countCap?: number;
}

/** The reusable queries every table gets. */
export interface DbService<T extends TenantTable, TList extends ListParams = ListParams> {
  table: T;
  label: string;
  /** The row, or undefined. */
  find(ctx: Ctx, id: string, where?: Condition): Promise<RowOf<T> | undefined>;
  /** The row, or a NOT_FOUND error. */
  get(ctx: Ctx, id: string, where?: Condition): Promise<RowOf<T>>;
  /** Several rows, in the order asked. Ids that do not exist are left out. */
  findMany(ctx: Ctx, ids: readonly string[]): Promise<RowOf<T>[]>;
  /** The first row matching the condition, or undefined. */
  findBy(ctx: Ctx, where: Condition): Promise<RowOf<T> | undefined>;
  /** Every row matching the condition. For small sets only; lists use `list`. */
  all(ctx: Ctx, where?: Condition, limit?: number): Promise<RowOf<T>[]>;
  exists(ctx: Ctx, where?: Condition): Promise<boolean>;
  count(ctx: Ctx, where?: Condition): Promise<number>;
  list(ctx: Ctx, params: TList, where?: Condition): Promise<Page<RowOf<T>>>;
  /** Keyset paging for very long lists: no page numbers, no count. */
  listCursor(ctx: Ctx, params: CursorParams, where?: Condition): Promise<CursorPage<RowOf<T>>>;
  insert(ctx: Ctx, values: InsertOf<T>): Promise<RowOf<T>>;
  insertMany(ctx: Ctx, values: InsertOf<T>[]): Promise<RowOf<T>[]>;
  /** With `expectedVersion`, the update is refused if someone else saved first. */
  update(ctx: Ctx, id: string, patch: PatchOf<T>, expectedVersion?: number): Promise<RowOf<T>>;
  /** Soft delete: the row stays, marked as deleted. */
  remove(ctx: Ctx, id: string, expectedVersion?: number): Promise<void>;
  /** Undoes a soft delete. */
  restore(ctx: Ctx, id: string): Promise<RowOf<T>>;
  /** Reads the row and holds it until the transaction ends, for read-then-write flows such as collecting a fee. */
  lock(ctx: Ctx, id: string): Promise<RowOf<T>>;
}

const DEFAULT_COUNT_CAP = 20_000;
const MAX_ALL = 5_000;

const clean = (conditions: Condition[]): SQL[] =>
  conditions.filter((condition): condition is SQL => Boolean(condition));

function encodeCursor(value: unknown, id: string): string {
  return Buffer.from(JSON.stringify([value, id]), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): [string | number, string] {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[1] === 'string' &&
      ['string', 'number'].includes(typeof parsed[0])
    ) {
      return parsed as [string | number, string];
    }
  } catch {
    // fall through to the error below
  }
  throw invalid({
    cursor: ['This page link is no longer valid. Start again from the first page.'],
  });
}

export function createDbService<T extends TenantTable, TList extends ListParams = ListParams>(
  table: T,
  config: DbServiceConfig<TList>,
): DbService<T, TList> {
  // Drizzle's builders cannot follow a generic table type, so the kernel works on the base shape
  // and casts results once. Module code stays fully typed through the interface above.
  const t: TenantTable = table;
  const alive = isNull(t.deletedAt);
  const sortColumns: Record<string, AnyPgColumn | undefined> = config.sort;
  const countCap = config.countCap ?? DEFAULT_COUNT_CAP;
  const base = (ctx: Ctx, ...extra: Condition[]) =>
    and(alive, ...clean([config.baseWhere?.(ctx), ...extra]));

  const service: DbService<T, TList> = {
    table,
    label: config.label,

    async find(ctx, id, where) {
      const [row] = await ctx.db
        .select()
        .from(t)
        .where(base(ctx, eq(t.id, id), where))
        .limit(1);
      return row as RowOf<T> | undefined;
    },

    async get(ctx, id, where) {
      const row = await service.find(ctx, id, where);
      if (!row) throw notFound(config.label);
      return row;
    },

    async findMany(ctx, ids) {
      if (ids.length === 0) return [];
      const unique = [...new Set(ids)];
      const rows = (await ctx.db
        .select()
        .from(t)
        .where(base(ctx, inArray(t.id, unique)))) as RowOf<T>[];
      const byId = new Map(rows.map((row) => [row.id, row]));
      return ids.flatMap((id) => byId.get(id) ?? []);
    },

    async findBy(ctx, where) {
      const [row] = await ctx.db.select().from(t).where(base(ctx, where)).limit(1);
      return row as RowOf<T> | undefined;
    },

    async all(ctx, where, limit = MAX_ALL) {
      const rows = await ctx.db
        .select()
        .from(t)
        .where(base(ctx, where))
        .orderBy(asc(t.createdAt), asc(t.id))
        .limit(Math.min(limit, MAX_ALL));
      return rows as RowOf<T>[];
    },

    async exists(ctx, where) {
      const [row] = await ctx.db.select({ id: t.id }).from(t).where(base(ctx, where)).limit(1);
      return row !== undefined;
    },

    async count(ctx, where) {
      const [row] = await ctx.db.select({ total: count() }).from(t).where(base(ctx, where));
      return row?.total ?? 0;
    },

    async list(ctx, params, where) {
      const filters = config.filters?.(params, ctx) ?? [];
      const condition = base(
        ctx,
        searchCondition(config.search ?? [], params.q),
        where,
        ...filters,
      );
      const direction = params.order === 'desc' ? desc : asc;
      const sortColumn = sortColumns[params.sort] ?? t.id;

      const items = await ctx.db
        .select()
        .from(t)
        .where(condition)
        // The id is a tie-breaker, so paging stays stable when many rows share the sort value.
        .orderBy(direction(sortColumn), asc(t.id))
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize);

      const capped = ctx.db
        .select({ one: sql<number>`1`.as('one') })
        .from(t)
        .where(condition)
        .limit(countCap + 1)
        .as('capped');
      const [counted] = await ctx.db.select({ total: count() }).from(capped);
      const total = counted?.total ?? 0;

      return {
        items: items as RowOf<T>[],
        page: params.page,
        pageSize: params.pageSize,
        total: Math.min(total, countCap),
        ...(total > countCap && { totalIsEstimate: true }),
      };
    },

    async listCursor(ctx, params, where) {
      const column = config.cursor?.column ?? t.createdAt;
      const newestFirst = (config.cursor?.order ?? 'desc') === 'desc';
      let after: SQL | undefined;
      if (params.cursor) {
        const [value, id] = decodeCursor(params.cursor);
        const typed = sql`${value}::${sql.raw(column.getSQLType())}`;
        after = newestFirst
          ? sql`(${column}, ${t.id}) < (${typed}, ${id}::uuid)`
          : sql`(${column}, ${t.id}) > (${typed}, ${id}::uuid)`;
      }
      const direction = newestFirst ? desc : asc;
      const rows = (await ctx.db
        .select()
        .from(t)
        .where(base(ctx, where, after))
        .orderBy(direction(column), direction(t.id))
        .limit(params.limit + 1)) as RowOf<T>[];

      const items = rows.slice(0, params.limit);
      const last = items.at(-1);
      const columnKey = Object.entries(t as unknown as Record<string, unknown>).find(
        ([, candidate]) => candidate === column,
      )?.[0];
      const more = rows.length > params.limit && last !== undefined && columnKey !== undefined;
      return {
        items,
        nextCursor: more
          ? encodeCursor((last as Record<string, unknown>)[columnKey], last.id)
          : null,
      };
    },

    async insert(ctx, values) {
      const [row] = await service.insertMany(ctx, [values]);
      if (!row) throw new Error(`Insert into ${config.label} returned no row`);
      return row;
    },

    async insertMany(ctx, values) {
      if (values.length === 0) return [];
      const stamp = stampOf(ctx);
      const stamped = values.map((value) => ({
        ...value,
        // Made here rather than by the database, so ids sort by time and an offline device can supply its own.
        id: (value as { id?: string }).id ?? newId(),
        orgId: ctx.actor.orgId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        createdBy: stamp,
        updatedBy: stamp,
      }));
      const rows = await ctx.db
        .insert(t)
        .values(stamped as never)
        .returning();
      return rows as RowOf<T>[];
    },

    async update(ctx, id, patch, expectedVersion) {
      const [row] = await ctx.db
        .update(t)
        .set({
          ...patch,
          version: sql`${t.version} + 1`,
          updatedAt: ctx.now,
          updatedBy: stampOf(ctx),
        } as never)
        .where(
          and(
            eq(t.id, id),
            alive,
            expectedVersion === undefined ? undefined : eq(t.version, expectedVersion),
          ),
        )
        .returning();
      if (row) return row as RowOf<T>;

      // Nothing was updated: the row is gone (NOT_FOUND), or its version moved on (STALE).
      await service.get(ctx, id);
      throw stale(config.label);
    },

    async remove(ctx, id, expectedVersion) {
      const [row] = await ctx.db
        .update(t)
        .set({
          deletedAt: ctx.now,
          updatedAt: ctx.now,
          updatedBy: stampOf(ctx),
          version: sql`${t.version} + 1`,
        } as never)
        .where(
          and(
            eq(t.id, id),
            alive,
            expectedVersion === undefined ? undefined : eq(t.version, expectedVersion),
          ),
        )
        .returning({ id: t.id });
      if (row) return;
      await service.get(ctx, id);
      throw stale(config.label);
    },

    async restore(ctx, id) {
      const [row] = await ctx.db
        .update(t)
        .set({
          deletedAt: null,
          updatedAt: ctx.now,
          updatedBy: stampOf(ctx),
          version: sql`${t.version} + 1`,
        } as never)
        .where(and(eq(t.id, id), isNotNull(t.deletedAt)))
        .returning();
      if (!row) throw notFound(config.label);
      return row as RowOf<T>;
    },

    async lock(ctx, id) {
      const [row] = await ctx.db
        .select()
        .from(t)
        .where(and(eq(t.id, id), alive))
        .limit(1)
        .for('update');
      if (!row) throw notFound(config.label);
      return row as RowOf<T>;
    },
  };

  return service;
}

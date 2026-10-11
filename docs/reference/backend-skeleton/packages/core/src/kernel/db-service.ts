import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
  sql,
  type InferInsertModel,
  type InferSelectModel,
  type SQL,
} from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { ListParams, Page } from '@school/contracts';
import type { Ctx } from './context';
import { AppError, notFound } from './errors';

/** Columns from `baseColumns` that this layer fills in. Callers never pass them. */
type ManagedColumn = 'orgId' | 'version' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/** Any table built with `baseColumns`. */
export type TenantTable = PgTable & Record<'id' | ManagedColumn, AnyPgColumn>;

export type RowOf<T extends TenantTable> = InferSelectModel<T> & { id: string; version: number };
export type InsertOf<T extends TenantTable> = Omit<InferInsertModel<T>, ManagedColumn>;
export type PatchOf<T extends TenantTable> = Partial<Omit<InsertOf<T>, 'id'>>;

type Condition = SQL | undefined | null | false | '';

export interface DbServiceConfig<TList extends ListParams> {
  /** Used in messages: "Student not found". */
  label: string;
  /** Columns the `q` search box looks in. */
  search?: AnyPgColumn[];
  /** Public sort name → column. A name missing here is a compile error, so the contract and the query cannot drift. */
  sort: Record<TList['sort'], AnyPgColumn>;
  /** Turns the module's filters into SQL conditions. Empty entries are skipped. */
  filters?: (params: TList) => Condition[];
}

/** The reusable queries every table gets. Module files add their own next to these. */
export interface DbService<T extends TenantTable, TList extends ListParams = ListParams> {
  table: T;
  label: string;
  /** The row, or undefined. */
  find(ctx: Ctx, id: string): Promise<RowOf<T> | undefined>;
  /** The row, or a NOT_FOUND error. */
  get(ctx: Ctx, id: string): Promise<RowOf<T>>;
  list(ctx: Ctx, params: TList): Promise<Page<RowOf<T>>>;
  insert(ctx: Ctx, values: InsertOf<T>): Promise<RowOf<T>>;
  insertMany(ctx: Ctx, values: InsertOf<T>[]): Promise<RowOf<T>[]>;
  /** With `expectedVersion`, the update is refused if someone else saved first. */
  update(ctx: Ctx, id: string, patch: PatchOf<T>, expectedVersion?: number): Promise<RowOf<T>>;
  /** Soft delete: the row stays, marked as deleted. */
  remove(ctx: Ctx, id: string): Promise<void>;
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

export function createDbService<T extends TenantTable, TList extends ListParams = ListParams>(
  table: T,
  config: DbServiceConfig<TList>,
): DbService<T, TList> {
  // Drizzle's builders cannot follow a generic table type, so the kernel works on the base shape
  // and casts results once. Module code stays fully typed through the interface above.
  const t: TenantTable = table;
  const alive = isNull(t.deletedAt);
  const sortColumns: Record<string, AnyPgColumn | undefined> = config.sort;

  const service: DbService<T, TList> = {
    table,
    label: config.label,

    async find(ctx, id) {
      const [row] = await ctx.db
        .select()
        .from(t)
        .where(and(eq(t.id, id), alive))
        .limit(1);
      return row as RowOf<T> | undefined;
    },

    async get(ctx, id) {
      const row = await service.find(ctx, id);
      if (!row) throw notFound(config.label);
      return row;
    },

    async list(ctx, params) {
      const term = params.q && config.search?.length ? `%${escapeLike(params.q)}%` : undefined;
      const search = term ? or(...(config.search ?? []).map((column) => ilike(column, term))) : undefined;
      const filters = (config.filters?.(params) ?? []).filter((c): c is SQL => Boolean(c));
      const where = and(alive, search, ...filters);

      const direction = params.order === 'desc' ? desc : asc;
      const sortColumn = sortColumns[params.sort] ?? t.id;

      const items = await ctx.db
        .select()
        .from(t)
        .where(where)
        // The id is a tie-breaker, so paging stays stable when many rows share the sort value.
        .orderBy(direction(sortColumn), asc(t.id))
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize);

      const [counted] = await ctx.db.select({ total: count() }).from(t).where(where);

      return {
        items: items as RowOf<T>[],
        page: params.page,
        pageSize: params.pageSize,
        total: counted?.total ?? 0,
      };
    },

    async insert(ctx, values) {
      const [row] = await service.insertMany(ctx, [values]);
      if (!row) throw new Error(`Insert into ${config.label} returned no row`);
      return row;
    },

    async insertMany(ctx, values) {
      if (values.length === 0) return [];
      const stamped = values.map((value) => ({
        ...value,
        orgId: ctx.actor.orgId,
        createdBy: ctx.actor.userId,
        updatedBy: ctx.actor.userId,
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
          updatedAt: sql`now()`,
          updatedBy: ctx.actor.userId,
        } as never)
        .where(and(eq(t.id, id), alive, expectedVersion === undefined ? undefined : eq(t.version, expectedVersion)))
        .returning();
      if (row) return row as RowOf<T>;

      // Nothing was updated: the row is gone (NOT_FOUND), or its version moved on.
      await service.get(ctx, id);
      throw new AppError('STALE', `${config.label} was changed by someone else. Reload and try again.`);
    },

    async remove(ctx, id) {
      const [row] = await ctx.db
        .update(t)
        .set({
          deletedAt: sql`now()`,
          updatedAt: sql`now()`,
          updatedBy: ctx.actor.userId,
          version: sql`${t.version} + 1`,
        } as never)
        .where(and(eq(t.id, id), alive))
        .returning({ id: t.id });
      if (!row) throw notFound(config.label);
    },
  };

  return service;
}

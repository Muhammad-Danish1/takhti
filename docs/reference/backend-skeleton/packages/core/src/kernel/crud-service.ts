import type {
  AnyResource,
  CreateData,
  EntityOf,
  ListData,
  Page,
  UpdateData,
} from '@school/contracts';
import { audit } from './audit';
import type { Ctx } from './context';
import type { DbService, InsertOf, PatchOf, RowOf, TenantTable } from './db-service';
import { assertCan } from './permissions';

type Awaitable<T> = T | Promise<T>;

/** The service every plain create/read/update/delete resource gets. */
export interface CrudService<R extends AnyResource> {
  list(ctx: Ctx, params: ListData<R>): Promise<Page<EntityOf<R>>>;
  get(ctx: Ctx, id: string): Promise<EntityOf<R>>;
  create(ctx: Ctx, input: CreateData<R>): Promise<EntityOf<R>>;
  update(ctx: Ctx, id: string, input: UpdateData<R>): Promise<EntityOf<R>>;
  remove(ctx: Ctx, id: string): Promise<void>;
}

/**
 * When the contract's shape already fits the table, no mapper is needed.
 * When it does not, TypeScript demands one, so the contract and the table cannot drift apart silently.
 */
type Mapper<TName extends string, TFrom, TTo> = [TFrom] extends [TTo]
  ? { [K in TName]?: (input: TFrom, ctx: Ctx) => TTo }
  : { [K in TName]: (input: TFrom, ctx: Ctx) => TTo };

type Changes<R extends AnyResource> = Omit<UpdateData<R>, 'version'>;

export type CrudServiceOptions<R extends AnyResource, T extends TenantTable> = {
  contract: R;
  db: DbService<T, ListData<R>>;
  /** Business rules. Throw `rule('...')` to stop the write; the transaction rolls back. */
  rules?: {
    beforeCreate?(ctx: Ctx, input: CreateData<R>): Awaitable<void>;
    beforeUpdate?(ctx: Ctx, current: RowOf<T>, input: UpdateData<R>): Awaitable<void>;
    beforeRemove?(ctx: Ctx, current: RowOf<T>): Awaitable<void>;
  };
} & Mapper<'toInsert', CreateData<R>, InsertOf<T>> &
  Mapper<'toPatch', Changes<R>, PatchOf<T>>;

/**
 * Wraps a db-service with the three things every write needs:
 * a permission check, the module's business rules and an audit entry.
 */
export function createCrudService<R extends AnyResource, T extends TenantTable>(
  options: CrudServiceOptions<R, T>,
): CrudService<R> {
  const { contract, db, rules } = options;
  const resource = contract.name;

  const mappers = options as {
    toInsert?: (input: CreateData<R>, ctx: Ctx) => InsertOf<T>;
    toPatch?: (input: Changes<R>, ctx: Ctx) => PatchOf<T>;
  };
  const toInsert = mappers.toInsert ?? ((input) => input as InsertOf<T>);
  const toPatch = mappers.toPatch ?? ((input) => input as PatchOf<T>);

  // Rows leave the server only through the contract, so an internal column can never leak into a response.
  const toEntity = (row: unknown) => contract.entity.parse(row) as EntityOf<R>;

  return {
    async list(ctx, params) {
      assertCan(ctx, resource, 'read');
      const page = await db.list(ctx, params);
      return { ...page, items: page.items.map(toEntity) };
    },

    async get(ctx, id) {
      assertCan(ctx, resource, 'read');
      return toEntity(await db.get(ctx, id));
    },

    async create(ctx, input) {
      assertCan(ctx, resource, 'create');
      await rules?.beforeCreate?.(ctx, input);
      const row = await db.insert(ctx, toInsert(input, ctx));
      await audit(ctx, resource, 'create', row.id, { after: row });
      return toEntity(row);
    },

    async update(ctx, id, input) {
      assertCan(ctx, resource, 'update');
      const current = await db.get(ctx, id);
      await rules?.beforeUpdate?.(ctx, current, input);
      const { version, ...changes } = input as UpdateData<R> & { version: number };
      const row = await db.update(ctx, id, toPatch(changes as Changes<R>, ctx), version);
      await audit(ctx, resource, 'update', id, { before: current, after: row });
      return toEntity(row);
    },

    async remove(ctx, id) {
      assertCan(ctx, resource, 'delete');
      const current = await db.get(ctx, id);
      await rules?.beforeRemove?.(ctx, current);
      await db.remove(ctx, id);
      await audit(ctx, resource, 'delete', id, { before: current });
    },
  };
}

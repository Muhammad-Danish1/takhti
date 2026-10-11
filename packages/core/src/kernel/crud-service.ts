import type {
  AnyResource,
  BulkResult,
  CreateData,
  EntityOf,
  EventDef,
  ListData,
  ModuleKey,
  Page,
  PermissionKey,
  UpdateData,
} from '@takhti/contracts';
import { audit } from './audit';
import { runBulk } from './bulk';
import type { Ctx } from './context';
import type { Condition, DbService, InsertOf, PatchOf, RowOf, TenantTable } from './db-service';
import { rule } from './errors';
import { emit } from './events';
import { assertModule } from './modules';
import { assertPermission } from './permissions';

type Awaitable<T> = T | Promise<T>;

/** The access word for an operation any member of the school may call. */
export const SIGNED_IN = 'signed-in';

/** The service every plain create, read, update and delete resource gets. */
export interface CrudService<R extends AnyResource> {
  list(ctx: Ctx, params: ListData<R>): Promise<Page<EntityOf<R>>>;
  get(ctx: Ctx, id: string): Promise<EntityOf<R>>;
  create(ctx: Ctx, input: CreateData<R>): Promise<EntityOf<R>>;
  /** Many creates in one call. One bad item does not undo the good ones. */
  createMany(ctx: Ctx, inputs: readonly CreateData<R>[]): Promise<BulkResult<EntityOf<R>>>;
  update(ctx: Ctx, id: string, input: UpdateData<R>): Promise<EntityOf<R>>;
  remove(ctx: Ctx, id: string): Promise<void>;
  restore(ctx: Ctx, id: string): Promise<EntityOf<R>>;
  /**
   * What each operation needs: a whole permission key, `signed-in`, or false when it is switched off.
   * The route builders read it, so a route refuses a caller before it reads their request.
   */
  permissions: Readonly<Record<CrudAction, string | false>>;
}

/**
 * When the contract's shape already fits the table, no mapper is needed.
 * When it does not, TypeScript demands one, so the contract and the table cannot drift apart silently.
 */
type Mapper<TName extends string, TFrom, TTo> = [TFrom] extends [TTo]
  ? { [K in TName]?: (input: TFrom, ctx: Ctx) => Awaitable<TTo> }
  : { [K in TName]: (input: TFrom, ctx: Ctx) => Awaitable<TTo> };

type Changes<R extends AnyResource> = Omit<UpdateData<R>, 'version'>;

export type CrudAction = 'list' | 'get' | 'create' | 'update' | 'delete' | 'restore';

export type CrudServiceOptions<R extends AnyResource, T extends TenantTable> = {
  contract: R;
  db: DbService<T, ListData<R>>;
  /** The module this resource belongs to. Its routes are refused when the module is off for the school. */
  module?: ModuleKey;
  /**
   * The permission action each operation needs, when it is not the plain one: setup records often
   * use `update` or `manage` for creating and deleting too. `false` switches the operation off.
   * Defaults: read, create, update, delete; restore needs what delete needs. `read` covers both
   * listing and opening one record; give `list` or `get` when they differ.
   *
   * A value with a colon is a whole permission key (`behaviour:manage`), for a resource whose
   * permissions belong to another one. `signed-in` lets every member of the school through: what
   * they then reach is decided by row-level security alone.
   */
  actions?: Partial<Record<CrudAction | 'read', string | false>>;
  /**
   * An extra condition applied to every read and checked on every write, for scoping that row-level
   * security does not do: a teacher's own sections, a cashier's own session.
   */
  scope?: (ctx: Ctx) => Awaitable<Condition>;
  /** Business rules. Throw `rule('...')` to stop the write; the transaction rolls back. */
  rules?: {
    beforeCreate?(ctx: Ctx, input: CreateData<R>): Awaitable<void>;
    beforeUpdate?(ctx: Ctx, current: RowOf<T>, input: UpdateData<R>): Awaitable<void>;
    beforeRemove?(ctx: Ctx, current: RowOf<T>): Awaitable<void>;
    beforeRestore?(ctx: Ctx, id: string): Awaitable<void>;
    /** Runs after each write, in the same transaction: follow-on changes that must succeed or fail with it. */
    afterWrite?(
      ctx: Ctx,
      row: RowOf<T>,
      action: 'create' | 'update' | 'delete' | 'restore',
    ): Awaitable<void>;
  };
  /** Events emitted after the write, in the same transaction. The payload defaults to `{ id }`. */
  events?: {
    created?: EventDef;
    updated?: EventDef;
    removed?: EventDef;
    payload?: (row: RowOf<T>) => Record<string, unknown>;
  };
  /** One line for the activity feed: `(row) => \`Added room ${row.name}\``. */
  summary?: (
    row: RowOf<T>,
    action: 'create' | 'update' | 'delete' | 'restore',
  ) => string | undefined;
} & Mapper<'toInsert', CreateData<R>, InsertOf<T>> &
  Mapper<'toPatch', Changes<R>, PatchOf<T>>;

/**
 * Layer 4. Wraps a db-service with what every write needs: the module switch, a permission check,
 * the module's business rules, an audit entry and the events that follow.
 */
export function createCrudService<R extends AnyResource, T extends TenantTable>(
  options: CrudServiceOptions<R, T>,
): CrudService<R> {
  const { contract, db, rules, events } = options;
  const resource = contract.name;

  const mappers = options as {
    toInsert?: (input: CreateData<R>, ctx: Ctx) => Awaitable<InsertOf<T>>;
    toPatch?: (input: Changes<R>, ctx: Ctx) => Awaitable<PatchOf<T>>;
  };
  const toInsert = mappers.toInsert ?? ((input) => input as InsertOf<T>);
  const toPatch = mappers.toPatch ?? ((input) => input as PatchOf<T>);

  // Rows leave the server only through the contract, so an internal column can never leak into a response.
  const toEntity = (row: unknown) => contract.entity.parse(row) as EntityOf<R>;

  const actionFor = (action: CrudAction): string | false => {
    const chosen = options.actions?.[action];
    if (chosen !== undefined) return chosen;
    if (action === 'list' || action === 'get') return options.actions?.read ?? 'read';
    // Restoring undoes a delete, so unless stated it needs whatever deleting needs.
    if (action === 'restore') return options.actions?.delete ?? 'delete';
    return action;
  };
  /** The whole key: a bare action belongs to this resource, `rooms` + `update` is `rooms:update`. */
  const permissionFor = (action: CrudAction): string | false => {
    const needed = actionFor(action);
    return needed === false || needed === SIGNED_IN || needed.includes(':')
      ? needed
      : `${resource}:${needed}`;
  };
  const permissions: Record<CrudAction, string | false> = {
    list: permissionFor('list'),
    get: permissionFor('get'),
    create: permissionFor('create'),
    update: permissionFor('update'),
    delete: permissionFor('delete'),
    restore: permissionFor('restore'),
  };
  const refused: Record<CrudAction, string> = {
    list: 'listed',
    get: 'opened',
    create: 'created',
    update: 'changed',
    delete: 'deleted',
    restore: 'restored',
  };

  async function allow(ctx: Ctx, action: CrudAction): Promise<void> {
    if (options.module) await assertModule(ctx, options.module);
    const needed = permissions[action];
    if (needed === false) throw rule(`${db.label} records cannot be ${refused[action]} here`);
    if (needed === SIGNED_IN) return;
    assertPermission(ctx, needed as PermissionKey);
  }

  const scopeOf = async (ctx: Ctx): Promise<Condition> =>
    options.scope ? await options.scope(ctx) : undefined;
  const payloadOf = (row: RowOf<T>) => events?.payload?.(row) ?? { id: row.id };
  const subject = (row: RowOf<T>) => ({ entityType: resource, entityId: row.id });
  const summarise = (row: RowOf<T>, action: 'create' | 'update' | 'delete' | 'restore') => {
    const summary = options.summary?.(row, action);
    return summary === undefined ? {} : { summary };
  };

  async function createOne(ctx: Ctx, input: CreateData<R>): Promise<EntityOf<R>> {
    await rules?.beforeCreate?.(ctx, input);
    const row = await db.insert(ctx, await toInsert(input, ctx));
    await audit(ctx, resource, 'create', row.id, { after: row, ...summarise(row, 'create') });
    await rules?.afterWrite?.(ctx, row, 'create');
    if (events?.created) await emit(ctx, events.created, payloadOf(row), subject(row));
    return toEntity(row);
  }

  return {
    permissions,

    async list(ctx, params) {
      await allow(ctx, 'list');
      const page = await db.list(ctx, params, await scopeOf(ctx));
      return { ...page, items: page.items.map(toEntity) };
    },

    async get(ctx, id) {
      await allow(ctx, 'get');
      return toEntity(await db.get(ctx, id, await scopeOf(ctx)));
    },

    async create(ctx, input) {
      await allow(ctx, 'create');
      return createOne(ctx, input);
    },

    async createMany(ctx, inputs) {
      await allow(ctx, 'create');
      return runBulk(ctx, inputs, (itemCtx, input) => createOne(itemCtx, input));
    },

    async update(ctx, id, input) {
      await allow(ctx, 'update');
      const current = await db.get(ctx, id, await scopeOf(ctx));
      await rules?.beforeUpdate?.(ctx, current, input);
      const { version, ...changes } = input as UpdateData<R> & { version: number };
      const row = await db.update(ctx, id, await toPatch(changes as Changes<R>, ctx), version);
      await audit(ctx, resource, 'update', id, {
        before: current,
        after: row,
        ...summarise(row, 'update'),
      });
      await rules?.afterWrite?.(ctx, row, 'update');
      if (events?.updated) await emit(ctx, events.updated, payloadOf(row), subject(row));
      return toEntity(row);
    },

    async remove(ctx, id) {
      await allow(ctx, 'delete');
      const current = await db.get(ctx, id, await scopeOf(ctx));
      await rules?.beforeRemove?.(ctx, current);
      await db.remove(ctx, id);
      await audit(ctx, resource, 'delete', id, {
        before: current,
        ...summarise(current, 'delete'),
      });
      await rules?.afterWrite?.(ctx, current, 'delete');
      if (events?.removed) await emit(ctx, events.removed, payloadOf(current), subject(current));
    },

    async restore(ctx, id) {
      await allow(ctx, 'restore');
      await rules?.beforeRestore?.(ctx, id);
      const row = await db.restore(ctx, id);
      await audit(ctx, resource, 'restore', id, { after: row, ...summarise(row, 'restore') });
      await rules?.afterWrite?.(ctx, row, 'restore');
      return toEntity(row);
    },
  };
}

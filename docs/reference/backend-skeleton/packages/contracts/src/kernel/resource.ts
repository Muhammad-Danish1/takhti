import { z } from 'zod';

/** Fields every record returns, whatever the module. */
export const baseEntity = {
  id: z.uuid(),
  version: z.int(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

/** What every list endpoint understands, whatever the module. */
export interface ListParams {
  page: number;
  pageSize: number;
  q?: string | undefined;
  sort: string;
  order: 'asc' | 'desc';
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Query string of a list endpoint: paging, search and sorting, plus the module's own filters.
 * Values arrive as text from the URL, so numbers are coerced.
 */
export function listQuery<
  const TSort extends readonly [string, ...string[]],
  TFilters extends z.ZodRawShape = {},
>(options: {
  sortable: TSort;
  defaultSort: NoInfer<TSort[number]>;
  defaultOrder?: 'asc' | 'desc';
  filters?: TFilters;
}) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().min(1).max(100).optional(),
    sort: z.enum(options.sortable).default(options.defaultSort),
    order: z.enum(['asc', 'desc']).default(options.defaultOrder ?? 'asc'),
    ...(options.filters as TFilters),
  });
}

/**
 * One module's API shape. Written once and reused by the route, the API client,
 * the hooks, the forms, offline sync and the AI tools.
 */
export interface ResourceContract<
  TEntity extends z.ZodType<{ id: string }> = z.ZodType<{ id: string }>,
  TCreate extends z.ZodType = z.ZodType,
  TUpdate extends z.ZodType<{ version: number }> = z.ZodType<{ version: number }>,
  TList extends z.ZodType<ListParams> = z.ZodType<ListParams>,
> {
  /** Permission prefix, cache key and audit name, e.g. "students". */
  name: string;
  /** REST path under /api/v1, e.g. "/students". */
  path: `/${string}`;
  /** What the API returns. */
  entity: TEntity;
  /** POST body. */
  create: TCreate;
  /** PATCH body. Always carries `version` so a stale edit is rejected instead of overwriting. */
  update: TUpdate;
  /** GET query string. */
  list: TList;
}

export function defineResource<
  TEntity extends z.ZodType<{ id: string }>,
  TCreate extends z.ZodType,
  TUpdate extends z.ZodType<{ version: number }>,
  TList extends z.ZodType<ListParams>,
>(contract: ResourceContract<TEntity, TCreate, TUpdate, TList>) {
  return contract;
}

export type AnyResource = ResourceContract;

export type EntityOf<R extends AnyResource> = z.output<R['entity']>;
/** `Input` is what a client sends; `Data` is what the server holds after validation (defaults applied). */
export type CreateInput<R extends AnyResource> = z.input<R['create']>;
export type CreateData<R extends AnyResource> = z.output<R['create']>;
export type UpdateInput<R extends AnyResource> = z.input<R['update']>;
export type UpdateData<R extends AnyResource> = z.output<R['update']>;
export type ListInput<R extends AnyResource> = z.input<R['list']>;
export type ListData<R extends AnyResource> = z.output<R['list']>;

/** Path parameter of every `/resource/[id]` route. */
export const IdParams = z.object({ id: z.uuid() });

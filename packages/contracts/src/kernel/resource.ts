import { z } from 'zod';
import type { ErrorCode, FieldErrors } from './errors';

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
  /** True when `total` is an estimate, used for very large tables. */
  totalIsEstimate?: boolean;
}

/** A page of a very long, append-only list (ledgers, logs, chat). */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** Result of a bulk call: one bad row never undoes the good ones. */
export interface BulkResult<T> {
  succeeded: T[];
  failed: { index: number; code: ErrorCode; message: string; fields?: FieldErrors }[];
}

/** The largest page a screen may ask for, and the larger one exports use. */
export const MAX_PAGE_SIZE = 100;
export const MAX_EXPORT_PAGE_SIZE = 200;

/**
 * Query string of a list endpoint: paging, search and sorting, plus the module's own filters.
 * Values arrive as text from the URL, so numbers are coerced.
 * An unknown parameter is rejected, so a typo is found at once instead of silently ignored.
 */
export function listQuery<
  const TSort extends readonly [string, ...string[]],
  TFilters extends z.ZodRawShape = {},
>(options: {
  sortable: TSort;
  defaultSort: NoInfer<TSort[number]>;
  defaultOrder?: 'asc' | 'desc';
  filters?: TFilters;
  /** Exports may ask for larger pages. */
  maxPageSize?: number;
}) {
  return z.strictObject({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(options.maxPageSize ?? MAX_PAGE_SIZE)
      .default(25),
    q: z.string().trim().min(1).max(100).optional(),
    sort: z.enum(options.sortable).default(options.defaultSort),
    order: z.enum(['asc', 'desc']).default(options.defaultOrder ?? 'asc'),
    ...(options.filters as TFilters),
  });
}

/** Query string of a cursor-paged list. */
export function cursorQuery<TFilters extends z.ZodRawShape = {}>(
  options: { filters?: TFilters; maxLimit?: number } = {},
) {
  return z.strictObject({
    cursor: z.string().min(1).max(200).optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(options.maxLimit ?? 100)
      .default(50),
    ...(options.filters as TFilters),
  });
}

/**
 * One resource's API shape. Written once and reused by the route, the API client,
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

/** Body of an action that changes one record and needs nothing else: carries the version last seen. */
export const VersionBody = z.object({ version: z.int() });

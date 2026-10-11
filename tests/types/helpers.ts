import type { InferSelectModel } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

/* Building blocks of the type tests. Nothing here runs; `pnpm typecheck` reads the files that use them. */

/** Compiles only when its argument is `true`. */
export type Expect<T extends true> = T;

/**
 * `true` when every field of a record type exists on the table's row with exactly the same type:
 * no field the table lacks, none whose type, allowed values or emptiness differ.
 * The record may leave out columns the API never returns (`orgId`, `createdBy`, `deletedAt`).
 */
export type Agrees<TTable extends PgTable, TEntity> = [
  Pick<InferSelectModel<TTable>, keyof TEntity & keyof InferSelectModel<TTable>>,
] extends [TEntity]
  ? [TEntity] extends [
      Pick<InferSelectModel<TTable>, keyof TEntity & keyof InferSelectModel<TTable>>,
    ]
    ? true
    : false
  : false;

import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  customType,
  date,
  index,
  integer,
  numeric,
  real,
  snakeCase,
  text,
  time,
  timestamp,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

/** Postgres cuts identifiers at 63 bytes without saying so; a name that long is shortened here, predictably. */
export function identifier(name: string): string {
  if (name.length <= 63) return name;
  return `${name.slice(0, 54)}_${createHash('sha256').update(name).digest('hex').slice(0, 8)}`;
}

type ExtraConfig = (columns: Record<string, AnyPgColumn>) => unknown[];

const withoutIndex = new WeakSet<object>();

/**
 * Marks a foreign key column that deliberately gets no index of its own: a column on a very large,
 * insert-heavy table that no query filters by. Say why beside each use; the conventions test lists them.
 */
export function unindexed<T extends object>(builder: T): T {
  withoutIndex.add(builder);
  return builder;
}

/** The first column of an index, unique constraint or primary key declared in a table's extra config. */
function leadingColumn(item: unknown): string | undefined {
  const entry = item as {
    config?: { columns?: { name?: string }[] };
    columns?: { name?: string }[];
  };
  return (entry.config?.columns ?? entry.columns)?.[0]?.name;
}

/**
 * Every table is declared with this instead of `pgTable`: code says `orgId`,
 * the database column is `org_id`, and nobody types the column name twice.
 *
 * It also keeps one convention by construction: every foreign key column is indexed.
 * A column that references another table and does not already lead an index, a unique constraint
 * or the primary key gets an index of its own (partial, when the column is optional).
 * `org_id` is the exception: every query reaches a table through another index, and the tenant
 * column alone would never be the one chosen.
 */
export const table: typeof snakeCase.table = ((
  name: string,
  columns: Record<string, unknown>,
  extra?: ExtraConfig,
) => {
  const referencing = Object.entries(columns)
    .filter(
      ([key, builder]) =>
        key !== 'orgId' &&
        !withoutIndex.has(builder as object) &&
        ((builder as { foreignKeyConfigs?: unknown[] }).foreignKeyConfigs?.length ?? 0) > 0,
    )
    .map(([key]) => key);

  const withForeignKeyIndexes: ExtraConfig = (t) => {
    const declared = extra ? extra(t) : [];
    const led = new Set(declared.map(leadingColumn));
    const added = referencing.flatMap((key) => {
      const column = t[key] as
        (AnyPgColumn & { primary?: boolean; isUnique?: boolean }) | undefined;
      if (!column || led.has(column.name) || column.primary || column.isUnique) return [];
      const builder = index(identifier(`${name}_${column.name}_fk_idx`)).on(column);
      return [column.notNull ? builder : builder.where(sql`${column} is not null`)];
    });
    return [...declared, ...added];
  };
  return snakeCase.table(name, columns as never, withForeignKeyIndexes as never);
}) as unknown as typeof snakeCase.table;

/** Timestamps are read as text, so nothing shifts by a day between the database, the API and Pakistan time. */
export const timestamptz = () => timestamp({ withTimezone: true, mode: 'string' });

/** A calendar date, read as `YYYY-MM-DD` text. Never a JavaScript Date. */
export const dateStr = () => date({ mode: 'string' });

/** A time of day, read as text. */
export const timeStr = () => time({ withTimezone: false });

/** Money in paisa. Whole numbers only, so integer maths cannot drift. Add a check with `nonNegative` unless negative is meaningful. */
export const paisa = () => bigint({ mode: 'number' });

/** A percentage with two decimals, read as a number. */
export const percent = () => numeric({ precision: 5, scale: 2, mode: 'number' });

/** Marks with two decimals, read as a number. */
export const marks = () => numeric({ precision: 6, scale: 2, mode: 'number' });

/** A full-text search document. Always a generated column: the database works it out and nothing writes it. */
export const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

/**
 * An embedding: the list of numbers a model gives a piece of text. It is kept as a plain array until
 * an embeddings provider is switched on; the migration that turns vector search on changes it to
 * pgvector's own type and adds its index. The in-process engine the tests run on has no pgvector.
 */
export const vector = () => real().array();

/** A number with a fixed number of decimals, read as a number. */
export const decimal = (precision: number, scale: number) =>
  numeric({ precision, scale, mode: 'number' });

/** A text column limited to a list of allowed values. Pair it with `enumChecks` so the database enforces the list. */
export const enumText = <const T extends readonly [string, ...string[]]>(values: T) =>
  text({ enum: values });

/**
 * A primary key the application normally supplies (so an offline device can create the record),
 * with a database default as the fallback.
 */
export const idColumn = () => uuid().primaryKey().defaultRandom();

/** Version, timestamps and actor columns shared by every business table. */
export const auditColumns = {
  /** Goes up by one on every change. An edit made against an old version is rejected. */
  version: integer().notNull().default(1),
  createdAt: timestamptz().notNull().defaultNow(),
  updatedAt: timestamptz().notNull().defaultNow(),
  createdBy: uuid(),
  updatedBy: uuid(),
  /** Rows are never physically deleted, so offline devices can learn that a row is gone. */
  deletedAt: timestamptz(),
};

type Columns = Record<string, AnyPgColumn>;

/**
 * A check constraint for every `enumText` column of a table, so the database refuses a value
 * outside the list even if a write bypasses the contract. Call it in the table's extra config.
 */
export function enumChecks(tableName: string, t: Columns) {
  return Object.values(t).flatMap((column) => {
    // Inside a table's extra-config callback the list is on `config`; on a built column it is on the column.
    const source = column as {
      enumValues?: readonly string[];
      config?: { enumValues?: readonly string[] };
    };
    const values = source.enumValues ?? source.config?.enumValues;
    if (!values || values.length === 0) return [];
    const list = sql.join(
      values.map((value) => sql.raw(`'${value.replace(/'/g, "''")}'`)),
      sql.raw(', '),
    );
    return [check(identifier(`${tableName}_${column.name}_chk`), sql`${column} in (${list})`)];
  });
}

/** `column >= 0`, for amounts and counts. */
export const nonNegative = (tableName: string, column: AnyPgColumn) =>
  check(identifier(`${tableName}_${column.name}_min`), sql`${column} >= 0`);

/** `column > 0`. */
export const positive = (tableName: string, column: AnyPgColumn) =>
  check(identifier(`${tableName}_${column.name}_pos`), sql`${column} > 0`);

/** `column between low and high`. */
export const between = (tableName: string, column: AnyPgColumn, low: number, high: number) =>
  check(
    identifier(`${tableName}_${column.name}_range`),
    sql`${column} between ${sql.raw(String(low))} and ${sql.raw(String(high))}`,
  );

/** The condition "this row is live", for partial unique indexes: unique among rows not deleted. */
export const live = (t: { deletedAt: AnyPgColumn }) => sql`${t.deletedAt} is null`;

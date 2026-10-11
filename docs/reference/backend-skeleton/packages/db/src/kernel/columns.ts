import { integer, snakeCase, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Every table is declared with this instead of `pgTable`: code says `orgId`,
 * the database column is `org_id`, and nobody types the column name twice.
 */
export const table = snakeCase.table;

/** Timestamps are read as text, so nothing shifts by a day between the database, the API and Pakistan time. */
export const timestamptz = () => timestamp({ withTimezone: true, mode: 'string' });

/**
 * Columns every tenant-owned table has. Spread into each table definition.
 * The db-service layer fills all of them in; module code never sets them by hand.
 */
export const baseColumns = {
  /** Generated here by default, or by an offline device before it syncs. */
  id: uuid().primaryKey().defaultRandom(),
  /** The school group that owns the row. Row-level security filters on it. */
  orgId: uuid().notNull(),
  /** Goes up by one on every change. An edit made against an old version is rejected. */
  version: integer().notNull().default(1),
  createdAt: timestamptz().notNull().defaultNow(),
  updatedAt: timestamptz().notNull().defaultNow(),
  createdBy: uuid(),
  updatedBy: uuid(),
  /** Rows are never physically deleted, so offline devices can learn that a row is gone. */
  deletedAt: timestamptz(),
};

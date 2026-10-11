import { uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { auditColumns, idColumn, timestamptz } from './columns';

/*
 * This file must not import any table file. Table files import it and spread `baseColumns` while
 * they are being loaded; if this file were still half-loaded at that moment (which a circular
 * import would cause), the spread would silently add nothing and the table would lose its columns.
 * So the two tables it needs, `orgs` and `branches`, introduce themselves through
 * `bindOrgsTable` and `bindBranchesTable` instead.
 */

let orgsId: AnyPgColumn | undefined;

/** Called once, by the organisations table file, so that `org_id` columns can reference it. */
export function bindOrgsTable(id: AnyPgColumn): void {
  orgsId = id;
}

const orgsIdColumn = (): AnyPgColumn => {
  if (!orgsId)
    throw new Error(
      'The orgs table is not loaded. Import tables through `@takhti/db`, not one file at a time.',
    );
  return orgsId;
};

/** The school group that owns a row. Row-level security filters on it. */
export const orgIdColumn = () => uuid().notNull().references(orgsIdColumn);

let branchesId: AnyPgColumn | undefined;

/** Called once, by the branches table file, so that `branch_id` columns can reference it. */
export function bindBranchesTable(id: AnyPgColumn): void {
  branchesId = id;
}

const branchesIdColumn = (): AnyPgColumn => {
  if (!branchesId)
    throw new Error(
      'The branches table is not loaded. Import tables through `@takhti/db`, not one file at a time.',
    );
  return branchesId;
};

/** The branch a row belongs to. Spread after `baseColumns` in every branch-level table. */
export const branchIdColumn = () => uuid().notNull().references(branchesIdColumn);

/**
 * Columns every tenant-owned table has. Spread into each table definition.
 * The db-service layer fills all of them in; module code never sets them by hand.
 */
export const baseColumns = {
  /** Made by the application (so an offline device can create the record) or, as a fallback, by the database. */
  id: idColumn(),
  orgId: orgIdColumn(),
  ...auditColumns,
};

/** Columns of an append-only table: no version, no update, no delete. */
export const appendColumns = {
  id: idColumn(),
  orgId: orgIdColumn(),
  createdAt: timestamptz().notNull().defaultNow(),
  createdBy: uuid(),
};

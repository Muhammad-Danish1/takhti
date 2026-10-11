import { sql } from 'drizzle-orm';
import { pgPolicy, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { authenticatedRole } from 'drizzle-orm/supabase';

/*
 * Row-level security is the second wall behind the permission checks in the service layer:
 * even a buggy query cannot read another school's rows.
 *
 * `app.org_id()`, `app.all_branches()` and `app.branch_ids()` are small SQL functions (created in the
 * first migration) that read the signed-in user's token. Wrapping each call in `(select ...)` lets
 * Postgres evaluate it once per query instead of once per row.
 */

/** Rows are visible only inside their own school group. */
export function orgScoped(table: string, t: { orgId: AnyPgColumn }) {
  const sameOrg = sql`${t.orgId} = (select app.org_id())`;
  return [
    pgPolicy(`${table}_org`, {
      for: 'all',
      to: authenticatedRole,
      using: sameOrg,
      withCheck: sameOrg,
    }),
  ];
}

/** As `orgScoped`, and also limited to the branches the user is assigned to. */
export function branchScoped(table: string, t: { orgId: AnyPgColumn; branchId: AnyPgColumn }) {
  const ownBranch = sql`((select app.all_branches()) or ${t.branchId} = any ((select app.branch_ids())::uuid[]))`;
  return [
    ...orgScoped(table, t),
    pgPolicy(`${table}_branch`, {
      as: 'restrictive',
      for: 'all',
      to: authenticatedRole,
      using: ownBranch,
      withCheck: ownBranch,
    }),
  ];
}

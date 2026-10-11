import { getColumns, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminDb, identifier, registeredTables, rowsOf } from '@takhti/db';
import { createTestDb, type TestDb } from '../helpers/test-db';

/*
 * The rules of docs/plan/00-foundation/05-conventions.md, part B, checked against the real database
 * for every table at once. (`pnpm db:lint` runs this folder.) A rule with deliberate exceptions lists
 * them here, with the reason, so an exception is always a decision and never an accident.
 */

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.destroy();
});

const tables = registeredTables();

/** Organisation tables that keep their own, shorter set of base columns, and why. */
const ownLifecycle: Record<string, string> = {
  jobs: 'a queue row has a state of its own and is purged when finished, never soft-deleted',
  idempotency_keys: 'a stored reply, removed when it expires',
};
const snake = (name: string) => name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

describe('columns', () => {
  it('every table has the base columns of its scope', () => {
    const problems: string[] = [];
    for (const table of tables) {
      const columns = getColumns(table.table) as Record<string, PgColumn>;
      const needs: string[] = [];
      if (table.scope === 'org' || table.scope === 'branch') {
        needs.push('id', table.orgColumn ?? 'orgId', 'createdAt');
        if (table.scope === 'branch') needs.push('branchId');
        // A table whose rows are only ever added has no version and no "deleted" mark.
        if (!table.appendOnly && table.orgColumn !== 'id' && !(table.name in ownLifecycle))
          needs.push('version', 'updatedAt', 'deletedAt', 'createdBy', 'updatedBy');
      }
      for (const name of needs) {
        if (!columns[name]) problems.push(`${table.name}: no ${snake(name)} column`);
      }
      if (table.scope === 'branch' && columns.branchId && !columns.branchId.notNull)
        problems.push(`${table.name}: branch_id may be empty on a branch-level table`);
    }
    expect(problems).toEqual([]);
  });

  it('a moment is a timestamp with time zone and a day is a date, by the name of the column', async () => {
    const rows = rowsOf<{ name: string; type: string }>(
      await adminDb().execute(sql`
        select table_name || '.' || column_name as name, data_type as type
        from information_schema.columns
        where table_schema = 'public'
          and table_name in (select tablename from pg_tables where schemaname = 'public')
          and (
            (column_name like '%\\_at' and data_type <> 'timestamp with time zone')
            or ((column_name like '%\\_on' or column_name like '%\\_date') and data_type <> 'date')
          )
        order by 1
      `),
    );
    // Exceptions, each with its reason:
    const allowed = new Set<string>([
      // "To date" here means "so far this tax year": these are running totals of money, not days.
      'payslips.tax_to_date',
      'payslips.taxable_to_date',
    ]);
    expect(rows.map((row) => row.name).filter((name) => !allowed.has(name))).toEqual([]);
  });

  it('every list of allowed values is enforced by a check constraint that names exactly those values', async () => {
    const rows = rowsOf<{ table_name: string; name: string; definition: string }>(
      await adminDb().execute(sql`
        select c.conrelid::regclass::text as table_name, c.conname as name, pg_get_constraintdef(c.oid) as definition
        from pg_constraint c
        where c.contype = 'c' and c.connamespace = 'public'::regnamespace
      `),
    );
    const checks = new Map(rows.map((row) => [`${row.table_name}.${row.name}`, row.definition]));
    const problems: string[] = [];
    for (const table of tables) {
      for (const column of Object.values(getColumns(table.table) as Record<string, PgColumn>)) {
        const values = column.enumValues;
        if (!values || values.length === 0) continue;
        const name = identifier(`${table.name}_${column.name}_chk`);
        const definition = checks.get(`${table.name}.${name}`);
        if (!definition) {
          problems.push(`${table.name}.${column.name}: no check constraint "${name}"`);
          continue;
        }
        const allowed = [...definition.matchAll(/'((?:[^']|'')*)'::text/g)].map((match) =>
          (match[1] ?? '').replace(/''/g, "'"),
        );
        if ([...allowed].sort().join('|') !== [...values].sort().join('|'))
          problems.push(
            `${table.name}.${column.name}: the database allows [${allowed.join(', ')}], the code says [${values.join(', ')}]`,
          );
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('uniqueness', () => {
  it('"unique" means unique among live rows: every unique index on a table with deleted_at leaves deleted rows out', async () => {
    const rows = rowsOf<{ name: string }>(
      await adminDb().execute(sql`
        select i.indexrelid::regclass::text as name
        from pg_index i
        join pg_class c on c.oid = i.indrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and i.indisunique and not i.indisprimary
          and exists (select from pg_attribute a where a.attrelid = c.oid and a.attname = 'deleted_at' and not a.attisdropped)
          and coalesce(pg_get_expr(i.indpred, i.indrelid), '') not like '%deleted_at IS NULL%'
        order by 1
      `),
    );
    // Deliberately for ever, deleted or not:
    const forEver = [
      // A stored object's path and a token's hash each name one thing for all time.
      'files_path_uq',
      'invitations_token_uq',
      'api_keys_key_hash_uq',
      'id_cards_qr_token_hash_uq',
      'admission_applications_tracking_token_hash_uq',
      'calendar_feeds_token_hash_uq',
      // An outside service's event id is remembered for ever, so a repeated delivery is recognised however old.
      'webhook_events_provider_event_uq',
      // The code printed on a document must keep pointing at that document, and an invoice number is never used twice.
      'generated_documents_verify_uq',
      'subscription_invoices_number_uq',
      // One counter per (organisation, key, branch, period): a counter is never deleted, and an empty branch counts as a value.
      'number_sequences_uq',
      // One row per user, kept for the life of the account.
      'user_preferences_user_uq',
    ];
    expect(rows.map((row) => row.name)).toEqual([...forEver].sort());
  });
});

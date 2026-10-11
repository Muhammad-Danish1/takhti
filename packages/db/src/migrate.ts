import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { boardCatalogue, permissionCatalogue } from '@takhti/contracts';
import { registeredTables } from './registry';
import './schema';

/*
 * The one way the database schema changes: locally, in tests and in production.
 *
 *   1. Applies every migration folder that has not been applied yet, each in its own transaction.
 *   2. Brings table triggers in line with the conventions (`app.sync_table_rules`).
 *   3. Brings the `permissions` table in line with the catalogue in code.
 *   4. Brings the `boards` table in line with the list of examination boards in code.
 *
 * Steps 2 to 4 run every time and change nothing when nothing is out of line.
 *
 * Safety rules, each of which stops the run with a plain message:
 *   - a migration that was already applied must not have been edited since;
 *   - an applied migration must still exist in the folder;
 *   - a new migration must sort after everything already applied;
 *   - two runs at once wait for each other instead of colliding.
 */

/** The little a migration run needs from a database connection. Both must use one and the same session. */
export interface MigrationTarget {
  /** Runs SQL that may hold many statements. */
  exec(text: string): Promise<void>;
  /** Runs one statement with parameters and returns its rows. */
  query<T = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<T[]>;
}

export interface MigrationResult {
  /** Names of the migrations applied by this run, in order. */
  applied: string[];
  /** How many were already in place. */
  alreadyApplied: number;
  permissions: { added: number; updated: number; removed: number };
  boards: { added: number; updated: number; retired: number };
}

export interface MigrationOptions {
  /** Where the migration folders are. Defaults to `packages/db/migrations`. */
  folder?: string;
  log?: (line: string) => void;
}

export const defaultMigrationsFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../migrations',
);

interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

/** Line endings differ between Windows and Linux checkouts; the checksum must not. */
const normalise = (text: string) => text.replace(/\r\n/g, '\n');

export function readMigrations(folder: string = defaultMigrationsFolder): MigrationFile[] {
  if (!existsSync(folder)) throw new Error(`Migrations folder not found: ${folder}`);
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const file = join(folder, name, 'migration.sql');
      if (!existsSync(file)) throw new Error(`Migration "${name}" has no migration.sql`);
      const sql = normalise(readFileSync(file, 'utf8'));
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });
}

/** A fingerprint of every migration and of the catalogue; the test database cache is keyed on it. */
export function schemaFingerprint(folder: string = defaultMigrationsFolder): string {
  const hash = createHash('sha256');
  for (const migration of readMigrations(folder))
    hash.update(migration.name).update(migration.checksum);
  hash.update(
    JSON.stringify(
      permissionCatalogue.map((permission) => [
        permission.key,
        permission.label,
        permission.sensitive ?? false,
      ]),
    ),
  );
  hash.update(JSON.stringify(appendOnlyTables()));
  hash.update(JSON.stringify(boardCatalogue));
  return hash.digest('hex').slice(0, 16);
}

const appendOnlyTables = (): string[] =>
  registeredTables()
    .filter((table) => table.appendOnly)
    .map((table) => table.name)
    .sort();

const LOCK_KEY = 7_254_817; // any fixed number; it only has to be the same for every run

export async function applyMigrations(
  target: MigrationTarget,
  options: MigrationOptions = {},
): Promise<MigrationResult> {
  const log = options.log ?? (() => {});
  const migrations = readMigrations(options.folder);

  await target.exec(`
    create schema if not exists app;
    create table if not exists app.schema_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    );
  `);

  await target.query('select pg_advisory_lock($1)', [LOCK_KEY]);
  try {
    const done = await target.query<{ name: string; checksum: string }>(
      'select name, checksum from app.schema_migrations order by name',
    );
    const doneByName = new Map(done.map((row) => [row.name, row.checksum]));
    const onDisk = new Set(migrations.map((migration) => migration.name));

    for (const row of done) {
      if (!onDisk.has(row.name)) {
        throw new Error(
          `Migration "${row.name}" is recorded in the database but its folder is gone. Restore the folder; a merged migration is never removed.`,
        );
      }
    }
    const lastApplied = done.at(-1)?.name;
    const applied: string[] = [];

    for (const migration of migrations) {
      const recorded = doneByName.get(migration.name);
      if (recorded !== undefined) {
        if (recorded !== migration.checksum) {
          throw new Error(
            `Migration "${migration.name}" was edited after it was applied. A merged migration is never edited: add a new one. ` +
              'On a local database that holds nothing worth keeping, run `pnpm db:reset`.',
          );
        }
        continue;
      }
      if (lastApplied !== undefined && migration.name < lastApplied) {
        throw new Error(
          `Migration "${migration.name}" is new but sorts before "${lastApplied}", which is already applied. ` +
            'Generate it again so that it gets a later timestamp.',
        );
      }

      log(`applying ${migration.name}`);
      try {
        await target.exec('begin');
        // Operator classes of the extensions (trigram search, "no two rows overlap") are named without
        // their schema in a migration, so they must be findable whatever the connecting role's defaults are.
        await target.exec('set local search_path = public, extensions');
        await target.exec(migration.sql);
        await target.query('insert into app.schema_migrations (name, checksum) values ($1, $2)', [
          migration.name,
          migration.checksum,
        ]);
        await target.exec('commit');
      } catch (error) {
        await target.exec('rollback').catch(() => {});
        throw new Error(
          `Migration "${migration.name}" failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`,
          {
            cause: error,
          },
        );
      }
      applied.push(migration.name);
    }

    await target.query('select app.sync_table_rules($1::text[])', [appendOnlyTables()]);
    const permissions = await syncPermissions(target);
    if (permissions.added + permissions.updated + permissions.removed > 0) {
      log(
        `permissions: ${permissions.added} added, ${permissions.updated} updated, ${permissions.removed} removed`,
      );
    }

    const boards = await syncBoards(target);
    if (boards.added + boards.updated + boards.retired > 0) {
      log(
        `examination boards: ${boards.added} added, ${boards.updated} updated, ${boards.retired} switched off`,
      );
    }

    return { applied, alreadyApplied: migrations.length - applied.length, permissions, boards };
  } finally {
    await target.query('select pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
  }
}

/**
 * The `permissions` table mirrors the catalogue in code. A permission that left the code is removed,
 * together with the grants of it, so no role keeps a permission that means nothing any more.
 */
async function syncPermissions(target: MigrationTarget): Promise<MigrationResult['permissions']> {
  const wanted = permissionCatalogue.map((permission) => ({
    key: permission.key,
    resource: permission.resource,
    action: permission.action,
    module_key: permission.module,
    label: permission.label,
    is_sensitive: permission.sensitive ?? false,
  }));
  const existing = await target.query<{
    key: string;
    resource: string;
    action: string;
    module_key: string;
    label: string;
    is_sensitive: boolean;
  }>('select key, resource, action, module_key, label, is_sensitive from public.permissions');
  const existingByKey = new Map(existing.map((row) => [row.key, row]));
  const wantedKeys = new Set<string>(wanted.map((row) => row.key));

  let added = 0;
  let updated = 0;
  for (const row of wanted) {
    const current = existingByKey.get(row.key);
    if (!current) {
      await target.query(
        'insert into public.permissions (key, resource, action, module_key, label, is_sensitive) values ($1, $2, $3, $4, $5, $6)',
        [row.key, row.resource, row.action, row.module_key, row.label, row.is_sensitive],
      );
      added += 1;
    } else if (
      current.resource !== row.resource ||
      current.action !== row.action ||
      current.module_key !== row.module_key ||
      current.label !== row.label ||
      current.is_sensitive !== row.is_sensitive
    ) {
      await target.query(
        'update public.permissions set resource = $2, action = $3, module_key = $4, label = $5, is_sensitive = $6 where key = $1',
        [row.key, row.resource, row.action, row.module_key, row.label, row.is_sensitive],
      );
      updated += 1;
    }
  }

  const stale = existing.filter((row) => !wantedKeys.has(row.key)).map((row) => row.key);
  if (stale.length > 0) {
    await target.query(
      'delete from public.role_permissions where permission_key = any ($1::text[])',
      [stale],
    );
    await target.query('delete from public.permissions where key = any ($1::text[])', [stale]);
  }
  return { added, updated, removed: stale.length };
}

/**
 * The `boards` table mirrors the list of examination boards in code, in every environment.
 * A board that left the list is switched off, not removed: past results and registrations name it.
 */
async function syncBoards(target: MigrationTarget): Promise<MigrationResult['boards']> {
  const existing = await target.query<{
    key: string;
    name: string;
    short_name: string;
    province: string | null;
    kind: string;
    website: string | null;
    is_active: boolean;
  }>(
    'select key, name, short_name, province, kind, website, is_active from public.boards where deleted_at is null',
  );
  const existingByKey = new Map(existing.map((row) => [row.key, row]));
  const wantedKeys = new Set(boardCatalogue.map((board) => board.key));

  let added = 0;
  let updated = 0;
  for (const board of boardCatalogue) {
    const website = board.website ?? null;
    const values = [board.key, board.name, board.shortName, board.province, board.kind, website];
    const current = existingByKey.get(board.key);
    if (!current) {
      await target.query(
        'insert into public.boards (key, name, short_name, province, kind, website) values ($1, $2, $3, $4, $5, $6)',
        values,
      );
      added += 1;
    } else if (
      current.name !== board.name ||
      current.short_name !== board.shortName ||
      current.province !== board.province ||
      current.kind !== board.kind ||
      current.website !== website ||
      !current.is_active
    ) {
      await target.query(
        'update public.boards set name = $2, short_name = $3, province = $4, kind = $5, website = $6, is_active = true, version = version + 1 where key = $1 and deleted_at is null',
        values,
      );
      updated += 1;
    }
  }

  const retired = existing.filter((row) => !wantedKeys.has(row.key) && row.is_active);
  if (retired.length > 0) {
    await target.query(
      'update public.boards set is_active = false, version = version + 1 where key = any ($1::text[]) and deleted_at is null',
      [retired.map((row) => row.key)],
    );
  }
  return { added, updated, retired: retired.length };
}

/** A target on a real Postgres. Uses a single connection so the advisory lock and the transactions share a session. */
export function postgresTarget(url: string): MigrationTarget & { close(): Promise<void> } {
  const client = postgres(url, { max: 1, prepare: false, onnotice: () => {}, connect_timeout: 15 });
  return {
    exec: async (text) => {
      await client.unsafe(text);
    },
    query: async <T>(text: string, params: readonly unknown[] = []) =>
      (await client.unsafe(text, params as never[])) as unknown as T[],
    close: () => client.end({ timeout: 5 }),
  };
}

/** A target on an in-process Postgres (PGlite), which is one session by nature. */
export function pgliteTarget(pg: {
  exec(text: string): Promise<unknown>;
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}): MigrationTarget {
  return {
    exec: async (text) => {
      await pg.exec(text);
    },
    query: async <T>(text: string, params: readonly unknown[] = []) =>
      (await pg.query(text, [...params])).rows as T[],
  };
}

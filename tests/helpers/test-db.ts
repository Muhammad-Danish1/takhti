import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { closeDatabase, configureDatabase, type Db } from '@takhti/db';
import {
  applyMigrations,
  pgliteTarget,
  postgresTarget,
  schemaFingerprint,
} from '@takhti/db/migrate';

/*
 * A fresh database for one test file, with every migration applied.
 *
 *   TEST_DB=pglite    (default) an in-process Postgres, loaded from a prepared copy in well under a second
 *   TEST_DB=postgres  a database on the Docker Postgres, cloned from a prepared template (`pnpm test:db`)
 *
 * `global-setup.ts` prepares the copy or the template once per run; a test file calls `createTestDb()`
 * in `beforeAll` and `destroy()` in `afterAll`.
 */

export type TestEngine = 'pglite' | 'postgres';

export const testEngine = (): TestEngine =>
  process.env.TEST_DB === 'postgres' ? 'postgres' : 'pglite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cacheDir = resolve(root, '.test-db');
const extensions = { pg_trgm, btree_gist };

export const pgliteTemplateFile = () => resolve(cacheDir, `pglite-${schemaFingerprint()}.tar`);
export const postgresTemplateName = () => `takhti_test_tpl_${schemaFingerprint()}`;

export interface TestDb {
  engine: TestEngine;
  /** On the Docker Postgres: the address the application signs in with, as the unprivileged `takhti_api` role. */
  appUrl?: string;
  destroy(): Promise<void>;
}

/** Builds the prepared copy for PGlite. Called once per run by the global setup. */
export async function preparePgliteTemplate(): Promise<void> {
  const file = pgliteTemplateFile();
  if (existsSync(file)) return;
  mkdirSync(cacheDir, { recursive: true });
  const pg = new PGlite({ extensions });
  try {
    await pg.exec('create schema if not exists extensions; set search_path = public, extensions;');
    await applyMigrations(pgliteTarget(pg));
    const dump = await pg.dumpDataDir('none');
    writeFileSync(file, Buffer.from(await dump.arrayBuffer()));
  } finally {
    await pg.close();
  }
}

const withDatabase = (url: string, database: string): string => {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
};

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value || value === 'postgres://unused')
    throw new Error(`${name} must point at the Docker database when TEST_DB=postgres`);
  return value;
};

/** Refuses to touch anything but a local database: test runs create and drop databases. */
function assertLocal(url: string): void {
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    throw new Error(`Tests only run against a local database, not "${host}"`);
  }
}

/** Builds the template database on Docker Postgres. Called once per run by the global setup. */
export async function preparePostgresTemplate(): Promise<void> {
  const adminUrl = requireEnv('DATABASE_ADMIN_URL');
  assertLocal(adminUrl);
  const template = postgresTemplateName();
  const server = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    const existing =
      await server`select datname from pg_database where datname like 'takhti_test_%'`;
    const names = existing.map((row) => row.datname as string);
    // Left-overs of earlier runs: other fingerprints' templates and per-file databases that were never dropped.
    for (const name of names.filter((name) => name !== template)) {
      await server.unsafe(`drop database if exists "${name}" with (force)`);
    }
    if (names.includes(template)) return;
    await server.unsafe(`create database "${template}"`);
  } finally {
    await server.end({ timeout: 5 });
  }
  const target = postgresTarget(withDatabase(adminUrl, template));
  try {
    await applyMigrations(target);
  } finally {
    await target.close();
  }
}

async function createPglite(): Promise<TestDb> {
  const file = pgliteTemplateFile();
  if (!existsSync(file)) await preparePgliteTemplate();
  const pg = new PGlite({ extensions, loadDataDir: new Blob([readFileSync(file)]) });
  await pg.exec('set search_path = public, extensions;');
  // One in-process session plays both parts: privileged outside a transaction, the signed-in user inside `withUserTx`.
  const db = drizzlePglite({ client: pg }) as unknown as Db;
  configureDatabase({ app: db, admin: db, close: () => pg.close(), singleSession: true });
  return { engine: 'pglite', destroy: closeDatabase };
}

async function createPostgres(): Promise<TestDb> {
  const adminUrl = requireEnv('DATABASE_ADMIN_URL');
  const appUrl = requireEnv('DATABASE_URL');
  assertLocal(adminUrl);
  assertLocal(appUrl);
  const name = `takhti_test_${randomBytes(6).toString('hex')}`;
  const server = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    await server.unsafe(`create database "${name}" template "${postgresTemplateName()}"`);
  } finally {
    await server.end({ timeout: 5 });
  }

  const options = {
    prepare: false,
    onnotice: () => {},
    idle_timeout: 20,
    connect_timeout: 15,
  } as const;
  const appClient = postgres(withDatabase(appUrl, name), { ...options, max: 12 });
  const adminClient = postgres(withDatabase(adminUrl, name), { ...options, max: 6 });
  configureDatabase({
    app: drizzlePostgres({ client: appClient }),
    admin: drizzlePostgres({ client: adminClient }),
    close: async () => {
      await Promise.all([appClient.end({ timeout: 5 }), adminClient.end({ timeout: 5 })]);
    },
  });

  return {
    engine: 'postgres',
    appUrl: withDatabase(appUrl, name),
    destroy: async () => {
      await closeDatabase();
      const cleaner = postgres(adminUrl, { max: 1, onnotice: () => {} });
      try {
        await cleaner.unsafe(`drop database if exists "${name}" with (force)`);
      } finally {
        await cleaner.end({ timeout: 5 });
      }
    },
  };
}

/** A fresh, fully migrated database, wired into `@takhti/db` so `withUserTx` and `adminDb` use it. */
export const createTestDb = (): Promise<TestDb> =>
  testEngine() === 'postgres' ? createPostgres() : createPglite();

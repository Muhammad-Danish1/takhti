/*
 * Replaces the local database with the contents of a backup.
 *
 *   pnpm db:restore backups/takhti-2026-10-10T12-00-00.sql
 *
 * Everything now in the local database is lost: it is emptied, the schema is rebuilt by the
 * migrations, and the backup's rows are loaded into it, all or nothing.
 *
 * Local development only. It refuses to run against a database that is not on this machine.
 */
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyMigrations, postgresTarget } from '../migrate';
import {
  assertLocalDatabase,
  databaseContainer,
  fail,
  repoRoot,
  requireEnv,
  setApiRolePassword,
} from './local';

const adminUrl = requireEnv('DATABASE_ADMIN_URL');
const apiPassword = requireEnv('TAKHTI_API_DB_PASSWORD');
assertLocalDatabase(adminUrl, 'restore the database');

const given = process.argv.slice(2).find((argument) => !argument.startsWith('-'));
if (!given) fail('Say which backup to restore:  pnpm db:restore backups/<file>.sql');
const file = resolve(repoRoot, given);
if (!existsSync(file)) fail(`No such file: ${given}`);

async function migrate(): Promise<void> {
  const target = postgresTarget(adminUrl);
  try {
    await applyMigrations(target);
    await setApiRolePassword(target, apiPassword);
  } finally {
    await target.close();
  }
}

console.log('1/3  Emptying the local database…');
const reset = spawnSync('supabase', ['db', 'reset', '--no-seed'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
});
if (reset.status !== 0)
  fail('`supabase db reset` failed. Is Docker running, and was `pnpm db:start` run?');

console.log('2/3  Rebuilding the schema…');
await migrate().catch((error: unknown) =>
  fail(error instanceof Error ? error.message : String(error)),
);

console.log('3/3  Loading the backup…');
const psql = [
  'exec',
  '-i',
  databaseContainer(),
  'psql',
  '--username=supabase_admin',
  '--dbname=postgres',
  '--quiet',
  '--set=ON_ERROR_STOP=1',
];
// The migrations have just filled the permission catalogue; the backup brings its own copy.
const clear = spawnSync(
  'docker',
  [...psql, '--command=truncate table public.permissions cascade'],
  { stdio: 'inherit' },
);
if (clear.status !== 0) fail('Could not prepare the database for the backup.');

const input = openSync(file, 'r');
const load = spawnSync('docker', [...psql, '--single-transaction', '--file=-'], {
  stdio: [input, 'ignore', 'inherit'],
});
closeSync(input);
if (load.status !== 0) {
  fail(
    'The backup could not be loaded, and none of it was kept. The database is empty but usable: run `pnpm db:reset` for a fresh one.',
  );
}

// Brings the permission catalogue back in line with the code, in case the backup is from an older version.
await migrate().catch((error: unknown) =>
  fail(error instanceof Error ? error.message : String(error)),
);
console.log(`\nRestored ${given}.`);

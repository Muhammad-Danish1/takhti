/*
 * Saves the data of the local database to a file in `backups/`.
 *
 *   pnpm db:backup
 *
 * It holds every row of the application's tables, the sign-in accounts and the records of stored
 * files. It does not hold the files' bytes, which live in the Storage container.
 * Restore it with `pnpm db:restore backups/<file>.sql`.
 *
 * Local development only. Backups of a real school's data are made by the hosting platform and
 * are covered in docs/plan/20-phases/phase-21-hardening-and-launch.md.
 */
import { spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertLocalDatabase, databaseContainer, fail, repoRoot, requireEnv } from './local';

assertLocalDatabase(requireEnv('DATABASE_ADMIN_URL'), 'back up the database');

const folder = resolve(repoRoot, 'backups');
mkdirSync(folder, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = resolve(folder, `takhti-${stamp}.sql`);

const output = openSync(file, 'w');
const dump = spawnSync(
  'docker',
  [
    'exec',
    databaseContainer(),
    'pg_dump',
    '--username=supabase_admin',
    '--dbname=postgres',
    '--data-only',
    // Tables reference each other in circles (an organisation's logo is a file; a file belongs to an organisation).
    '--disable-triggers',
    '--no-owner',
    '--no-privileges',
    '--schema=public',
    '--schema=auth',
    '--schema=storage',
    // Each service keeps a record of its own migrations; a restored database already has them.
    '--exclude-table=auth.schema_migrations',
    '--exclude-table=storage.migrations',
  ],
  { stdio: ['ignore', output, 'inherit'] },
);
closeSync(output);

if (dump.status !== 0) fail('The backup failed. Is the local stack running (pnpm db:start)?');
const size = statSync(file).size;
if (size < 1_000) fail('The backup is empty. Is there a database to back up (pnpm db:reset)?');
console.log(`Saved ${(size / 1024).toFixed(0)} KB to backups/takhti-${stamp}.sql`);
console.log(`Restore it with:  pnpm db:restore backups/takhti-${stamp}.sql`);

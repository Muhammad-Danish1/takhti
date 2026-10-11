/*
 * Rebuilds the local database from nothing: empties it (including sign-in accounts and stored files),
 * applies every migration, lets the application role sign in, then loads the seed data.
 *
 *   pnpm db:reset                      everything
 *   pnpm db:reset --no-seed            schema only
 *   pnpm db:reset --today 2026-11-15   the seed as it would look on that day (also --small, --large)
 *
 * Local development only. It refuses to run against a database that is not on this machine.
 */
import { spawnSync } from 'node:child_process';
import { applyMigrations, postgresTarget } from '../migrate';
import { assertLocalDatabase, fail, repoRoot, requireEnv, setApiRolePassword } from './local';

const adminUrl = requireEnv('DATABASE_ADMIN_URL');
const apiPassword = requireEnv('TAKHTI_API_DB_PASSWORD');
assertLocalDatabase(adminUrl, 'reset the database');

console.log(
  '1/3  Emptying the local database (Supabase recreates it; this takes about half a minute)…',
);
const reset = spawnSync('supabase', ['db', 'reset', '--no-seed'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
});
if (reset.status !== 0)
  fail('`supabase db reset` failed. Is Docker running, and was `pnpm db:start` run?');

console.log('2/3  Applying migrations…');
const target = postgresTarget(adminUrl);
try {
  const result = await applyMigrations(target, { log: (line) => console.log(`       ${line}`) });
  await setApiRolePassword(target, apiPassword);
  console.log(
    `       ${result.applied.length} migration(s) applied, ${result.permissions.added} permission(s) recorded.`,
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await target.close();
}

if (process.argv.includes('--no-seed')) {
  console.log('3/3  Seed skipped (--no-seed).');
} else {
  console.log('3/3  Loading seed data…');
  // `--today 2026-11-15`, `--small` and `--large` are passed on to the seed.
  const seed = spawnSync('pnpm', ['--silent', 'db:seed', ...process.argv.slice(2)], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
  });
  if (seed.status !== 0)
    fail('The seed failed. The schema is in place; fix the seed and run `pnpm db:seed`.');
}
console.log('\nThe local database is ready.');

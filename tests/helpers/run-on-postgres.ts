/*
 * Runs the test suite against the Docker Postgres instead of the in-process one.
 *
 *   pnpm test:db                    everything
 *   pnpm test:db tests/api/fees     one folder
 *
 * The connection settings come from `.env.local` (loaded by the script in package.json).
 * Each test file gets its own database, cloned from a template, and drops it afterwards.
 */
import { spawnSync } from 'node:child_process';

for (const name of ['DATABASE_ADMIN_URL', 'DATABASE_URL']) {
  if (!process.env[name]) {
    console.error(
      `${name} is not set. Run \`pnpm db:start\`, then \`pnpm db:env\` and \`pnpm db:migrate\`.`,
    );
    process.exit(1);
  }
}

const run = spawnSync('pnpm', ['exec', 'vitest', 'run', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  // Tests assert on behaviour, not on log lines; the developer's own LOG_LEVEL would only add noise.
  env: { ...process.env, TEST_DB: 'postgres', LOG_LEVEL: 'silent' },
});
process.exit(run.status ?? 1);

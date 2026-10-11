/*
 * Applies pending migrations to the database in DATABASE_ADMIN_URL.
 *
 *   pnpm db:migrate
 *
 * Safe to run at any time and on any environment: it only ever moves the schema forward.
 */
import { applyMigrations, postgresTarget } from '../migrate';
import { fail, requireEnv, setApiRolePassword } from './local';

const target = postgresTarget(requireEnv('DATABASE_ADMIN_URL'));
try {
  const result = await applyMigrations(target, { log: (line) => console.log(`  ${line}`) });
  if (process.env.TAKHTI_API_DB_PASSWORD)
    await setApiRolePassword(target, process.env.TAKHTI_API_DB_PASSWORD);
  console.log(
    result.applied.length > 0
      ? `Applied ${result.applied.length} migration(s); ${result.alreadyApplied} were already in place.`
      : `Nothing to apply: all ${result.alreadyApplied} migration(s) are in place.`,
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await target.close();
}

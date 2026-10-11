/*
 * Checks that the seeded data in the local database is sound: every student enrolled once, every
 * family with a living primary guardian, every sign-in joined to a real person, and so on.
 *
 *   pnpm db:verify-seed
 *
 * The rules are in `packages/db/src/seed/verify.ts`. Run it after any change to the seed.
 */
import { closeDatabase, withAdminTx } from '../client';
import { seedCheckCount, verifySeed } from '../seed/verify';
import { assertLocalDatabase, fail, requireEnv } from './local';

assertLocalDatabase(requireEnv('DATABASE_ADMIN_URL'), 'check the seeded data');

try {
  const problems = await withAdminTx((tx) => verifySeed(tx));
  if (problems.length > 0) {
    console.error(problems.map((line) => `  ${line}`).join('\n'));
    fail(`${problems.length} of ${seedCheckCount} checks failed.`);
  }
  console.log(`The seeded data is sound: ${seedCheckCount} checks passed.`);
} finally {
  await closeDatabase();
}

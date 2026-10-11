/*
 * Loads the seed data into the local database.
 *
 *   pnpm db:seed                      the standard set, placed around today
 *   pnpm db:seed --today 2026-11-15   the same set as it would look on that day
 *   pnpm db:seed --small              about 120 students, for quick resets
 *   pnpm db:seed --large              about 4,500 students, for performance work
 *   pnpm db:seed --timing             also print how long each part took
 *
 * It creates the demonstration school (Roshan Public School), a small second school for isolation
 * tests (Al-Noor Grammar School), and the sign-in accounts of `accounts.ts`.
 * Running it again changes nothing: a school that is already there is left alone.
 * Each school is written in one transaction, so a failure leaves no half-made school behind.
 *
 * Local development only. It refuses to run against a database that is not on this machine.
 * What the full seed holds, module by module: docs/plan/30-reference/seed-data.md. The schools
 * themselves are written by `schools.ts`, which grows with each wave of Phase 1.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { storageBuckets } from '@takhti/contracts';
import { closeDatabase, withAdminTx } from '../client';
import { ensureProfile } from '../provision';
import { platformAdmins } from '../schema';
import { assertLocalDatabase, fail, requireEnv } from '../scripts/local';
import {
  alnoorAccounts,
  platformAccounts,
  roshanAccounts,
  SEED_PASSWORD,
  seedAccounts,
  type SeedAccount,
} from './accounts';
import { noonOn, seedId, type SeedSize } from './context';
import { seededSchools, seedSchool } from './schools';

export { seedId } from './context';

const args = process.argv.slice(2);
const todayArgument = args.includes('--today') ? args[args.indexOf('--today') + 1] : undefined;
if (todayArgument !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(todayArgument))
  fail('--today takes a date as YYYY-MM-DD, for example --today 2026-11-15');
const size: SeedSize = args.includes('--small')
  ? 'small'
  : args.includes('--large')
    ? 'large'
    : 'standard';
/** Today in Pakistan (UTC+5, no daylight saving). */
const today = todayArgument ?? new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
// With a fixed "today" the audit columns are fixed too, so two runs give identical rows.
const now = todayArgument ? noonOn(todayArgument) : new Date().toISOString();

const adminUrl = requireEnv('DATABASE_ADMIN_URL');
assertLocalDatabase(adminUrl, 'seed the database');
const supabase: SupabaseClient = createClient(
  requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requireEnv('SUPABASE_SECRET_KEY'),
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

/** Creates the sign-in account, or finds it when it already exists. Returns the user's id. */
async function ensureAuthUser(email: string, fullName: string): Promise<string> {
  const id = seedId(`user:${email}`);
  const created = await supabase.auth.admin.createUser({
    id,
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  } as Parameters<typeof supabase.auth.admin.createUser>[0]);
  if (created.data.user) return created.data.user.id;

  // Already there from an earlier run: find it.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const existing = data.users.find((user) => user.email === email);
    if (existing) return existing.id;
    if (data.users.length < 200) break;
  }
  return fail(
    `Could not create the sign-in account ${email}: ${created.error?.message ?? 'no answer from Supabase Auth'}. Is the local stack running (pnpm db:start)?`,
  );
}

async function ensureBuckets(): Promise<void> {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) fail(`Could not reach Supabase Storage: ${error.message}`);
  const existing = new Set((data ?? []).map((bucket) => bucket.name));
  for (const bucket of storageBuckets) {
    const options = { public: bucket.public, fileSizeLimit: bucket.maxBytes };
    const result = existing.has(bucket.name)
      ? await supabase.storage.updateBucket(bucket.name, options)
      : await supabase.storage.createBucket(bucket.name, options);
    if (result.error)
      fail(`Could not prepare the storage bucket "${bucket.name}": ${result.error.message}`);
  }
}

console.log(`Seeding the local database as of ${today} (${size} size)…`);
const startedAt = Date.now();
await ensureBuckets();

const userIds = new Map<string, string>();
for (const account of [...seedAccounts, ...platformAccounts]) {
  userIds.set(account.email, await ensureAuthUser(account.email, account.fullName));
}

try {
  const made: string[] = [];
  // One transaction per school: a school is either wholly there or not there at all.
  for (const school of seededSchools) {
    const summary = await withAdminTx((tx) =>
      seedSchool({ tx, today, now, size, timing: args.includes('--timing') }, school.slug, userIds),
    );
    if (summary) made.push(`${school.name}: ${summary}`);
  }

  await withAdminTx(async (tx) => {
    for (const account of platformAccounts) {
      const userId = userIds.get(account.email) as string;
      await ensureProfile(tx, {
        id: userId,
        fullName: account.fullName,
        email: account.email,
        isPlatform: true,
        now,
      });
      const [existing] = await tx
        .select({ id: platformAdmins.id })
        .from(platformAdmins)
        .where(eq(platformAdmins.userId, userId))
        .limit(1);
      if (!existing)
        await tx
          .insert(platformAdmins)
          .values({ userId, role: account.role, createdAt: now, updatedAt: now });
    }
  });

  console.log(
    made.length > 0
      ? `Created in ${Math.round((Date.now() - startedAt) / 1000)} s:\n${made.map((line) => `  ${line}`).join('\n')}`
      : 'Both schools were already there; nothing was changed.',
  );
} catch (error) {
  fail(
    `The seed failed and nothing of that school was saved: ${error instanceof Error ? error.message : String(error)}`,
  );
} finally {
  await closeDatabase();
}

const width = Math.max(
  ...[...seedAccounts, ...platformAccounts].map((account) => account.email.length),
);
const notes = (account: SeedAccount) =>
  `${account.branches ? `  [${account.branches.join(', ')}]` : ''}${
    account.also
      ? `  also ${account.also.map((extra) => `${extra.role} at ${extra.school}`).join(', ')}`
      : ''
  }`;
console.log('\nSign-in accounts (local only)\n');
console.log('  Takhti platform');
for (const account of platformAccounts)
  console.log(`    ${account.email.padEnd(width)}  ${account.role}`);
console.log('\n  Roshan Public School  (school code: roshan)');
for (const account of roshanAccounts)
  console.log(`    ${account.email.padEnd(width)}  ${account.role}${notes(account)}`);
console.log('\n  Al-Noor Grammar School  (school code: alnoor)');
for (const account of alnoorAccounts)
  console.log(`    ${account.email.padEnd(width)}  ${account.role}${notes(account)}`);
console.log(`\n  Password for every account above: ${SEED_PASSWORD}`);
console.log('  (defined in packages/db/src/seed/accounts.ts; it exists nowhere else)\n');

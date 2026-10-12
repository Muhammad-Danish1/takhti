import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminDb, registeredTables, rowsOf } from '@takhti/db';
import { createTestDb, type TestDb } from '../../helpers/test-db';

/*
 * Every module's spec lists a test "Row-level security for every table in this module". That proof
 * is not written module by module: tests/api/security/rls.generated.test.ts probes every table in
 * the registry, as seven kinds of user, in its own school, another branch and another school.
 *
 * What is proved here, module by module as each is finished, is that nothing of the module escapes
 * that probe: every table the plan gives the module is in the registry under the module's name, and
 * in the database row-level security is switched on for it, with at least one policy.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const plan = JSON.parse(readFileSync(join(root, 'docs/plan/_tools/out/plan.json'), 'utf8')) as {
  tables: { name: string; module: string }[];
};

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.destroy();
});

async function expectModuleProbed(module: string): Promise<void> {
  const planned = plan.tables.filter((table) => table.module === module).map((table) => table.name);
  expect(planned.length).toBeGreaterThan(0);
  const registered = registeredTables()
    .filter((table) => table.module === module)
    .map((table) => table.name);
  expect(registered.sort()).toEqual([...planned].sort());

  const inDatabase = rowsOf<{ name: string; enabled: boolean; policies: number }>(
    await adminDb().execute(sql`
      select c.relname as name, c.relrowsecurity as enabled,
             (select count(*)::int from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname in (${sql.join(
        planned.map((name) => sql`${name}`),
        sql`, `,
      )})`),
  );
  expect(inDatabase.map((table) => table.name).sort()).toEqual([...planned].sort());
  const unguarded = inDatabase.filter((table) => !table.enabled || table.policies < 1);
  expect(unguarded).toEqual([]);
}

describe('row-level security, module by module', () => {
  it('T-shared-12 every table of the shared kernel is probed by the generated row-level security tests', async () => {
    await expectModuleProbed('M00');
  });
});

import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registeredTables, withAdminTx } from '@takhti/db';
import { INSUFFICIENT_PRIVILEGE, probeTable, sqlState } from '../../helpers/rls';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { fixtureOverrides } from './rls-fixtures';

/*
 * Row-level security, proved for every table in the registry.
 *
 * Nothing here is written per table: a new table is covered the moment it is registered, and a table
 * whose policies do not match its registry entry fails with a list of who could do what.
 * How it works: tests/helpers/rls.ts.
 *
 * The tables are probed a batch at a time, each batch on a database of its own. A probe makes the
 * database refuse hundreds of statements on purpose, and the in-process engine loses a little of its
 * stack with every refusal: several thousand in one database and it can no longer run anything.
 */

const BATCH = 25;
const tables = registeredTables();
const batches = Array.from({ length: Math.ceil(tables.length / BATCH) }, (_unused, index) => {
  const batch = tables.slice(index * BATCH, (index + 1) * BATCH);
  return [`tables ${index * BATCH + 1} to ${index * BATCH + batch.length}`, batch] as const;
});

describe('row-level security, generated from the table registry', () => {
  it('covers every table', () => {
    expect(tables.length).toBeGreaterThan(0);
    expect(batches.reduce((sum, [, batch]) => sum + batch.length, 0)).toBe(tables.length);
  });

  describe.each(batches)('%s', (_label, batch) => {
    let db: TestDb;
    beforeAll(async () => {
      db = await createTestDb();
    });
    afterAll(async () => {
      await db.destroy();
    });

    describe.each(batch.map((table) => [table.name, table] as const))('%s', (_name, table) => {
      it(`${table.scope}: each kind of user reaches exactly the rows the registry says`, async () => {
        const result = await probeTable(table, fixtureOverrides);
        expect(result.actual).toEqual(result.expected);
      });

      if (table.appendOnly) {
        it('append-only: even the privileged connection cannot change or remove a row', async () => {
          const result = await probeTable(table, fixtureOverrides);
          expect(result.appendOnly).toEqual({ update: 'TK001', delete: 'TK001' });
        });
      }
    });
  });
});

describe('roles that must reach nothing', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => {
    await db.destroy();
  });

  /** Ends the probing transaction without keeping anything. */
  class Finished extends Error {}

  /** Tables a role can select from, having switched to it inside a privileged transaction. */
  async function reachableAs(role: string): Promise<string[]> {
    const reachable: string[] = [];
    // The real server's driver fails a transaction at its end when any statement in it was refused,
    // even one that was caught and rolled back to a savepoint. Nothing here is meant to be kept, so
    // the transaction is ended by an error of our own, which takes precedence.
    const probing = withAdminTx(async (tx) => {
      await tx.execute(sql`set local role ${sql.identifier(role)}`);
      for (const table of tables) {
        // Released as well as rolled back, so the savepoints of four hundred tables do not nest.
        await tx.execute(sql`savepoint reach`);
        try {
          await tx.execute(sql`select 1 from ${sql.identifier(table.name)} limit 1`);
          reachable.push(table.name);
        } catch (error) {
          if (sqlState(error) !== INSUFFICIENT_PRIVILEGE) throw error;
        } finally {
          await tx.execute(sql`rollback to savepoint reach`);
          await tx.execute(sql`release savepoint reach`);
        }
      }
      await tx.execute(sql`reset role`);
      throw new Finished();
    });
    await probing.catch((error: unknown) => {
      if (!(error instanceof Finished)) throw error;
    });
    return reachable;
  }

  it('a visitor who is not signed in (anon) has no rights on any table', async () => {
    expect(await reachableAs('anon')).toEqual([]);
  });

  it('the application role (takhti_api) has no rights of its own: a query outside withUserTx fails', async () => {
    if (!db.appUrl) {
      expect(await reachableAs('takhti_api')).toEqual([]);
      return;
    }
    // On the real server, sign in exactly as the application does and try every table without switching role.
    const client = postgres(db.appUrl, { max: 1, onnotice: () => {} });
    const reachable: string[] = [];
    try {
      for (const table of tables) {
        try {
          await client.unsafe(`select 1 from "${table.name}" limit 1`);
          reachable.push(table.name);
        } catch (error) {
          if (sqlState(error) !== INSUFFICIENT_PRIVILEGE) throw error;
        }
      }
    } finally {
      await client.end({ timeout: 5 });
    }
    expect(reachable).toEqual([]);
  });
});

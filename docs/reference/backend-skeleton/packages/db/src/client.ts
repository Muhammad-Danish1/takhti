import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

// Supabase's pooler (transaction mode) does not support prepared statements.
const client = postgres(url, { prepare: false });

/**
 * The privileged connection. It skips row-level security, so module code never imports it:
 * requests go through `withUserTx`, and only the kernel (permission lookups, system jobs) uses `db`.
 */
export const db = drizzle({ client });

export type Db = typeof db;
/** The transaction handle every db-service receives through `ctx.db`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** The parts of the signed-in user's token that row-level security reads. */
export interface DbClaims {
  sub: string;
  role: 'authenticated';
  org_id: string;
  role_key: string;
  branch_ids: readonly string[];
  all_branches: boolean;
}

/**
 * Runs `work` inside one transaction in which Postgres sees the signed-in user,
 * so every query is filtered by the row-level security policies.
 * Both settings are transaction-local and disappear on commit or rollback.
 */
export function withUserTx<T>(claims: DbClaims, work: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return work(tx);
  });
}

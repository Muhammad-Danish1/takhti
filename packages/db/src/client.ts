import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/*
 * Two connections.
 *
 * `app`   connects as `takhti_api`, a role that cannot bypass row-level security and has no table
 *         rights of its own. Every request runs through `withUserTx`, which switches to the
 *         `authenticated` role and sets the user's claims for the length of one transaction.
 *
 * `admin` is privileged. Only the few kernel files listed in docs/plan/00-foundation/07-backend-kernel.md
 *         may use it; an ESLint rule forbids importing `adminDb` or `withAdminTx` anywhere else.
 *
 * Connections are opened on first use, so importing this file needs no environment.
 */

export type Db = ReturnType<typeof drizzle>;
/** The transaction handle every db-service receives through `ctx.db`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** The parts of the signed-in user's identity that row-level security reads. */
export interface DbClaims {
  sub: string;
  role: 'authenticated';
  org_id: string;
  kind: 'staff' | 'guardian' | 'student';
  all_branches: boolean;
  branch_ids: readonly string[];
  student_ids: readonly string[];
  staff_id?: string;
  guardian_id?: string;
  family_id?: string;
  /** Capabilities for the sensitive tables: `hr`, `payroll`, `health`, `counselling`. */
  caps: readonly string[];
}

export interface Connections {
  app: Db;
  admin: Db;
  close(): Promise<void>;
  /**
   * Set by tests that run on the in-process engine, which is a single session with no timers:
   * a server-side timeout there does nothing useful and can end the only session there is,
   * so code that sets one asks first.
   */
  singleSession?: boolean;
}

const globalKey = Symbol.for('takhti.db.connections');
type GlobalWithDb = typeof globalThis & { [globalKey]?: Connections | undefined };
const store = globalThis as GlobalWithDb;

function connect(): Connections {
  const appUrl = process.env.DATABASE_URL;
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (!appUrl) throw new Error('DATABASE_URL is not set');
  if (!adminUrl) throw new Error('DATABASE_ADMIN_URL is not set');

  // Supabase's pooler (transaction mode) does not support prepared statements.
  const options = {
    prepare: false,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {},
  } as const;
  const appClient = postgres(appUrl, { ...options, max: 10 });
  const adminClient = postgres(adminUrl, { ...options, max: 5 });

  return {
    app: drizzle({ client: appClient }),
    admin: drizzle({ client: adminClient }),
    close: async () => {
      await Promise.all([appClient.end({ timeout: 5 }), adminClient.end({ timeout: 5 })]);
    },
  };
}

/** The live connections. Kept on `globalThis` so a hot reload in development does not open new pools. */
function connections(): Connections {
  store[globalKey] ??= connect();
  return store[globalKey];
}

/**
 * Replaces the connections. Tests use this to run on an in-process Postgres;
 * nothing in the application calls it.
 */
export function configureDatabase(next: Connections | undefined): void {
  store[globalKey] = next;
}

/** False on the in-process test engine, where ending a session on a timeout would end the whole database. */
export const supportsSessionTimeouts = (): boolean => connections().singleSession !== true;

export async function closeDatabase(): Promise<void> {
  const current = store[globalKey];
  store[globalKey] = undefined;
  await current?.close();
}

/**
 * Runs `work` inside one transaction in which Postgres sees the signed-in user,
 * so every query is filtered by the row-level security policies.
 * Both settings are transaction-local and disappear on commit or rollback.
 */
export function withUserTx<T>(claims: DbClaims, work: (tx: Tx) => Promise<T>): Promise<T> {
  return connections().app.transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return work(tx);
  });
}

/** The privileged connection. Skips row-level security: kernel use only. */
export const adminDb = (): Db => connections().admin;

/** One privileged transaction. Kernel use only. */
export function withAdminTx<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return connections().admin.transaction(work);
}

/** True when the database answers. Used by the readiness check. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await connections().admin.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Rows of a raw `execute`, whichever driver ran it: postgres-js returns the rows as an array,
 * PGlite returns `{ rows }`. Prefer the query builder; use this only for SQL it cannot express.
 */
export function rowsOf<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

import { sql } from 'drizzle-orm';
import { adminDb, rowsOf } from '@takhti/db';
import { currentTime } from './context';
import { isoFromMs } from './dates';
import { rateLimited } from './errors';

/*
 * A fixed-window counter. Each hit is one atomic upsert on the privileged connection, outside the
 * request's own transaction, so an attempt is counted even when the request later fails
 * (which is exactly what matters for sign-in attempts).
 *
 * The store is an interface: Postgres here, and a Redis-backed one can replace it in production
 * without touching any caller.
 */

export interface RateLimitRule {
  /** What is being limited, for example `sign-in:ip:203.0.113.9`. */
  key: string;
  max: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Hits left in this window. */
  remaining: number;
  /** Seconds until the window ends. */
  retryAfterSeconds: number;
}

export interface RateLimitStore {
  /** Counts one hit and returns the count in the current window. */
  hit(key: string, windowStartIso: string): Promise<number>;
  /** Removes windows that ended before the given moment. */
  purge(beforeIso: string): Promise<number>;
}

const postgresStore: RateLimitStore = {
  async hit(key, windowStartIso) {
    const result = await adminDb().execute(sql`
      insert into rate_limits (key, window_start, count) values (${key}, ${windowStartIso}::timestamptz, 1)
      on conflict (key, window_start) do update set count = rate_limits.count + 1
      returning count
    `);
    return Number(rowsOf<{ count: number | string }>(result)[0]?.count ?? 1);
  },
  async purge(beforeIso) {
    const result = await adminDb().execute(sql`
      with removed as (delete from rate_limits where window_start < ${beforeIso}::timestamptz returning 1)
      select count(*)::int as n from removed
    `);
    return Number(rowsOf<{ n: number }>(result)[0]?.n ?? 0);
  },
};

let store: RateLimitStore = postgresStore;

/** Replaces the store (a Redis-backed one in production; a recording one in a test). */
export function setRateLimitStore(next: RateLimitStore | undefined): void {
  store = next ?? postgresStore;
}

/** Counts one hit and says whether it is within the limit. Never throws for being over the limit. */
export async function checkLimit(rule: RateLimitRule): Promise<RateLimitResult> {
  if (rule.max < 1 || rule.windowSeconds < 1)
    throw new Error(`Rate limit "${rule.key}" needs a positive max and window`);
  const nowMs = Date.parse(currentTime());
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = Math.floor(nowMs / windowMs) * windowMs;
  const count = await store.hit(rule.key.slice(0, 300), isoFromMs(windowStart));
  return {
    allowed: count <= rule.max,
    remaining: Math.max(0, rule.max - count),
    retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - nowMs) / 1000)),
  };
}

/** Counts one hit and throws `RATE_LIMITED`, with the seconds to wait, when the limit is passed. */
export async function limit(rule: RateLimitRule): Promise<void> {
  const result = await checkLimit(rule);
  if (!result.allowed) throw rateLimited(result.retryAfterSeconds);
}

/** Removes old windows. Run nightly by the `shared.cleanup` job. */
export const purgeRateLimits = (beforeIso: string): Promise<number> => store.purge(beforeIso);

/** The limits of docs/plan/00-foundation/08-api-standards.md, by kind of route. */
export const standardLimits = {
  auth: { max: 5, windowSeconds: 15 * 60 },
  publicForm: { max: 10, windowSeconds: 60 * 60 },
  read: { max: 300, windowSeconds: 60 },
  write: { max: 120, windowSeconds: 60 },
  heavy: { max: 10, windowSeconds: 60 },
} as const;

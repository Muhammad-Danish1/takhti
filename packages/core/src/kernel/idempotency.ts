import { and, eq, lt, sql } from 'drizzle-orm';
import { adminDb, idempotencyKeys, rowsOf } from '@takhti/db';
import type { Ctx } from './context';
import { sha256 } from './crypto';
import { addSeconds } from './dates';
import { conflict, invalid } from './errors';
import { newId } from './ids';

/*
 * Makes "do this once" true even when the request arrives twice: a double click, a retry after a
 * timeout, an offline device uploading again.
 *
 *   first request with a key          runs the work and stores its result, in the same transaction
 *   same key, same request            returns the stored result; the work does not run
 *   same key, different request       409: the key was already used for something else
 *   two identical requests at once    the second waits on the unique index, then gets the first one's result
 *
 * A request that fails stores nothing (its transaction rolls back), so it can simply be tried again.
 */

const KEEP_SECONDS = 24 * 60 * 60;
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export interface StoredResponse {
  status: number;
  body: unknown;
  /** True when this is a stored result being returned again. */
  replayed: boolean;
}

/** A fingerprint of everything that makes two requests "the same request". */
export const hashRequest = (method: string, path: string, body: unknown): string =>
  sha256(`${method} ${path}\n${JSON.stringify(body ?? null)}`);

export function assertIdempotencyKey(key: string | null | undefined): string {
  if (!key)
    throw invalid(
      { 'Idempotency-Key': ['This request needs an Idempotency-Key header'] },
      'This request needs an Idempotency-Key header',
    );
  if (!KEY_PATTERN.test(key))
    throw invalid(
      { 'Idempotency-Key': ['Use 8 to 128 letters, digits, hyphens or underscores'] },
      'The Idempotency-Key header is not valid',
    );
  return key;
}

export async function withIdempotency(
  ctx: Ctx,
  request: { key: string; route: string; requestHash: string },
  work: () => Promise<{ status: number; body: unknown }>,
): Promise<StoredResponse> {
  const { key, route, requestHash } = request;
  const scope = and(
    eq(idempotencyKeys.orgId, ctx.actor.orgId),
    eq(idempotencyKeys.userId, ctx.actor.userId),
    eq(idempotencyKeys.key, key),
  );

  // Waits here if another transaction is inserting the same key right now.
  const inserted = rowsOf<{ id: string }>(
    await ctx.db.execute(sql`
      insert into idempotency_keys (id, org_id, user_id, key, route, request_hash, created_at, expires_at)
      values (${newId()}::uuid, ${ctx.actor.orgId}::uuid, ${ctx.actor.userId}::uuid, ${key}, ${route}, ${requestHash},
              ${ctx.now}::timestamptz, ${addSeconds(ctx.now, KEEP_SECONDS)}::timestamptz)
      on conflict (org_id, user_id, key) do nothing
      returning id
    `),
  );

  if (inserted.length === 0) {
    const [existing] = await ctx.db.select().from(idempotencyKeys).where(scope).limit(1);
    if (existing && existing.expiresAt > ctx.now) {
      if (existing.route !== route || existing.requestHash !== requestHash) {
        throw conflict('This request key was already used for a different request.');
      }
      if (existing.responseStatus !== null) {
        return { status: existing.responseStatus, body: existing.responseBody, replayed: true };
      }
    }
    // The stored key has expired (or, in theory, holds no result): take it over for this request.
    await ctx.db
      .update(idempotencyKeys)
      .set({
        route,
        requestHash,
        responseStatus: null,
        responseBody: null,
        createdAt: ctx.now,
        expiresAt: addSeconds(ctx.now, KEEP_SECONDS),
      })
      .where(scope);
  }

  const result = await work();
  await ctx.db
    .update(idempotencyKeys)
    .set({ responseStatus: result.status, responseBody: (result.body ?? null) as never })
    .where(scope);
  return { ...result, replayed: false };
}

/** Removes keys past their time. Run nightly by the `shared.cleanup` job; uses the privileged connection. */
export async function purgeExpiredIdempotencyKeys(now: string): Promise<number> {
  const removed = await adminDb()
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.expiresAt, now))
    .returning({ id: idempotencyKeys.id });
  return removed.length;
}

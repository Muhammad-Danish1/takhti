import { and, eq } from 'drizzle-orm';
import { db, rolePermissions } from '@school/db';
import type { Ctx } from './context';
import { forbidden } from './errors';

/** The four actions every resource has. Modules add their own, e.g. "collect" for fees. */
export type Action = 'read' | 'create' | 'update' | 'delete' | (string & {});

export const can = (ctx: Ctx, resource: string, action: Action) =>
  ctx.actor.permissions.has(`${resource}:${action}`);

export function assertCan(ctx: Ctx, resource: string, action: Action): void {
  if (!can(ctx, resource, action)) throw forbidden(`You do not have the "${resource}:${action}" permission`);
}

const cache = new Map<string, { permissions: ReadonlySet<string>; expires: number }>();
const CACHE_MS = 60_000;

/**
 * A role's permissions, read from the database and remembered for a minute.
 * Changing a role in the admin screen therefore takes effect within a minute, without anyone signing in again.
 */
export async function loadPermissions(orgId: string, roleKey: string): Promise<ReadonlySet<string>> {
  const key = `${orgId}:${roleKey}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.permissions;

  const rows = await db
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(and(eq(rolePermissions.orgId, orgId), eq(rolePermissions.roleKey, roleKey)));

  const permissions = new Set(rows.map((row) => row.permission));
  cache.set(key, { permissions, expires: Date.now() + CACHE_MS });
  return permissions;
}

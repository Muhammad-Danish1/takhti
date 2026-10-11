import { and, eq, isNull } from 'drizzle-orm';
import { coreModuleKeys, modules, type ModuleKey } from '@takhti/contracts';
import { orgModules } from '@takhti/db';
import type { Ctx } from './context';
import { forbidden } from './errors';

/*
 * A school group has the modules of its plan, plus overrides. A module that is off refuses its
 * routes with a plain message; its data is kept, never deleted.
 * Core modules are part of every plan and cannot be switched off.
 */

const CACHE_MS = 60_000;
const cache = new Map<string, { enabled: ReadonlySet<ModuleKey>; expires: number }>();
const core: ReadonlySet<ModuleKey> = new Set(coreModuleKeys);
const names = new Map<string, string>(modules.map((module) => [module.key, module.name]));

/** The modules switched on for the actor's organisation. Remembered for a minute. */
export async function enabledModules(ctx: Ctx): Promise<ReadonlySet<ModuleKey>> {
  const hit = cache.get(ctx.actor.orgId);
  if (hit && hit.expires > Date.now()) return hit.enabled;

  const rows = await ctx.db
    .select({ moduleKey: orgModules.moduleKey, isEnabled: orgModules.isEnabled })
    .from(orgModules)
    .where(and(eq(orgModules.orgId, ctx.actor.orgId), isNull(orgModules.deletedAt)));
  const enabled = new Set<ModuleKey>(core);
  for (const row of rows) {
    if (row.isEnabled) enabled.add(row.moduleKey as ModuleKey);
    else if (!core.has(row.moduleKey as ModuleKey)) enabled.delete(row.moduleKey as ModuleKey);
  }
  cache.set(ctx.actor.orgId, { enabled, expires: Date.now() + CACHE_MS });
  return enabled;
}

export async function isModuleEnabled(ctx: Ctx, module: ModuleKey): Promise<boolean> {
  return core.has(module) || (await enabledModules(ctx)).has(module);
}

/** Throws `FORBIDDEN` "Transport is not part of your plan" when the module is off. */
export async function assertModule(ctx: Ctx, module: ModuleKey): Promise<void> {
  if (!(await isModuleEnabled(ctx, module))) {
    throw forbidden(`${names.get(module) ?? module} is not part of your plan`);
  }
}

/** Forgets what is remembered, for one organisation or all. Called when a plan or an override changes. */
export function invalidateModules(orgId?: string): void {
  if (orgId === undefined) cache.clear();
  else cache.delete(orgId);
}

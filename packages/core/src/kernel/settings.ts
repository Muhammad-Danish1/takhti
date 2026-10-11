import { and, eq, isNull, sql } from 'drizzle-orm';
import { findSetting, type SettingDef } from '@takhti/contracts';
import { branchSettings, orgSettings } from '@takhti/db';
import { audit } from './audit';
import { stampOf, type Ctx } from './context';
import { invalid, rule } from './errors';
import { newId } from './ids';

/*
 * Settings are typed and registered (`defineSetting` in the contracts). A value is read as:
 * the branch's own value, else the organisation's, else the registered default, and is always
 * passed through the setting's schema, so a caller can rely on its shape.
 *
 * A stored value that no longer fits the schema (the schema changed since it was saved) is not
 * allowed to break a screen: the next level down is used and the fact is logged.
 */

export type SettingSource = 'default' | 'org' | 'branch';

export interface ResolvedSetting<T> {
  value: T;
  source: SettingSource;
}

function registered<T>(def: SettingDef<T>): SettingDef<T> {
  if (findSetting(def.key) !== (def as SettingDef)) {
    throw new Error(
      `Setting "${def.key}" is not in the catalogue. Add its module's settings to packages/contracts/src/catalogue.ts.`,
    );
  }
  return def;
}

/** The value in force, and where it came from. Pass `branchId` to honour a branch's own value. */
export async function resolveSetting<T>(
  ctx: Ctx,
  def: SettingDef<T>,
  branchId?: string,
): Promise<ResolvedSetting<T>> {
  registered(def);
  const accept = (stored: unknown, source: SettingSource): ResolvedSetting<T> | undefined => {
    const parsed = def.schema.safeParse(stored);
    if (parsed.success) return { value: parsed.data, source };
    ctx.log.warn(
      { setting: def.key, source },
      'stored setting no longer fits its schema; falling back',
    );
    return undefined;
  };

  if (def.scope === 'branch' && branchId) {
    const [row] = await ctx.db
      .select({ value: branchSettings.value })
      .from(branchSettings)
      .where(
        and(
          eq(branchSettings.branchId, branchId),
          eq(branchSettings.key, def.key),
          isNull(branchSettings.deletedAt),
        ),
      )
      .limit(1);
    const hit = row && accept(row.value, 'branch');
    if (hit) return hit;
  }

  const [row] = await ctx.db
    .select({ value: orgSettings.value })
    .from(orgSettings)
    .where(
      and(
        eq(orgSettings.orgId, ctx.actor.orgId),
        eq(orgSettings.key, def.key),
        isNull(orgSettings.deletedAt),
      ),
    )
    .limit(1);
  const hit = row && accept(row.value, 'org');
  if (hit) return hit;

  return { value: def.default, source: 'default' };
}

/** The value in force: `await getSetting(ctx, feesLateFine, branchId)`. */
export async function getSetting<T>(ctx: Ctx, def: SettingDef<T>, branchId?: string): Promise<T> {
  return (await resolveSetting(ctx, def, branchId)).value;
}

function validated<T>(def: SettingDef<T>, value: unknown): T {
  const parsed = def.schema.safeParse(value);
  if (!parsed.success) {
    throw invalid({
      value: parsed.error.issues.map((issue) =>
        issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
      ),
    });
  }
  return parsed.data;
}

/**
 * Saves a value for the organisation, or for one branch when `branchId` is given.
 * The caller has already checked the permission; this validates, saves and audits.
 */
export async function setSetting<T>(
  ctx: Ctx,
  def: SettingDef<T>,
  value: unknown,
  branchId?: string,
): Promise<T> {
  registered(def);
  const next = validated(def, value);
  const before = await resolveSetting(ctx, def, branchId);
  const stamp = { updatedAt: ctx.now, updatedBy: stampOf(ctx) };

  if (branchId) {
    if (def.scope !== 'branch')
      throw rule(`"${def.label}" is set for the whole school group, not per branch`);
    await ctx.db
      .insert(branchSettings)
      .values({
        id: newId(),
        orgId: ctx.actor.orgId,
        branchId,
        key: def.key,
        value: next as never,
        createdAt: ctx.now,
        createdBy: stampOf(ctx),
        ...stamp,
      })
      .onConflictDoUpdate({
        target: [branchSettings.branchId, branchSettings.key],
        targetWhere: isNull(branchSettings.deletedAt),
        set: { value: next as never, version: sql`${branchSettings.version} + 1`, ...stamp },
      });
  } else {
    await ctx.db
      .insert(orgSettings)
      .values({
        id: newId(),
        orgId: ctx.actor.orgId,
        key: def.key,
        value: next as never,
        createdAt: ctx.now,
        createdBy: stampOf(ctx),
        ...stamp,
      })
      .onConflictDoUpdate({
        target: [orgSettings.orgId, orgSettings.key],
        targetWhere: isNull(orgSettings.deletedAt),
        set: { value: next as never, version: sql`${orgSettings.version} + 1`, ...stamp },
      });
  }

  // A setting has no row id of its own worth showing; the audit entry is filed under the organisation or the branch.
  await audit(
    ctx,
    branchId ? 'branch-settings' : 'org-settings',
    'update',
    branchId ?? ctx.actor.orgId,
    {
      before: { [def.key]: before.value },
      after: { [def.key]: next },
      branchId: branchId ?? null,
      summary: `Changed "${def.label}"`,
    },
  );
  return next;
}

/** Removes a branch's own value, so the organisation's value applies again. */
export async function clearBranchSetting<T>(
  ctx: Ctx,
  def: SettingDef<T>,
  branchId: string,
): Promise<void> {
  registered(def);
  const before = await resolveSetting(ctx, def, branchId);
  if (before.source !== 'branch') return;
  await ctx.db
    .update(branchSettings)
    .set({
      deletedAt: ctx.now,
      updatedAt: ctx.now,
      updatedBy: stampOf(ctx),
      version: sql`${branchSettings.version} + 1`,
    })
    .where(
      and(
        eq(branchSettings.branchId, branchId),
        eq(branchSettings.key, def.key),
        isNull(branchSettings.deletedAt),
      ),
    );
  const after = await resolveSetting(ctx, def, branchId);
  await audit(ctx, 'branch-settings', 'update', branchId, {
    before: { [def.key]: before.value },
    after: { [def.key]: after.value },
    branchId,
    summary: `Reset "${def.label}" to the school group's value`,
  });
}

import {
  findSetting,
  orgSettingsChanged,
  settingCatalogue,
  type PermissionKey,
  type SettingDef,
  type SettingView,
} from '@takhti/contracts';
import type { Ctx } from '../../kernel/context';
import { forbidden, notFound, rule } from '../../kernel/errors';
import { emit } from '../../kernel/events';
import { assertPermission, holds } from '../../kernel/permissions';
import { assertBranch, hasBranch } from '../../kernel/scope';
import { clearBranchSetting, resolveSetting, setSetting } from '../../kernel/settings';
import { assertBranchOpen } from './branches.service';
import { branchesDb } from './branches.db-service';

/*
 * Settings through the API: docs/plan/10-modules/m02-organisation-branches.md, rules R-org-1 and
 * R-org-2. Reading, saving and resolving a value is the kernel's (`kernel/settings.ts`); this
 * service decides who may read and who may change which setting.
 */

/** F-org-2: a key that is not registered is, to everyone, not a setting. */
function registered(key: string): SettingDef {
  const def = findSetting(key);
  if (!def) throw notFound('Setting');
  return def;
}

function mayRead(ctx: Ctx, def: SettingDef): boolean {
  const who = def.readableBy ?? 'staff';
  if (who === 'member') return true;
  if (who === 'staff') return ctx.actor.kind === 'staff' || ctx.actor.kind === 'system';
  return holds(ctx, who);
}

/** A module's setting names its own permission. One that names none is a general setting. */
const permissionToChange = (def: SettingDef, forBranch: boolean): PermissionKey =>
  def.permission ?? (forBranch ? 'branch-settings:update' : 'org-settings:update');

const mayChange = (ctx: Ctx, def: SettingDef, branchId?: string): boolean =>
  holds(ctx, permissionToChange(def, branchId !== undefined)) &&
  (branchId === undefined || hasBranch(ctx, branchId));

async function view(ctx: Ctx, def: SettingDef, branchId?: string): Promise<SettingView> {
  // A value a branch cannot have of its own is the group's, whichever branch asks.
  const at = def.scope === 'branch' ? branchId : undefined;
  const resolved = await resolveSetting(ctx, def, at);
  return {
    key: def.key,
    scope: def.scope,
    label: def.label,
    value: resolved.value,
    defaultValue: def.default,
    source: resolved.source,
    canChange: mayChange(ctx, def, at),
  };
}

/** R-org-2: a branch has a value of its own only for a setting registered as one a branch may override. */
function overridable(def: SettingDef): void {
  if (def.scope !== 'branch')
    throw rule(`"${def.label}" is set for the whole school group, not per branch`);
}

async function changed(ctx: Ctx, def: SettingDef, branchId: string | null): Promise<void> {
  await emit(
    ctx,
    orgSettingsChanged,
    { key: def.key, branchId },
    branchId
      ? { entityType: 'branches', entityId: branchId }
      : { entityType: 'org', entityId: ctx.actor.orgId },
  );
}

export const settingsService = {
  /** Every setting the person may read, with the group's value and its default. */
  async list(ctx: Ctx): Promise<SettingView[]> {
    assertPermission(ctx, 'org-settings:read');
    const views: SettingView[] = [];
    for (const def of settingCatalogue) if (mayRead(ctx, def)) views.push(await view(ctx, def));
    return views;
  },

  /** One setting, with the value in force (at a branch, when one is named). The one way a screen reads a setting. */
  async get(ctx: Ctx, key: string, branchId?: string): Promise<SettingView> {
    const def = registered(key);
    if (!mayRead(ctx, def)) throw forbidden('This setting is not yours to see');
    // Staff see a branch's own values only at a branch they work at. Answering with the group's
    // value instead would be an answer, and a wrong one.
    if (branchId && def.scope === 'branch') assertBranch(ctx, branchId);
    return view(ctx, def, branchId);
  },

  /** Saves the group's value. The setting's own permission decides who may. */
  async put(ctx: Ctx, key: string, value: unknown): Promise<SettingView> {
    const def = registered(key);
    assertPermission(ctx, permissionToChange(def, false));
    await setSetting(ctx, def, value);
    await changed(ctx, def, null);
    return view(ctx, def);
  },

  /** The settings a branch may have a value of its own for, each with the value in force there. */
  async listForBranch(ctx: Ctx, branchId: string): Promise<SettingView[]> {
    assertPermission(ctx, 'org-settings:read');
    await branchesDb.get(ctx, branchId);
    assertBranch(ctx, branchId);
    const views: SettingView[] = [];
    for (const def of settingCatalogue)
      if (def.scope === 'branch' && mayRead(ctx, def)) views.push(await view(ctx, def, branchId));
    return views;
  },

  /** Gives a branch a value of its own. */
  async putForBranch(
    ctx: Ctx,
    branchId: string,
    key: string,
    value: unknown,
  ): Promise<SettingView> {
    const def = registered(key);
    overridable(def);
    assertPermission(ctx, permissionToChange(def, true));
    // R-org-6: nothing is changed at an inactive branch, nor at one the person does not work at.
    await assertBranchOpen(ctx, branchId);
    await setSetting(ctx, def, value, branchId);
    await changed(ctx, def, branchId);
    return view(ctx, def, branchId);
  },

  /** Removes a branch's own value: the group's applies again. Answers with what is now in force. */
  async clearForBranch(ctx: Ctx, branchId: string, key: string): Promise<SettingView> {
    const def = registered(key);
    overridable(def);
    assertPermission(ctx, permissionToChange(def, true));
    await assertBranchOpen(ctx, branchId);
    const before = await resolveSetting(ctx, def, branchId);
    await clearBranchSetting(ctx, def, branchId);
    if (before.source === 'branch') await changed(ctx, def, branchId);
    return view(ctx, def, branchId);
  },
};

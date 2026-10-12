import { auditorActions, expandRoles, type RoleKey } from './access/roles';
import { auditorExcludedPermissions } from './access/capabilities';
import { isModuleKey, type ModuleKey } from './access/modules';
import type { EventDef } from './kernel/events';
import { splitPermission, type ModulePermissions, type PermissionDef } from './kernel/permissions';
import type { SettingDef } from './kernel/settings';
import { generatedPermissionModules } from './modules/generated';
import { identityPermissions } from './modules/identity/identity.permissions';
import { organisationPermissions } from './modules/organisation/organisation.permissions';
import { organisationEvents } from './modules/organisation/organisation.events';
import { organisationSettings } from './modules/organisation/organisation.settings';
import { platformPermissions } from './modules/platform/platform.permissions';
import { sharedEvents } from './modules/shared/shared.events';
import { sharedPermissions } from './modules/shared/shared.permissions';

/*
 * The catalogue gathers what every module declares: permissions, settings and events.
 * A module that is not listed here does not exist as far as the roles screen, the settings screen
 * and the notification dispatcher are concerned. Adding a module means adding its lines below.
 *
 * The `permissions` table in the database is brought in line with this file on every migration run.
 */

const permissionModules = [
  sharedPermissions,
  platformPermissions,
  organisationPermissions,
  identityPermissions,
  // Waves 1 onwards are written by `pnpm scaffold` from the module specifications.
  ...generatedPermissionModules,
] as const satisfies readonly ModulePermissions[];

/** Every permission key in the product. `assertCan` accepts nothing else. */
export type PermissionKey = (typeof permissionModules)[number]['permissions'][number]['key'];

export interface CataloguePermission extends PermissionDef {
  key: PermissionKey;
  module: ModuleKey;
  resource: string;
  action: string;
}

function gatherPermissions(): CataloguePermission[] {
  const seen = new Set<string>();
  const list: CataloguePermission[] = [];
  for (const group of permissionModules) {
    if (!isModuleKey(group.module))
      throw new Error(`Permissions declared for unknown module "${group.module}"`);
    for (const permission of group.permissions) {
      if (!/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/.test(permission.key)) {
        throw new Error(`Permission key "${permission.key}" must look like resource:action`);
      }
      if (seen.has(permission.key))
        throw new Error(`Permission "${permission.key}" is declared twice`);
      seen.add(permission.key);
      list.push({ ...permission, module: group.module, ...splitPermission(permission.key) });
    }
  }
  return list;
}

export const permissionCatalogue: readonly CataloguePermission[] = gatherPermissions();

export const permissionKeys = permissionCatalogue.map(
  (permission) => permission.key,
) as readonly PermissionKey[];

const permissionKeySet: ReadonlySet<string> = new Set(permissionKeys);
export const isPermissionKey = (value: string): value is PermissionKey =>
  permissionKeySet.has(value);

/**
 * The permissions a built-in role holds when an organisation is created.
 * The owner holds everything and the auditor everything that only looks; both are computed here,
 * so a permission added later reaches them without anyone editing a list.
 */
export function defaultPermissionsFor(role: RoleKey): PermissionKey[] {
  if (role === 'owner') return [...permissionKeys];
  if (role === 'auditor') {
    return permissionCatalogue
      .filter(
        (permission) =>
          (auditorActions as readonly string[]).includes(permission.action) &&
          !auditorExcludedPermissions.has(permission.key),
      )
      .map((permission) => permission.key);
  }
  return permissionCatalogue
    .filter((permission) => expandRoles(permission.defaultRoles).includes(role))
    .map((permission) => permission.key);
}

function gatherSettings(): SettingDef[] {
  const groups: readonly (readonly SettingDef<never>[])[] = [
    organisationSettings as unknown as readonly SettingDef<never>[],
  ];
  const seen = new Set<string>();
  const list: SettingDef[] = [];
  for (const group of groups) {
    for (const setting of group as unknown as readonly SettingDef[]) {
      if (seen.has(setting.key)) throw new Error(`Setting "${setting.key}" is declared twice`);
      seen.add(setting.key);
      list.push(setting);
    }
  }
  return list;
}

const settings: SettingDef[] = gatherSettings();
export const settingCatalogue: readonly SettingDef[] = settings;

const settingsByKey = new Map<string, SettingDef>(
  settings.map((setting) => [setting.key, setting]),
);
export const findSetting = (key: string): SettingDef | undefined => settingsByKey.get(key);

/**
 * For tests: adds a setting to the catalogue, as a module's own settings file would, so that a
 * rule about settings can be proved on a setting made for the purpose. Returns how to remove it.
 */
export function registerSettingForTests(setting: SettingDef): () => void {
  if (settingsByKey.has(setting.key)) throw new Error(`Setting "${setting.key}" is declared twice`);
  settings.push(setting);
  settingsByKey.set(setting.key, setting);
  return () => {
    settingsByKey.delete(setting.key);
    settings.splice(settings.indexOf(setting), 1);
  };
}

function gatherEvents(): EventDef[] {
  // Each module's `<module>.events.ts` is added here as its service is written.
  const groups: readonly (readonly EventDef[])[] = [
    sharedEvents as unknown as readonly EventDef[],
    organisationEvents as unknown as readonly EventDef[],
  ];
  const seen = new Set<string>();
  const list: EventDef[] = [];
  for (const group of groups) {
    for (const event of group) {
      if (seen.has(event.key)) throw new Error(`Event "${event.key}" is declared twice`);
      seen.add(event.key);
      list.push(event);
    }
  }
  return list;
}

export const eventCatalogue: readonly EventDef[] = gatherEvents();

const eventsByKey: ReadonlyMap<string, EventDef> = new Map(
  eventCatalogue.map((event) => [event.key, event]),
);
export const findEvent = (key: string): EventDef | undefined => eventsByKey.get(key);

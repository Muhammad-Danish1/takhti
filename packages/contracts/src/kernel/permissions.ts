import type { RoleToken } from '../access/roles';

/** One row of a module's Permissions table. */
export interface PermissionDef {
  /** `<resource>:<action>`, for example `fee-payments:collect`. */
  key: `${string}:${string}`;
  /** What it allows, as the roles screen shows it. */
  label: string;
  labelUr?: string;
  /** Roles that hold it when an organisation is created. The owner holds everything and is never listed. */
  defaultRoles: readonly RoleToken[];
  /** Flagged on the roles screen: granting it deserves a second look. */
  sensitive?: boolean;
}

export interface ModulePermissions {
  /** The module key, for example `org` or `fees`. */
  module: string;
  permissions: readonly PermissionDef[];
}

/** Declares a module's permissions. Each module's `<module>.permissions.ts` calls this once. */
export function definePermissions<const T extends readonly PermissionDef[]>(
  module: string,
  permissions: T,
) {
  return { module, permissions } satisfies ModulePermissions as { module: string; permissions: T };
}

/** The key union of a module's permissions, for typed `assertCan` calls. */
export type PermissionKeyOf<M extends ModulePermissions> = M['permissions'][number]['key'];

export const splitPermission = (key: string): { resource: string; action: string } => {
  const index = key.indexOf(':');
  return { resource: key.slice(0, index), action: key.slice(index + 1) };
};

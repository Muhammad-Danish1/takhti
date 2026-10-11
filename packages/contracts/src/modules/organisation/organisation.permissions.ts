import { definePermissions } from '../../kernel/permissions';

/** The Permissions table of docs/plan/10-modules/m02-organisation-branches.md. */
export const organisationPermissions = definePermissions('organisation', [
  { key: 'org:read', label: "See the group's profile", defaultRoles: ['ALL_STAFF'] },
  { key: 'org:update', label: "Change the group's profile", defaultRoles: ['director'] },
  {
    key: 'org-settings:read',
    label: 'See settings',
    defaultRoles: ['LEADERS', 'finance_head', 'academic_head', 'it_admin'],
  },
  {
    key: 'org-settings:update',
    label: 'Change general and security settings',
    defaultRoles: ['director', 'principal'],
    sensitive: true,
  },
  { key: 'branches:read', label: 'See branches', defaultRoles: ['ALL_STAFF'] },
  { key: 'branches:create', label: 'Add a branch', defaultRoles: ['director'] },
  {
    key: 'branches:update',
    label: 'Change or deactivate a branch',
    defaultRoles: ['director', 'principal'],
  },
  {
    key: 'branch-settings:update',
    label: "Change a branch's own settings",
    defaultRoles: ['ADMINS'],
  },
  { key: 'wings:read', label: 'See wings', defaultRoles: ['ALL_STAFF'] },
  { key: 'wings:update', label: 'Create, change and delete wings', defaultRoles: ['ADMINS'] },
  { key: 'rooms:read', label: 'See rooms', defaultRoles: ['ALL_STAFF'] },
  {
    key: 'rooms:update',
    label: 'Create, change and delete rooms',
    defaultRoles: ['ADMINS', 'coordinator'],
  },
  { key: 'onboarding:update', label: 'Tick off setup tasks', defaultRoles: ['ADMINS'] },
] as const);

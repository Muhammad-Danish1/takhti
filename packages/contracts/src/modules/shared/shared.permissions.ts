import { definePermissions } from '../../kernel/permissions';

/**
 * The Permissions table of docs/plan/10-modules/m00-shared-kernel.md.
 * Deciding an approval needs no permission of its own: the step's roles decide who may act.
 * Starting an import needs the create permission of the thing being imported.
 */
export const sharedPermissions = definePermissions('shared', [
  {
    key: 'jobs:read',
    label: "See the organisation's job queue",
    defaultRoles: ['ADMINS', 'it_admin', 'finance_head'],
  },
  { key: 'jobs:retry', label: 'Retry or cancel a job', defaultRoles: ['ADMINS', 'it_admin'] },
  {
    key: 'approvals:read',
    label: "See all approval requests, not only one's own",
    defaultRoles: ['LEADERS', 'finance_head', 'academic_head'],
  },
  {
    key: 'approval-policies:read',
    label: 'See approval policies',
    defaultRoles: ['LEADERS', 'finance_head'],
  },
  {
    key: 'approval-policies:update',
    label: 'Create and change approval policies',
    defaultRoles: ['principal', 'finance_head'],
    sensitive: true,
  },
  { key: 'custom-fields:read', label: 'See custom field definitions', defaultRoles: ['ALL_STAFF'] },
  {
    key: 'custom-fields:update',
    label: 'Create and change custom fields',
    defaultRoles: ['ADMINS'],
  },
  { key: 'notes:read', label: 'Read staff notes', defaultRoles: ['ALL_STAFF'] },
  {
    key: 'notes:create',
    label: "Add, edit and delete one's own notes",
    defaultRoles: ['ALL_STAFF'],
  },
  { key: 'imports:read', label: 'See past imports', defaultRoles: ['ADMINS', 'it_admin'] },
  {
    key: 'integrity:read',
    label: 'See integrity findings',
    defaultRoles: ['ADMINS', 'finance_head', 'it_admin'],
  },
  {
    key: 'integrity:update',
    label: 'Acknowledge and resolve findings',
    defaultRoles: ['ADMINS', 'finance_head'],
  },
  {
    key: 'sync-devices:read',
    label: 'See devices with offline mode on',
    defaultRoles: ['ADMINS', 'it_admin'],
  },
  { key: 'sync-devices:update', label: 'Revoke a device', defaultRoles: ['ADMINS', 'it_admin'] },
  {
    key: 'sync-conflicts:update',
    label: 'Resolve a sync conflict',
    defaultRoles: ['ACADEMIC', 'ACCOUNTS', 'ADMINS'],
  },
] as const);

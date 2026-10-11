import { definePermissions } from '../../kernel/permissions';

/** The Permissions table of docs/plan/10-modules/m03-identity-roles-audit.md. */
export const identityPermissions = definePermissions('identity', [
  {
    key: 'roles:read',
    label: 'See roles and their permissions',
    defaultRoles: ['LEADERS', 'hr_manager', 'it_admin'],
  },
  {
    key: 'roles:update',
    label: 'Create, edit, reset and delete roles',
    defaultRoles: ['director', 'principal'],
    sensitive: true,
  },
  {
    key: 'memberships:read',
    label: 'See who has access and with which roles',
    defaultRoles: ['LEADERS', 'hr_manager', 'it_admin'],
  },
  {
    key: 'memberships:update',
    label: "Change a user's roles and branches; suspend and reactivate",
    defaultRoles: ['director', 'principal', 'hr_manager'],
    sensitive: true,
  },
  {
    key: 'invitations:read',
    label: 'See pending invitations',
    defaultRoles: ['LEADERS', 'hr_manager', 'admissions_officer', 'it_admin'],
  },
  {
    key: 'invitations:create',
    label: 'Invite staff, guardians and students; resend and revoke',
    defaultRoles: ['ADMINS', 'hr_manager', 'admissions_officer', 'it_admin'],
  },
  {
    key: 'audit-log:read',
    label: 'Read the audit log',
    defaultRoles: ['LEADERS', 'finance_head', 'it_admin'],
  },
  {
    key: 'audit-log:export',
    label: 'Export the audit log',
    defaultRoles: ['director', 'principal'],
    sensitive: true,
  },
  {
    key: 'login-events:read',
    label: "See sign-in history of the organisation's members",
    defaultRoles: ['ADMINS', 'it_admin'],
  },
] as const);

import { definePermissions } from '../../kernel/permissions';

/**
 * The Permissions table of docs/plan/10-modules/m01-platform-console.md: what a school's own staff
 * may see of its subscription. Takhti's staff are not governed by these; platform routes check the
 * admin's platform role in the service.
 */
export const platformPermissions = definePermissions('platform', [
  {
    key: 'subscription:read',
    label: "See the organisation's plan, usage and invoices",
    defaultRoles: ['finance_head', 'director'],
  },
  {
    key: 'support-sessions:update',
    label: 'Approve, deny or end a support session',
    defaultRoles: ['director'],
    sensitive: true,
  },
] as const);

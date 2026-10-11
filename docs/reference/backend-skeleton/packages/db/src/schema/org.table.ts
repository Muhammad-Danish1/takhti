import { sql } from 'drizzle-orm';
import { index, jsonb, pgPolicy, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { authenticatedRole } from 'drizzle-orm/supabase';
import { baseColumns, table, timestamptz } from '../kernel/columns';
import { orgScoped } from '../kernel/policies';

export const branches = table(
  'branches',
  {
    ...baseColumns,
    name: text().notNull(),
    code: text().notNull(),
  },
  (t) => [uniqueIndex('branches_code_uq').on(t.orgId, t.code), ...orgScoped('branches', t)],
);

/** Which role may do what: one row per `resource:action`, e.g. ("teacher", "students:read"). */
export const rolePermissions = table(
  'role_permissions',
  {
    orgId: uuid().notNull(),
    roleKey: text().notNull(),
    permission: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.roleKey, t.permission] }), ...orgScoped('role_permissions', t)],
);

/** Append-only record of every change. There is no update or delete policy, so the app cannot edit history. */
export const auditLog = table(
  'audit_log',
  {
    id: uuid().primaryKey().defaultRandom(),
    orgId: uuid().notNull(),
    actorId: uuid().notNull(),
    /** Where the change came from: an API call, an offline device, a background job or the AI assistant. */
    source: text({ enum: ['api', 'sync', 'job', 'ai'] }).notNull(),
    requestId: text().notNull(),
    entity: text().notNull(),
    entityId: uuid().notNull(),
    action: text().notNull(),
    before: jsonb(),
    after: jsonb(),
    at: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_entity_idx').on(t.orgId, t.entity, t.entityId),
    pgPolicy('audit_log_insert', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${t.orgId} = (select app.org_id())`,
    }),
    pgPolicy('audit_log_read', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${t.orgId} = (select app.org_id())`,
    }),
  ],
);

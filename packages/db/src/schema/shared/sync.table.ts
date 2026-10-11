import {
  index,
  integer,
  jsonb,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import {
  devicePlatforms,
  syncConflictStatuses,
  syncDeviceStatuses,
  syncOpResults,
} from '@takhti/contracts';
import { appendColumns, baseColumns } from '../../kernel/base-columns';
import { enumChecks, enumText, live, table, timestamptz } from '../../kernel/columns';
import { appendOnly, orgScoped, selfOwned } from '../../kernel/policies';
import { registerTable } from '../../registry';
import { profiles } from '../identity/identity.table';

/* Offline sync bookkeeping. Design: docs/plan/00-foundation/14-offline-design.md. Used from Phase 17. */

/** A device that has switched offline mode on. */
export const syncDevices = table(
  'sync_devices',
  {
    ...baseColumns,
    userId: uuid()
      .notNull()
      .references((): AnyPgColumn => profiles.id),
    /** Two characters, printed in offline receipt numbers. */
    deviceCode: text().notNull(),
    name: text().notNull(),
    platform: enumText(devicePlatforms).notNull(),
    appVersion: text().notNull(),
    lastSyncAt: timestamptz(),
    pendingCount: integer().notNull().default(0),
    status: enumText(syncDeviceStatuses).notNull().default('active'),
    revokedBy: uuid().references((): AnyPgColumn => profiles.id),
  },
  (t) => [
    ...enumChecks('sync_devices', t),
    uniqueIndex('sync_devices_code_uq').on(t.orgId, t.deviceCode).where(live(t)),
    index('sync_devices_user_idx').on(t.orgId, t.userId),
    ...orgScoped('sync_devices', t),
    ...selfOwned('sync_devices', t.userId, { orgId: t.orgId }),
  ],
);
registerTable(syncDevices, 'sync_devices', { module: 'M00', scope: 'org', self: 'userId' });

/** Operation ids already applied, so a repeated upload is harmless. */
export const syncOps = table(
  'sync_ops',
  {
    ...appendColumns,
    deviceId: uuid()
      .notNull()
      .references(() => syncDevices.id),
    opId: text().notNull(),
    tableName: text().notNull(),
    result: enumText(syncOpResults).notNull(),
  },
  (t) => [
    ...enumChecks('sync_ops', t),
    uniqueIndex('sync_ops_uq').on(t.orgId, t.deviceId, t.opId),
    ...appendOnly('sync_ops', t, { insertBy: 'member', readBy: 'staff' }),
  ],
);
registerTable(syncOps, 'sync_ops', {
  module: 'M00',
  scope: 'org',
  staff: 'append',
  member: 'insert',
  appendOnly: true,
});

/** A change the server refused, kept for the user to see until they deal with it. */
export const syncRejections = table(
  'sync_rejections',
  {
    ...baseColumns,
    userId: uuid()
      .notNull()
      .references((): AnyPgColumn => profiles.id),
    deviceId: uuid()
      .notNull()
      .references(() => syncDevices.id),
    opId: text().notNull(),
    tableName: text().notNull(),
    entityId: uuid().notNull(),
    payload: jsonb().notNull(),
    /** An API error code. */
    reasonCode: text().notNull(),
    /** Written for the user. */
    reason: text().notNull(),
    resolvedAt: timestamptz(),
  },
  (t) => [
    index('sync_rejections_user_idx').on(t.orgId, t.userId, t.resolvedAt),
    index('sync_rejections_device_idx').on(t.deviceId),
    ...orgScoped('sync_rejections', t),
    ...selfOwned('sync_rejections', t.userId, { orgId: t.orgId }),
  ],
);
registerTable(syncRejections, 'sync_rejections', { module: 'M00', scope: 'org', self: 'userId' });

/** A device's value and the server's value disagree; a person chooses. */
export const syncConflicts = table(
  'sync_conflicts',
  {
    ...baseColumns,
    deviceId: uuid()
      .notNull()
      .references(() => syncDevices.id),
    tableName: text().notNull(),
    entityId: uuid().notNull(),
    deviceValue: jsonb().notNull(),
    serverValue: jsonb().notNull(),
    status: enumText(syncConflictStatuses).notNull().default('open'),
    resolvedBy: uuid().references((): AnyPgColumn => profiles.id),
    resolvedAt: timestamptz(),
  },
  (t) => [
    ...enumChecks('sync_conflicts', t),
    index('sync_conflicts_idx').on(t.orgId, t.status, t.createdAt),
    index('sync_conflicts_device_idx').on(t.deviceId),
    ...orgScoped('sync_conflicts', t),
  ],
);
registerTable(syncConflicts, 'sync_conflicts', { module: 'M00', scope: 'org' });

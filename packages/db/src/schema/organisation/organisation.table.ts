import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import {
  genderPolicies,
  onboardingStatuses,
  onboardingTaskKeys,
  roomKinds,
} from '@takhti/contracts';
import { baseColumns, branchIdColumn } from '../../kernel/base-columns';
import {
  between,
  enumChecks,
  enumText,
  live,
  positive,
  table,
  timestamptz,
} from '../../kernel/columns';
import { branchScoped, memberRead, orgScoped } from '../../kernel/policies';
import { registerTable } from '../../registry';
import { profiles } from '../identity/identity.table';
import { staff } from '../staff/staff.table';

export const orgSettings = table(
  'org_settings',
  {
    ...baseColumns,
    /** A registered setting with scope `org`. */
    key: text().notNull(),
    /** Validated by the setting's schema before saving. */
    value: jsonb().notNull(),
  },
  (t) => [
    uniqueIndex('org_settings_key_uq').on(t.orgId, t.key).where(live(t)),
    ...orgScoped('org_settings', t),
    // A setting shapes what a family sees too (which payment methods are offered, who may apply for leave),
    // so every member may read; only staff may change, and the service decides what a screen shows.
    ...memberRead('org_settings', t),
  ],
);
registerTable(orgSettings, 'org_settings', { module: 'M02', scope: 'org', member: 'read' });

export const branchSettings = table(
  'branch_settings',
  {
    ...baseColumns,
    branchId: branchIdColumn(),
    /** A registered setting with scope `branch`. */
    key: text().notNull(),
    value: jsonb().notNull(),
  },
  (t) => [
    uniqueIndex('branch_settings_key_uq').on(t.branchId, t.key).where(live(t)),
    ...branchScoped('branch_settings', t),
    ...memberRead('branch_settings', t),
  ],
);
registerTable(branchSettings, 'branch_settings', {
  module: 'M02',
  scope: 'branch',
  member: 'read',
});

/** A part of a campus with its own head: Primary, Middle, Secondary, or Boys and Girls. */
export const wings = table(
  'wings',
  {
    ...baseColumns,
    branchId: branchIdColumn(),
    name: text().notNull(),
    nameUr: text(),
    gradeFrom: integer().notNull(),
    gradeTo: integer().notNull(),
    /** A boys' wing and a girls' wing may cover the same grades. */
    gender: enumText(genderPolicies).notNull().default('mixed'),
    headStaffId: uuid().references((): AnyPgColumn => staff.id),
  },
  (t) => [
    ...enumChecks('wings', t),
    between('wings', t.gradeFrom, 1, 10),
    between('wings', t.gradeTo, 1, 10),
    uniqueIndex('wings_name_uq').on(t.branchId, t.name).where(live(t)),
    index('wings_branch_idx').on(t.orgId, t.branchId),
    ...branchScoped('wings', t),
  ],
);
registerTable(wings, 'wings', { module: 'M02', scope: 'branch' });

export const rooms = table(
  'rooms',
  {
    ...baseColumns,
    branchId: branchIdColumn(),
    name: text().notNull(),
    kind: enumText(roomKinds).notNull().default('classroom'),
    capacity: integer(),
    floor: text(),
    isBookable: boolean().notNull().default(false),
  },
  (t) => [
    ...enumChecks('rooms', t),
    positive('rooms', t.capacity),
    uniqueIndex('rooms_name_uq').on(t.branchId, t.name).where(live(t)),
    index('rooms_branch_idx').on(t.orgId, t.branchId, t.kind),
    ...branchScoped('rooms', t),
  ],
);
registerTable(rooms, 'rooms', { module: 'M02', scope: 'branch' });

/** The setup checklist a new school group works through. */
export const onboardingTasks = table(
  'onboarding_tasks',
  {
    ...baseColumns,
    key: enumText(onboardingTaskKeys).notNull(),
    status: enumText(onboardingStatuses).notNull().default('pending'),
    completedAt: timestamptz(),
    completedBy: uuid().references((): AnyPgColumn => profiles.id),
  },
  (t) => [
    ...enumChecks('onboarding_tasks', t),
    uniqueIndex('onboarding_tasks_key_uq').on(t.orgId, t.key).where(live(t)),
    ...orgScoped('onboarding_tasks', t),
  ],
);
registerTable(onboardingTasks, 'onboarding_tasks', { module: 'M02', scope: 'org' });

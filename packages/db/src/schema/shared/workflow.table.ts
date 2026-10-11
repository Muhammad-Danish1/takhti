import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import {
  approvalStatuses,
  approvalStepStatuses,
  customFieldEntities,
  customFieldTypes,
  exportFormats,
  exportStatuses,
  findingSeverities,
  findingStatuses,
  importRowStatuses,
  importStatuses,
  noteVisibilities,
} from '@takhti/contracts';
import { baseColumns } from '../../kernel/base-columns';
import {
  enumChecks,
  enumText,
  live,
  nonNegative,
  paisa,
  table,
  timestamptz,
} from '../../kernel/columns';
import { orgScoped, selfOwned } from '../../kernel/policies';
import { registerTable } from '../../registry';
import { profiles } from '../identity/identity.table';
import { branches } from '../organisation/branches.table';
import { files } from './files.table';

// ---------------------------------------------------------------- approvals

/** Who must approve what. */
export const approvalPolicies = table(
  'approval_policies',
  {
    ...baseColumns,
    /** `student-discounts`, `expenses`, `leave-requests`, … */
    entityType: text().notNull(),
    name: text().notNull(),
    /** The policy applies at or above this amount. */
    minAmount: paisa(),
    /** Ordered list of `{ roleKeys: string[] }`. */
    steps: jsonb().notNull(),
    isActive: boolean().notNull().default(true),
  },
  (t) => [
    nonNegative('approval_policies', t.minAmount),
    index('approval_policies_entity_idx').on(t.orgId, t.entityType, t.isActive),
    ...orgScoped('approval_policies', t),
  ],
);
registerTable(approvalPolicies, 'approval_policies', { module: 'M00', scope: 'org' });

export const approvalRequests = table(
  'approval_requests',
  {
    ...baseColumns,
    entityType: text().notNull(),
    entityId: uuid().notNull(),
    branchId: uuid().references(() => branches.id),
    policyId: uuid()
      .notNull()
      .references(() => approvalPolicies.id),
    /** One line shown to the approver. */
    summary: text().notNull(),
    amount: paisa(),
    status: enumText(approvalStatuses).notNull().default('pending'),
    currentStep: integer().notNull().default(1),
    requestedBy: uuid()
      .notNull()
      .references((): AnyPgColumn => profiles.id),
    decidedAt: timestamptz(),
  },
  (t) => [
    ...enumChecks('approval_requests', t),
    nonNegative('approval_requests', t.amount),
    uniqueIndex('approval_requests_pending_uq')
      .on(t.orgId, t.entityType, t.entityId)
      .where(sql`${t.status} = 'pending' and ${t.deletedAt} is null`),
    index('approval_requests_status_idx').on(t.orgId, t.status, t.createdAt),
    index('approval_requests_requester_idx').on(t.orgId, t.requestedBy),
    index('approval_requests_policy_idx').on(t.policyId),
    ...orgScoped('approval_requests', t),
  ],
);
registerTable(approvalRequests, 'approval_requests', { module: 'M00', scope: 'org' });

export const approvalSteps = table(
  'approval_steps',
  {
    ...baseColumns,
    requestId: uuid()
      .notNull()
      .references(() => approvalRequests.id),
    stepOrder: integer().notNull(),
    status: enumText(approvalStepStatuses).notNull(),
    decidedBy: uuid().references((): AnyPgColumn => profiles.id),
    decidedAt: timestamptz(),
    /** Required on reject. */
    note: text(),
  },
  (t) => [
    ...enumChecks('approval_steps', t),
    check(
      'approval_steps_reject_note_chk',
      sql`${t.status} <> 'rejected' or ${t.note} is not null`,
    ),
    uniqueIndex('approval_steps_uq').on(t.requestId, t.stepOrder).where(live(t)),
    ...orgScoped('approval_steps', t),
  ],
);
registerTable(approvalSteps, 'approval_steps', { module: 'M00', scope: 'org' });

// ---------------------------------------------------------------- imports and exports

export const importBatches = table(
  'import_batches',
  {
    ...baseColumns,
    /** `students`, `staff`, `marks`, … */
    kind: text().notNull(),
    fileId: uuid()
      .notNull()
      .references(() => files.id),
    branchId: uuid().references(() => branches.id),
    status: enumText(importStatuses).notNull(),
    totalRows: integer().notNull().default(0),
    validRows: integer().notNull().default(0),
    invalidRows: integer().notNull().default(0),
    createdRows: integer().notNull().default(0),
    options: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** The failed rows with an error column. */
    errorFileId: uuid().references(() => files.id),
    startedBy: uuid()
      .notNull()
      .references((): AnyPgColumn => profiles.id),
  },
  (t) => [
    ...enumChecks('import_batches', t),
    index('import_batches_idx').on(t.orgId, t.kind, t.createdAt),
    index('import_batches_file_idx').on(t.fileId),
    ...orgScoped('import_batches', t),
  ],
);
registerTable(importBatches, 'import_batches', { module: 'M00', scope: 'org' });

export const importRows = table(
  'import_rows',
  {
    ...baseColumns,
    batchId: uuid()
      .notNull()
      .references(() => importBatches.id),
    rowNumber: integer().notNull(),
    /** The cells as uploaded. */
    raw: jsonb().notNull(),
    /** After validation. */
    parsed: jsonb(),
    status: enumText(importRowStatuses).notNull(),
    /** `{ column: message }` */
    errors: jsonb(),
    /** The record created. */
    entityId: uuid(),
  },
  (t) => [
    ...enumChecks('import_rows', t),
    index('import_rows_batch_idx').on(t.batchId, t.status, t.rowNumber),
    ...orgScoped('import_rows', t),
  ],
);
registerTable(importRows, 'import_rows', { module: 'M00', scope: 'org' });

export const exportJobs = table(
  'export_jobs',
  {
    ...baseColumns,
    userId: uuid()
      .notNull()
      .references((): AnyPgColumn => profiles.id),
    /** The list being exported. */
    kind: text().notNull(),
    filters: jsonb().notNull(),
    format: enumText(exportFormats).notNull(),
    status: enumText(exportStatuses).notNull(),
    fileId: uuid().references(() => files.id),
    rowCount: integer(),
    includesSensitive: boolean().notNull().default(false),
  },
  (t) => [
    ...enumChecks('export_jobs', t),
    index('export_jobs_user_idx').on(t.orgId, t.userId, t.createdAt),
    ...orgScoped('export_jobs', t),
    ...selfOwned('export_jobs', t.userId, { orgId: t.orgId }),
  ],
);
registerTable(exportJobs, 'export_jobs', { module: 'M00', scope: 'org', self: 'userId' });

// ---------------------------------------------------------------- small shared records

/** Extra fields a school adds to students, guardians, staff or admissions. */
export const customFieldDefs = table(
  'custom_field_defs',
  {
    ...baseColumns,
    entity: enumText(customFieldEntities).notNull(),
    /** Lower snake_case. */
    key: text().notNull(),
    label: text().notNull(),
    labelUr: text(),
    fieldType: enumText(customFieldTypes).notNull(),
    /** For `select`. */
    options: jsonb(),
    isRequired: boolean().notNull().default(false),
    sortOrder: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
  },
  (t) => [
    ...enumChecks('custom_field_defs', t),
    check('custom_field_defs_key_chk', sql`${t.key} ~ '^[a-z][a-z0-9_]*$'`),
    uniqueIndex('custom_field_defs_uq').on(t.orgId, t.entity, t.key).where(live(t)),
    ...orgScoped('custom_field_defs', t),
  ],
);
registerTable(customFieldDefs, 'custom_field_defs', { module: 'M00', scope: 'org' });

/** Internal staff notes on any record. */
export const notes = table(
  'notes',
  {
    ...baseColumns,
    entityType: text().notNull(),
    entityId: uuid().notNull(),
    body: text().notNull(),
    visibility: enumText(noteVisibilities).notNull().default('staff'),
    isPinned: boolean().notNull().default(false),
  },
  (t) => [
    ...enumChecks('notes', t),
    check('notes_body_len_chk', sql`char_length(${t.body}) between 1 and 5000`),
    index('notes_entity_idx').on(t.orgId, t.entityType, t.entityId, t.createdAt),
    ...orgScoped('notes', t),
  ],
);
registerTable(notes, 'notes', { module: 'M00', scope: 'org' });

/** A user's saved filters for a list. */
export const savedViews = table(
  'saved_views',
  {
    ...baseColumns,
    userId: uuid()
      .notNull()
      .references((): AnyPgColumn => profiles.id),
    listKey: text().notNull(),
    name: text().notNull(),
    filters: jsonb().notNull(),
    isDefault: boolean().notNull().default(false),
  },
  (t) => [
    index('saved_views_user_idx').on(t.orgId, t.userId, t.listKey),
    ...orgScoped('saved_views', t),
    ...selfOwned('saved_views', t.userId, { orgId: t.orgId }),
  ],
);
registerTable(savedViews, 'saved_views', { module: 'M00', scope: 'org', self: 'userId' });

/** Results of the nightly integrity checks. */
export const integrityFindings = table(
  'integrity_findings',
  {
    ...baseColumns,
    checkName: text().notNull(),
    entityType: text(),
    entityId: uuid(),
    detail: jsonb().notNull(),
    severity: enumText(findingSeverities).notNull(),
    status: enumText(findingStatuses).notNull().default('open'),
    resolvedBy: uuid().references((): AnyPgColumn => profiles.id),
    resolvedNote: text(),
  },
  (t) => [
    ...enumChecks('integrity_findings', t),
    index('integrity_findings_idx').on(t.orgId, t.status, t.severity, t.createdAt),
    ...orgScoped('integrity_findings', t),
  ],
);
registerTable(integrityFindings, 'integrity_findings', { module: 'M00', scope: 'org' });

import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { documentLanguages, filePurposes, fileStatuses } from '@takhti/contracts';
import { baseColumns } from '../../kernel/base-columns';
import { enumChecks, enumText, positive, table, timestamptz } from '../../kernel/columns';
import { customPolicy, orgScoped, policySql } from '../../kernel/policies';
import { registerTable } from '../../registry';
import { profiles } from '../identity/identity.table';

/** One uploaded or generated file. Bytes live in Storage; this row is the record of them. */
export const files = table(
  'files',
  {
    ...baseColumns,
    bucket: text().notNull(),
    path: text().notNull(),
    purpose: enumText(filePurposes).notNull(),
    /** A label only; never used as a path. */
    originalName: text().notNull(),
    mimeType: text().notNull(),
    sizeBytes: bigint({ mode: 'number' }).notNull(),
    status: enumText(fileStatuses).notNull().default('pending'),
    /** SHA-256 of the content. */
    checksum: text(),
    width: integer(),
    height: integer(),
    thumbnailPath: text(),
    uploadedBy: uuid()
      .notNull()
      .references((): AnyPgColumn => profiles.id),
  },
  (t) => [
    ...enumChecks('files', t),
    positive('files', t.sizeBytes),
    uniqueIndex('files_path_uq').on(t.path),
    index('files_org_status_idx').on(t.orgId, t.status, t.createdAt),
    ...orgScoped('files', t),
    // Any member may record their own upload and see it; everything else reaches files through signed links.
    customPolicy('files_own_insert', {
      for: 'insert',
      withCheck: sql`${policySql.sameOrg(t.orgId)} and ${t.uploadedBy} = ${policySql.userId}`,
    }),
    customPolicy('files_own_read', {
      for: 'select',
      using: sql`${policySql.sameOrg(t.orgId)} and ${t.uploadedBy} = ${policySql.userId}`,
    }),
    customPolicy('files_own_update', {
      for: 'update',
      using: sql`${policySql.sameOrg(t.orgId)} and ${t.uploadedBy} = ${policySql.userId} and ${t.status} = 'pending'`,
      withCheck: sql`${policySql.sameOrg(t.orgId)} and ${t.uploadedBy} = ${policySql.userId}`,
    }),
  ],
);
registerTable(files, 'files', { module: 'M00', scope: 'org', custom: true });

/** Links a file to any record. */
export const attachments = table(
  'attachments',
  {
    ...baseColumns,
    /** A resource name such as `students`. */
    entityType: text().notNull(),
    entityId: uuid().notNull(),
    fileId: uuid()
      .notNull()
      .references(() => files.id),
    label: text(),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [
    index('attachments_entity_idx').on(t.orgId, t.entityType, t.entityId),
    index('attachments_file_idx').on(t.fileId),
    ...orgScoped('attachments', t),
  ],
);
registerTable(attachments, 'attachments', { module: 'M00', scope: 'org' });

/** A PDF made by the document pipeline. */
export const generatedDocuments = table(
  'generated_documents',
  {
    ...baseColumns,
    /** A key from the document catalogue. */
    kind: text().notNull(),
    entityType: text().notNull(),
    entityId: uuid().notNull(),
    fileId: uuid()
      .notNull()
      .references(() => files.id),
    /** The document's printed number. */
    number: text(),
    language: enumText(documentLanguages).notNull(),
    contentHash: text().notNull(),
    /** For the public verification page. */
    verifyTokenHash: text(),
    batchId: uuid(),
    revokedAt: timestamptz(),
    revokedReason: text(),
  },
  (t) => [
    ...enumChecks('generated_documents', t),
    uniqueIndex('generated_documents_number_uq')
      .on(t.orgId, t.kind, t.number)
      .where(sql`${t.number} is not null and ${t.deletedAt} is null`),
    uniqueIndex('generated_documents_verify_uq')
      .on(t.verifyTokenHash)
      .where(sql`${t.verifyTokenHash} is not null`),
    index('generated_documents_entity_idx').on(t.orgId, t.entityType, t.entityId),
    index('generated_documents_file_idx').on(t.fileId),
    ...orgScoped('generated_documents', t),
  ],
);
registerTable(generatedDocuments, 'generated_documents', { module: 'M00', scope: 'org' });

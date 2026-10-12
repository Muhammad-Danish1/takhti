import { z } from 'zod';
import { MAX_PAGE_SIZE } from '../../kernel/resource';
import { ExportStatus, ImportRowStatus, ImportStatus } from './shared.constants';

/*
 * Imports and exports as a person sees them: docs/plan/10-modules/m00-shared-kernel.md and
 * docs/plan/00-foundation/13-notifications-jobs-and-files.md, section 5.
 *
 * An import is always two steps: the file is checked row by row and shown, and only then, when the
 * person says so, are the valid rows written.
 */

/** The name a module gave its importer or exporter: `students`, `opening-fee-balances`. */
export const TransferKind = z
  .string()
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, 'Not a kind of import')
  .max(60);

export const ImportKindParams = z.object({ kind: TransferKind });

/** Body of `POST /imports`: an uploaded CSV file to check. */
export const StartImport = z.object({
  kind: TransferKind,
  /** A ready file uploaded with the purpose `import`. */
  fileId: z.uuid(),
  /** The branch the records go into, when the kind of record belongs to one. */
  branchId: z.uuid().optional(),
  /** Choices the importer understands, such as whether to update records that already exist. */
  options: z.record(z.string(), z.unknown()).optional(),
});
export type StartImport = z.output<typeof StartImport>;

export const ImportBatch = z.object({
  id: z.uuid(),
  kind: z.string(),
  fileId: z.uuid(),
  branchId: z.uuid().nullable(),
  status: ImportStatus,
  totalRows: z.int(),
  validRows: z.int(),
  invalidRows: z.int(),
  createdRows: z.int(),
  /** The rows that were wrong or failed, as a file to correct and upload again. Present once there are any. */
  errorFileId: z.uuid().nullable(),
  startedBy: z.uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ImportBatch = z.output<typeof ImportBatch>;

export const ListImports = z.strictObject({
  kind: TransferKind.optional(),
  status: ImportStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});
export type ListImports = z.output<typeof ListImports>;

export const ListImportRows = z.strictObject({
  /** `invalid` and `failed` are the rows a person must look at. */
  status: ImportRowStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
});
export type ListImportRows = z.output<typeof ListImportRows>;

export const ImportRow = z.object({
  id: z.uuid(),
  /** The line in the spreadsheet: the heading is line 1. */
  rowNumber: z.int(),
  /** The cells as uploaded, by column. */
  raw: z.record(z.string(), z.unknown()),
  status: ImportRowStatus,
  /** What is wrong, by column heading; `_` for a problem with the row as a whole. */
  errors: z.record(z.string(), z.string()).nullable(),
  /** The record this row became. */
  entityId: z.uuid().nullable(),
});
export type ImportRow = z.output<typeof ImportRow>;

/** The answer of committing an import. */
export const CommittedImport = z.object({
  batchId: z.uuid(),
  createdRows: z.int(),
  failedRows: z.int(),
  errorFileId: z.uuid().nullable(),
});
export type CommittedImport = z.output<typeof CommittedImport>;

// ---------------------------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------------------------

export const ListExports = z.strictObject({
  status: ExportStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});
export type ListExports = z.output<typeof ListExports>;

export const ExportJob = z.object({
  id: z.uuid(),
  kind: z.string(),
  format: z.string(),
  status: ExportStatus,
  rowCount: z.int().nullable(),
  fileId: z.uuid().nullable(),
  includesSensitive: z.boolean(),
  createdAt: z.string(),
  /** A link to the file, good for five minutes. Present when one export is opened and it is ready. */
  download: z.object({ url: z.string(), expiresAt: z.string() }).optional(),
});
export type ExportJob = z.output<typeof ExportJob>;

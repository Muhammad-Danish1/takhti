import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { ModuleKey } from '@takhti/contracts';
import { files, importBatches, importRows } from '@takhti/db';
import { storage } from '../providers/storage';
import { audit } from './audit';
import { stampOf, type Ctx } from './context';
import { parseCsv, toCsv } from './csv';
import { invalid, notFound, rule, toErrorResponse } from './errors';
import { newId } from './ids';
import { assertModule } from './modules';
import { assertCan } from './permissions';

/*
 * Imports are always two steps.
 *
 *   stageImport   reads the uploaded file, checks every row and keeps the result in a staging table,
 *                 with the reason beside each row that is wrong. Nothing touches business tables.
 *   commitImport  after a person has looked at the preview, creates a record for each valid row.
 *                 Each row is saved on its own, so one row that fails then does not undo the others.
 *
 * A module describes what it can import with `defineImporter`.
 * Only CSV is read for now; a spreadsheet is saved as CSV before uploading.
 */

export interface ImportColumn {
  /** The key in the parsed row. */
  key: string;
  /** The heading people see in the template. Matching ignores case and spaces. */
  header: string;
  required?: boolean;
  example?: string;
}

export interface ImporterDefinition<TRow = unknown> {
  /** For example `students`. */
  kind: string;
  label: string;
  module?: ModuleKey;
  /** The permission needed to start and to commit: the create permission of what is imported. */
  permission: { resource: string; action: string };
  columns: readonly ImportColumn[];
  /** Validates one row, given as `{ key: cell text }`. */
  row: z.ZodType<TRow>;
  /** Creates the record for one valid row and returns its id. Runs in a savepoint. */
  commit(
    ctx: Ctx,
    row: TRow,
    batch: { id: string; branchId: string | null; options: Record<string, unknown> },
  ): Promise<string>;
}

const importers = new Map<string, ImporterDefinition>();

export function defineImporter<TRow>(
  definition: ImporterDefinition<TRow>,
): ImporterDefinition<TRow> {
  importers.set(definition.kind, definition as ImporterDefinition);
  return definition;
}

export const findImporter = (kind: string): ImporterDefinition | undefined => importers.get(kind);

export const MAX_IMPORT_ROWS = 5_000;

const normalise = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '');

/** The first line of the template people fill in, with an example row. */
export function importTemplate(definition: ImporterDefinition): string {
  return toCsv([
    definition.columns.map((column) => column.header),
    definition.columns.map((column) => column.example ?? ''),
  ]);
}

async function importerFor(ctx: Ctx, kind: string): Promise<ImporterDefinition> {
  const definition = findImporter(kind);
  if (!definition) throw notFound('Import type');
  if (definition.module) await assertModule(ctx, definition.module);
  assertCan(ctx, definition.permission.resource, definition.permission.action);
  return definition;
}

export interface StagedImport {
  batchId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

/** Step 1: reads the file, checks each row and stores the result for a preview. */
export async function stageImport(
  ctx: Ctx,
  input: { kind: string; fileId: string; branchId?: string; options?: Record<string, unknown> },
): Promise<StagedImport> {
  const definition = await importerFor(ctx, input.kind);

  const [file] = await ctx.db
    .select()
    .from(files)
    .where(and(eq(files.id, input.fileId), isNull(files.deletedAt)))
    .limit(1);
  if (!file || file.status !== 'ready' || file.purpose !== 'import')
    throw invalid({ fileId: ['Upload the file again'] });
  if (file.mimeType !== 'text/csv')
    throw invalid({ fileId: ['Save the sheet as CSV and upload that file'] });

  const bytes = await storage().get(file.bucket, file.path);
  if (!bytes) throw rule('The uploaded file could not be read. Upload it again.');
  const table = parseCsv(new TextDecoder('utf-8').decode(bytes));
  const [headings, ...lines] = table;
  if (!headings || lines.length === 0) throw invalid({ fileId: ['The file has no rows'] });
  if (lines.length > MAX_IMPORT_ROWS) {
    throw invalid({
      fileId: [
        `The file has ${lines.length} rows; the most in one import is ${MAX_IMPORT_ROWS}. Split it into smaller files.`,
      ],
    });
  }

  const position = new Map(headings.map((heading, index) => [normalise(heading), index]));
  const missing = definition.columns.filter(
    (column) => column.required && !position.has(normalise(column.header)),
  );
  if (missing.length > 0) {
    throw invalid({
      fileId: [
        `The file is missing these columns: ${missing.map((column) => column.header).join(', ')}`,
      ],
    });
  }

  const batchId = newId();
  const stamps = {
    orgId: ctx.actor.orgId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    createdBy: stampOf(ctx),
    updatedBy: stampOf(ctx),
  };
  let valid = 0;
  const staged = lines.map((cells, index) => {
    const raw: Record<string, string> = {};
    for (const column of definition.columns) {
      const at = position.get(normalise(column.header));
      raw[column.key] = at === undefined ? '' : (cells[at] ?? '').trim();
    }
    const parsed = definition.row.safeParse(raw);
    if (parsed.success) valid += 1;
    const errors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '_');
        const column = definition.columns.find((candidate) => candidate.key === key);
        errors[column?.header ?? key] ??= issue.message;
      }
    }
    return {
      id: newId(),
      ...stamps,
      batchId,
      // The line number as a person sees it in a spreadsheet: the heading is line 1.
      rowNumber: index + 2,
      raw,
      parsed: parsed.success ? (parsed.data as never) : null,
      status: parsed.success ? ('valid' as const) : ('invalid' as const),
      errors: parsed.success ? null : errors,
    };
  });

  await ctx.db.insert(importBatches).values({
    id: batchId,
    ...stamps,
    kind: definition.kind,
    fileId: file.id,
    branchId: input.branchId ?? null,
    status: 'ready',
    totalRows: staged.length,
    validRows: valid,
    invalidRows: staged.length - valid,
    options: (input.options ?? {}) as never,
    startedBy: ctx.actor.userId,
  });
  for (let start = 0; start < staged.length; start += 500) {
    await ctx.db.insert(importRows).values(staged.slice(start, start + 500));
  }
  await audit(ctx, 'imports', 'create', batchId, {
    summary: `Checked a ${definition.label} import: ${valid} of ${staged.length} rows are ready`,
    branchId: input.branchId ?? null,
  });
  return {
    batchId,
    totalRows: staged.length,
    validRows: valid,
    invalidRows: staged.length - valid,
  };
}

export interface CommittedImport {
  batchId: string;
  createdRows: number;
  failedRows: number;
}

/** Step 2: creates a record for every valid row. A row that fails is marked with its reason; the rest go through. */
export async function commitImport(ctx: Ctx, batchId: string): Promise<CommittedImport> {
  const [batch] = await ctx.db
    .select()
    .from(importBatches)
    .where(and(eq(importBatches.id, batchId), isNull(importBatches.deletedAt)))
    .limit(1)
    .for('update');
  if (!batch) throw notFound('Import');
  if (batch.status !== 'ready')
    throw rule(
      batch.status === 'completed'
        ? 'This import was already completed'
        : 'This import cannot be started',
    );
  const definition = await importerFor(ctx, batch.kind);
  if (batch.validRows === 0)
    throw rule('No row of this file is ready to import. Correct the file and upload it again.');

  const stamp = { updatedAt: ctx.now, updatedBy: stampOf(ctx) };
  const rows = await ctx.db
    .select()
    .from(importRows)
    .where(
      and(
        eq(importRows.batchId, batchId),
        eq(importRows.status, 'valid'),
        isNull(importRows.deletedAt),
      ),
    )
    .orderBy(asc(importRows.rowNumber));

  let created = 0;
  let failed = 0;
  const context = {
    id: batch.id,
    branchId: batch.branchId,
    options: (batch.options ?? {}) as Record<string, unknown>,
  };
  for (const row of rows) {
    // The row is checked again from the cells as uploaded: the importer's rules may have changed since it
    // was staged. (The stored `parsed` value is for the preview; a schema's output is not always valid input.)
    const parsed = definition.row.safeParse(row.raw);
    let entityId: string | undefined;
    let reason: string | undefined;
    if (!parsed.success) {
      reason = parsed.error.issues[0]?.message ?? 'This row is no longer valid';
    } else {
      try {
        entityId = await ctx.db.transaction((savepoint) =>
          definition.commit({ ...ctx, db: savepoint }, parsed.data, context),
        );
      } catch (error) {
        const reply = toErrorResponse(error, ctx.requestId);
        // A programming error must not be recorded as "row 14 failed": stop, and undo the whole commit.
        if (reply.unexpected) throw error;
        const field = Object.values(reply.body.error.fields ?? {})[0]?.[0];
        reason = field ?? reply.body.error.message;
      }
    }
    if (entityId) created += 1;
    else failed += 1;
    await ctx.db
      .update(importRows)
      .set({
        status: entityId ? 'created' : 'failed',
        entityId: entityId ?? null,
        errors: entityId ? null : { _: reason ?? 'Could not be imported' },
        version: sql`${importRows.version} + 1`,
        ...stamp,
      })
      .where(eq(importRows.id, row.id));
  }

  await ctx.db
    .update(importBatches)
    .set({
      status: 'completed',
      createdRows: created,
      version: sql`${importBatches.version} + 1`,
      ...stamp,
    })
    .where(eq(importBatches.id, batchId));
  await audit(ctx, 'imports', 'commit', batchId, {
    summary: `Imported ${created} ${definition.label} record(s)${failed ? `; ${failed} row(s) failed` : ''}`,
    branchId: batch.branchId,
  });
  return { batchId, createdRows: created, failedRows: failed };
}

/** Abandons an import that was checked but not committed. */
export async function cancelImport(ctx: Ctx, batchId: string): Promise<void> {
  const [batch] = await ctx.db
    .update(importBatches)
    .set({
      status: 'cancelled',
      updatedAt: ctx.now,
      updatedBy: stampOf(ctx),
      version: sql`${importBatches.version} + 1`,
    })
    .where(
      and(
        eq(importBatches.id, batchId),
        eq(importBatches.status, 'ready'),
        isNull(importBatches.deletedAt),
      ),
    )
    .returning({ id: importBatches.id });
  if (!batch) throw rule('Only an import that is waiting to be started can be cancelled');
}

/** The rows that are wrong or failed, as CSV with a column saying why, for correcting and uploading again. */
export async function importProblemsCsv(ctx: Ctx, batchId: string): Promise<string> {
  const [batch] = await ctx.db
    .select()
    .from(importBatches)
    .where(and(eq(importBatches.id, batchId), isNull(importBatches.deletedAt)))
    .limit(1);
  if (!batch) throw notFound('Import');
  const definition = await importerFor(ctx, batch.kind);
  const rows = await ctx.db
    .select()
    .from(importRows)
    .where(
      and(
        eq(importRows.batchId, batchId),
        sql`${importRows.status} in ('invalid', 'failed')`,
        isNull(importRows.deletedAt),
      ),
    )
    .orderBy(asc(importRows.rowNumber));
  return toCsv([
    ['Row', ...definition.columns.map((column) => column.header), 'Problem'],
    ...rows.map((row) => {
      const raw = (row.raw ?? {}) as Record<string, string>;
      const problems = Object.entries((row.errors ?? {}) as Record<string, string>).map(
        ([column, message]) => (column === '_' ? message : `${column}: ${message}`),
      );
      return [
        row.rowNumber,
        ...definition.columns.map((column) => raw[column.key] ?? ''),
        problems.join('; '),
      ];
    }),
  ]);
}

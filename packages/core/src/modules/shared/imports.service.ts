import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  ExportJob,
  ImportBatch,
  ImportRow,
  importCompleted,
  type CommittedImport,
  type ListExports,
  type ListImportRows,
  type ListImports,
  type Page,
  type StartImport,
} from '@takhti/contracts';
import { exportJobs, importBatches, importRows } from '@takhti/db';
import { stampOf, type Ctx } from '../../kernel/context';
import { notFound } from '../../kernel/errors';
import { emit } from '../../kernel/events';
import { exportStatus } from '../../kernel/export';
import { signedDownload, storeGeneratedFile } from '../../kernel/files';
import {
  cancelImport,
  commitImport,
  findImporter,
  importProblemsCsv,
  importTemplate,
  stageImport,
} from '../../kernel/import';
import { assertModule } from '../../kernel/modules';
import { assertCan, assertPermission, holds } from '../../kernel/permissions';

/*
 * Imports and exports over HTTP: docs/plan/10-modules/m00-shared-kernel.md, rules R-shared-8 and 9.
 * The kernel (`kernel/import.ts`, `kernel/export.ts`) reads, checks and writes; this service is what
 * a person asks for: the template, the check, the preview of what is wrong, the commit, the result.
 *
 * A file is checked and committed inside the request for now. The two import jobs of the
 * specification take over when the first importer of thousands of rows exists.
 */

type BatchRow = typeof importBatches.$inferSelect;

/** An import belongs to the person who started it. Those who may see every import may see it too. */
async function ownBatch(ctx: Ctx, id: string): Promise<BatchRow> {
  const [batch] = await ctx.db
    .select()
    .from(importBatches)
    .where(and(eq(importBatches.id, id), isNull(importBatches.deletedAt)))
    .limit(1);
  if (!batch || (batch.startedBy !== ctx.actor.userId && !holds(ctx, 'imports:read')))
    throw notFound('Import');
  return batch;
}

export const importsService = {
  /** The spreadsheet a person fills in for one kind of import, with an example row. */
  async template(ctx: Ctx, kind: string): Promise<Response> {
    const definition = findImporter(kind);
    if (!definition) throw notFound('Import type');
    if (definition.module) await assertModule(ctx, definition.module);
    // Starting an import needs the create permission of the thing being imported.
    assertCan(ctx, definition.permission.resource, definition.permission.action);
    // The byte-order mark makes spreadsheets read Urdu headings correctly.
    return new Response(`﻿${importTemplate(definition)}`, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${definition.kind}-template.csv"`,
        'cache-control': 'no-store',
      },
    });
  },

  /** Step 1: reads the uploaded file and checks every row. Nothing is written to the records themselves. */
  async start(ctx: Ctx, input: StartImport): Promise<ImportBatch> {
    const staged = await stageImport(ctx, {
      kind: input.kind,
      fileId: input.fileId,
      ...(input.branchId && { branchId: input.branchId }),
      ...(input.options && { options: input.options }),
    });
    return importsService.get(ctx, staged.batchId);
  },

  /** Every import of the school, newest first, for those who may see them all. */
  async list(ctx: Ctx, query: ListImports): Promise<Page<ImportBatch>> {
    assertPermission(ctx, 'imports:read');
    const where = and(
      isNull(importBatches.deletedAt),
      query.kind ? eq(importBatches.kind, query.kind) : undefined,
      query.status ? eq(importBatches.status, query.status) : undefined,
    );
    const rows = await ctx.db
      .select()
      .from(importBatches)
      .where(where)
      .orderBy(desc(importBatches.createdAt), desc(importBatches.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const [counted] = await ctx.db.select({ total: count() }).from(importBatches).where(where);
    return {
      items: rows.map((row) => ImportBatch.parse(row)),
      page: query.page,
      pageSize: query.pageSize,
      total: counted?.total ?? 0,
    };
  },

  async get(ctx: Ctx, id: string): Promise<ImportBatch> {
    return ImportBatch.parse(await ownBatch(ctx, id));
  },

  /** The rows of an import with what is wrong with each, in the order of the file. */
  async rows(ctx: Ctx, id: string, query: ListImportRows): Promise<Page<ImportRow>> {
    await ownBatch(ctx, id);
    const where = and(
      eq(importRows.batchId, id),
      isNull(importRows.deletedAt),
      query.status ? eq(importRows.status, query.status) : undefined,
    );
    const rows = await ctx.db
      .select()
      .from(importRows)
      .where(where)
      .orderBy(asc(importRows.rowNumber))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const [counted] = await ctx.db.select({ total: count() }).from(importRows).where(where);
    return {
      items: rows.map((row) => ImportRow.parse(row)),
      page: query.page,
      pageSize: query.pageSize,
      total: counted?.total ?? 0,
    };
  },

  /**
   * Step 2: writes the valid rows. R-shared-9: an import is committed once; asked again (a double
   * click), it writes nothing more and answers with what the first commit did.
   */
  async commit(ctx: Ctx, id: string): Promise<CommittedImport> {
    const batch = await ownBatch(ctx, id);
    if (batch.status === 'completed') {
      const [failed] = await ctx.db
        .select({ total: count() })
        .from(importRows)
        .where(
          and(eq(importRows.batchId, id), eq(importRows.status, 'failed'), isNull(importRows.deletedAt)),
        );
      return {
        batchId: id,
        createdRows: batch.createdRows,
        failedRows: failed?.total ?? 0,
        errorFileId: batch.errorFileId,
      };
    }

    const result = await commitImport(ctx, id);
    // The rows that were wrong or failed, as a file to correct and upload again.
    let errorFileId: string | null = null;
    const [problems] = await ctx.db
      .select({ total: count() })
      .from(importRows)
      .where(
        and(
          eq(importRows.batchId, id),
          inArray(importRows.status, ['invalid', 'failed']),
          isNull(importRows.deletedAt),
        ),
      );
    if ((problems?.total ?? 0) > 0) {
      const csv = await importProblemsCsv(ctx, id);
      errorFileId = await storeGeneratedFile(ctx, {
        purpose: 'export',
        fileName: `${batch.kind}-rows-to-correct.csv`,
        mimeType: 'text/csv',
        content: new TextEncoder().encode(`﻿${csv}`),
      });
      await ctx.db
        .update(importBatches)
        .set({
          errorFileId,
          updatedAt: ctx.now,
          updatedBy: stampOf(ctx),
          version: sql`${importBatches.version} + 1`,
        })
        .where(eq(importBatches.id, id));
    }
    await emit(
      ctx,
      importCompleted,
      {
        batchId: id,
        kind: batch.kind,
        userId: batch.startedBy,
        created: result.createdRows,
        failed: result.failedRows,
      },
      { entityType: 'imports', entityId: id },
    );
    return { ...result, errorFileId };
  },

  /** Abandons an import that was checked but not committed. */
  async cancel(ctx: Ctx, id: string): Promise<ImportBatch> {
    await ownBatch(ctx, id);
    await cancelImport(ctx, id);
    return importsService.get(ctx, id);
  },
};

export const exportsService = {
  /** One's own exports, newest first. */
  async list(ctx: Ctx, query: ListExports): Promise<Page<ExportJob>> {
    const where = and(
      eq(exportJobs.userId, ctx.actor.userId),
      isNull(exportJobs.deletedAt),
      query.status ? eq(exportJobs.status, query.status) : undefined,
    );
    const rows = await ctx.db
      .select()
      .from(exportJobs)
      .where(where)
      .orderBy(desc(exportJobs.createdAt), desc(exportJobs.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const [counted] = await ctx.db.select({ total: count() }).from(exportJobs).where(where);
    return {
      items: rows.map((row) => ExportJob.parse(row)),
      page: query.page,
      pageSize: query.pageSize,
      total: counted?.total ?? 0,
    };
  },

  /** One of one's own exports, with a link to the file once it is ready. */
  async get(ctx: Ctx, id: string): Promise<ExportJob> {
    // The kernel answers only for the person who asked for the export.
    await exportStatus(ctx, id);
    const [row] = await ctx.db.select().from(exportJobs).where(eq(exportJobs.id, id)).limit(1);
    if (!row) throw notFound('Export');
    const download =
      row.status === 'ready' && row.fileId
        ? await signedDownload(ctx, row.fileId, { download: true })
        : undefined;
    return ExportJob.parse({ ...row, ...(download && { download }) });
  },
};

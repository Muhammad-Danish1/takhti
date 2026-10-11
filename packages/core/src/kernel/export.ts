import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { Id, type exportFormats, type ModuleKey } from '@takhti/contracts';
import { exportJobs, files } from '@takhti/db';
import { storage } from '../providers/storage';
import { audit } from './audit';
import { stampOf, type Ctx } from './context';
import { csvLine } from './csv';
import { notFound, rule } from './errors';
import { newId } from './ids';
import { defineJob, enqueue } from './jobs';
import { assertModule } from './modules';
import { assertCan } from './permissions';

/*
 * Exports. A module describes a list it can export with `defineExporter`.
 *
 *   up to 5,000 rows   the file is built during the request and returned at once
 *   more than that     an `export_jobs` row is created, a job builds the file, the user is told
 *
 * Every export is recorded in the audit log with its row count and whether it held sensitive columns.
 * Only CSV is written for now.
 */

export interface ExportColumn<TRow> {
  header: string;
  value: (row: TRow) => unknown;
}

export interface ExporterDefinition<TFilters = unknown, TRow = unknown> {
  /** For example `students`. */
  kind: string;
  label: string;
  module?: ModuleKey;
  permission: { resource: string; action: string };
  filters: z.ZodType<TFilters>;
  columns: readonly ExportColumn<TRow>[];
  /** Flags the audit entry: the file holds identity numbers, salaries, health data or the like. */
  sensitive?: boolean;
  count(ctx: Ctx, filters: TFilters): Promise<number>;
  /** One page of rows, in a stable order. */
  rows(ctx: Ctx, filters: TFilters, page: { offset: number; limit: number }): Promise<TRow[]>;
}

const exporters = new Map<string, ExporterDefinition>();

export function defineExporter<TFilters, TRow>(
  definition: ExporterDefinition<TFilters, TRow>,
): ExporterDefinition<TFilters, TRow> {
  exporters.set(definition.kind, definition as unknown as ExporterDefinition);
  return definition;
}

export const findExporter = (kind: string): ExporterDefinition | undefined => exporters.get(kind);

type ExportFormat = (typeof exportFormats)[number];

export const DIRECT_EXPORT_ROWS = 5_000;
export const MAX_EXPORT_ROWS = 500_000;
const PAGE = 1_000;

async function exporterFor(ctx: Ctx, kind: string): Promise<ExporterDefinition> {
  const definition = findExporter(kind);
  if (!definition) throw notFound('Export type');
  if (definition.module) await assertModule(ctx, definition.module);
  assertCan(ctx, definition.permission.resource, definition.permission.action);
  return definition;
}

async function buildCsv(
  ctx: Ctx,
  definition: ExporterDefinition,
  filters: unknown,
  total: number,
): Promise<{ content: Uint8Array; rows: number }> {
  const lines: string[] = [csvLine(definition.columns.map((column) => column.header))];
  let written = 0;
  for (let offset = 0; offset < total; offset += PAGE) {
    const rows = await definition.rows(ctx, filters, { offset, limit: PAGE });
    if (rows.length === 0) break;
    for (const row of rows)
      lines.push(csvLine(definition.columns.map((column) => column.value(row))));
    written += rows.length;
  }
  // The byte-order mark makes spreadsheets read Urdu text correctly.
  return { content: new TextEncoder().encode(`﻿${lines.join('\r\n')}\r\n`), rows: written };
}

const fileNameFor = (definition: ExporterDefinition, today: string) =>
  `${definition.kind}-${today}.csv`;

export type ExportStart =
  | { ready: true; fileName: string; mimeType: 'text/csv'; content: Uint8Array; rowCount: number }
  | { ready: false; exportId: string; rowCount: number };

/** Starts an export: the file itself when it is small, or the id of the job that is building it. */
export async function startExport(
  ctx: Ctx,
  input: { kind: string; filters: unknown; format: ExportFormat },
): Promise<ExportStart> {
  const definition = await exporterFor(ctx, input.kind);
  if (input.format !== 'csv') throw rule('Only CSV exports are available for now');
  const filters = definition.filters.parse(input.filters);
  const total = await definition.count(ctx, filters);
  if (total > MAX_EXPORT_ROWS)
    throw rule(
      `This would export ${total.toLocaleString('en')} rows. Narrow the filters to under ${MAX_EXPORT_ROWS.toLocaleString('en')}.`,
    );

  if (total <= DIRECT_EXPORT_ROWS) {
    const built = await buildCsv(ctx, definition, filters, total);
    await audit(ctx, definition.kind, 'export', ctx.actor.orgId, {
      summary: `Exported ${built.rows} ${definition.label} row(s)${definition.sensitive ? ', including sensitive columns' : ''}`,
    });
    return {
      ready: true,
      fileName: fileNameFor(definition, ctx.today),
      mimeType: 'text/csv',
      content: built.content,
      rowCount: built.rows,
    };
  }

  const exportId = newId();
  await ctx.db.insert(exportJobs).values({
    id: exportId,
    orgId: ctx.actor.orgId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    createdBy: stampOf(ctx),
    updatedBy: stampOf(ctx),
    userId: ctx.actor.userId,
    kind: definition.kind,
    filters: filters as never,
    format: 'csv',
    status: 'queued',
    includesSensitive: definition.sensitive ?? false,
  });
  await enqueue(ctx, exportBuildJob, { exportId }, { dedupeKey: `export:${exportId}` });
  await audit(ctx, definition.kind, 'export', ctx.actor.orgId, {
    summary: `Started an export of about ${total} ${definition.label} row(s)${definition.sensitive ? ', including sensitive columns' : ''}`,
  });
  return { ready: false, exportId, rowCount: total };
}

/** Builds a large export in the background and stores the file. */
export const exportBuildJob = defineJob({
  name: 'shared.export-build',
  payload: z.object({ exportId: Id }),
  retries: 2,
  timeoutSeconds: 600,
  handler: async (ctx, { exportId }) => {
    const [job] = await ctx.db
      .select()
      .from(exportJobs)
      .where(and(eq(exportJobs.id, exportId), isNull(exportJobs.deletedAt)))
      .limit(1);
    if (!job || job.status === 'ready') return;
    const definition = findExporter(job.kind);
    const stamp = { updatedAt: ctx.now, version: sql`${exportJobs.version} + 1` };
    if (!definition) {
      await ctx.db
        .update(exportJobs)
        .set({ status: 'failed', ...stamp })
        .where(eq(exportJobs.id, exportId));
      return;
    }

    const filters = definition.filters.parse(job.filters);
    const total = await definition.count(ctx, filters);
    const built = await buildCsv(ctx, definition, filters, total);

    const fileId = newId();
    const path = `${ctx.actor.orgId}/export/${ctx.today.slice(0, 4)}/${fileId}.csv`;
    await storage().put('exports', path, built.content, 'text/csv');
    await ctx.db.insert(files).values({
      id: fileId,
      orgId: ctx.actor.orgId,
      bucket: 'exports',
      path,
      purpose: 'export',
      originalName: fileNameFor(definition, ctx.today),
      mimeType: 'text/csv',
      sizeBytes: built.content.byteLength,
      status: 'ready',
      // The file belongs to the person who asked for it.
      uploadedBy: job.userId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
    });
    await ctx.db
      .update(exportJobs)
      .set({ status: 'ready', fileId, rowCount: built.rows, ...stamp })
      .where(eq(exportJobs.id, exportId));
  },
});

/** The state of a background export, for the person who started it. */
export async function exportStatus(
  ctx: Ctx,
  exportId: string,
): Promise<{ id: string; status: string; rowCount: number | null; fileId: string | null }> {
  const [job] = await ctx.db
    .select()
    .from(exportJobs)
    .where(
      and(
        eq(exportJobs.id, exportId),
        eq(exportJobs.userId, ctx.actor.userId),
        isNull(exportJobs.deletedAt),
      ),
    )
    .limit(1);
  if (!job) throw notFound('Export');
  return { id: job.id, status: job.status, rowCount: job.rowCount, fileId: job.fileId };
}

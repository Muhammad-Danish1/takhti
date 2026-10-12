import { z } from 'zod';
import type {
  ReportCatalogue,
  ReportOutput,
  ReportResult,
  ReportSummary,
  RunReport,
} from '@takhti/contracts';
import { reportRuns } from '@takhti/db';
import { stampOf, type Ctx } from '../../kernel/context';
import { notFound, rule } from '../../kernel/errors';
import { isUuid, newId } from '../../kernel/ids';
import { assertModule, isModuleEnabled } from '../../kernel/modules';
import { assertPermission, holds } from '../../kernel/permissions';
import { findReport, registeredReports, type ReportDefinition, type ReportRow } from './registry';

/*
 * Running the reports the modules registered: docs/plan/10-modules/m42-dashboards-reports.md,
 * rules R-reports-1, 3, 4 and 14.
 */

/**
 * The most rows a screen is given. It becomes the setting `reports.max_rows_screen` when the
 * module's settings are declared (step 2.13); the figure is the specification's default.
 */
export const MAX_ROWS_ON_SCREEN = 5_000;

function summaryOf(definition: ReportDefinition): ReportSummary {
  return {
    key: definition.key,
    module: definition.module,
    title: definition.title,
    permission: definition.permission,
    columns: [...definition.columns],
    paramsSchema: z.toJSONSchema(definition.params, { io: 'input', unrepresentable: 'any' }) as Record<
      string,
      unknown
    >,
    ...(definition.pdf && { pdf: definition.pdf }),
  };
}

/** R-reports-4: a total is the sum of a column over every matching row, not over the page shown. */
function totalsOf(definition: ReportDefinition, rows: readonly ReportRow[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const column of definition.columns) {
    if (column.total !== 'sum') continue;
    let sum = 0;
    for (const row of rows) {
      const value = row[column.key];
      if (typeof value === 'number' && Number.isFinite(value)) sum += value;
    }
    totals[column.key] = sum;
  }
  return totals;
}

/** The branches a run covered, when its parameters name them, for the record of who ran what. */
function branchesIn(params: unknown): string[] {
  if (typeof params !== 'object' || params === null) return [];
  const { branchIds, branchId } = params as { branchIds?: unknown; branchId?: unknown };
  return [...(Array.isArray(branchIds) ? branchIds : []), branchId].filter(isUuid);
}

export const reportsService = {
  /** The reports a person may run: those whose own permission they hold, in modules that are on. */
  async catalogue(ctx: Ctx): Promise<ReportCatalogue> {
    assertPermission(ctx, 'reports:read');
    const groups = new Map<string, ReportSummary[]>();
    for (const definition of registeredReports()) {
      if (!holds(ctx, definition.permission)) continue;
      if (!(await isModuleEnabled(ctx, definition.module))) continue;
      const list = groups.get(definition.module) ?? [];
      list.push(summaryOf(definition));
      groups.set(definition.module, list);
    }
    return [...groups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([module, reports]) => ({
        module,
        reports: reports.sort((a, b) => a.key.localeCompare(b.key)),
      }));
  },

  /** One report's definition. A report the person may not run is, to them, not there. */
  async describe(ctx: Ctx, key: string): Promise<ReportSummary> {
    assertPermission(ctx, 'reports:read');
    const definition = findReport(key);
    if (!definition || !holds(ctx, definition.permission)) throw notFound('Report');
    await assertModule(ctx, definition.module);
    return summaryOf(definition);
  },

  /**
   * Runs a report and returns one page of it with the totals of all of it.
   * R-reports-1: its own permission first, then every query through the caller's `ctx`.
   * R-reports-3: the run is recorded.
   */
  async run(
    ctx: Ctx,
    key: string,
    input: RunReport,
    output: ReportOutput = 'screen',
  ): Promise<ReportResult> {
    assertPermission(ctx, 'reports:read');
    const definition = findReport(key);
    if (!definition) throw notFound('Report');
    await assertModule(ctx, definition.module);
    assertPermission(ctx, definition.permission);

    const params = definition.params.parse(input.params) as Record<string, unknown>;
    const started = performance.now();
    const outcome = await definition.run(ctx, params);
    const { rows } = outcome;

    // R-reports-14: never silently cut short.
    if (output === 'screen' && rows.length > MAX_ROWS_ON_SCREEN)
      throw rule(
        `This report has ${rows.length.toLocaleString('en')} rows, more than the ${MAX_ROWS_ON_SCREEN.toLocaleString('en')} a screen shows. Narrow the filters, or export it.`,
      );

    // No `returning`: the log of runs is written by everyone who runs a report and read by few.
    await ctx.db.insert(reportRuns).values({
      id: newId(),
      orgId: ctx.actor.orgId,
      createdAt: ctx.now,
      createdBy: stampOf(ctx),
      reportKey: definition.key,
      userId: stampOf(ctx),
      params: params as never,
      branchIds: branchesIn(params),
      rowCount: rows.length,
      durationMs: Math.round(performance.now() - started),
      output,
      status: 'ok',
    });

    const from = (input.page - 1) * input.pageSize;
    return {
      key: definition.key,
      columns: [...definition.columns],
      rows: rows.slice(from, from + input.pageSize),
      totals: outcome.totals ?? totalsOf(definition, rows),
      page: input.page,
      pageSize: input.pageSize,
      total: rows.length,
      generatedAt: ctx.now,
      params,
    };
  },
};

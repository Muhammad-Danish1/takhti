import type { z } from 'zod';
import type { ModuleKey, PermissionKey, ReportColumn } from '@takhti/contracts';
import type { Ctx } from '../../kernel/context';

/*
 * The registries of reporting: docs/plan/10-modules/m42-dashboards-reports.md, section 4.
 *
 * Reports, the measures of analysis, KPIs and dashboard widgets are all declared in code by the
 * module that owns them, in `<module>.reports.ts`, and gathered here. Nothing is in a registry
 * until its module's service exists, so a report can never run on data its module cannot explain.
 */

type Words = { en: string; ur: string };
type Awaitable<T> = T | Promise<T>;

// ---------------------------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------------------------

export type ReportRow = Record<string, unknown>;

export interface ReportOutcome {
  /** Every matching row. Paging is done after the report has run, so totals are of all of them. */
  rows: ReportRow[];
  /** Totals the report worked out itself. Left out, each column marked `total: 'sum'` is summed. */
  totals?: Record<string, number>;
}

export interface ReportDefinition<P extends z.ZodType = z.ZodType> {
  /** `<module>.<name>`, for example `fees.aging`. */
  key: `${string}.${string}`;
  module: ModuleKey;
  title: Words;
  /** The report's own permission. It is checked before anything runs. */
  permission: PermissionKey;
  params: P;
  columns: readonly ReportColumn[];
  /**
   * Gathers the rows through the caller's `ctx`, so branch scope and row-level security apply
   * exactly as they do on the module's screens (R-reports-1).
   */
  run: (ctx: Ctx, params: z.output<P>) => Awaitable<ReportOutcome>;
  pdf?: { orientation?: 'portrait' | 'landscape'; groupBy?: string };
}

const reports = new Map<string, ReportDefinition>();

export function defineReport<P extends z.ZodType>(definition: ReportDefinition<P>): ReportDefinition<P> {
  if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(definition.key))
    throw new Error(`Report key "${definition.key}" must look like module.name`);
  const keys = definition.columns.map((column) => column.key);
  if (new Set(keys).size !== keys.length)
    throw new Error(`Report "${definition.key}" names a column twice`);
  if (definition.pdf?.groupBy && !keys.includes(definition.pdf.groupBy))
    throw new Error(`Report "${definition.key}" groups its pages by a column it does not have`);
  reports.set(definition.key, definition as unknown as ReportDefinition);
  return definition;
}

export const findReport = (key: string): ReportDefinition | undefined => reports.get(key);
export const registeredReports = (): ReportDefinition[] => [...reports.values()];

// ---------------------------------------------------------------------------------------------
// Measures and dimensions, for analysis
// ---------------------------------------------------------------------------------------------

export interface MeasureDefinition {
  /** `<thing>.<figure>`, for example `fees.collected`. */
  key: `${string}.${string}`;
  module: ModuleKey;
  label: Words;
  unit: 'count' | 'money' | 'percent' | 'days';
  /** What it may be split by: `branch`, `grade`, `month`. A split not listed here is refused. */
  splitBy: readonly string[];
  permission: PermissionKey;
  /** The figure for each group of the chosen splits, through the caller's `ctx`. */
  run: (
    ctx: Ctx,
    request: { splitBy: readonly string[]; filters: Readonly<Record<string, unknown>> },
  ) => Awaitable<{ group: Record<string, string>; value: number }[]>;
}

const measures = new Map<string, MeasureDefinition>();

export function defineMeasure(definition: MeasureDefinition): MeasureDefinition {
  measures.set(definition.key, definition);
  return definition;
}

export const findMeasure = (key: string): MeasureDefinition | undefined => measures.get(key);
export const registeredMeasures = (): MeasureDefinition[] => [...measures.values()];

export interface AnalysisAsk {
  measures: readonly string[];
  splitBy: readonly string[];
}

/**
 * R-reports-6: an analysis request is refused, not narrowed. The answer lists everything that is
 * not allowed, in words: an unknown measure, a split a measure does not have, a measure the person
 * lacks the permission for. An empty list means it may run.
 */
export function analysisProblems(
  ask: AnalysisAsk,
  permissions: ReadonlySet<string>,
  vocabulary: (key: string) => MeasureDefinition | undefined = findMeasure,
): string[] {
  const problems: string[] = [];
  if (ask.measures.length < 1 || ask.measures.length > 3)
    problems.push('Choose one to three measures');
  if (ask.splitBy.length > 2) problems.push('A figure can be split two ways at most');
  for (const key of ask.measures) {
    const measure = vocabulary(key);
    if (!measure) {
      problems.push(`"${key}" is not a measure`);
      continue;
    }
    if (!permissions.has(measure.permission))
      problems.push(`You do not have access to ${measure.label.en}`);
    for (const split of ask.splitBy)
      if (!measure.splitBy.includes(split))
        problems.push(`${measure.label.en} cannot be split by ${split}`);
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// KPIs and widgets, for dashboards
// ---------------------------------------------------------------------------------------------

export interface KpiValue {
  /** For a figure that is one number over another (a rate), both parts, so branches combine exactly. */
  numerator: number;
  denominator?: number;
}

export interface KpiDefinition {
  /** `enrolment`, `fee-collection-month`. */
  key: string;
  module: ModuleKey;
  label: Words;
  unit: 'count' | 'money' | 'percent';
  /** Whether more is better (`up`) or less is (`down`). */
  goodDirection: 'up' | 'down';
  /** `sum` across branches, or `ratio`: summed numerators over summed denominators, never an average of percentages. */
  combine: 'sum' | 'ratio';
  permission: PermissionKey;
  /** The figure for one branch on one day, through the caller's `ctx`. */
  compute: (ctx: Ctx, input: { branchId: string; date: string }) => Awaitable<KpiValue>;
}

const kpis = new Map<string, KpiDefinition>();

export function defineKpi(definition: KpiDefinition): KpiDefinition {
  kpis.set(definition.key, definition);
  return definition;
}

export const findKpi = (key: string): KpiDefinition | undefined => kpis.get(key);
export const registeredKpis = (): KpiDefinition[] => [...kpis.values()];

/**
 * R-reports-5: a figure for several branches. A sum adds up; a rate is the summed numerators over
 * the summed denominators, as a percentage to two decimals. No branch with a denominator of nothing
 * can make the answer anything but a number.
 */
export function combineKpi(combine: KpiDefinition['combine'], values: readonly KpiValue[]): number {
  const top = values.reduce((sum, value) => sum + value.numerator, 0);
  if (combine === 'sum') return top;
  const bottom = values.reduce((sum, value) => sum + (value.denominator ?? 0), 0);
  if (bottom === 0) return 0;
  return Math.round((top * 10_000) / bottom) / 100;
}

export interface WidgetDefinition {
  /** `today-attendance`, `fee-collection`. */
  key: string;
  module: ModuleKey;
  title: Words;
  permission: PermissionKey | 'signed-in';
  /** The portals it suits: `school`, `hq`, `teach`, `family`, `learn`. */
  portals: readonly string[];
  /** Columns and rows it takes on the grid by default. */
  size: { w: number; h: number };
  /** How long its data may be shown before it is fetched again. */
  cacheSeconds: number;
  data: (ctx: Ctx, input: { branchIds: readonly string[] }) => Awaitable<unknown>;
}

const widgets = new Map<string, WidgetDefinition>();

export function defineWidget(definition: WidgetDefinition): WidgetDefinition {
  widgets.set(definition.key, definition);
  return definition;
}

export const findWidget = (key: string): WidgetDefinition | undefined => widgets.get(key);
export const registeredWidgets = (): WidgetDefinition[] => [...widgets.values()];

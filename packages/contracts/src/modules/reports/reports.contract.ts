import { z } from 'zod';
import { reportRunOutputs } from './reports.constants';

/*
 * Running a report: docs/plan/10-modules/m42-dashboards-reports.md, section 4.
 * A report is registered in code by the module that owns it; these are the shapes the library
 * screen and the API share.
 */

const Words = z.object({ en: z.string(), ur: z.string() });

export const reportColumnTypes = ['text', 'number', 'count', 'money', 'percent', 'date'] as const;
export type ReportColumnType = (typeof reportColumnTypes)[number];

export const ReportColumn = z.object({
  key: z.string(),
  label: Words,
  type: z.enum(reportColumnTypes),
  /** The column has a total, worked out from every matching row. */
  total: z.enum(['sum']).optional(),
});
export type ReportColumn = z.output<typeof ReportColumn>;

/** One report as the library lists it. `paramsSchema` is JSON Schema, so the screen can build the filter form. */
export const ReportSummary = z.object({
  key: z.string(),
  module: z.string(),
  title: Words,
  permission: z.string(),
  columns: z.array(ReportColumn),
  paramsSchema: z.record(z.string(), z.unknown()),
  pdf: z
    .object({
      orientation: z.enum(['portrait', 'landscape']).optional(),
      groupBy: z.string().optional(),
    })
    .optional(),
});
export type ReportSummary = z.output<typeof ReportSummary>;

/** The reports a person may run, grouped by module. */
export const ReportCatalogue = z.array(
  z.object({ module: z.string(), reports: z.array(ReportSummary) }),
);
export type ReportCatalogue = z.output<typeof ReportCatalogue>;

export const ReportKeyParams = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/, 'Not a report key'),
});

/** Body of `POST /reports/[key]/run`. The report checks `params` against its own schema. */
export const RunReport = z.object({
  params: z.record(z.string(), z.unknown()).default({}),
  page: z.int().min(1).default(1),
  pageSize: z.int().min(1).max(500).default(100),
});
export type RunReport = z.output<typeof RunReport>;

export const ReportResult = z.object({
  key: z.string(),
  columns: z.array(ReportColumn),
  /** One page of rows. */
  rows: z.array(z.record(z.string(), z.unknown())),
  /** Worked out from every matching row, never from the page on screen. */
  totals: z.record(z.string(), z.number()),
  page: z.int(),
  pageSize: z.int(),
  /** How many rows match in all. */
  total: z.int(),
  generatedAt: z.string(),
  /** The parameters as the report understood them, defaults filled in. */
  params: z.record(z.string(), z.unknown()),
});
export type ReportResult = z.output<typeof ReportResult>;

export const ReportOutput = z.enum(reportRunOutputs);
export type ReportOutput = z.output<typeof ReportOutput>;

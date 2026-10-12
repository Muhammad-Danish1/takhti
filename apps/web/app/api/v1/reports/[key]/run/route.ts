import { ReportKeyParams, RunReport } from '@takhti/contracts';
import { reportsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `POST /api/v1/reports/[key]/run`: runs a report and returns a page of rows with the totals of all of them. */
export const POST = defineRoute({
  permission: 'reports:read',
  params: ReportKeyParams,
  body: RunReport,
  handler: (ctx, { params, body }) => reportsService.run(ctx, params.key, body),
});

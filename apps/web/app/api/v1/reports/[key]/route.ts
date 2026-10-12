import { ReportKeyParams } from '@takhti/contracts';
import { reportsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/reports/[key]`: one report's definition and the schema of its parameters. */
export const GET = defineRoute({
  permission: 'reports:read',
  params: ReportKeyParams,
  handler: (ctx, { params }) => reportsService.describe(ctx, params.key),
});

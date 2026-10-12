import { reportsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/reports`: the catalogue of reports the caller may run, grouped by module. */
export const GET = defineRoute({
  permission: 'reports:read',
  handler: (ctx) => reportsService.catalogue(ctx),
});

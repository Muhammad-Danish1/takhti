import { IdParams } from '@takhti/contracts';
import { jobsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/jobs/[id]`: one job, with what it was asked to do and why it last failed. */
export const GET = defineRoute({
  permission: 'jobs:read',
  params: IdParams,
  handler: (ctx, { params }) => jobsService.get(ctx, params.id),
});

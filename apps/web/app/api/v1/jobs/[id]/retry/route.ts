import { IdParams } from '@takhti/contracts';
import { jobsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `POST /api/v1/jobs/[id]/retry`: puts a failed job back in the queue for one more try. */
export const POST = defineRoute({
  permission: 'jobs:retry',
  params: IdParams,
  handler: (ctx, { params }) => jobsService.retry(ctx, params.id),
});

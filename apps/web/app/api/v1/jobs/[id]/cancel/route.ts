import { IdParams } from '@takhti/contracts';
import { jobsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `POST /api/v1/jobs/[id]/cancel`: takes a job that has not started out of the queue. */
export const POST = defineRoute({
  permission: 'jobs:retry',
  params: IdParams,
  handler: (ctx, { params }) => jobsService.cancel(ctx, params.id),
});

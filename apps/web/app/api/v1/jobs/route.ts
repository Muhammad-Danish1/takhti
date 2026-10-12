import { ListJobs } from '@takhti/contracts';
import { jobsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/jobs`: the school's background jobs, newest first, with a status filter. */
export const GET = defineRoute({
  permission: 'jobs:read',
  query: ListJobs,
  handler: (ctx, { query }) => jobsService.list(ctx, query),
});

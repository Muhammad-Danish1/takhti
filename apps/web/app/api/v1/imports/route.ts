import { ListImports, StartImport } from '@takhti/contracts';
import { importsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/imports`: every import of the school, for those who may see them all. */
export const GET = defineRoute({
  permission: 'imports:read',
  query: ListImports,
  handler: (ctx, { query }) => importsService.list(ctx, query),
});

/** `POST /api/v1/imports`: checks an uploaded file row by row. Nothing is written to the records yet. */
export const POST = defineRoute({
  permission: 'signed-in',
  body: StartImport,
  status: 201,
  // A file of thousands of rows is checked in this one request.
  rateLimit: { max: 10, windowSeconds: 60, by: 'user' },
  handler: (ctx, { body }) => importsService.start(ctx, body),
});

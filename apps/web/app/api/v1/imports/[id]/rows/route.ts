import { IdParams, ListImportRows } from '@takhti/contracts';
import { importsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/imports/[id]/rows`: the rows of an import with what is wrong with each. */
export const GET = defineRoute({
  permission: 'signed-in',
  params: IdParams,
  query: ListImportRows,
  handler: (ctx, { params, query }) => importsService.rows(ctx, params.id, query),
});

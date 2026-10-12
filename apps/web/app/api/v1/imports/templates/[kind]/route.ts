import { ImportKindParams } from '@takhti/contracts';
import { importsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/imports/templates/[kind]`: the spreadsheet to fill in for one kind of import, as a CSV file. */
export const GET = defineRoute({
  permission: 'signed-in',
  params: ImportKindParams,
  handler: (ctx, { params }) => importsService.template(ctx, params.kind),
});

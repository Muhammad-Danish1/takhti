import { IdParams, VersionBody } from '@takhti/contracts';
import { branchesService } from '@takhti/core';
import { defineRoute } from '@/server/route';

export const POST = defineRoute({
  params: IdParams,
  body: VersionBody,
  handler: (ctx, { params, body }) => branchesService.activate(ctx, params.id, body.version),
});

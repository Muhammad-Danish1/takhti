import { IdParams, ResolveFinding } from '@takhti/contracts';
import { integrityFindingsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `POST /api/v1/integrity-findings/[id]/resolve`: closes the finding with a note of what was done. */
export const POST = defineRoute({
  permission: 'integrity:update',
  params: IdParams,
  body: ResolveFinding,
  handler: (ctx, { params, body }) => integrityFindingsService.resolve(ctx, params.id, body),
});

import { IdParams } from '@takhti/contracts';
import { integrityFindingsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `POST /api/v1/integrity-findings/[id]/acknowledge`: somebody has seen the finding and is looking into it. */
export const POST = defineRoute({
  permission: 'integrity:update',
  params: IdParams,
  handler: (ctx, { params }) => integrityFindingsService.acknowledge(ctx, params.id),
});

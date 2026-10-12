import { IdParams } from '@takhti/contracts';
import { importsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `POST /api/v1/imports/[id]/cancel`: abandons an import that was checked but not committed. */
export const POST = defineRoute({
  permission: 'signed-in',
  params: IdParams,
  handler: (ctx, { params }) => importsService.cancel(ctx, params.id),
});

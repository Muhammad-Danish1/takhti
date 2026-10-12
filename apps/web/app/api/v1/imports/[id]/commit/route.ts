import { IdParams } from '@takhti/contracts';
import { importsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `POST /api/v1/imports/[id]/commit`: writes the valid rows. Asked twice, it writes them once. */
export const POST = defineRoute({
  permission: 'signed-in',
  params: IdParams,
  rateLimit: { max: 10, windowSeconds: 60, by: 'user' },
  handler: (ctx, { params }) => importsService.commit(ctx, params.id),
});

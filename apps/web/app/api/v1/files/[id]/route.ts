import { IdParams } from '@takhti/contracts';
import { filesService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `DELETE /api/v1/files/[id]`: withdraws one's own upload, while nothing uses it. */
export const DELETE = defineRoute({
  permission: 'signed-in',
  params: IdParams,
  handler: (ctx, { params }) => filesService.remove(ctx, params.id),
});

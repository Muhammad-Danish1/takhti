import { IdParams } from '@takhti/contracts';
import { filesService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/files/[id]/url`: a download link that works for five minutes, after an access check. */
export const GET = defineRoute({
  permission: 'signed-in',
  params: IdParams,
  handler: (ctx, { params }) => filesService.downloadUrl(ctx, params.id),
});

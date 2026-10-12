import { IdParams } from '@takhti/contracts';
import { filesService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `POST /api/v1/files/[id]/confirm`: checks what reached storage against what was announced and marks the file ready. */
export const POST = defineRoute({
  permission: 'signed-in',
  params: IdParams,
  handler: (ctx, { params }) => filesService.confirm(ctx, params.id),
});

import { IdParams } from '@takhti/contracts';
import { attachmentsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `DELETE /api/v1/attachments/[id]`: removes a file from a record. The file itself is kept until nothing uses it. */
export const DELETE = defineRoute({
  permission: 'signed-in',
  params: IdParams,
  handler: (ctx, { params }) => attachmentsService.detach(ctx, params.id),
});

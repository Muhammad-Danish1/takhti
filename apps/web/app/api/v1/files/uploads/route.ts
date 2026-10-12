import { CreateUpload } from '@takhti/contracts';
import { filesService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `POST /api/v1/files/uploads`: records a file that is about to be uploaded and returns the link to send it to. */
export const POST = defineRoute({
  permission: 'signed-in',
  body: CreateUpload,
  status: 201,
  handler: (ctx, { body }) => filesService.createUpload(ctx, body),
});

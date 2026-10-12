import { CreateAttachment, ListAttachments } from '@takhti/contracts';
import { attachmentsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/attachments?entityType=&entityId=`: the files attached to a record the caller can read. */
export const GET = defineRoute({
  permission: 'signed-in',
  query: ListAttachments,
  handler: (ctx, { query }) => attachmentsService.list(ctx, query),
});

/** `POST /api/v1/attachments`: attaches a ready file to a record the caller can change. */
export const POST = defineRoute({
  permission: 'signed-in',
  body: CreateAttachment,
  status: 201,
  handler: (ctx, { body }) => attachmentsService.attach(ctx, body),
});

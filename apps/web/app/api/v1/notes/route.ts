import { CreateNote, ListNotes } from '@takhti/contracts';
import { notesService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/notes?entityType=&entityId=`: the staff notes on a record the caller can open. */
export const GET = defineRoute({
  permission: 'notes:read',
  query: ListNotes,
  handler: (ctx, { query }) => notesService.list(ctx, query),
});

/** `POST /api/v1/notes`: adds a note to a record. */
export const POST = defineRoute({
  permission: 'notes:create',
  body: CreateNote,
  status: 201,
  handler: (ctx, { body }) => notesService.create(ctx, body),
});

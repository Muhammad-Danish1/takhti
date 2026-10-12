import { IdParams, UpdateNote } from '@takhti/contracts';
import { notesService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `PATCH /api/v1/notes/[id]`: changes one's own note. */
export const PATCH = defineRoute({
  permission: 'notes:create',
  params: IdParams,
  body: UpdateNote,
  handler: (ctx, { params, body }) => notesService.update(ctx, params.id, body),
});

/** `DELETE /api/v1/notes/[id]`: deletes one's own note. */
export const DELETE = defineRoute({
  permission: 'notes:create',
  params: IdParams,
  handler: (ctx, { params }) => notesService.remove(ctx, params.id),
});

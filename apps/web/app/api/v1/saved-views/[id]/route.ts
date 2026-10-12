import { IdParams, UpdateSavedView } from '@takhti/contracts';
import { savedViewsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `PATCH /api/v1/saved-views/[id]`: renames one's own view, changes its filters or makes it the default. */
export const PATCH = defineRoute({
  permission: 'signed-in',
  params: IdParams,
  body: UpdateSavedView,
  handler: (ctx, { params, body }) => savedViewsService.update(ctx, params.id, body),
});

/** `DELETE /api/v1/saved-views/[id]`: deletes one's own view. */
export const DELETE = defineRoute({
  permission: 'signed-in',
  params: IdParams,
  handler: (ctx, { params }) => savedViewsService.remove(ctx, params.id),
});

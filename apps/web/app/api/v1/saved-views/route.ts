import { CreateSavedView, ListSavedViews } from '@takhti/contracts';
import { savedViewsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/saved-views?listKey=`: one's own saved views of a list. */
export const GET = defineRoute({
  permission: 'signed-in',
  query: ListSavedViews,
  handler: (ctx, { query }) => savedViewsService.list(ctx, query),
});

/** `POST /api/v1/saved-views`: saves the filters of a list under a name. */
export const POST = defineRoute({
  permission: 'signed-in',
  body: CreateSavedView,
  status: 201,
  handler: (ctx, { body }) => savedViewsService.create(ctx, body),
});

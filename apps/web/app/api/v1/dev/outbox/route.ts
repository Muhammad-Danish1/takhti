import { DevOutboxQuery } from '@takhti/contracts';
import { devOutbox } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/dev/outbox`: development only. Every message the local stand-ins "sent". */
export const GET = defineRoute({
  permission: 'signed-in',
  query: DevOutboxQuery,
  handler: (ctx, { query }) => devOutbox.list(ctx, query),
});

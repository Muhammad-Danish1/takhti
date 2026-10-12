import { CalendarQuery } from '@takhti/contracts';
import { calendarService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/calendar?from=&to=`: the caller's calendar for a range of days. */
export const GET = defineRoute({
  permission: 'signed-in',
  query: CalendarQuery,
  handler: (ctx, { query }) => calendarService.range(ctx, query.from, query.to),
});

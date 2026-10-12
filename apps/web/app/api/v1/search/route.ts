import { GlobalSearch } from '@takhti/contracts';
import { searchService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/**
 * `GET /api/v1/search?q=&kinds=`: students, guardians, staff and fee vouchers matching what was
 * typed. At most eight of each kind, and only records the person could open.
 */
export const GET = defineRoute({
  permission: 'signed-in',
  query: GlobalSearch,
  // The box asks again as the person types.
  rateLimit: { max: 120, windowSeconds: 60, by: 'user' },
  handler: (ctx, { query }) => searchService.search(ctx, query),
});

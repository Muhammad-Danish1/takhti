import { ListFindings } from '@takhti/contracts';
import { integrityFindingsService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/integrity-findings`: what the nightly data checks found, the open and most serious first. */
export const GET = defineRoute({
  permission: 'integrity:read',
  query: ListFindings,
  handler: (ctx, { query }) => integrityFindingsService.list(ctx, query),
});

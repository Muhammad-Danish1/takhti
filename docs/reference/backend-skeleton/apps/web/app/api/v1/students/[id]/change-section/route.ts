import { ChangeSection, IdParams } from '@school/contracts';
import { studentsService } from '@school/core';
import { defineRoute } from '@/server/route';

export const POST = defineRoute({
  params: IdParams,
  body: ChangeSection,
  handler: (ctx, { params, body }) => studentsService.changeSection(ctx, params.id, body),
});

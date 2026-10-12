import { customFieldsContract, IdParams } from '@takhti/contracts';
import { customFieldsService } from '@takhti/core';
import { defineRoute, itemRoutes } from '@/server/route';

export const { PATCH } = itemRoutes(customFieldsContract, customFieldsService);

/** `DELETE /api/v1/custom-fields/[id]`: switches the field off. Values already stored keep their meaning. */
export const DELETE = defineRoute({
  permission: 'custom-fields:update',
  params: IdParams,
  handler: (ctx, { params }) => customFieldsService.deactivate(ctx, params.id),
});

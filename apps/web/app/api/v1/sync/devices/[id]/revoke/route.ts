import { IdParams } from '@takhti/contracts';
import { syncDevicesService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `POST /api/v1/sync/devices/[id]/revoke`: the device is refused from now on and deletes what it holds at its next contact. */
export const POST = defineRoute({
  permission: 'sync-devices:update',
  params: IdParams,
  handler: (ctx, { params }) => syncDevicesService.revoke(ctx, params.id),
});

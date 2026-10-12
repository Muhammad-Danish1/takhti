import { ListSyncDevices, RegisterDevice } from '@takhti/contracts';
import { syncDevicesService } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/sync/devices`: every device with offline mode on, those holding unsynced work first. */
export const GET = defineRoute({
  permission: 'sync-devices:read',
  query: ListSyncDevices,
  handler: (ctx, { query }) => syncDevicesService.list(ctx, query),
});

/**
 * `POST /api/v1/sync/devices`: registers this device for offline use and gives it its code.
 * Sent again with the same id, it checks the device in and says whether it was revoked.
 */
export const POST = defineRoute({
  permission: 'signed-in',
  body: RegisterDevice,
  handler: (ctx, { body }) => syncDevicesService.register(ctx, body),
});

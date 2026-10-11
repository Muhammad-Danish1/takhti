import { eq } from 'drizzle-orm';
import type { ListRoomsParams } from '@takhti/contracts';
import { rooms } from '@takhti/db';
import { createDbService } from '../../kernel/db-service';
import { branchFilter } from '../../kernel/scope';

/** Layer 3 for rooms. */
export const roomsDb = createDbService<typeof rooms, ListRoomsParams>(rooms, {
  label: 'Room',
  search: [rooms.name, rooms.floor],
  sort: {
    name: rooms.name,
    kind: rooms.kind,
    capacity: rooms.capacity,
    createdAt: rooms.createdAt,
  },
  filters: (params, ctx) => [
    branchFilter(ctx, rooms.branchId),
    params.branchId && eq(rooms.branchId, params.branchId),
    params.kind && eq(rooms.kind, params.kind),
    params.isBookable !== undefined && eq(rooms.isBookable, params.isBookable),
  ],
});

import { z } from 'zod';
import { Name, QueryBool, ShortText } from '../../kernel/primitives';
import { baseEntity, defineResource, listQuery } from '../../kernel/resource';

export const roomKinds = [
  'classroom',
  'lab',
  'library',
  'hall',
  'office',
  'clinic',
  'store',
  'other',
] as const;
export const RoomKind = z.enum(roomKinds);
export type RoomKind = (typeof roomKinds)[number];

const fields = {
  name: Name,
  kind: RoomKind,
  capacity: z.int().min(1, { error: 'Capacity must be at least 1' }).max(5000).nullable(),
  floor: ShortText.nullable(),
  isBookable: z.boolean(),
};

export const Room = z.object({ ...baseEntity, branchId: z.uuid(), ...fields });
export type Room = z.output<typeof Room>;

export const CreateRoom = z.object({
  id: z.uuid().optional(),
  branchId: z.uuid(),
  name: fields.name,
  kind: fields.kind.optional(),
  capacity: fields.capacity.optional(),
  floor: fields.floor.optional(),
  isBookable: fields.isBookable.optional(),
});
export type CreateRoom = z.output<typeof CreateRoom>;

export const UpdateRoom = z.object(fields).partial().extend({ version: z.int() });
export type UpdateRoom = z.output<typeof UpdateRoom>;

export const ListRooms = listQuery({
  sortable: ['name', 'kind', 'capacity', 'createdAt'],
  defaultSort: 'name',
  filters: {
    branchId: z.uuid().optional(),
    kind: RoomKind.optional(),
    isBookable: QueryBool.optional(),
  },
});
export type ListRoomsParams = z.output<typeof ListRooms>;

export const roomsContract = defineResource({
  name: 'rooms',
  path: '/rooms',
  entity: Room,
  create: CreateRoom,
  update: UpdateRoom,
  list: ListRooms,
});

import { roomsApi } from '@takhti/api-client';
import { roomsContract } from '@takhti/contracts';
import { createCrudHooks } from '../../kernel/crud-hooks';

const crud = createCrudHooks(roomsContract, roomsApi);

export const roomKeys = crud.keys;
export const roomQueries = crud.queries;
// No hook reads one room: the plan has no such route, and a room is edited from the list.
export const useRooms = crud.useList;
export const useCreateRoom = crud.useCreate;
export const useUpdateRoom = crud.useUpdate;
export const useDeleteRoom = crud.useRemove;

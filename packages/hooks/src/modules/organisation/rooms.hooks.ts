import { roomsApi } from '@takhti/api-client';
import { roomsContract } from '@takhti/contracts';
import { createCrudHooks } from '../../kernel/crud-hooks';

const crud = createCrudHooks(roomsContract, roomsApi);

export const roomKeys = crud.keys;
export const roomQueries = crud.queries;
export const useRooms = crud.useList;
export const useRoom = crud.useDetail;
export const useCreateRoom = crud.useCreate;
export const useUpdateRoom = crud.useUpdate;
export const useDeleteRoom = crud.useRemove;

import { roomsContract } from '@takhti/contracts';
import { roomsService } from '@takhti/core';
import { itemRoutes } from '@/server/route';

// The plan has no route that reads one room: a room is edited from the list.
export const { PATCH, DELETE } = itemRoutes(roomsContract, roomsService);

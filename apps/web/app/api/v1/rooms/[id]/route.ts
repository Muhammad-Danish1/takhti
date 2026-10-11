import { roomsContract } from '@takhti/contracts';
import { roomsService } from '@takhti/core';
import { itemRoutes } from '@/server/route';

export const { GET, PATCH, DELETE } = itemRoutes(roomsContract, roomsService);

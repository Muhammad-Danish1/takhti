import { roomsContract } from '@takhti/contracts';
import { roomsService } from '@takhti/core';
import { collectionRoutes } from '@/server/route';

export const { GET, POST } = collectionRoutes(roomsContract, roomsService);

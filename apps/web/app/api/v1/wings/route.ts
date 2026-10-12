import { wingsContract } from '@takhti/contracts';
import { wingsService } from '@takhti/core';
import { collectionRoutes } from '@/server/route';

export const { GET, POST } = collectionRoutes(wingsContract, wingsService);

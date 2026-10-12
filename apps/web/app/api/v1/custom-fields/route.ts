import { customFieldsContract } from '@takhti/contracts';
import { customFieldsService } from '@takhti/core';
import { collectionRoutes } from '@/server/route';

export const { GET, POST } = collectionRoutes(customFieldsContract, customFieldsService);

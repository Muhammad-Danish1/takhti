import { branchesContract } from '@takhti/contracts';
import { branchesService } from '@takhti/core';
import { collectionRoutes } from '@/server/route';

export const { GET, POST } = collectionRoutes(branchesContract, branchesService);

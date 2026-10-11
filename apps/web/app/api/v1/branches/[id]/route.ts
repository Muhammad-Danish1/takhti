import { branchesContract } from '@takhti/contracts';
import { branchesService } from '@takhti/core';
import { itemRoutes } from '@/server/route';

// A branch is never deleted; it is deactivated. So there is no DELETE here.
export const { GET, PATCH } = itemRoutes(branchesContract, branchesService);

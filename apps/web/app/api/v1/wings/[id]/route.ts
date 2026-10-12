import { wingsContract } from '@takhti/contracts';
import { wingsService } from '@takhti/core';
import { itemRoutes } from '@/server/route';

// The plan has no route that reads one wing: a wing is edited from the branch's list.
export const { PATCH, DELETE } = itemRoutes(wingsContract, wingsService);

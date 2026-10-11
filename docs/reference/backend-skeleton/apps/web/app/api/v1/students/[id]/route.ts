import { studentsContract } from '@school/contracts';
import { studentsService } from '@school/core';
import { itemRoutes } from '@/server/route';

export const { GET, PATCH, DELETE } = itemRoutes(studentsContract, studentsService);

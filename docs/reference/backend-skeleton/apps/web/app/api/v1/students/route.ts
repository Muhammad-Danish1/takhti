import { studentsContract } from '@school/contracts';
import { studentsService } from '@school/core';
import { collectionRoutes } from '@/server/route';

export const { GET, POST } = collectionRoutes(studentsContract, studentsService);

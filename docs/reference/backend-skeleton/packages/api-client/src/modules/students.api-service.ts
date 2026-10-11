import { studentsContract, type ChangeSection, type Student } from '@school/contracts';
import { api } from '../kernel/client';
import { createApiService } from '../kernel/crud-api-service';

export const studentsApi = {
  ...createApiService(studentsContract),

  // Calls for custom actions sit next to the generated ones.
  changeSection: (id: string, input: ChangeSection) =>
    api.post<Student>(`/students/${id}/change-section`, { body: input }),
};

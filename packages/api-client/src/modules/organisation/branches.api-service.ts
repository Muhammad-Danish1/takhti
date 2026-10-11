import { branchesContract, type Branch } from '@takhti/contracts';
import { api } from '../../kernel/client';
import { createApiService } from '../../kernel/crud-api-service';

export const branchesApi = {
  ...createApiService(branchesContract),

  // Calls for named actions sit next to the generated ones.
  deactivate: (id: string, version: number) =>
    api.post<Branch>(`/branches/${id}/deactivate`, { body: { version } }),
  activate: (id: string, version: number) =>
    api.post<Branch>(`/branches/${id}/activate`, { body: { version } }),
};

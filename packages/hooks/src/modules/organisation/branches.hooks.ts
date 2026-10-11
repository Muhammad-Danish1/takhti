import { useMutation, useQueryClient } from '@tanstack/react-query';
import { branchesApi } from '@takhti/api-client';
import { branchesContract } from '@takhti/contracts';
import { createCrudHooks } from '../../kernel/crud-hooks';

const crud = createCrudHooks(branchesContract, branchesApi);

export const branchKeys = crud.keys;
export const branchQueries = crud.queries;
export const useBranches = crud.useList;
export const useBranch = crud.useDetail;
export const useCreateBranch = crud.useCreate;
export const useUpdateBranch = crud.useUpdate;

/** A hook for a named action follows the same pattern as the generated ones. */
function useSetBranchStatus(action: 'activate' | 'deactivate') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      branchesApi[action](id, version),
    onSuccess: (branch) => {
      queryClient.setQueryData(branchKeys.detail(branch.id), branch);
      // The branch switcher in every shell is built from `/me`.
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      return queryClient.invalidateQueries({ queryKey: branchKeys.lists() });
    },
  });
}

export const useDeactivateBranch = () => useSetBranchStatus('deactivate');
export const useActivateBranch = () => useSetBranchStatus('activate');

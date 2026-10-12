import { wingsApi } from '@takhti/api-client';
import { wingsContract } from '@takhti/contracts';
import { createCrudHooks } from '../../kernel/crud-hooks';

const crud = createCrudHooks(wingsContract, wingsApi);

// No hook reads one wing: the plan has no such route, and a wing is edited from the list.
export const wingKeys = crud.keys;
export const wingQueries = crud.queries;
export const useWings = crud.useList;
export const useCreateWing = crud.useCreate;
export const useUpdateWing = crud.useUpdate;
export const useDeleteWing = crud.useRemove;

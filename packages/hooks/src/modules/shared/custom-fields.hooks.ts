import { customFieldsApi } from '@takhti/api-client';
import { customFieldsContract } from '@takhti/contracts';
import { createCrudHooks } from '../../kernel/crud-hooks';

const crud = createCrudHooks(customFieldsContract, customFieldsApi);

export const customFieldKeys = crud.keys;
export const customFieldQueries = crud.queries;
export const useCustomFields = crud.useList;
export const useCreateCustomField = crud.useCreate;
export const useUpdateCustomField = crud.useUpdate;
/** Switches the field off: the route never deletes one. */
export const useDeactivateCustomField = crud.useRemove;

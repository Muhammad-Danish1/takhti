import { approvalPoliciesApi } from '@takhti/api-client';
import { approvalPoliciesContract } from '@takhti/contracts';
import { createCrudHooks } from '../../kernel/crud-hooks';

const crud = createCrudHooks(approvalPoliciesContract, approvalPoliciesApi);

export const approvalPolicyKeys = crud.keys;
export const approvalPolicyQueries = crud.queries;
export const useApprovalPolicies = crud.useList;
export const useCreateApprovalPolicy = crud.useCreate;
export const useUpdateApprovalPolicy = crud.useUpdate;
export const useDeleteApprovalPolicy = crud.useRemove;

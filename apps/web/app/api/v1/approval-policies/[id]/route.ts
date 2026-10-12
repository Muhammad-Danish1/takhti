import { approvalPoliciesContract } from '@takhti/contracts';
import { approvalPoliciesService } from '@takhti/core';
import { itemRoutes } from '@/server/route';

// The plan has no route that reads one policy: a policy is edited from the list.
export const { PATCH, DELETE } = itemRoutes(approvalPoliciesContract, approvalPoliciesService);

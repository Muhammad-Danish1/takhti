import { approvalPoliciesContract } from '@takhti/contracts';
import { approvalPoliciesService } from '@takhti/core';
import { collectionRoutes } from '@/server/route';

export const { GET, POST } = collectionRoutes(approvalPoliciesContract, approvalPoliciesService);

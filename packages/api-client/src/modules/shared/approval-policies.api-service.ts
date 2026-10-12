import { approvalPoliciesContract } from '@takhti/contracts';
import { createApiService } from '../../kernel/crud-api-service';

export const approvalPoliciesApi = createApiService(approvalPoliciesContract);

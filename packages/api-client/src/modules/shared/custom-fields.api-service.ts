import { customFieldsContract } from '@takhti/contracts';
import { createApiService } from '../../kernel/crud-api-service';

export const customFieldsApi = createApiService(customFieldsContract);

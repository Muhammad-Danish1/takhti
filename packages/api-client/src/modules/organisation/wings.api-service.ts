import { wingsContract } from '@takhti/contracts';
import { createApiService } from '../../kernel/crud-api-service';

export const wingsApi = createApiService(wingsContract);

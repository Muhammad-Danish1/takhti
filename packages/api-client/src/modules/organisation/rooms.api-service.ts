import { roomsContract } from '@takhti/contracts';
import { createApiService } from '../../kernel/crud-api-service';

export const roomsApi = createApiService(roomsContract);

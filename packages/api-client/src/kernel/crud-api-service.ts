import type {
  AnyResource,
  BulkResult,
  CreateInput,
  EntityOf,
  ListInput,
  Page,
  UpdateInput,
} from '@takhti/contracts';
import { api } from './client';

/** The calls every resource has. One line per module creates them. */
export interface ApiService<R extends AnyResource> {
  list(params?: ListInput<R>, signal?: AbortSignal): Promise<Page<EntityOf<R>>>;
  get(id: string, signal?: AbortSignal): Promise<EntityOf<R>>;
  create(input: CreateInput<R>): Promise<EntityOf<R>>;
  update(id: string, input: UpdateInput<R>): Promise<EntityOf<R>>;
  remove(id: string): Promise<void>;
  /** Undoes a delete. */
  restore(id: string): Promise<EntityOf<R>>;
  /** Many creates in one call; the answer says which succeeded and why each of the others did not. */
  bulkCreate(items: CreateInput<R>[]): Promise<BulkResult<EntityOf<R>>>;
}

export function createApiService<R extends AnyResource>(contract: R): ApiService<R> {
  const { path } = contract;
  return {
    list: (params, signal) =>
      api.get(path, { query: params as Record<string, unknown> | undefined, signal }),
    get: (id, signal) => api.get(`${path}/${id}`, { signal }),
    create: (input) =>
      api.post(path, { body: input, idempotent: contract.idempotentCreate === true }),
    update: (id, input) => api.patch(`${path}/${id}`, { body: input }),
    remove: (id) => api.delete(`${path}/${id}`),
    restore: (id) => api.post(`${path}/${id}/restore`),
    bulkCreate: (items) => api.post(`${path}/bulk`, { body: { items } }),
  };
}

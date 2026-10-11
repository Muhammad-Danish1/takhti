import type {
  AnyResource,
  CreateInput,
  EntityOf,
  ListInput,
  Page,
  UpdateInput,
} from '@school/contracts';
import { api } from './client';

/** The five calls every resource has. One line per module creates them. */
export interface ApiService<R extends AnyResource> {
  list(params?: ListInput<R>, signal?: AbortSignal): Promise<Page<EntityOf<R>>>;
  get(id: string, signal?: AbortSignal): Promise<EntityOf<R>>;
  create(input: CreateInput<R>): Promise<EntityOf<R>>;
  update(id: string, input: UpdateInput<R>): Promise<EntityOf<R>>;
  remove(id: string): Promise<void>;
}

export function createApiService<R extends AnyResource>(contract: R): ApiService<R> {
  const { path } = contract;
  return {
    list: (params, signal) =>
      api.get(path, { ...(params && { query: params as Record<string, unknown> }), ...(signal && { signal }) }),
    get: (id, signal) => api.get(`${path}/${id}`, { ...(signal && { signal }) }),
    create: (input) => api.post(path, { body: input }),
    update: (id, input) => api.patch(`${path}/${id}`, { body: input }),
    remove: (id) => api.delete(`${path}/${id}`),
  };
}

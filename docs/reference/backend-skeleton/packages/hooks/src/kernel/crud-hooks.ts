import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiService } from '@school/api-client';
import type { AnyResource, EntityOf, ListInput, UpdateInput } from '@school/contracts';

/**
 * Builds the cache keys, query definitions and the five hooks of a resource.
 * The keys are nested ("students" > "list" > filters), so one call can refresh
 * every student list without touching the open detail pages.
 */
export function createCrudHooks<R extends AnyResource>(contract: R, service: ApiService<R>) {
  const keys = {
    all: [contract.name] as const,
    lists: () => [contract.name, 'list'] as const,
    list: (params: ListInput<R> | undefined) => [contract.name, 'list', params ?? {}] as const,
    details: () => [contract.name, 'detail'] as const,
    detail: (id: string) => [contract.name, 'detail', id] as const,
  };

  /** Query definitions usable outside components too: prefetching, server rendering, `queryClient.fetchQuery`. */
  const queries = {
    list: (params?: ListInput<R>) =>
      queryOptions({
        queryKey: keys.list(params),
        queryFn: ({ signal }) => service.list(params, signal),
        // Keeps the current page on screen while the next page or filter loads.
        placeholderData: keepPreviousData,
      }),
    detail: (id: string) =>
      queryOptions({
        queryKey: keys.detail(id),
        queryFn: ({ signal }) => service.get(id, signal),
      }),
  };

  function useList(params?: ListInput<R>) {
    return useQuery(queries.list(params));
  }

  /** Pass `undefined` while the id is not known yet; the query then waits. */
  function useDetail(id: string | undefined) {
    return useQuery({ ...queries.detail(id ?? ''), enabled: Boolean(id) });
  }

  function useCreate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: service.create,
      onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.lists() }),
    });
  }

  function useUpdate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ id, ...input }: UpdateInput<R> & { id: string }) => service.update(id, input as UpdateInput<R>),
      onSuccess: (entity: EntityOf<R>) => {
        // The server returned the saved record, so the detail page updates without another request.
        queryClient.setQueryData(keys.detail(entity.id), entity);
        return queryClient.invalidateQueries({ queryKey: keys.lists() });
      },
    });
  }

  function useRemove() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: service.remove,
      onSuccess: (_result, id) => {
        queryClient.removeQueries({ queryKey: keys.detail(id) });
        return queryClient.invalidateQueries({ queryKey: keys.lists() });
      },
    });
  }

  return { keys, queries, useList, useDetail, useCreate, useUpdate, useRemove };
}

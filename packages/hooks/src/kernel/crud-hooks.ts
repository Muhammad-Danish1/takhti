import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { isApiError, type ApiService } from '@takhti/api-client';
import type {
  AnyResource,
  CreateInput,
  EntityOf,
  ListInput,
  Page,
  UpdateInput,
} from '@takhti/contracts';
import { keysFor } from './query-keys';

/*
 * Layer 7. `createCrudHooks(contract, service)` builds the cache keys, the query definitions and
 * the hooks of a resource. A module's hooks file is one call to it plus a hook per named action.
 */

export interface UpdateOptions {
  /**
   * Show the change at once and undo it if the server refuses. For small, low-risk edits (a toggle,
   * a rename). Never for money, marks or anything a rule may refuse.
   */
  optimistic?: boolean;
}

export function createCrudHooks<R extends AnyResource>(contract: R, service: ApiService<R>) {
  type Entity = EntityOf<R>;
  type List = ListInput<R>;
  const keys = keysFor<List>(contract.name);

  /** Query definitions usable outside components too: prefetching, server rendering, `queryClient.fetchQuery`. */
  const queries = {
    list: (params?: List) =>
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
    /** A list that grows as the person scrolls: page 1, then 2, and so on. */
    infinite: (params?: List) =>
      infiniteQueryOptions({
        queryKey: keys.infinite(params),
        initialPageParam: 1,
        queryFn: ({ pageParam, signal }) =>
          service.list({ ...(params as object), page: pageParam } as List, signal),
        getNextPageParam: (last: Page<Entity>) =>
          last.page * last.pageSize < last.total ? last.page + 1 : undefined,
      }),
  };

  function useList(params?: List) {
    return useQuery(queries.list(params));
  }

  function useInfiniteList(params?: List) {
    return useInfiniteQuery(queries.infinite(params));
  }

  /** Pass `undefined` while the id is not known yet; the query then waits. */
  function useDetail(id: string | undefined) {
    return useQuery({ ...queries.detail(id ?? ''), enabled: Boolean(id) });
  }

  function useCreate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (input: CreateInput<R>) => service.create(input),
      onSuccess: (entity: Entity) => {
        queryClient.setQueryData(keys.detail(entity.id), entity);
        return queryClient.invalidateQueries({ queryKey: keys.lists() });
      },
    });
  }

  function useUpdate(options: UpdateOptions = {}) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ id, ...input }: UpdateInput<R> & { id: string }) =>
        service.update(id, input as UpdateInput<R>),
      onMutate: async ({ id, ...input }) => {
        if (!options.optimistic) return undefined;
        await queryClient.cancelQueries({ queryKey: keys.detail(id) });
        const previous = queryClient.getQueryData<Entity>(keys.detail(id));
        // `input.version` is the version the screen last saw, so the record keeps it until the server answers.
        if (previous) queryClient.setQueryData(keys.detail(id), { ...previous, ...input });
        return { previous };
      },
      onError: (_error, { id }, context) => {
        // The server refused: put back exactly what was there.
        if (context?.previous) queryClient.setQueryData(keys.detail(id), context.previous);
      },
      onSuccess: (entity: Entity) => {
        // The server returned the saved record, so the detail page updates without another request.
        queryClient.setQueryData(keys.detail(entity.id), entity);
        return queryClient.invalidateQueries({ queryKey: keys.lists() });
      },
    });
  }

  function useRemove() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => service.remove(id),
      onSuccess: (_result, id) => {
        queryClient.removeQueries({ queryKey: keys.detail(id) });
        return queryClient.invalidateQueries({ queryKey: keys.lists() });
      },
    });
  }

  function useRestore() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => service.restore(id),
      onSuccess: (entity: Entity) => {
        queryClient.setQueryData(keys.detail(entity.id), entity);
        return queryClient.invalidateQueries({ queryKey: keys.lists() });
      },
    });
  }

  function useBulkCreate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (items: CreateInput<R>[]) => service.bulkCreate(items),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.lists() }),
    });
  }

  return {
    keys,
    queries,
    useList,
    useInfiniteList,
    useDetail,
    useCreate,
    useUpdate,
    useRemove,
    useRestore,
    useBulkCreate,
  };
}

/** The part of a form library this helper needs. React Hook Form's `form` fits as it is. */
export interface FormLike {
  setError(
    name: never,
    error: { type: string; message: string },
    options?: { shouldFocus?: boolean },
  ): void;
}

/**
 * Puts the server's messages under the fields they belong to.
 * Returns the message to show for the form as a whole: the server's sentence when no field took it
 * (a business rule, a stale record), or undefined when every message found its field.
 *
 *   onError: (error) => setFormError(applyApiError(form, error, ['name', 'capacity']))
 */
export function applyApiError(
  form: FormLike,
  error: unknown,
  fieldNames: readonly string[],
): string | undefined {
  if (!isApiError(error)) return 'Something went wrong. Try again.';
  const known = new Set(fieldNames);
  let placed = 0;
  const general: string[] = [];
  for (const [field, messages] of Object.entries(error.fields ?? {})) {
    const message = messages[0];
    if (!message) continue;
    if (known.has(field)) {
      form.setError(field as never, { type: 'server', message }, { shouldFocus: placed === 0 });
      placed += 1;
    } else {
      general.push(message);
    }
  }
  if (general.length > 0) return general.join(' ');
  return placed > 0 ? undefined : error.message;
}

/*
 * One factory for cache keys, so invalidation is never guessed.
 * Keys are nested: ["rooms"] > ["rooms", "list"] > ["rooms", "list", filters].
 * One call can therefore refresh every list of a resource without touching the open detail pages.
 */

export interface ResourceKeys<TList> {
  all: readonly [string];
  lists: () => readonly [string, 'list'];
  list: (params: TList | undefined) => readonly [string, 'list', TList | Record<string, never>];
  infinite: (
    params: TList | undefined,
  ) => readonly [string, 'list', 'infinite', TList | Record<string, never>];
  details: () => readonly [string, 'detail'];
  detail: (id: string) => readonly [string, 'detail', string];
  /** For a named read that is neither a list nor one record: `keys.custom('summary', { month })`. */
  custom: (name: string, params?: unknown) => readonly [string, string, unknown];
}

export function keysFor<TList = unknown>(name: string): ResourceKeys<TList> {
  return {
    all: [name],
    lists: () => [name, 'list'],
    list: (params) => [name, 'list', params ?? {}],
    infinite: (params) => [name, 'list', 'infinite', params ?? {}],
    details: () => [name, 'detail'],
    detail: (id) => [name, 'detail', id],
    custom: (custom, params) => [name, custom, params ?? {}],
  };
}

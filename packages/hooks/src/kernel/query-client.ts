import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '@takhti/api-client';

/*
 * The defaults every app uses.
 *
 *   - data is fresh for 30 seconds, so moving between screens does not refetch needlessly;
 *   - an answer from the server (a 4xx or 5xx) is never retried: asking again will not change it;
 *   - a dropped connection is retried once;
 *   - a write is never retried here. The api-client already repeats a write that is safe to repeat.
 */

/** Whether a failed read is worth one more try. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  return !isApiError(error) || error.isNetworkError;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

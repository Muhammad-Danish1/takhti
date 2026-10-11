import type { ApiErrorBody } from '@takhti/contracts';
import type { Actor, RouteHandler } from '@takhti/core';
import { setRateLimitStore } from '@takhti/core';
import { setSessionReaderForTests } from '@/server/auth';

/*
 * Calling real Route Handlers in tests.
 *
 * The handlers are the app's own, imported from `apps/web/app/api/v1/...`. Only the verification of
 * the sign-in token is replaced: a test says who is calling, and everything after that (finding the
 * membership, loading access, the transaction, the service, the response) is the real code.
 */

export const APP_ORIGIN = 'http://localhost:3000';

const TEST_USER_HEADER = 'x-test-user';
const TEST_MFA_HEADER = 'x-test-mfa';

let installed = false;

/** Call once per test file, before the first `callRoute`. */
export function useTestSessions(): void {
  if (installed) return;
  installed = true;
  setSessionReaderForTests(async (request) => {
    const userId = request.headers.get(TEST_USER_HEADER);
    if (!userId) return null;
    return {
      userId,
      viaBearer: request.headers.has('authorization'),
      mfa: request.headers.get(TEST_MFA_HEADER) === 'yes',
    };
  });
  // Ordinary tests are not about rate limits; the limiter has tests of its own.
  setRateLimitStore({ hit: async () => 1, purge: async () => 0 });
}

export interface CallOptions {
  /** Who is calling. Leave out for a request with no session. */
  as?: Actor | { userId: string; membershipId?: string };
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Path and query, for example `/api/v1/rooms?kind=lab`. */
  url: string;
  /** Route parameters, for example `{ id }` for `/rooms/[id]`. */
  params?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Send no `Origin` header, as a request from another site's page would look to the server. */
  crossSite?: boolean;
}

export interface CallResult<T = unknown> {
  status: number;
  /** The `data` of a successful answer. */
  data: T;
  /** The `error` of a failed answer. */
  error: ApiErrorBody['error'] | undefined;
  headers: Headers;
}

export async function callRoute<T = unknown>(
  handler: RouteHandler,
  options: CallOptions,
): Promise<CallResult<T>> {
  useTestSessions();
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { ...options.headers };
  if (options.as) {
    headers[TEST_USER_HEADER] = options.as.userId;
    if (options.as.membershipId) headers['x-membership-id'] = options.as.membershipId;
  }
  if (!options.crossSite) headers.origin ??= APP_ORIGIN;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const request = new Request(new URL(options.url, APP_ORIGIN), {
    method,
    headers,
    ...(options.body !== undefined && {
      body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body),
    }),
  });
  const response = await handler(request, { params: Promise.resolve(options.params ?? {}) });
  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as { data?: T; error?: ApiErrorBody['error'] }) : {};
  return {
    status: response.status,
    data: parsed.data as T,
    error: parsed.error,
    headers: response.headers,
  };
}

/**
 * A `fetch` that hands requests to Route Handlers, so the API client can be driven against the real
 * API without a server. `routes` maps a path pattern such as `/rooms/[id]` to that route file's exports.
 */
export function fetchThrough(
  routes: Record<string, Partial<Record<string, RouteHandler>>>,
  as: CallOptions['as'],
): typeof fetch {
  useTestSessions();
  const patterns = Object.entries(routes).map(([pattern, handlers]) => {
    const names: string[] = [];
    const expression = pattern.replace(/\[([^\]]+)\]/g, (_whole, name: string) => {
      names.push(name);
      return '([^/]+)';
    });
    return { regex: new RegExp(`^/api/v1${expression}$`), names, handlers };
  });

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      APP_ORIGIN,
    );
    const method = (init?.method ?? 'GET').toUpperCase();
    for (const { regex, names, handlers } of patterns) {
      const match = regex.exec(url.pathname);
      const handler = match && handlers[method];
      if (!match || !handler) continue;
      const headers = new Headers(init?.headers);
      headers.set('origin', APP_ORIGIN);
      if (as) {
        headers.set(TEST_USER_HEADER, as.userId);
        if (as.membershipId) headers.set('x-membership-id', as.membershipId);
      }
      const request = new Request(url, {
        method,
        headers,
        ...(init?.body != null && { body: init.body }),
      });
      const params = Object.fromEntries(
        names.map((name, index) => [name, decodeURIComponent(match[index + 1] ?? '')]),
      );
      return handler(request, { params: Promise.resolve(params) });
    }
    return new Response(
      JSON.stringify({
        error: {
          code: 'NOT_FOUND',
          message: `No test route for ${method} ${url.pathname}`,
          requestId: 'test',
        },
      }),
      { status: 404 },
    );
  }) as typeof fetch;
}

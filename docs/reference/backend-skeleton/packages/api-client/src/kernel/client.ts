import type { ApiErrorBody, ErrorCode } from '@school/contracts';

/** What every failed call throws. Screens switch on `code`; forms read `fields`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string[]>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiConfig {
  baseUrl: string;
  /** Mobile apps return the Supabase access token here. The web app leaves it out and relies on its cookie. */
  getToken?: () => Promise<string | null | undefined>;
  fetch?: typeof fetch;
}

let config: ApiConfig = { baseUrl: '/api/v1' };

/** Called once when an app starts. */
export function configureApi(next: Partial<ApiConfig>): void {
  config = { ...config, ...next };
}

export interface RequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  signal?: AbortSignal;
  /** Sent on writes that must not happen twice, such as collecting a fee, so a retry is safe. */
  idempotencyKey?: string;
}

function toQueryString(query: Record<string, unknown> | undefined): string {
  if (!query) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const token = await config.getToken?.();
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;

  let response: Response;
  try {
    response = await (config.fetch ?? fetch)(config.baseUrl + path + toQueryString(options.query), {
      method,
      headers,
      credentials: 'include',
      ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
      ...(options.signal && { signal: options.signal }),
    });
  } catch (cause) {
    // A cancelled request is not a failure; let the caller (React Query) see the abort as it is.
    if (options.signal?.aborted) throw cause;
    throw new ApiError(0, 'INTERNAL', 'No connection. Check your internet and try again.');
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (payload as Partial<ApiErrorBody> | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'INTERNAL',
      error?.message ?? 'Something went wrong',
      error?.fields,
      error?.requestId,
    );
  }
  return (payload as { data: T }).data;
}

/** The one place the app talks HTTP. Every api-service is built on these four functions. */
export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body' | 'idempotencyKey'>) =>
    request<T>('GET', path, options),
  post: <T>(path: string, options?: RequestOptions) => request<T>('POST', path, options),
  patch: <T>(path: string, options?: RequestOptions) => request<T>('PATCH', path, options),
  delete: <T = void>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
};

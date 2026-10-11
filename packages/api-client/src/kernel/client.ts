import type { ApiErrorBody, ErrorCode, FieldErrors } from '@takhti/contracts';

/*
 * Layer 6. The one place an app talks HTTP. Every api-service is built on the functions at the
 * bottom of this file. It runs in browsers and in the mobile apps, so it uses nothing but `fetch`.
 *
 * What it takes care of, so no screen has to:
 *   - one error type, whatever went wrong, with the server's code, message and field messages;
 *   - a GET that fails because the connection dropped is tried once more, quietly;
 *   - a write marked idempotent carries an `Idempotency-Key`, and is tried once more with the
 *     same key if the connection dropped, which is safe: the server runs it at most once;
 *   - an expired session is reported once, so the app can send the person to sign in and back.
 */

/** What every failed call throws. Screens switch on `code`; forms read `fields`. */
export class ApiError extends Error {
  constructor(
    /** The HTTP status, or 0 when no answer arrived at all. */
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: FieldErrors,
    readonly requestId?: string,
    /** With `RATE_LIMITED`: seconds to wait. */
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the request never got an answer: offline, or the server unreachable. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export interface ApiConfig {
  baseUrl: string;
  /** Mobile apps return the Supabase access token here. The web app leaves it out and relies on its cookie. */
  getToken?: () => Promise<string | null | undefined>;
  /** Mobile apps: the membership the person chose. The web app keeps it in a cookie instead. */
  getMembershipId?: () => string | null | undefined;
  /** The branch the person is working in, when they have more than one. */
  getBranchId?: () => string | null | undefined;
  /** `en` or `ur`, for the language of messages. */
  getLocale?: () => string | null | undefined;
  /** Sent as `x-app-version` by the mobile apps, so the API can ask an old app to update. */
  appVersion?: string;
  /** Called when the server says the session is no longer valid. The app sends the person to sign in. */
  onUnauthenticated?: (error: ApiError) => void;
  fetch?: typeof fetch;
}

let config: ApiConfig = { baseUrl: '/api/v1' };

/** Called once when an app starts. */
export function configureApi(next: Partial<ApiConfig>): void {
  config = { ...config, ...next };
}

export interface RequestOptions {
  query?: Record<string, unknown> | undefined;
  body?: unknown;
  signal?: AbortSignal | undefined;
  /**
   * For a write that must not happen twice (collecting a fee, posting a voucher run).
   * `true` makes a key for this call; a string reuses a key the caller made, for its own retries.
   */
  idempotent?: boolean | string | undefined;
}

/** A key for one user action. */
export function newIdempotencyKey(): string {
  const { crypto } = globalThis;
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto?.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else
    for (let index = 0; index < bytes.length; index++)
      bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toQueryString(query: Record<string, unknown> | undefined): string {
  if (!query) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    // A filter that takes several values is sent comma-separated: `status=unpaid,partial`.
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function send(
  method: string,
  path: string,
  options: RequestOptions,
  idempotencyKey: string | undefined,
): Promise<Response> {
  const token = await config.getToken?.();
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const membershipId = config.getMembershipId?.();
  if (membershipId) headers['x-membership-id'] = membershipId;
  const branchId = config.getBranchId?.();
  if (branchId) headers['x-branch-id'] = branchId;
  const locale = config.getLocale?.();
  if (locale) headers['accept-language'] = locale;
  if (config.appVersion) headers['x-app-version'] = config.appVersion;

  return (config.fetch ?? fetch)(config.baseUrl + path + toQueryString(options.query), {
    method,
    headers,
    credentials: 'include',
    ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
    ...(options.signal && { signal: options.signal }),
  });
}

async function exchange(method: string, path: string, options: RequestOptions): Promise<Response> {
  const idempotencyKey =
    options.idempotent === true ? newIdempotencyKey() : options.idempotent || undefined;
  // Trying again is safe for a read, and for a write the server will run at most once.
  const mayRetry = method === 'GET' || idempotencyKey !== undefined;
  for (let attempt = 1; ; attempt++) {
    try {
      return await send(method, path, options, idempotencyKey);
    } catch (cause) {
      // A cancelled request is not a failure; let the caller (React Query) see the abort as it is.
      if (options.signal?.aborted) throw cause;
      if (mayRetry && attempt === 1) {
        await wait(300);
        continue;
      }
      throw new ApiError(0, 'INTERNAL', 'No connection. Check your internet and try again.');
    }
  }
}

function toApiError(response: Response, payload: unknown): ApiError {
  const error = (payload as Partial<ApiErrorBody> | null)?.error;
  const retryAfter = Number(response.headers.get('retry-after'));
  const fallback: ErrorCode =
    response.status === 401
      ? 'UNAUTHENTICATED'
      : response.status === 403
        ? 'FORBIDDEN'
        : response.status === 404
          ? 'NOT_FOUND'
          : 'INTERNAL';
  const apiError = new ApiError(
    response.status,
    error?.code ?? fallback,
    error?.message ?? 'Something went wrong',
    error?.fields,
    error?.requestId ?? response.headers.get('x-request-id') ?? undefined,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  );
  if (apiError.code === 'UNAUTHENTICATED') config.onUnauthenticated?.(apiError);
  return apiError;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const response = await exchange(method, path, options);
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw toApiError(response, payload);
  return (payload as { data: T }).data;
}

/** For a download: the file's bytes and the name the server suggests. */
async function download(
  path: string,
  options: Omit<RequestOptions, 'body' | 'idempotent'> = {},
): Promise<{ blob: Blob; fileName: string | undefined }> {
  const response = await exchange('GET', path, options);
  if (!response.ok) throw toApiError(response, await response.json().catch(() => null));
  const disposition = response.headers.get('content-disposition') ?? '';
  const fileName = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1];
  return {
    blob: await response.blob(),
    fileName: fileName ? decodeURIComponent(fileName) : undefined,
  };
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body' | 'idempotent'>) =>
    request<T>('GET', path, options),
  post: <T>(path: string, options?: RequestOptions) => request<T>('POST', path, options),
  patch: <T>(path: string, options?: RequestOptions) => request<T>('PATCH', path, options),
  /** Replaces a whole value, such as one setting. */
  put: <T>(path: string, options?: RequestOptions) => request<T>('PUT', path, options),
  delete: <T = void>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
  download,
};

import {
  createBrowserClient,
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/*
 * Supabase clients. `supabase-js` is used for Auth, Storage and Realtime only; data goes through
 * Takhti's own API. The publishable key is safe in the browser; the secret key never leaves the server
 * and is used only inside `@takhti/core` (storage links, creating accounts).
 */

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** For Client Components: one client per browser tab. */
export function browserSupabase(): SupabaseClient {
  return createBrowserClient(url(), publishableKey());
}

/**
 * For a Route Handler or the proxy: reads the session from the request's cookies.
 * Refreshed cookies are collected in `setCookies`, for the caller to attach to its response.
 */
export function requestSupabase(request: Request): {
  supabase: SupabaseClient;
  setCookies: string[];
} {
  const setCookies: string[] = [];
  const supabase = createServerClient(url(), publishableKey(), {
    cookies: {
      getAll: () =>
        parseCookieHeader(request.headers.get('cookie') ?? '').map(({ name, value }) => ({
          name,
          value: value ?? '',
        })),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies)
          setCookies.push(serializeCookieHeader(name, value, options));
      },
    },
  });
  return { supabase, setCookies };
}

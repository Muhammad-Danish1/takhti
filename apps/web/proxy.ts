import { NextResponse, type NextRequest } from 'next/server';
import { requestSupabase } from '@/server/supabase';

/*
 * Runs before every page request (Next.js calls this file the proxy).
 *
 *   - keeps the sign-in session fresh: an expiring token is renewed and the new cookies are sent back;
 *   - sends a signed-out visitor of a portal to the sign-in page, and remembers where they were going.
 *
 * It decides nothing about what a signed-in person may see. Every API route does that itself.
 */

const portals = ['/platform', '/hq', '/school', '/teach', '/family', '/learn'];

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { supabase, setCookies } = requestSupabase(request);
  let signedIn = false;
  try {
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  } catch {
    // The Auth service is away. Treat the visitor as signed out; the sign-in page explains.
    signedIn = false;
  }

  const { pathname, search } = request.nextUrl;
  const inPortal = portals.some(
    (portal) => pathname === portal || pathname.startsWith(`${portal}/`),
  );

  let response: NextResponse;
  if (inPortal && !signedIn) {
    const target = request.nextUrl.clone();
    target.pathname = '/sign-in';
    target.search = `?next=${encodeURIComponent(pathname + search)}`;
    response = NextResponse.redirect(target);
  } else {
    response = NextResponse.next();
  }
  for (const cookie of setCookies) response.headers.append('set-cookie', cookie);
  return response;
}

export const config = {
  // Pages only. API routes authenticate each request themselves, and static files need nothing.
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$).*)',
  ],
};

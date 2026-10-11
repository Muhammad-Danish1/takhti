import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { AppError, loadPermissions, type Actor } from '@school/core';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/**
 * Works out who is calling. The web app sends Supabase's session cookie; the mobile apps and the
 * offline sync upload send `Authorization: Bearer <token>`. Either way the token's signature is verified.
 */
export async function authenticate(request: Request): Promise<Actor> {
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () =>
        parseCookieHeader(request.headers.get('cookie') ?? '').map(({ name, value }) => ({
          name,
          value: value ?? '',
        })),
      // API routes only read the session. Refreshing it is the job of the app's proxy file.
      setAll: () => {},
    },
  });

  const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const { data, error } = await supabase.auth.getClaims(bearer);
  if (error || !data) throw new AppError('UNAUTHENTICATED', 'Please sign in again');

  // `org_id`, `role_key`, `branch_ids` and `all_branches` are added to the token by a
  // Supabase "custom access token" hook when the user signs in.
  const claims = data.claims;
  const orgId = typeof claims.org_id === 'string' ? claims.org_id : undefined;
  const roleKey = typeof claims.role_key === 'string' ? claims.role_key : undefined;
  if (!orgId || !roleKey) throw new AppError('FORBIDDEN', 'This account is not linked to a school yet');

  return {
    userId: claims.sub,
    orgId,
    roleKey,
    branchIds: Array.isArray(claims.branch_ids) ? claims.branch_ids.filter((id) => typeof id === 'string') : [],
    allBranches: claims.all_branches === true,
    permissions: await loadPermissions(orgId, roleKey),
  };
}

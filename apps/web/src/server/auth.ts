import { parseCookieHeader } from '@supabase/ssr';
import {
  actorFor,
  isUuid,
  platformAdminFor,
  unauthenticated,
  type MemberSession,
  type PlatformAdmin,
} from '@takhti/core';
import { requestSupabase } from './supabase';

/*
 * Works out who is calling.
 *
 * The web app sends Supabase's session cookie; the mobile apps and the offline upload send
 * `Authorization: Bearer <token>`. Either way the token's signature is verified, and then only the
 * user id is taken from it. Which school the person is in, and what they may do there, is read from
 * the database on every request by `actorFor`.
 */

/** The cookie that remembers which membership a person with several is using. */
export const MEMBERSHIP_COOKIE = 'takhti_membership';

export interface VerifiedSession {
  userId: string;
  viaBearer: boolean;
  /** The membership version the token was issued for, when the token carries one. */
  tokenVersion?: number;
  /** Whether this sign-in passed two-factor (`aal2`). */
  mfa: boolean;
}

export type SessionReader = (request: Request) => Promise<VerifiedSession | null>;

async function supabaseSession(request: Request): Promise<VerifiedSession | null> {
  const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const { supabase } = requestSupabase(request);
  const { data, error } = await supabase.auth.getClaims(bearer);
  if (error || !data?.claims?.sub) return null;
  const { claims } = data;
  const version = (claims as Record<string, unknown>).membership_version;
  return {
    userId: claims.sub,
    viaBearer: bearer !== undefined,
    mfa: claims.aal === 'aal2',
    ...(typeof version === 'number' && { tokenVersion: version }),
  };
}

let readSession: SessionReader = supabaseSession;

/** For tests: replaces token verification, so a test can act as any seeded person without a real sign-in. */
export function setSessionReaderForTests(reader: SessionReader | undefined): void {
  readSession = reader ?? supabaseSession;
}

async function requireSession(request: Request): Promise<VerifiedSession> {
  const session = await readSession(request);
  if (!session) throw unauthenticated();
  return session;
}

/** The membership the caller chose: a header from the mobile apps, a cookie from the web app. */
function chosenMembership(request: Request): string | undefined {
  const header = request.headers.get('x-membership-id');
  if (header && isUuid(header)) return header;
  const cookie = parseCookieHeader(request.headers.get('cookie') ?? '').find(
    ({ name }) => name === MEMBERSHIP_COOKIE,
  )?.value;
  return cookie && isUuid(cookie) ? cookie : undefined;
}

/** A signed-in member of a school. */
export async function authenticate(request: Request): Promise<MemberSession> {
  const session = await requireSession(request);
  const actor = await actorFor({
    userId: session.userId,
    membershipId: chosenMembership(request),
    tokenVersion: session.tokenVersion,
  });
  return { actor, viaBearer: session.viaBearer };
}

/** A signed-in person, whether or not they have chosen a school. */
export async function authenticateUser(
  request: Request,
): Promise<{ userId: string; viaBearer: boolean }> {
  const session = await requireSession(request);
  return { userId: session.userId, viaBearer: session.viaBearer };
}

/** One of Takhti's own staff. Their sign-in must have passed two-factor. */
export async function authenticatePlatform(request: Request): Promise<PlatformAdmin> {
  const session = await requireSession(request);
  const admin = await platformAdminFor(session.userId);
  if (!session.mfa) throw unauthenticated('Sign in again with your two-factor code');
  return admin;
}

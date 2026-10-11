import { and, eq, isNull } from 'drizzle-orm';
import type { Locale } from '@takhti/contracts';
import { adminDb, memberships, orgs, platformAdmins, userPreferences } from '@takhti/db';
import type { Actor, PlatformAdmin } from './context';
import { forbidden, unauthenticated } from './errors';
import { loadAccess, membershipState, type Access } from './permissions';

/*
 * From "this person proved who they are" to "this is what they may do".
 *
 * The host app verifies the sign-in token and passes the user id here. Everything else is read from
 * the database on every request: which membership is active, whether it is still allowed in, and
 * (cached for a minute) its roles, permissions and branches. Nothing about access is taken from the token.
 *
 * Uses the privileged connection, because it runs before any transaction for the user exists.
 */

export interface MembershipSummary {
  membershipId: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  kind: 'staff' | 'guardian' | 'student';
  status: 'invited' | 'active' | 'suspended';
}

/** Every membership of a user, for the "choose where to go" screen. Organisations that are closed are left out. */
export async function membershipsOf(userId: string): Promise<MembershipSummary[]> {
  const rows = await adminDb()
    .select({
      membershipId: memberships.id,
      orgId: memberships.orgId,
      orgName: orgs.name,
      orgSlug: orgs.slug,
      kind: memberships.kind,
      status: memberships.status,
      orgStatus: orgs.status,
    })
    .from(memberships)
    .innerJoin(orgs, eq(orgs.id, memberships.orgId))
    .where(
      and(eq(memberships.userId, userId), isNull(memberships.deletedAt), isNull(orgs.deletedAt)),
    );
  return rows
    .filter((row) => row.orgStatus !== 'closed')
    .map(({ orgStatus: _orgStatus, ...row }) => row);
}

async function localeOf(userId: string): Promise<Locale> {
  const [row] = await adminDb()
    .select({ locale: userPreferences.locale })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return row?.locale ?? 'en';
}

export function actorFromAccess(access: Access, locale: Locale): Actor {
  return {
    userId: access.userId,
    orgId: access.orgId,
    membershipId: access.membershipId,
    kind: access.kind,
    roleKeys: access.roleKeys,
    permissions: access.permissions,
    allBranches: access.allBranches,
    branchIds: access.branchIds,
    ...(access.staffId !== undefined && { staffId: access.staffId }),
    ...(access.guardianId !== undefined && { guardianId: access.guardianId }),
    studentIds: access.studentIds,
    ...(access.familyId !== undefined && { familyId: access.familyId }),
    caps: access.caps,
    locale,
  };
}

export interface ActorRequest {
  userId: string;
  /** The membership the person chose, when they have more than one. */
  membershipId?: string | undefined;
  /** The membership version the token was issued for, when the token carries one. */
  tokenVersion?: number | undefined;
}

/**
 * The actor for a signed-in user.
 *
 *   no membership                      403  "not linked to a school yet"
 *   several, none chosen               403  "choose which school"
 *   a chosen one that is not theirs    403  (the same words as the first: nothing is revealed)
 *   invited, not yet accepted          403
 *   suspended, or the school is        403
 *   a token from before a forced sign-out   401
 */
export async function actorFor(request: ActorRequest): Promise<Actor> {
  let membershipId = request.membershipId;
  if (!membershipId) {
    const usable = (await membershipsOf(request.userId)).filter(
      (membership) => membership.status === 'active',
    );
    if (usable.length === 0) throw forbidden('This account is not linked to a school yet');
    if (usable.length > 1) throw forbidden('Choose which school to continue with');
    membershipId = usable[0]?.membershipId;
  }
  if (!membershipId) throw forbidden('This account is not linked to a school yet');

  // Read on every request, never cached: a suspension must bite at once.
  const state = await membershipState(membershipId);
  if (!state || state.userId !== request.userId)
    throw forbidden('This account is not linked to a school yet');
  if (state.status === 'invited') throw forbidden('Accept your invitation before signing in');
  if (state.status === 'suspended')
    throw forbidden('Your access to this school has been suspended. Speak to the school office.');
  if (request.tokenVersion !== undefined && request.tokenVersion !== state.tokenVersion)
    throw unauthenticated();

  const [org] = await adminDb()
    .select({ status: orgs.status })
    .from(orgs)
    .where(eq(orgs.id, state.orgId))
    .limit(1);
  if (!org || org.status === 'closed') throw forbidden('This school is no longer on Takhti');
  if (org.status === 'suspended')
    throw forbidden(
      'This school’s account is suspended. Its owner can restore it from the billing page.',
    );
  if (org.status === 'provisioning') throw forbidden('This school is still being set up');

  const access = await loadAccess(membershipId);
  if (!access) throw forbidden('This account is not linked to a school yet');
  return actorFromAccess(access, await localeOf(request.userId));
}

/** One of Takhti's own staff, or a refusal. Two-factor sign-in must already be enrolled. */
export async function platformAdminFor(userId: string): Promise<PlatformAdmin> {
  const [admin] = await adminDb()
    .select({
      role: platformAdmins.role,
      isActive: platformAdmins.isActive,
      mfaEnrolledAt: platformAdmins.mfaEnrolledAt,
    })
    .from(platformAdmins)
    .where(and(eq(platformAdmins.userId, userId), isNull(platformAdmins.deletedAt)))
    .limit(1);
  if (!admin || !admin.isActive) throw forbidden();
  if (!admin.mfaEnrolledAt)
    throw forbidden('Set up two-factor sign-in before using the platform console');
  return { userId, role: admin.role };
}

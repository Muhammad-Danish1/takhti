import { SwitchOrg } from '@takhti/contracts';
import { actorFor, env } from '@takhti/core';
import { MEMBERSHIP_COOKIE } from '@/server/auth';
import { defineUserRoute } from '@/server/route';

/**
 * `POST /api/v1/me/switch-org`: chooses which membership the person continues with.
 * The choice is checked exactly as every later request will check it, then remembered in a cookie.
 */
export const POST = defineUserRoute({
  body: SwitchOrg,
  handler: async (user, { body }) => {
    const actor = await actorFor({ userId: user.userId, membershipId: body.membershipId });
    const secure = new URL(env().APP_URL).protocol === 'https:' ? '; Secure' : '';
    return Response.json(
      { data: { membershipId: actor.membershipId, orgId: actor.orgId, kind: actor.kind } },
      {
        headers: {
          'set-cookie': `${MEMBERSHIP_COOKIE}=${actor.membershipId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
          'cache-control': 'no-store',
        },
      },
    );
  },
});

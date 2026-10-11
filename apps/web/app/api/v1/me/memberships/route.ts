import { membershipsOf } from '@takhti/core';
import { defineUserRoute } from '@/server/route';

/** `GET /api/v1/me/memberships`: the schools a signed-in person belongs to, before one is chosen. */
export const GET = defineUserRoute({ handler: (user) => membershipsOf(user.userId) });

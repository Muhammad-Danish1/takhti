import { getMe } from '@takhti/core';
import { defineRoute } from '@/server/route';

/** `GET /api/v1/me`: who is signed in and what they may do. Every portal shell is built from this. */
export const GET = defineRoute({ handler: (ctx) => getMe(ctx) });

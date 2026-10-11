import { createRoutes, env, runAs, runAsPlatform } from '@takhti/core';
import { authenticate, authenticatePlatform, authenticateUser } from './auth';

/**
 * The route builders for this app: Supabase sign-in, one row-level-secured transaction per request.
 * Every file under `app/api/v1` builds its handlers with these and nothing else.
 */
export const {
  defineRoute,
  defineUserRoute,
  definePlatformRoute,
  definePublicRoute,
  collectionRoutes,
  itemRoutes,
  restoreRoute,
  bulkRoute,
} = createRoutes({
  authenticate: (request) => authenticate(request),
  authenticateUser: (request) => authenticateUser(request),
  authenticatePlatform: (request) => authenticatePlatform(request),
  run: runAs,
  runPlatform: runAsPlatform,
  // A browser may send a changing request only from the app's own address.
  allowedOrigins: () => [new URL(env().APP_URL).origin],
});

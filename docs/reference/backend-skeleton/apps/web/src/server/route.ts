import { createRoutes, runAs } from '@school/core';
import { authenticate } from './auth';

/** The route builders for this app: Supabase sign-in, and one row-level-secured transaction per request. */
export const { defineRoute, collectionRoutes, itemRoutes } = createRoutes({ authenticate, run: runAs });

import { defineConfig } from 'drizzle-kit';

// Run from the repository root: `pnpm db:generate --name <what-changed>`.
// Migrations are applied by `packages/db/src/migrate.ts`, never by drizzle-kit, so no connection is configured here.
export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/db/src/schema/index.ts',
  out: './packages/db/migrations',
  // The `authenticated` role belongs to Supabase (and to the foundation migration on other engines).
  entities: { roles: { provider: 'supabase' } },
});

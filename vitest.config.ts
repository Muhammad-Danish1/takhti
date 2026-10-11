import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests live beside the code; service, security and API tests live in `tests/`.
// They run on an in-process Postgres by default and on the Docker Postgres with `pnpm test:db`.
export default defineConfig({
  // The web app's own alias, so tests can import its Route Handlers exactly as Next.js does.
  resolve: { alias: { '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)) } },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'tests/e2e/**', 'docs/**'],
    globalSetup: ['tests/helpers/global-setup.ts'],
    setupFiles: ['tests/helpers/setup-env.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // The Docker database is one shared server: keep the number of connections it sees modest.
    ...(process.env.TEST_DB === 'postgres' ? { maxWorkers: 4 } : {}),
  },
});

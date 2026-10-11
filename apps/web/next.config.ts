import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// One `.env.local` serves the whole repository (the web app, the worker, the database scripts),
// and it lives at the repository root. Next.js only looks beside the app, so it is loaded here.
const rootEnv = resolve(import.meta.dirname, '../../.env.local');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

/** Security headers sent with every response. The content security policy is tightened in Phase 21. */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(self), payment=()',
  },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  // Workspace packages are used as TypeScript source; Next compiles them with the app.
  transpilePackages: [
    '@takhti/api-client',
    '@takhti/contracts',
    '@takhti/core',
    '@takhti/db',
    '@takhti/hooks',
    '@takhti/ui',
  ],
  // Server-only packages that must not be bundled.
  serverExternalPackages: ['postgres', 'pino', 'pino-pretty'],
  reactCompiler: true,
  typedRoutes: true,
  poweredByHeader: false,
  // Type-checking is done by `pnpm typecheck` (TypeScript 7), not by the build.
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;

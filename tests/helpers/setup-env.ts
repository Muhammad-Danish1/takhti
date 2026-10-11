/*
 * Runs before every test file. Tests never read `.env.local`: every value they need is set here,
 * so a test behaves the same on every machine. Values already present (set by `pnpm test:db`) win.
 */
const defaults: Record<string, string> = {
  APP_ENV: 'test',
  APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:64321',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
  SUPABASE_SECRET_KEY: 'test-secret-key',
  DATABASE_URL: 'postgres://unused',
  DATABASE_ADMIN_URL: 'postgres://unused',
  // 32 zero bytes, base64: a key that is only ever used inside tests.
  ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  SMS_PROVIDER: 'log',
  WHATSAPP_PROVIDER: 'log',
  EMAIL_PROVIDER: 'log',
  PUSH_PROVIDER: 'log',
  PAYMENT_PROVIDER: 'fake',
  AI_PROVIDER: 'fake',
  LOG_LEVEL: 'silent',
  TEST_DB: 'pglite',
};

for (const [name, value] of Object.entries(defaults)) {
  process.env[name] ??= value;
}

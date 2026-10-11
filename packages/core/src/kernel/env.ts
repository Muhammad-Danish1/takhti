import { z } from 'zod';

/*
 * One schema for every environment variable. The app refuses to start with a missing or
 * malformed value and says which one. Only this file and the logger (which must work before the
 * environment is validated) read `process.env`.
 */

const base64Key = z.string().refine((value) => Buffer.from(value, 'base64').length === 32, {
  error: 'must be 32 random bytes, base64-encoded',
});

const provider = <const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) =>
  z.enum(values).default(fallback);

const schema = z.object({
  APP_URL: z.url().default('http://localhost:3000'),
  APP_ENV: z.enum(['local', 'test', 'staging', 'production']).default('local'),

  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),

  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, { error: 'must be a postgres:// address' }),
  DATABASE_ADMIN_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, { error: 'must be a postgres:// address' }),

  ENCRYPTION_KEY: base64Key,

  SMS_PROVIDER: provider(['log'], 'log'),
  WHATSAPP_PROVIDER: provider(['log'], 'log'),
  EMAIL_PROVIDER: provider(['log'], 'log'),
  PUSH_PROVIDER: provider(['log'], 'log'),
  PAYMENT_PROVIDER: provider(['fake'], 'fake'),
  AI_PROVIDER: provider(['fake', 'anthropic'], 'fake'),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.output<typeof schema>;

/** Parses an environment. Throws one error naming every variable that is wrong. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (result.success) {
    if (result.data.AI_PROVIDER === 'anthropic' && !result.data.ANTHROPIC_API_KEY) {
      throw new Error(
        'Environment is not valid:\n  ANTHROPIC_API_KEY: required when AI_PROVIDER is "anthropic"',
      );
    }
    return result.data;
  }
  const problems = result.error.issues.map(
    (issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
  throw new Error(`Environment is not valid:\n${problems.join('\n')}\nSee .env.example.`);
}

let cached: Env | undefined;

/** The validated environment. Parsed on first use, so importing this file never fails by itself. */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** For tests: replaces the cached environment. */
export function setEnvForTests(next: Env | undefined): void {
  cached = next;
}

export const isProduction = (): boolean => env().APP_ENV === 'production';

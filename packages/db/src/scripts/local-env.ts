/*
 * Writes `.env.local` for local development from the running Supabase stack.
 *
 *   pnpm db:env
 *
 * Keys are read from `supabase status` and written straight to the file: nothing secret is printed.
 * Values already in `.env.local` are kept, so running it again is safe. The two values that have
 * no source (the API role's database password and the encryption key) are generated once.
 */
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fail, readEnvFile, repoRoot } from './local';

interface Status {
  DB_URL?: string;
  PUBLISHABLE_KEY?: string;
  SECRET_KEY?: string;
  ANON_KEY?: string;
  SERVICE_ROLE_KEY?: string;
}

function readStatus(): Status {
  try {
    const out = execSync('supabase status -o json', {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    });
    return JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)) as Status;
  } catch {
    return fail('Local Supabase is not running. Start Docker Desktop, then run `pnpm db:start`.');
  }
}

/** The port of the `[api]` section of supabase/config.toml: Auth, Storage and Realtime answer there. */
function apiPort(): number {
  const config = readFileSync(resolve(repoRoot, 'supabase/config.toml'), 'utf8');
  const section = config.slice(config.indexOf('[api]'));
  const port = section.match(/^\s*port\s*=\s*(\d+)/m)?.[1];
  if (!port) fail('Could not read the [api] port from supabase/config.toml.');
  return Number(port);
}

const status = readStatus();
if (!status.DB_URL) fail('`supabase status` did not report a database address.');
const publishable = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const secret = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
if (!publishable || !secret) fail('`supabase status` did not report the API keys.');

const file = resolve(repoRoot, '.env.local');
const existing = readEnvFile(file);
const examplePath = resolve(repoRoot, '.env.example');
if (!existsSync(examplePath)) fail('.env.example is missing.');

const adminUrl = new URL(status.DB_URL);
const apiPassword = existing.get('TAKHTI_API_DB_PASSWORD') || randomBytes(18).toString('hex');
const appUrl = new URL(status.DB_URL);
appUrl.username = 'takhti_api';
appUrl.password = apiPassword;

const fromStack: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${apiPort()}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable,
  SUPABASE_SECRET_KEY: secret,
  DATABASE_ADMIN_URL: adminUrl.toString(),
  DATABASE_URL: appUrl.toString(),
  TAKHTI_API_DB_PASSWORD: apiPassword,
};
const generatedOnce: Record<string, () => string> = {
  ENCRYPTION_KEY: () => randomBytes(32).toString('base64'),
};

// Keep the layout and comments of .env.example; fill in each value.
const written: string[] = [];
const lines = readFileSync(examplePath, 'utf8')
  .split(/\r?\n/)
  .map((line) => {
    const name = line.match(/^([A-Z0-9_]+)=/)?.[1];
    if (!name) return line;
    const value =
      fromStack[name] ??
      (existing.get(name) || generatedOnce[name]?.() || line.slice(name.length + 1));
    written.push(name);
    return `${name}=${value}`;
  });

// Anything the developer added that the example does not know about is kept at the end.
const extras = [...existing].filter(([name]) => !written.includes(name));
if (extras.length > 0) {
  lines.push('', '# --- added locally');
  for (const [name, value] of extras) lines.push(`${name}=${value}`);
}

writeFileSync(file, `${lines.join('\n').replace(/\n+$/, '')}\n`);
console.log(
  `Wrote .env.local (${written.length + extras.length} variables). Nothing in it is committed.`,
);
console.log('Next: `pnpm db:reset` to create the schema and seed data.');

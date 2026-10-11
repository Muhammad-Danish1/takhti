import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MigrationTarget } from '../migrate';

/* Small helpers shared by the database scripts. */

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

export function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    fail(`${name} is not set. Run \`pnpm db:env\` to write .env.local, or see .env.example.`);
  return value;
}

const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal']);

export const isLocalDatabase = (url: string): boolean => {
  try {
    return localHosts.has(new URL(url).hostname);
  } catch {
    return false;
  }
};

/** Stops a destructive script from ever running against a database that is not on this machine. */
export function assertLocalDatabase(url: string, action: string): void {
  if (!isLocalDatabase(url)) {
    fail(
      `Refusing to ${action}: DATABASE_ADMIN_URL does not point at this machine. This command is for local development only.`,
    );
  }
}

/**
 * Lets the application sign in as `takhti_api` with the password from the environment.
 * The role itself is created by the foundation migration, without a password.
 */
export async function setApiRolePassword(target: MigrationTarget, password: string): Promise<void> {
  if (password.length < 12) fail('TAKHTI_API_DB_PASSWORD must be at least 12 characters.');
  // A role password cannot be sent as a query parameter, so it is quoted here: doubled single quotes, no backslashes.
  if (/[\\\0]/.test(password)) fail('TAKHTI_API_DB_PASSWORD must not contain a backslash.');
  await target.exec(`alter role takhti_api with login password '${password.replace(/'/g, "''")}'`);
}

/** Reads a `KEY=value` file into an ordered map. Comments and blank lines are skipped. */
export function readEnvFile(path: string): Map<string, string> {
  const values = new Map<string, string>();
  if (!existsSync(path)) return values;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match?.[1] !== undefined)
      values.set(match[1], (match[2] ?? '').replace(/^(['"])(.*)\1$/, '$2'));
  }
  return values;
}

/** The name of the local database container, from the project id in supabase/config.toml. */
export function databaseContainer(): string {
  const config = readFileSync(resolve(repoRoot, 'supabase/config.toml'), 'utf8');
  const projectId = config.match(/^\s*project_id\s*=\s*"([^"]+)"/m)?.[1];
  if (!projectId) fail('Could not read project_id from supabase/config.toml.');
  return `supabase_db_${projectId}`;
}

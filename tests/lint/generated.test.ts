import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * The data layer of Waves 1 onwards is written by `pnpm scaffold` from the module specifications.
 * These tests keep three things true:
 *   - the generated files are exactly what the specifications and the hints produce today;
 *   - nobody edited a generated file by hand;
 *   - the SQL that Drizzle cannot express has really been put into a migration.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * The statements of a hand-written SQL file. A statement ends at a line that ends with `;`,
 * unless the line is inside a `$$ … $$` body (a function), where `;` ends nothing.
 */
function statementsOf(text: string): string[] {
  const statements: string[] = [];
  let current: string[] = [];
  let insideBody = false;
  for (const line of text.split(/\r?\n/)) {
    if (current.length === 0 && (line.trim() === '' || line.startsWith('--'))) continue;
    current.push(line);
    if ((line.match(/\$\$/g) ?? []).length % 2 === 1) insideBody = !insideBody;
    if (!insideBody && line.trimEnd().endsWith(';')) {
      statements.push(current.join('\n'));
      current = [];
    }
  }
  if (current.length > 0) statements.push(current.join('\n'));
  return statements;
}

describe('generated files', () => {
  it('are up to date with the specifications (run `pnpm scaffold` if this fails)', () => {
    let output = '';
    let failed = false;
    try {
      output = execFileSync(
        process.execPath,
        [join(root, 'docs/plan/_tools/scaffold.mjs'), '--check'],
        {
          cwd: root,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
    } catch (error) {
      failed = true;
      const caught = error as { stdout?: string; stderr?: string };
      output = `${caught.stdout ?? ''}${caught.stderr ?? ''}`;
    }
    expect(failed, output).toBe(false);
    expect(output).toMatch(/up to date/);
  }, 120_000);

  it('the standard API files are up to date with the plan and the tables (run `pnpm scaffold:api` if this fails)', () => {
    let output = '';
    let failed = false;
    try {
      // It loads the table files, so it runs through tsx.
      output = execFileSync(
        process.execPath,
        ['--import', 'tsx', join(root, 'docs/plan/_tools/scaffold-api.mjs'), '--check'],
        { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch (error) {
      failed = true;
      const caught = error as { stdout?: string; stderr?: string };
      output = `${caught.stdout ?? ''}${caught.stderr ?? ''}`;
    }
    expect(failed, output).toBe(false);
    expect(output).toMatch(/up to date/);
  }, 180_000);

  it('every statement Drizzle cannot express is part of a migration (run `pnpm db:custom-sql <wave>` after generating)', () => {
    const customDir = join(root, 'packages/db/src/custom-sql');
    const migrationsDir = join(root, 'packages/db/migrations');
    const migrations = squash(
      readdirSync(migrationsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => readFileSync(join(migrationsDir, entry.name, 'migration.sql'), 'utf8'))
        .join('\n'),
    );
    const files = existsSync(customDir)
      ? readdirSync(customDir).filter((name) => /^wave-\d+\.sql$/.test(name))
      : [];
    expect(files.length).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const name of files) {
      for (const statement of statementsOf(readFileSync(join(customDir, name), 'utf8'))) {
        if (!migrations.includes(squash(statement)))
          missing.push(`${name}: ${squash(statement).slice(0, 90)}…`);
      }
    }
    expect(missing).toEqual([]);
  });
});

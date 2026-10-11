// Reads the module specifications into plain data for the scaffolder.
// The notation it understands is the one described in docs/plan/00-foundation/05-conventions.md, part C.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const planDir = resolve(here, '..');
export const repoRoot = resolve(planDir, '../..');
const modulesDir = join(planDir, '10-modules');

const isRow = (line) => line.startsWith('|') && line.trimEnd().endsWith('|');
const cells = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

/**
 * Splits prose into sentences and `;`-separated items, without breaking inside brackets or backticks.
 * "Unique: (a, b) among live rows; (c). One open row per x." → ["(a, b) among live rows", "(c)", "One open row per x"]
 */
export function splitItems(text) {
  const items = [];
  let depth = 0;
  let inTick = false;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '`') inTick = !inTick;
    if (!inTick && (char === '(' || char === '[' || char === '{')) depth++;
    if (!inTick && (char === ')' || char === ']' || char === '}')) depth = Math.max(0, depth - 1);
    const endOfSentence = char === '.' && (i === text.length - 1 || text[i + 1] === ' ');
    if (!inTick && depth === 0 && (char === ';' || endOfSentence)) {
      if (current.trim()) items.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

/** The fragments of a Rules cell, split on `;` outside backticks and brackets. */
export function splitRules(text) {
  const parts = [];
  let depth = 0;
  let inTick = false;
  let current = '';
  for (const char of text) {
    if (char === '`') inTick = !inTick;
    if (!inTick && (char === '(' || char === '{' || char === '[')) depth++;
    if (!inTick && (char === ')' || char === '}' || char === ']')) depth = Math.max(0, depth - 1);
    if (char === ';' && !inTick && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseType(text) {
  const reference = text.match(/^(uuid(?:\[\])?) → ([a-z_0-9]+)$/);
  if (reference) return { base: reference[1], target: reference[2] };
  const list = text.match(/^enum\((.*)\)$/);
  if (list) return { base: 'enum', values: list[1].split(',').map((value) => value.trim()) };
  const numeric = text.match(/^numeric\((\d+),\s*(\d+)\)$/);
  if (numeric) return { base: 'numeric', precision: Number(numeric[1]), scale: Number(numeric[2]) };
  return { base: text };
}

export function parseSpec(file) {
  const lines = readFileSync(join(modulesDir, file), 'utf8').split(/\r?\n/);
  const code = file.slice(0, 3).toUpperCase();
  const title = (lines[0] ?? '').replace(/^# M\d\d · /, '');
  // Section 4 names the folder every layer uses for the module: `packages/contracts/src/modules/fees/`.
  const key = (lines.join('\n').match(/`packages\/contracts\/src\/modules\/([a-z-]+)\/`/) ?? [])[1];
  if (!key) throw new Error(`${file}: section 4 does not name the module's contracts folder`);

  const tables = [];
  const permissions = [];
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i].match(/^#### `([a-z_0-9]+)` · (.+)$/);
    if (heading) {
      const [scope, ...mods] = heading[2].trim().split(/\s+/);
      let j = i + 1;
      const intro = [];
      while (j < lines.length && !isRow(lines[j]) && !/^#{2,4} /.test(lines[j])) {
        if (lines[j].trim()) intro.push(lines[j].trim());
        j++;
      }
      const columns = [];
      j += 2;
      while (j < lines.length && isRow(lines[j])) {
        const [name, type, ...rest] = cells(lines[j]);
        const rules = rest.join(' | ');
        columns.push({ name, type: parseType(type), typeText: type, rules, fragments: splitRules(rules) });
        j++;
      }
      const after = { Unique: [], Index: [], Policy: [], Check: [], other: [] };
      while (j < lines.length && !/^#{2,4} /.test(lines[j])) {
        const line = lines[j].trim();
        if (line) {
          const kind = (line.match(/^(Unique|Index|Policy|Check):/) ?? [])[1];
          if (kind === 'Policy') after.Policy.push(line.replace(/^Policy:\s*/, ''));
          else if (kind) after[kind].push(...splitItems(line.replace(/^[A-Z][a-z]+:\s*/, '')));
          else after.other.push(line);
        }
        j++;
      }
      tables.push({
        name: heading[1],
        module: code,
        file,
        scope,
        mods,
        description: intro.join(' '),
        columns,
        unique: after.Unique,
        index: after.Index,
        policy: after.Policy,
        check: after.Check,
        other: after.other,
      });
      continue;
    }
    if (/^\|\s*Permission\s*\|\s*Allows\s*\|\s*Default roles\s*\|/.test(lines[i])) {
      let j = i + 2;
      while (j < lines.length && isRow(lines[j])) {
        const [permission, allows, roles] = cells(lines[j]);
        permissions.push({
          key: permission.replace(/^`|`$/g, ''),
          allows: allows ?? '',
          roles: (roles ?? '')
            .split(',')
            .map((role) => role.trim())
            .filter(Boolean),
        });
        j++;
      }
    }
  }
  return { code, file, key, title, tables, permissions };
}

export function parseAllSpecs() {
  return readdirSync(modulesDir)
    .filter((name) => /^m\d\d-.*\.md$/.test(name))
    .sort()
    .map(parseSpec);
}

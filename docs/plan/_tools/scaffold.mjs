#!/usr/bin/env node
// Writes the data layer of every module from its specification.
//
//   pnpm scaffold            write the generated files (waves 1 to `throughWave` in scaffold-hints.mjs)
//   pnpm scaffold --check    change nothing; exit 1 if a generated file is out of date
//   pnpm scaffold --report   print what was understood, table by table
//
// For each module it writes:
//   packages/contracts/src/modules/<key>/<key>.constants.ts     allowed-value lists
//   packages/contracts/src/modules/<key>/<key>.entities.ts      one Zod schema and type per table
//   packages/contracts/src/modules/<key>/<key>.permissions.ts   the Permissions table
//   packages/db/src/schema/<key>/<key>.table.ts                 the tables, with checks, indexes and access
//   tests/types/entities/<key>.ts                               each entity type agrees with its table
// and, once: the two `generated.ts` barrels, tests/api/security/rls-fixtures.generated.ts and
// packages/db/src/custom-sql/wave-N.sql (statements Drizzle cannot express, appended to the wave's migration).
//
// The output is a function of two inputs only: the module specs (docs/plan/10-modules) and
// scaffold-hints.mjs, which holds every decision the specs' fixed notation cannot carry. Nothing in a
// generated file is edited by hand; `--check` runs in the test suite, so the plan and the schema cannot drift.
// A sentence in a spec that the generator does not understand, and that no hint accounts for, is an error.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import * as prettier from 'prettier';
import * as hints from './scaffold-hints.mjs';
import { parseAllSpecs, repoRoot } from './scaffold-parse.mjs';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const report = args.includes('--report');
const throughWave = args.includes('--through-wave')
  ? Number(args[args.indexOf('--through-wave') + 1])
  : hints.throughWave;

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

// ---------------------------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------------------------

const camel = (snake) => snake.replace(/[_-]([a-z0-9])/g, (_, char) => char.toUpperCase());
const pascal = (snake) => {
  const name = camel(snake);
  return name.charAt(0).toUpperCase() + name.slice(1);
};
/** What Drizzle's snake-case mode turns a property name into. A column whose name does not survive the round trip is named explicitly. */
const drizzleSnake = (name) =>
  (name.match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [])
    .map((word) => word.toLowerCase())
    .join('_');

/** Postgres cuts identifiers at 63 bytes; this is `identifier()` from packages/db/src/kernel/columns.ts. */
const identifier = (name) =>
  name.length <= 63
    ? name
    : `${name.slice(0, 54)}_${createHash('sha256').update(name).digest('hex').slice(0, 8)}`;

function singularWord(word) {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word === 'statuses') return 'status';
  if (word.endsWith('zzes')) return word.slice(0, -3);
  if (/(ss|ch|sh|x)es$/.test(word)) return word.slice(0, -2);
  if (/(ss|us|is)$/.test(word)) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}
function pluralWord(word) {
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}
const singularOf = (table) => {
  if (hints.singular[table]) return hints.singular[table];
  const words = table.split('_');
  words.push(singularWord(words.pop()));
  return words.join('_');
};
/** Words a column name may end with that make a poor plural: `applies_to` becomes `…AppliesToOptions`. */
const notNouns = new Set(['to', 'by', 'from', 'for', 'on', 'as', 'in', 'of', 'at', 'with', 'via']);

const quote = (text) => `'${String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const sqlText = (text) => `'${String(text).replace(/'/g, "''")}'`;

// ---------------------------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------------------------

const specs = parseAllSpecs();
const waveOf = new Map();
for (const [wave, codes] of Object.entries(hints.waves))
  for (const code of codes) waveOf.set(code, Number(wave));
for (const spec of specs)
  if (!waveOf.has(spec.code)) fail(spec.code, 'is in no wave (scaffold-hints.mjs, `waves`)');

const planTables = new Map();
for (const spec of specs) for (const table of spec.tables) planTables.set(table.name, { spec, table });

const generatedSpecs = specs.filter((spec) => {
  const wave = waveOf.get(spec.code) ?? 99;
  return wave >= 1 && wave <= throughWave;
});

for (const name of Object.keys(hints.tables))
  if (!planTables.has(name)) fail(name, 'has hints but is not a table in the plan');

/** Tables written by hand (Wave 0): where each one's constant is exported from. */
const handWritten = new Map();
{
  const schemaDir = join(repoRoot, 'packages/db/src/schema');
  const walk = (dir) =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  for (const file of walk(schemaDir).filter((name) => name.endsWith('.table.ts'))) {
    const text = readFileSync(file, 'utf8');
    if (text.startsWith('// Generated by')) continue;
    for (const match of text.matchAll(
      /export const (\w+) = (?:table|defineTable)\(\s*'([a-z_0-9]+)'/g,
    )) {
      handWritten.set(match[2], { constName: match[1], file });
    }
  }
}

const tableConst = (name) => handWritten.get(name)?.constName ?? camel(name);
const moduleDir = (spec) => join(repoRoot, 'packages/db/src/schema', spec.key);
const tableFile = (spec) => join(moduleDir(spec), `${spec.key}.table.ts`);

/** Whether a table exists in code once this run is written. */
const isAvailable = (name) => {
  if (handWritten.has(name)) return true;
  const found = planTables.get(name);
  return !!found && (waveOf.get(found.spec.code) ?? 99) <= throughWave;
};

// ---------------------------------------------------------------------------------------------
// Understanding one table
// ---------------------------------------------------------------------------------------------

const number = String.raw`-?\d+(?:\.\d+)?`;
const numberOf = (text) => Number(text.replace(/,/g, ''));

function baseColumnsOf(table) {
  const appendOnly = table.mods.includes('append-only');
  if (table.scope === 'org' || table.scope === 'branch') {
    return {
      spread: appendOnly ? '...appendColumns' : '...baseColumns',
      branch: table.scope === 'branch',
      hasDeletedAt: !appendOnly,
      hasVersion: !appendOnly,
    };
  }
  const override = hints.tables[table.name]?.base;
  if (override === 'append')
    return { spread: 'append-global', branch: false, hasDeletedAt: false, hasVersion: false };
  return { spread: 'global', branch: false, hasDeletedAt: true, hasVersion: true };
}

function metaOf(table) {
  const hint = hints.tables[table.name] ?? {};
  const meta = { module: table.module, scope: table.scope };
  const has = (name) => table.columns.some((column) => column.name === name);
  for (const mod of table.mods) {
    const family = mod.match(/^\+family(?:\(([a-z_]+)\))?$/);
    const self = mod.match(/^\+self(?:\(([a-z_]+)\))?$/);
    const cap = mod.match(/^\+cap\(([a-z]+)\)$/);
    const household = mod.match(/^\+household(?:\(([a-z_]+)\))?$/);
    if (family) meta.family = camel(family[1] ?? 'student_id');
    else if (self) meta.self = camel(self[1] ?? 'user_id');
    else if (household) {
      meta.household = true;
      if (household[1]) meta.householdColumn = camel(household[1]);
    } else if (cap) {
      meta.cap = cap[1];
      // The person a sensitive row is about may always reach it.
      if (has('staff_id')) meta.capOwner = 'staffId';
    } else if (mod === 'append-only') {
      meta.appendOnly = true;
      meta.staff = 'append';
    } else fail(table.name, `unknown scope modifier "${mod}"`);
  }
  Object.assign(meta, hint.meta ?? {});
  for (const key of Object.keys(meta)) if (meta[key] === undefined) delete meta[key];

  // The spec and the hints must agree that a table departs from its scope's template: a Policy line
  // nobody acted on, and access nobody wrote down, are both mistakes.
  if (table.policy.length > 0 && !hint.meta && !hint.policy)
    fail(
      table.name,
      `has a Policy line and no decision in the hints (meta, or policy: 'template' | 'service'): "${table.policy.join(' ')}"`,
    );
  if (hint.meta && table.policy.length === 0)
    fail(table.name, 'the hints change who may reach it, but its spec has no Policy line saying so');
  return meta;
}

function literalCode(value) {
  if (Array.isArray(value)) return `[${value.map(literalCode).join(', ')}]`;
  if (value && typeof value === 'object') {
    return `{ ${Object.entries(value)
      .map(([key, item]) => `${key}: ${literalCode(item)}`)
      .join(', ')} }`;
  }
  return typeof value === 'string' ? quote(value) : String(value);
}

/** The allowed-value list of an enum column: its constant, its Zod schema, its values. */
function enumOf(table, column) {
  const hint = hints.tables[table.name]?.columns?.[column.name]?.enum;
  if (hint?.use) return { constName: hint.use, typeName: hint.schema, shared: true };
  const sharedList = hints.sharedLists.find(
    (list) => list.values.join(',') === column.type.values.join(','),
  );
  if (sharedList && hint?.share !== false)
    return { constName: sharedList.constName, typeName: sharedList.schema, shared: true };
  const base = `${singularOf(table.name)}_${column.name}`;
  const words = base.split('_');
  const last = words.pop();
  const plural = notNouns.has(last) ? [...words, last, 'options'] : [...words, pluralWord(last)];
  return {
    constName: hint?.constName ?? camel(plural.join('_')),
    typeName: hint?.typeName ?? pascal(base),
    values: column.type.values,
    shared: false,
  };
}

/** Wording that usually describes something a constraint could enforce. */
const constraintWords =
  /\bunique\b|\bone [a-z`_ ]+ per\b|\bexactly one\b|\bat most one\b|\bat least one\b|\bno two\b|\boverlap|\bone of the two\b|\brequired (for|when|once|on|if)\b|\bdifferent from\b/;

function analyseColumn(table, column, base) {
  const where = `${table.name}.${column.name}`;
  const hint = hints.tables[table.name]?.columns?.[column.name] ?? {};
  const key = camel(column.name);
  const type = column.type;
  const notes = [];
  const checks = [];
  const uniques = [];
  const t = (name) => `\${t.${camel(name)}}`;
  const sibling = (name) => table.columns.find((other) => other.name === name);

  // ---- type
  let builder;
  let zod;
  let sample; // code for a value the security tests' row generator may put here; `index` numbers the row
  const explicitName = drizzleSnake(key) === column.name ? '' : quote(column.name);
  switch (type.base) {
    case 'text':
      builder = `text(${explicitName})`;
      zod = 'z.string()';
      break;
    case 'int':
      builder = `integer(${explicitName})`;
      zod = 'z.int()';
      break;
    case 'bigint':
      builder = explicitName
        ? `bigint(${explicitName}, { mode: 'number' })`
        : `bigint({ mode: 'number' })`;
      zod = 'z.int()';
      break;
    case 'paisa':
      builder = 'paisa()';
      zod = 'z.int()';
      break;
    case 'bool':
      builder = `boolean(${explicitName})`;
      zod = 'z.boolean()';
      break;
    case 'date':
      builder = 'dateStr()';
      zod = 'z.string()';
      break;
    case 'time':
      builder = 'timeStr()';
      zod = 'z.string()';
      break;
    case 'timestamptz':
      builder = 'timestamptz()';
      zod = 'z.string()';
      break;
    case 'jsonb':
      builder = `jsonb(${explicitName})`;
      zod = 'z.unknown()';
      break;
    case 'uuid':
      builder = `uuid(${explicitName})`;
      zod = 'z.uuid()';
      break;
    case 'uuid[]':
      builder = `uuid(${explicitName}).array()`;
      zod = 'z.array(z.uuid())';
      break;
    case 'text[]':
      builder = `text(${explicitName}).array()`;
      zod = 'z.array(z.string())';
      break;
    case 'int[]':
      builder = `integer(${explicitName}).array()`;
      zod = 'z.array(z.int())';
      break;
    case 'paisa[]':
      builder = 'paisa().array()';
      zod = 'z.array(z.int())';
      break;
    case 'numeric':
      builder = `decimal(${type.precision}, ${type.scale})`;
      zod = 'z.number()';
      break;
    case 'enum': {
      const list = enumOf(table, column);
      builder = `enumText(${list.constName})`;
      zod = list.typeName;
      break;
    }
    default:
      if (!hint.builder) fail(where, `unknown type "${column.typeText}" (give it a builder in the hints)`);
  }
  if (explicitName && !/\(\s*'/.test(builder ?? ''))
    fail(where, 'its name does not survive camelCase and back; the generator cannot name it');
  if (hint.builder) builder = hint.builder;
  if (hint.zod) zod = hint.zod;

  // ---- foreign key
  let forward;
  if (type.target && type.base === 'uuid' && hint.reference !== false) {
    if (isAvailable(type.target)) {
      const auto = `${table.name}_${column.name}_${type.target}_id_fkey`;
      const named = auto.length > 63 ? `, { name: ${quote(identifier(auto))} }` : '';
      builder += `.references((): AnyPgColumn => ${tableConst(type.target)}.id${named})`;
    } else {
      forward = type.target;
      notes.push(
        `References \`${type.target}.id\`; the constraint is added in Wave ${waveOf.get(planTables.get(type.target)?.spec.code) ?? '?'}.`,
      );
    }
  } else if (type.target && type.base === 'uuid[]') {
    notes.push(`Ids of \`${type.target}\`.`);
  }

  // ---- rules
  let required = false;
  let optional = false;
  let defaultCode;
  let signed = hint.signed === true;
  let generated = hint.generated;
  for (const fragment of column.fragments) {
    let match;
    if (fragment === 'required') required = true;
    else if (/^optional\b/.test(fragment)) {
      optional = true;
      if (fragment !== 'optional') notes.push(fragment);
    } else if ((match = fragment.match(/^default (.+)$/))) {
      const value = match[1];
      const tick = value.match(/^`(.*)`$/)?.[1];
      if (hint.default !== undefined) defaultCode = hint.default;
      else if (type.base === 'bool' && /^(true|false)$/.test(value)) defaultCode = `.default(${value})`;
      else if (
        ['int', 'bigint', 'paisa', 'numeric'].includes(type.base) &&
        new RegExp(`^${number}$`).test(value)
      )
        defaultCode = `.default(${value})`;
      else if (type.base === 'enum' && type.values.includes(value))
        defaultCode = `.default(${quote(value)})`;
      else if (type.base === 'jsonb' && tick === '{}') defaultCode = '.default({})';
      else if (type.base === 'jsonb' && tick === '[]') defaultCode = '.default([])';
      else if (type.base.endsWith('[]') && value === 'empty') defaultCode = ".default(sql`'{}'`)";
      else if (type.base.endsWith('[]') && tick && /^\{[\d, ]*\}$/.test(tick))
        defaultCode = `.default(sql\`'${tick.replace(/\s/g, '')}'\`)`;
      else if (type.base === 'timestamptz' && value === 'now') defaultCode = '.defaultNow()';
      else if (type.base === 'time' && /^\d\d:\d\d$/.test(value))
        defaultCode = `.default(${quote(value)})`;
      else if (type.base === 'text' && tick !== undefined) defaultCode = `.default(${quote(tick)})`;
      else fail(where, `cannot read the default "${value}" (state it in the hints)`);
    } else if (fragment === 'unique per organisation')
      uniques.push({ columns: ['org_id', column.name] });
    else if (fragment === 'unique per branch') uniques.push({ columns: ['branch_id', column.name] });
    else if (fragment === 'unique' || fragment === 'unique across the platform')
      uniques.push({ columns: [column.name], plain: true });
    else if ((match = fragment.match(new RegExp(`^> (${number})$`)))) {
      checks.push(
        match[1] === '0'
          ? `positive(${quote(table.name)}, t.${key})`
          : { suffix: 'gt', sql: `${t(column.name)} > ${match[1]}` },
      );
      sample = String(numberOf(match[1]) + 1);
    } else if ((match = fragment.match(new RegExp(`^≥ (${number})$`)))) {
      checks.push(
        match[1] === '0'
          ? `nonNegative(${quote(table.name)}, t.${key})`
          : { suffix: 'min', sql: `${t(column.name)} >= ${match[1]}` },
      );
      sample = String(numberOf(match[1]));
    } else if ((match = fragment.match(new RegExp(`^(${number}) to (${number})$`)))) {
      checks.push(`between(${quote(table.name)}, t.${key}, ${match[1]}, ${match[2]})`);
      // Whole numbers walk through the range, so rows that must differ (a grade's level) do.
      const [low, high] = [numberOf(match[1]), numberOf(match[2])];
      sample =
        type.base === 'int' && Number.isInteger(low) && Number.isInteger(high)
          ? `${low} + (index % ${high - low + 1})`
          : String(low);
    } else if (
      (match = fragment.match(new RegExp(`^(${number}) to \`([a-z_0-9]+)\`$`))) &&
      sibling(match[2])
    ) {
      // "0 to `max_marks`": from a number up to another column of the row.
      checks.push({
        suffix: 'within',
        sql: `${t(column.name)} >= ${match[1]} and ${t(column.name)} <= ${t(match[2])}`,
        compare: { operator: '<=', other: match[2] },
      });
    } else if ((match = fragment.match(/^(>|≥|≤|after) `([a-z_0-9]+)`$/)) && sibling(match[2])) {
      const operator = { '>': '>', after: '>', '≥': '>=', '≤': '<=' }[match[1]];
      const suffix = { '>': 'after', '>=': 'from', '<=': 'upto' }[operator];
      checks.push({
        suffix,
        sql: `${t(column.name)} ${operator} ${t(match[2])}`,
        compare: { operator, other: match[2] },
      });
    } else if (/^first day of (a|the|the first) month\b/.test(fragment)) {
      checks.push({ suffix: 'first', sql: `extract(day from ${t(column.name)}) = 1` });
      sample = 'firstOfMonth(index)';
    } else if (fragment === 'a Monday') {
      checks.push({ suffix: 'monday', sql: `extract(isodow from ${t(column.name)}) = 1` });
      sample = 'day(4 + index * 7)';
    } else if ((match = fragment.match(/^at least ([\d,]+) characters$/))) {
      checks.push({ suffix: 'len', sql: `char_length(${t(column.name)}) >= ${numberOf(match[1])}` });
      sample = quote('Sample text'.padEnd(numberOf(match[1]) + 4, '.'));
    } else if ((match = fragment.match(/^(?:at most|up to) ([\d,]+) characters$/))) {
      checks.push({ suffix: 'maxlen', sql: `char_length(${t(column.name)}) <= ${numberOf(match[1])}` });
    } else if (fragment === 'never below zero') {
      checks.push(`nonNegative(${quote(table.name)}, t.${key})`);
    } else if (fragment === 'lower case') {
      checks.push({ suffix: 'lower', sql: `${t(column.name)} = lower(${t(column.name)})` });
    } else if (/^signed\b/.test(fragment) || /\bnegative for\b/.test(fragment)) {
      signed = true;
      if (fragment !== 'signed') notes.push(fragment);
    } else if (/^generated\b/.test(fragment)) {
      if (!generated) fail(where, 'is a generated column; give its expression in the hints');
      notes.push(fragment);
    } else {
      // Wording that sounds like a constraint the database could hold must not pass as a mere comment.
      if (constraintWords.test(fragment) && hint.accounted === undefined && !hint.neededWhen)
        fail(
          where,
          `the rule "${fragment}" reads like a constraint: enforce it through the hints (checks, extra) or leave it to the service, and say which with \`accounted\``,
        );
      notes.push(fragment);
    }
  }

  // ---- nullability
  let notNull;
  if (hint.notNull !== undefined) notNull = hint.notNull;
  else if (generated) notNull = false;
  else if (required) notNull = true;
  else if (optional) notNull = false;
  else if (defaultCode) notNull = true;
  else if (column.fragments.some((fragment) => /^required (for|when|on|once|if)\b/.test(fragment)))
    notNull = false;
  else fail(where, `says neither required, optional nor default: "${column.rules}"`);
  if (optional && defaultCode && hint.notNull === undefined) notNull = false;

  // A generated column is declared among the columns, where there is no `t`: it names its
  // siblings through the table itself, inside a function so the table exists by the time it runs.
  if (generated) {
    const expression = generated.split('${t.').join(`\${${tableConst(table.name)}.`);
    builder += `.generatedAlwaysAs((): SQL => sql\`${expression}\`)`;
  }
  else {
    if (notNull) builder += '.notNull()';
    if (defaultCode) builder += defaultCode;
  }
  if (!notNull) zod += '.nullable()';

  // ---- money is never negative unless the spec says so
  const alreadyBounded = checks.some(
    (check) => typeof check === 'string' && /^(positive|nonNegative)\(/.test(check),
  );
  if (type.base === 'paisa' && !signed && !generated && !alreadyBounded && hint.check !== false)
    checks.push(`nonNegative(${quote(table.name)}, t.${key})`);
  if (hint.check === false) checks.length = 0;
  for (const extra of hint.checks ?? []) checks.push(extra);

  // ---- "required when another column says so": { neededWhen: { kind: 'x' } }, a list of values, or `true` for a flag
  const needs = [];
  if (hint.neededWhen) {
    const unless = [];
    for (const [other, wanted] of Object.entries(hint.neededWhen)) {
      const otherColumn = sibling(other);
      if (!otherColumn) fail(where, `neededWhen names the column "${other}", which the table does not have`);
      if (wanted === true) unless.push(`not ${t(other)}`);
      else {
        const list = [wanted].flat();
        unless.push(
          list.length === 1
            ? `${t(other)} <> ${quote(list[0])}`
            : `${t(other)} not in (${list.map(quote).join(', ')})`,
        );
        needs.push({ other, values: list, all: otherColumn?.type.values ?? [] });
      }
    }
    checks.push({ suffix: 'needed', sql: `${unless.join(' or ')} or ${t(column.name)} is not null` });
  }

  if (hint.note) notes.unshift(hint.note);
  return {
    name: column.name,
    key,
    type,
    builder,
    zod,
    notes,
    checks,
    uniques,
    notNull,
    hasDefault: !!defaultCode || !!generated,
    generated: !!generated,
    sample,
    needs,
    forward,
    base,
  };
}

/** The value that stands for "empty" when a unique rule counts two empty values as the same. */
function emptyValue(column, tableName) {
  switch (column.type.base) {
    case 'uuid':
      return "'00000000-0000-0000-0000-000000000000'::uuid";
    case 'text':
    case 'enum':
      return "''";
    case 'int':
      return '-1';
    case 'date':
      return "'0001-01-01'::date";
    default:
      fail(`${tableName}.${column.name}`, 'no "empty" value is known for its type in a unique rule');
      return 'null';
  }
}

/** `${t.deletedAt} is null and …`, as the body of a `sql` template, or the `live(t)` helper when that is all. */
function predicateCode(parts, base) {
  const all = [...(base.hasDeletedAt ? ['${t.deletedAt} is null'] : []), ...parts];
  if (all.length === 0) return '';
  if (all.length === 1 && base.hasDeletedAt) return '.where(live(t))';
  return `.where(sql\`${all.join(' and ')}\`)`;
}

const nameFrom = (table, columns, suffix) => {
  const parts = columns
    .filter((column) => column !== 'org_id' || columns.length === 1)
    .map((column) => column.replace(/_id$/, ''));
  return `${table.name}_${parts.join('_')}_${suffix}`;
};

function analyseTable(spec, table) {
  const hint = hints.tables[table.name] ?? {};
  const base = baseColumnsOf(table);
  const meta = metaOf(table);
  const columns = table.columns.map((column) => analyseColumn(table, column, base));
  const byName = new Map(columns.map((column) => [column.name, column]));
  const known = new Set([
    ...byName.keys(),
    'id',
    'org_id',
    'created_at',
    'created_by',
    ...(base.branch ? ['branch_id'] : []),
    ...(base.hasVersion ? ['version', 'updated_at', 'updated_by', 'deleted_at'] : []),
  ]);
  const t = (name) => `\${t.${camel(name)}}`;
  const extra = [];
  const used = new Set();
  const named = (wanted) => {
    let name = identifier(wanted);
    for (let n = 2; used.has(name); n++) name = identifier(`${wanted}_${n}`);
    used.add(name);
    return name;
  };
  const columnsExist = (list, what) => {
    const missing = list.filter((name) => !known.has(name));
    if (missing.length) fail(table.name, `${what} names unknown column(s): ${missing.join(', ')}`);
    return missing.length === 0;
  };
  const nullable = (name) => byName.has(name) && !byName.get(name).notNull;

  // ---- checks stated on columns
  for (const column of columns) {
    for (const check of column.checks) {
      if (typeof check === 'string') {
        extra.push(check);
        const helper = check.match(/^(positive|nonNegative|between)\(/)?.[1];
        used.add(`${table.name}_${column.name}_${{ positive: 'pos', nonNegative: 'min', between: 'range' }[helper]}`);
      } else {
        extra.push(
          `check(${quote(named(`${table.name}_${column.name}_${check.suffix}`))}, sql\`${check.sql}\`)`,
        );
      }
    }
  }

  // ---- lines a hint accounts for
  const lineHints = hint.lines ?? [];
  const usedLineHints = new Set();
  const hintFor = (item) => {
    const found = lineHints.find((entry) => item.includes(entry.match));
    if (found) usedLineHints.add(found);
    return found;
  };
  const applyHint = (found) => {
    for (const code of [found.code ?? []].flat()) extra.push(code);
  };
  const customSql = [...(hint.sql ?? [])];
  const takeSql = (found) => customSql.push(...[found.sql ?? []].flat());

  // ---- uniqueness stated on columns
  for (const column of columns) {
    for (const unique of column.uniques) {
      const columnHint = hint.columns?.[column.name] ?? {};
      if (columnHint.unique === false) continue;
      if (!columnsExist(unique.columns, `the unique rule of ${column.name}`)) continue;
      // A hash, a path or a token identifies one thing for ever, deleted or not.
      const forEver =
        columnHint.unique === 'for ever' || /(_hash|_token|^path)$/.test(column.name);
      const parts = nullable(column.name) ? [`${t(column.name)} is not null`] : [];
      const predicate = forEver ? '' : predicateCode(parts, base);
      extra.push(
        `uniqueIndex(${quote(named(nameFrom(table, unique.columns, 'uq')))}).on(${unique.columns
          .map((name) => `t.${camel(name)}`)
          .join(', ')})${predicate}`,
      );
    }
  }

  // ---- Unique: lines
  for (const item of table.unique) {
    const found = hintFor(item);
    const tuples = [...item.matchAll(/\(([a-z_0-9, ]+)\)/g)];
    const rest = item
      .replace(/\(([a-z_0-9, ]+)\)/g, '')
      .replace(/^[\s,]+/, '')
      .trim();
    if (found && (found.code || found.sql || found.note || found.service)) {
      applyHint(found);
      takeSql(found);
      continue;
    }
    const startsWithTuple = /^\(/.test(item.trim());
    if (!startsWithTuple || tuples.length === 0) {
      fail(table.name, `cannot read the unique rule "${item}" (account for it in the hints)`);
      continue;
    }
    let parts;
    let match;
    if (found?.where !== undefined) parts = found.where ? [found.where] : [];
    else if (rest === '' || rest === 'among live rows') parts = [];
    else if (/^(among live rows )?(where set|when present|where .+ is (set|not empty)\b.*)$/.test(rest))
      parts = null; // each tuple's optional columns must be present
    else if ((match = rest.match(/^(?:among live rows )?where status is (.+)$/))) {
      const values = match[1].split(/,\s*|\s+or\s+/).map((value) => value.replace(/`/g, '').trim());
      const status = table.columns.find((column) => column.name === 'status');
      const unknown = values.filter((value) => !status?.type.values?.includes(value));
      if (unknown.length) fail(table.name, `unique rule "${item}" names unknown status ${unknown.join(', ')}`);
      parts = [
        values.length === 1
          ? `${t('status')} = ${sqlText(values[0])}`
          : `${t('status')} in (${values.map(sqlText).join(', ')})`,
      ];
    } else if (rest === 'among live active rows') parts = [`${t('status')} = 'active'`];
    else {
      fail(table.name, `cannot read the condition of the unique rule "${item}" (give \`where\` in the hints)`);
      continue;
    }
    for (const tuple of tuples) {
      const list = tuple[1].split(',').map((name) => name.trim());
      if (!columnsExist(list, `unique rule "${item}"`)) continue;
      const empties = list.filter(nullable);
      const own = parts ?? empties.map((name) => `${t(name)} is not null`);
      // Postgres lets any number of rows share a tuple once one of its columns is empty. Whether that
      // is what the rule means cannot be read from the notation, so it has to be said.
      if (parts !== null && empties.length > 0 && found?.nulls === undefined) {
        fail(
          table.name,
          `the unique rule "${item}" includes the optional column(s) ${empties.join(', ')}: say in the hints whether two empty values clash (nulls: 'same') or not (nulls: 'distinct')`,
        );
        continue;
      }
      const target = (name) =>
        parts !== null && found?.nulls === 'same' && empties.includes(name)
          ? `sql\`coalesce(${t(name)}, ${emptyValue(byName.get(name), table.name)})\``
          : `t.${camel(name)}`;
      // `forEver`: the rule also holds against deleted rows (an outside service's event id, a token).
      extra.push(
        `uniqueIndex(${quote(named(found?.name ?? nameFrom(table, list, 'uq')))}).on(${list
          .map(target)
          .join(', ')})${found?.forEver ? '' : predicateCode(own, base)}`,
      );
    }
  }

  // ---- Index: lines
  for (const item of table.index) {
    const found = hintFor(item);
    if (found && (found.code || found.sql || found.note || found.service)) {
      applyHint(found);
      takeSql(found);
      continue;
    }
    let match;
    if ((match = item.match(/^\(([a-z_0-9, ]+)\)(.*)$/))) {
      const list = match[1].split(',').map((name) => name.trim());
      if (!columnsExist(list, `index "${item}"`)) continue;
      let predicate = '';
      if (found?.where !== undefined) predicate = found.where ? `.where(sql\`${found.where}\`)` : '';
      else if (match[2].trim() !== '') {
        fail(table.name, `cannot read the condition of the index "${item}" (give \`where\` in the hints)`);
        continue;
      }
      extra.push(
        `index(${quote(named(nameFrom(table, list, 'idx')))}).on(${list
          .map((name) => `t.${camel(name)}`)
          .join(', ')})${predicate}`,
      );
    } else if ((match = item.match(/^trigram on (.+)$/))) {
      const list = [...match[1].matchAll(/`([a-z_0-9]+)`/g)].map((found2) => found2[1]);
      if (!columnsExist(list, `index "${item}"`)) continue;
      for (const name of list) {
        extra.push(
          `index(${quote(named(`${table.name}_${name}_trgm`))}).using('gin', sql\`${t(name)} gin_trgm_ops\`)`,
        );
      }
    } else if ((match = item.match(/^full-text on (.+)$/))) {
      const list = [...match[1].matchAll(/`([a-z_0-9]+)`/g)].map((found2) => found2[1]);
      if (!columnsExist(list, `index "${item}"`)) continue;
      const document = list.map((name) => `coalesce(${t(name)}, '')`).join(" || ' ' || ");
      extra.push(
        `index(${quote(named(`${table.name}_search`))}).using('gin', sql\`to_tsvector('simple', ${document})\`)`,
      );
    } else if ((match = item.match(/^GIN on `([a-z_0-9]+)`$/))) {
      if (!columnsExist([match[1]], `index "${item}"`)) continue;
      extra.push(`index(${quote(named(`${table.name}_${match[1]}_gin`))}).using('gin', t.${camel(match[1])})`);
    } else fail(table.name, `cannot read the index "${item}" (account for it in the hints)`);
  }

  // ---- Check: lines and free prose under the table
  for (const item of [...table.check, ...table.other]) {
    const found = hintFor(item);
    if (!found) {
      fail(table.name, `nothing accounts for the line "${item}" (hints: code, sql, service or note)`);
      continue;
    }
    applyHint(found);
    takeSql(found);
  }
  for (const entry of lineHints)
    if (!usedLineHints.has(entry)) fail(table.name, `hint line "${entry.match}" matches nothing in the spec`);

  for (const code of hint.extra ?? []) extra.push(code);

  const forward = columns.filter((column) => column.forward);
  return {
    spec,
    table,
    name: table.name,
    constName: camel(table.name),
    entityName: hint.entity ?? pascal(singularOf(table.name)),
    base,
    meta,
    columns,
    extra,
    customSql,
    forward,
    fixture: hint.fixture,
    sample: hint.sample,
    description: [table.description, hint.note].filter(Boolean).join(' '),
  };
}

// ---------------------------------------------------------------------------------------------
// Writing files
// ---------------------------------------------------------------------------------------------

const header = (spec) =>
  `// Generated by docs/plan/_tools/scaffold.mjs from docs/plan/10-modules/${spec.file}.\n` +
  `// Do not edit: change the specification or docs/plan/_tools/scaffold-hints.mjs, then run \`pnpm scaffold\`.\n`;
const plainHeader =
  `// Generated by docs/plan/_tools/scaffold.mjs from the module specifications.\n` +
  `// Do not edit: change a specification or docs/plan/_tools/scaffold-hints.mjs, then run \`pnpm scaffold\`.\n`;

const doc = (lines, indent = '') => {
  const text = lines.filter(Boolean).join('; ').replace(/\*\//g, '*\\/').trim();
  return text ? `${indent}/** ${text} */\n` : '';
};

/** `import { a, b } from 'x';` for the names of `candidates` that `body` really uses. */
function importsUsed(body, from, candidates, typeOnly = []) {
  // Comments and quoted text are prose: a word there is not a use of the import.
  const code = body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/\.\.\./g, ' ');
  const uses = (name) => new RegExp(`(?<![\\w.])${name}(?!\\w)`).test(code);
  const names = [
    ...candidates.filter(uses),
    ...typeOnly.filter(uses).map((name) => `type ${name}`),
  ].sort((a, b) => a.replace(/^type /, '').localeCompare(b.replace(/^type /, '')));
  return names.length ? `import { ${names.join(', ')} } from ${quote(from)};\n` : '';
}

function tableCode(model) {
  const { base } = model;
  const lines = [];
  if (base.spread === 'global') lines.push('id: idColumn(),', '...auditColumns,');
  else if (base.spread === 'append-global')
    lines.push('id: idColumn(),', 'createdAt: timestamptz().notNull().defaultNow(),');
  else lines.push(`${base.spread},`);
  if (base.branch) lines.push('branchId: branchIdColumn(),');
  for (const column of model.columns) {
    lines.push(`${doc(column.notes)}${column.key}: ${column.builder},`);
  }
  const extra = model.extra.length ? `,\n  (t) => [\n${model.extra.map((line) => `    ${line},`).join('\n')}\n  ]` : '';
  return (
    `${doc([model.description])}export const ${model.constName} = defineTable(\n` +
    `  ${quote(model.name)},\n  ${literalCode(model.meta)},\n  {\n${lines.map((line) => `    ${line}`).join('\n')}\n  }${extra},\n);\n`
  );
}

function tableFileCode(spec, models) {
  const body = models.map(tableCode).join('\n');
  const enumConsts = new Set();
  for (const model of models)
    for (const column of model.columns)
      if (column.type.base === 'enum') enumConsts.add(enumOf(model.table, column).constName);

  // Tables of other files that this file's foreign keys point to.
  const imports = new Map();
  for (const model of models) {
    for (const column of model.columns) {
      const target = column.type.target;
      if (!target || column.type.base !== 'uuid' || column.forward) continue;
      if (models.some((other) => other.name === target)) continue;
      const hand = handWritten.get(target);
      const file = hand ? hand.file : tableFile(planTables.get(target).spec);
      const from = relative(moduleDir(spec), file).replace(/\\/g, '/').replace(/\.ts$/, '');
      const list = imports.get(from) ?? new Set();
      list.add(tableConst(target));
      imports.set(from, list);
    }
  }
  const tableImports = [...imports]
    .filter(([, names]) => [...names].some((name) => new RegExp(`\\b${name}\\.id\\b`).test(body)))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([from, names]) => `import { ${[...names].sort().join(', ')} } from ${quote(from.startsWith('.') ? from : `./${from}`)};\n`)
    .join('');

  return (
    header(spec) +
    importsUsed(body, 'drizzle-orm', ['sql'], ['SQL']) +
    importsUsed(
      body,
      'drizzle-orm/pg-core',
      ['bigint', 'boolean', 'check', 'index', 'integer', 'jsonb', 'text', 'uniqueIndex', 'uuid', 'customType'],
      ['AnyPgColumn'],
    ) +
    (enumConsts.size
      ? `import { ${[...enumConsts].sort().join(', ')} } from '@takhti/contracts';\n`
      : '') +
    importsUsed(body, '../../kernel/base-columns', ['appendColumns', 'baseColumns', 'branchIdColumn']) +
    importsUsed(body, '../../kernel/columns', [
      'auditColumns',
      'between',
      'dateStr',
      'decimal',
      'enumText',
      'idColumn',
      'live',
      'nonNegative',
      'paisa',
      'positive',
      'timeStr',
      'timestamptz',
      'tsvector',
      'vector',
    ]) +
    `import { defineTable } from '../../kernel/define-table';\n` +
    importsUsed(body, '../../kernel/policies', ['customPolicy', 'policySql']) +
    tableImports +
    `\n/* The tables of ${spec.code} · ${spec.title}. */\n\n` +
    body
  );
}

function constantsCode(spec, models) {
  const blocks = [];
  for (const model of models) {
    for (const column of model.columns) {
      if (column.type.base !== 'enum') continue;
      const list = enumOf(model.table, column);
      if (list.shared) continue;
      blocks.push(
        `/** \`${model.name}.${column.name}\` */\n` +
          `export const ${list.constName} = [${list.values.map(quote).join(', ')}] as const;\n` +
          `export const ${list.typeName} = z.enum(${list.constName});\n` +
          `export type ${list.typeName} = (typeof ${list.constName})[number];\n`,
      );
    }
  }
  if (blocks.length === 0) return undefined;
  return (
    header(spec) +
    `import { z } from 'zod';\n\n` +
    `/* Allowed-value lists of ${spec.code} · ${spec.title}. The tables build their check constraints from these. */\n\n` +
    blocks.join('\n')
  );
}

function entitiesCode(spec, models) {
  const blocks = [];
  const enumTypes = new Map(); // type name → where it comes from
  for (const model of models) {
    const fields = [];
    const { base } = model;
    if (base.hasVersion) fields.push('...baseEntity,');
    else fields.push('id: z.uuid(),', 'createdAt: z.string(),');
    if (base.branch) fields.push('branchId: z.uuid(),');
    for (const column of model.columns) {
      if (column.type.base === 'enum') {
        const list = enumOf(model.table, column);
        enumTypes.set(list.typeName, list.shared ? 'shared' : 'own');
      }
      fields.push(`${column.key}: ${column.zod},`);
    }
    blocks.push(
      `${doc([`One row of \`${model.name}\`, as the API returns it.`, model.description])}` +
        `export const ${model.entityName} = z.object({\n${fields.map((field) => `  ${field}`).join('\n')}\n});\n` +
        `export type ${model.entityName} = z.output<typeof ${model.entityName}>;\n`,
    );
  }
  const body = blocks.join('\n');
  const own = [...enumTypes].filter(([, from]) => from === 'own').map(([name]) => name).sort();
  const shared = [...enumTypes].filter(([, from]) => from === 'shared').map(([name]) => name).sort();
  return (
    header(spec) +
    `import { z } from 'zod';\n` +
    (shared.length ? `import { ${shared.join(', ')} } from '../../kernel/primitives';\n` : '') +
    importsUsed(body, '../../kernel/resource', ['baseEntity']) +
    (own.length ? `import { ${own.join(', ')} } from './${spec.key}.constants';\n` : '') +
    `\n/* The records of ${spec.code} · ${spec.title}. Inputs (create, update, list) are written with each resource's service. */\n\n` +
    body
  );
}

const sensitiveActions = new Set(hints.sensitiveActions);

function permissionsCode(spec) {
  if (spec.permissions.length === 0) return undefined;
  const rows = spec.permissions.map((permission) => {
    const action = permission.key.split(':')[1];
    const sensitive =
      hints.permissions[permission.key]?.sensitive ?? sensitiveActions.has(action);
    return (
      `  {\n    key: ${quote(permission.key)},\n    label: ${quote(permission.allows)},\n` +
      `    defaultRoles: [${permission.roles.map(quote).join(', ')}],\n` +
      (sensitive ? '    sensitive: true,\n' : '') +
      '  },'
    );
  });
  return (
    header(spec) +
    `import { definePermissions } from '../../kernel/permissions';\n\n` +
    `/** The Permissions table of docs/plan/10-modules/${spec.file}. */\n` +
    `export const ${camel(spec.key)}Permissions = definePermissions(${quote(spec.key)}, [\n${rows.join('\n')}\n] as const);\n`
  );
}

function typeTestCode(spec, models) {
  return (
    header(spec) +
    `import type { ${models.map((model) => model.entityName).sort().join(', ')} } from '@takhti/contracts';\n` +
    `import type { ${models.map((model) => model.constName).sort().join(', ')} } from '@takhti/db';\n` +
    `import type { Agrees, Expect } from '../helpers';\n\n` +
    `/* Each record type of ${spec.code} must have exactly the fields and types of its table's row. Never run; \`pnpm typecheck\` reads it. */\n` +
    `export type ${pascal(spec.key)}Entities = [\n` +
    models.map((model) => `  Expect<Agrees<typeof ${model.constName}, ${model.entityName}>>,`).join('\n') +
    `\n];\n`
  );
}

/** Values the security tests' row generator cannot guess: the ones a generated check would refuse. */
function fixtureCode(model) {
  if (model.fixture) return model.fixture;
  const values = new Map();
  const needed = (column) => column && column.notNull && !column.hasDefault;
  const byName = new Map(model.columns.map((column) => [column.name, column]));
  for (const column of model.columns) {
    if (needed(column) && column.sample !== undefined)
      values.set(column.key, column.sample);
    for (const check of column.checks) {
      if (typeof check === 'string' || !check.compare) continue;
      const other = byName.get(check.compare.other);
      if (!needed(column) || !other) continue;
      const kind = column.type.base;
      const pair =
        kind === 'date'
          ? ['day(index * 3)', 'day(index * 3 + 1)']
          : kind === 'timestamptz'
            ? ['hour(index * 3)', 'hour(index * 3 + 1)']
            : kind === 'time'
              ? ['clock(index)', 'clock(index, 30)']
              : ['1', '2'];
      const [low, high] = pair;
      if (check.compare.operator === '<=') {
        values.set(column.key, low);
        values.set(other.key, high);
      } else {
        values.set(other.key, low);
        values.set(column.key, high);
      }
    }
  }
  // A column that others depend on ("required for `x`") is given a value that asks for none of them.
  const asked = new Map();
  for (const column of model.columns)
    for (const need of column.needs ?? []) {
      const entry = asked.get(need.other) ?? { values: new Set(), all: need.all };
      for (const value of need.values) entry.values.add(value);
      asked.set(need.other, entry);
    }
  for (const [other, { values: taken, all }] of asked) {
    const safe = all.find((value) => !taken.has(value));
    if (safe === undefined)
      fail(model.name, `every value of "${other}" makes another column required: give the table a fixture in the hints`);
    else values.set(camel(other), quote(safe));
  }
  // Values the hints give for single columns, on top of what was worked out.
  for (const [key, code] of Object.entries(model.sample ?? {})) values.set(key, code);
  if (values.size === 0) return undefined;
  const usesIndex = [...values.values()].some((value) => value.includes('index'));
  return `(${usesIndex ? '_place, index' : ''}) => ({ ${[...values].map(([key, value]) => `${key}: ${value}`).join(', ')} })`;
}

// ---------------------------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------------------------

const models = new Map(); // spec → table models
for (const spec of generatedSpecs) models.set(spec, spec.tables.map((table) => analyseTable(spec, table)));
const allModels = [...models.values()].flat();

// Names exported from @takhti/contracts must be unique across hand-written and generated files.
{
  const taken = new Map();
  const contractsDir = join(repoRoot, 'packages/contracts/src');
  const walk = (dir) =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  for (const file of walk(contractsDir).filter((name) => /\.ts$/.test(name) && !/\.test\.ts$/.test(name))) {
    const text = readFileSync(file, 'utf8');
    if (text.startsWith('// Generated by')) continue;
    for (const match of text.matchAll(/^export (?:const|type|interface|function|class) (\w+)/gm))
      taken.set(match[1], relative(repoRoot, file));
  }
  const claim = (name, by) => {
    if (taken.has(name) && taken.get(name) !== by)
      fail(by, `would export "${name}", which ${taken.get(name)} already exports (rename it in the hints)`);
    taken.set(name, by);
  };
  for (const model of allModels) {
    claim(model.entityName, `${model.name} (record)`);
    for (const column of model.columns) {
      if (column.type.base !== 'enum') continue;
      const list = enumOf(model.table, column);
      if (list.shared) continue;
      claim(list.constName, `${model.name}.${column.name}`);
      claim(list.typeName, `${model.name}.${column.name}`);
    }
  }
  for (const spec of generatedSpecs) claim(`${camel(spec.key)}Permissions`, `${spec.code} permissions`);
}

// A value list's constant must not share a name with a table constant: both are imported into the table file.
{
  const tableConsts = new Set([...planTables.keys()].map(camel));
  for (const model of allModels)
    for (const column of model.columns)
      if (column.type.base === 'enum' && tableConsts.has(enumOf(model.table, column).constName))
        fail(`${model.name}.${column.name}`, `its value list would be named like the table "${enumOf(model.table, column).constName}" (rename it in the hints)`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem(s). Nothing was written.`);
  process.exit(1);
}

if (report) {
  for (const [spec, list] of models) {
    console.log(`\n${spec.code} ${spec.key} (wave ${waveOf.get(spec.code)})`);
    for (const model of list) {
      console.log(`  ${model.name} → ${model.entityName}  ${JSON.stringify(model.meta)}`);
      for (const line of model.extra) console.log(`      ${line}`);
      for (const column of model.forward) console.log(`      (waiting) ${column.name} → ${column.forward}`);
    }
  }
  process.exit(0);
}

const files = new Map(); // absolute path → content
for (const [spec, list] of models) {
  const contracts = join(repoRoot, 'packages/contracts/src/modules', spec.key);
  const constants = constantsCode(spec, list);
  if (constants) files.set(join(contracts, `${spec.key}.constants.ts`), constants);
  files.set(join(contracts, `${spec.key}.entities.ts`), entitiesCode(spec, list));
  const permissions = permissionsCode(spec);
  if (permissions) files.set(join(contracts, `${spec.key}.permissions.ts`), permissions);
  files.set(tableFile(spec), tableFileCode(spec, list));
  files.set(join(repoRoot, 'tests/types/entities', `${spec.key}.ts`), typeTestCode(spec, list));
}

{
  const contractLines = [];
  const permissionNames = [];
  for (const [spec, list] of models) {
    if (constantsCode(spec, list)) contractLines.push(`export * from './${spec.key}/${spec.key}.constants';`);
    contractLines.push(`export * from './${spec.key}/${spec.key}.entities';`);
    if (spec.permissions.length) {
      contractLines.push(`export * from './${spec.key}/${spec.key}.permissions';`);
      permissionNames.push([`${camel(spec.key)}Permissions`, `./${spec.key}/${spec.key}.permissions`]);
    }
  }
  files.set(
    join(repoRoot, 'packages/contracts/src/modules/generated.ts'),
    plainHeader +
      permissionNames.map(([name, from]) => `import { ${name} } from ${quote(from)};`).join('\n') +
      `\n\n${contractLines.join('\n')}\n\n` +
      `/** The permission lists of every generated module, for the catalogue. */\n` +
      `export const generatedPermissionModules = [\n${permissionNames.map(([name]) => `  ${name},`).join('\n')}\n] as const;\n`,
  );
  files.set(
    join(repoRoot, 'packages/db/src/schema/generated.ts'),
    plainHeader +
      `// Waves 1 to ${throughWave}.\n` +
      [...models.keys()].map((spec) => `export * from './${spec.key}/${spec.key}.table';`).join('\n') +
      '\n',
  );

  const fixtures = allModels
    .map((model) => [model.name, fixtureCode(model)])
    .filter(([, code]) => code);
  const fixtureBody = fixtures.map(([name, code]) => `  ${name}: ${code},`).join('\n');
  // Only the helpers the rows use are written, so the file has nothing unused in it.
  const fixtureHelpers = [
    [
      'day',
      `/** A date \`days\` after 1 January 2026. Rows get ranges that never overlap. */\n` +
        `const day = (days: number) => new Date(Date.UTC(2026, 0, 1 + days)).toISOString().slice(0, 10);\n`,
    ],
    [
      'firstOfMonth',
      `/** The first day of a month, \`months\` after January 2026. */\n` +
        `const firstOfMonth = (months: number) =>\n  \`\${2026 + Math.floor(months / 12)}-\${String(1 + (months % 12)).padStart(2, '0')}-01\`;\n`,
    ],
    [
      'hour',
      `/** A moment \`hours\` after the start of 2026. */\n` +
        `const hour = (hours: number) => new Date(Date.UTC(2026, 0, 1, hours)).toISOString();\n`,
    ],
    [
      'clock',
      `/** A time of day: 06:00 plus \`hours\`, with minutes. */\n` +
        `const clock = (hours: number, minutes = 0) =>\n  \`\${String(6 + (hours % 17)).padStart(2, '0')}:\${String(minutes).padStart(2, '0')}\`;\n`,
    ],
  ]
    .filter(([name]) => new RegExp(`\\b${name}\\(`).test(fixtureBody))
    .map(([, code]) => code)
    .join('');
  files.set(
    join(repoRoot, 'tests/api/security/rls-fixtures.generated.ts'),
    plainHeader +
      `import type { FixtureOverrides } from '../../helpers/rls';\n\n` +
      `/* Values that satisfy the check constraints the generator wrote, for the security tests' row generator. */\n\n` +
      fixtureHelpers +
      `\nexport const generatedFixtures: FixtureOverrides = {\n${fixtureBody}\n};\n`,
  );

  for (let wave = 1; wave <= throughWave; wave++) {
    const statements = allModels
      .filter((model) => waveOf.get(model.spec.code) === wave && model.customSql.length)
      .map((model) => `-- ${model.name}\n${model.customSql.map((statement) => `${statement.trim().replace(/;$/, '')};`).join('\n')}`);
    const extra = hints.waveSql?.[wave] ?? [];
    if (statements.length === 0 && extra.length === 0) continue;
    files.set(
      join(repoRoot, 'packages/db/src/custom-sql', `wave-${wave}.sql`),
      `-- Generated by docs/plan/_tools/scaffold.mjs. Do not edit: change docs/plan/_tools/scaffold-hints.mjs.\n` +
        `-- What Drizzle cannot express for Wave ${wave}. \`pnpm db:generate\` is followed by appending this file to the wave's migration.\n\n` +
        [...statements, ...extra.map((statement) => `${statement.trim().replace(/;$/, '')};`)].join('\n\n') +
        '\n',
    );
  }
}

const stale = [];
let written = 0;
for (const [file, raw] of files) {
  let content = raw;
  if (/\.ts$/.test(file)) {
    const options = { ...(await prettier.resolveConfig(file)), filepath: file };
    // Prettier does not always settle in one pass on long lines.
    for (let pass = 0; pass < 3; pass++) {
      const next = await prettier.format(content, options);
      if (next === content) break;
      content = next;
    }
  }
  const current = existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : undefined;
  if (current === content) continue;
  if (checkOnly) {
    stale.push(relative(repoRoot, file));
    continue;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  written++;
}

if (checkOnly) {
  if (stale.length) {
    console.error(`Out of date (run \`pnpm scaffold\`):\n${stale.map((file) => `  ${file}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`Generated files are up to date: ${files.size} file(s), ${allModels.length} table(s).`);
} else {
  const waiting = allModels.reduce((sum, model) => sum + model.forward.length, 0);
  console.log(
    `${allModels.length} table(s) in ${generatedSpecs.length} module(s), waves 1 to ${throughWave}: ${written} file(s) written, ${files.size - written} unchanged. ${waiting} foreign key(s) wait for later waves.`,
  );
}

/*
 * Compares the tables written in code with the tables written in the plan.
 *
 *   pnpm db:verify-plan
 *
 * For every module that has at least one table in code, each of its tables in the plan must exist
 * with the same scope, modifiers, columns, column types, enum values and foreign keys; and for every
 * module that declares permissions, their keys and default roles must be the plan's.
 * A foreign key to a table of a later wave is expected to be a plain column until that wave lands.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { modules, permissionCatalogue } from '@takhti/contracts';
import '../schema';
import { registeredTables, type RegisteredTable } from '../registry';

interface PlanColumn {
  name: string;
  type: string;
}
interface PlanTable {
  name: string;
  module: string;
  scope: string;
  modifiers: string[];
  columns: PlanColumn[];
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const planFile = resolve(root, 'docs/plan/_tools/out/plan.json');

interface PlanPermission {
  key: string;
  module: string;
  roles: string[];
}

function loadPlan(): { tables: PlanTable[]; permissions: PlanPermission[] } {
  execFileSync(
    process.execPath,
    [resolve(root, 'docs/plan/_tools/check.mjs'), '--json', '--no-write'],
    {
      cwd: root,
      stdio: 'ignore',
    },
  );
  if (!existsSync(planFile)) throw new Error(`The plan checker did not write ${planFile}`);
  return JSON.parse(readFileSync(planFile, 'utf8')) as {
    tables: PlanTable[];
    permissions: PlanPermission[];
  };
}

/** Foreign keys the plan states in words, because its `→` notation covers uuid columns only. */
const statedInWords = new Set(['role_permissions.permission_key']);

/** Columns every table may carry without the plan listing them. */
const baseColumnNames = new Set([
  'id',
  'org_id',
  'version',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'deleted_at',
]);

const snake = (name: string) => name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/** The Postgres type a plan type stands for. */
function expectedSqlType(planType: string): string {
  const base = planType.replace(/\s*→.*$/, '').trim();
  if (base.startsWith('enum(')) return 'text';
  const fixed: Record<string, string> = {
    text: 'text',
    int: 'integer',
    bigint: 'bigint',
    bool: 'boolean',
    date: 'date',
    time: 'time',
    timestamptz: 'timestamp with time zone',
    jsonb: 'jsonb',
    uuid: 'uuid',
    paisa: 'bigint',
    tsvector: 'tsvector',
    vector: 'vector',
    'uuid[]': 'uuid[]',
    'text[]': 'text[]',
    'int[]': 'integer[]',
    'paisa[]': 'bigint[]',
    'real[]': 'real[]',
  };
  if (base in fixed) return fixed[base] as string;
  if (/^numeric\(\d+,\s*\d+\)$/.test(base)) return base.replace(/\s/g, '');
  throw new Error(`Unknown plan type "${planType}"`);
}

function expectedModifiers(table: RegisteredTable): string[] {
  const list: string[] = [];
  if (table.family)
    list.push(table.family === 'studentId' ? '+family' : `+family(${snake(table.family)})`);
  if (table.household)
    list.push(table.householdColumn ? `+household(${snake(table.householdColumn)})` : '+household');
  if (table.self) list.push(table.self === 'userId' ? '+self' : `+self(${snake(table.self)})`);
  if (table.cap) list.push(`+cap(${table.cap})`);
  if (table.appendOnly) list.push('append-only');
  return list;
}

const loaded = loadPlan();
const plan = loaded.tables;
const planByName = new Map(plan.map((table) => [table.name, table]));
const code = registeredTables();
const codeByName = new Map(code.map((table) => [table.name, table]));
const modulesInCode = new Set(code.map((table) => table.module));

const problems: string[] = [];
let pendingForeignKeys = 0;

for (const planTable of plan) {
  if (
    modulesInCode.has(planTable.module as RegisteredTable['module']) &&
    !codeByName.has(planTable.name)
  ) {
    problems.push(`${planTable.name}: in the plan (${planTable.module}) but not in code`);
  }
}

for (const table of code) {
  const planTable = planByName.get(table.name);
  if (!planTable) {
    problems.push(`${table.name}: in code but not in the plan`);
    continue;
  }
  const at = (message: string) => problems.push(`${table.name}: ${message}`);
  if (planTable.module !== table.module)
    at(`module is ${table.module} in code, ${planTable.module} in the plan`);
  if (planTable.scope !== table.scope)
    at(`scope is "${table.scope}" in code, "${planTable.scope}" in the plan`);

  const wantModifiers = [...planTable.modifiers].sort().join(' ');
  const haveModifiers = expectedModifiers(table).sort().join(' ');
  if (wantModifiers !== haveModifiers)
    at(`modifiers are "${haveModifiers}" in code, "${wantModifiers}" in the plan`);

  const config = getTableConfig(table.table);
  if (config.name !== table.name)
    at(`registered as "${table.name}" but the database name is "${config.name}"`);
  if (!config.enableRLS && config.policies.length === 0)
    at('has no policy, so row-level security would be off');

  const columns = new Map(config.columns.map((column) => [column.name, column]));
  const foreignKeys = new Map<string, string>();
  for (const foreignKey of config.foreignKeys) {
    const reference = foreignKey.reference();
    const [column] = reference.columns;
    if (reference.columns.length === 1 && column)
      foreignKeys.set(column.name, getTableConfig(reference.foreignTable).name);
  }

  const planned = new Set(planTable.columns.map((column) => column.name));
  if (table.scope === 'branch') planned.add('branch_id');

  for (const planColumn of planTable.columns) {
    const column = columns.get(planColumn.name);
    if (!column) {
      at(`column "${planColumn.name}" (${planColumn.type}) is missing`);
      continue;
    }
    const want = expectedSqlType(planColumn.type);
    const have =
      column.getSQLType().replace(/,\s+/g, ',') +
      '[]'.repeat((column as { dimensions?: number }).dimensions ?? 0);
    if (want !== have)
      at(`column "${planColumn.name}" is ${have}, the plan says ${planColumn.type}`);

    const enumMatch = planColumn.type.match(/^enum\((.*)\)$/);
    if (enumMatch) {
      const wantValues = (enumMatch[1] ?? '').split(',').map((value) => value.trim());
      const haveValues = (column as { enumValues?: readonly string[] }).enumValues ?? [];
      if (wantValues.join(',') !== haveValues.join(',')) {
        at(
          `column "${planColumn.name}" allows [${haveValues.join(', ')}], the plan says [${wantValues.join(', ')}]`,
        );
      }
    }

    const target = planColumn.type.match(/→\s*(\S+)$/)?.[1];
    const actualTarget = foreignKeys.get(planColumn.name);
    if (target && codeByName.has(target)) {
      if (actualTarget !== target)
        at(
          `column "${planColumn.name}" should reference ${target}${actualTarget ? `, not ${actualTarget}` : ''}`,
        );
    } else if (target) {
      pendingForeignKeys += 1;
      if (actualTarget)
        at(`column "${planColumn.name}" references ${actualTarget}, but the plan says ${target}`);
    } else if (actualTarget && !statedInWords.has(`${table.name}.${planColumn.name}`)) {
      at(`column "${planColumn.name}" references ${actualTarget}, which the plan does not say`);
    }
  }

  for (const name of columns.keys()) {
    if (!planned.has(name) && !baseColumnNames.has(name)) at(`column "${name}" is not in the plan`);
  }
}

// ---- permissions: for every module that declares any, the keys and the default roles must be the plan's.
const moduleCode = new Map<string, string>(modules.map((module) => [module.key, module.code]));
const codePermissions = new Map(
  permissionCatalogue.map((permission) => [
    permission.key as string,
    {
      module: moduleCode.get(permission.module) ?? permission.module,
      roles: [...permission.defaultRoles].sort().join(', '),
    },
  ]),
);
const modulesWithPermissions = new Set([...codePermissions.values()].map((entry) => entry.module));
const planPermissionKeys = new Set(loaded.permissions.map((permission) => permission.key));
for (const permission of loaded.permissions) {
  if (!modulesWithPermissions.has(permission.module)) continue;
  const inCode = codePermissions.get(permission.key);
  if (!inCode) {
    problems.push(
      `${permission.key}: a permission of ${permission.module} in the plan, not in code`,
    );
    continue;
  }
  if (inCode.module !== permission.module)
    problems.push(
      `${permission.key}: belongs to ${inCode.module} in code, ${permission.module} in the plan`,
    );
  const wanted = [...permission.roles].sort().join(', ');
  if (inCode.roles !== wanted)
    problems.push(
      `${permission.key}: default roles are [${inCode.roles}] in code, [${wanted}] in the plan`,
    );
}
for (const key of codePermissions.keys()) {
  if (!planPermissionKeys.has(key)) problems.push(`${key}: a permission in code, not in the plan`);
}

const summary = `${code.length} tables in code, ${plan.length} in the plan, ${pendingForeignKeys} foreign keys waiting for later waves; ${codePermissions.size} of ${loaded.permissions.length} permissions`;
if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} difference(s). ${summary}.`);
  process.exit(1);
}
console.log(`Code matches the plan. ${summary}.`);

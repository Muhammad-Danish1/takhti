import { getColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

/*
 * Every table, with the scope its module spec gives it and who may do what with its rows.
 *
 * For tables declared with `defineTable`, this entry is also what the row-level-security policies
 * are built from, so the description and the policies cannot disagree. Three more things read it:
 * the generated security tests (which prove the database really behaves this way), `pnpm
 * db:verify-plan` (which compares it with the plan) and the database conventions tests.
 * A table that is not registered fails all of them.
 */

export type TableScope = 'global' | 'platform' | 'org' | 'branch';

/**
 * What a group of users may do with the rows they can reach.
 * `read` select · `insert` insert only · `append` select and insert · `update` select and update ·
 * `write` select, insert, update and delete.
 */
export type Access = 'none' | 'read' | 'insert' | 'append' | 'update' | 'write';

/**
 * Column values a row must have for a rule to apply: `{ status: 'published' }`,
 * `{ status: ['pending', 'returned'] }`, `{ isShared: true }`, or `{ publishedAt: { set: true } }`
 * for "once this column has a value". Keys are column names as written in the table file.
 * Several keys must all hold.
 */
export type When = Readonly<Record<string, WhenValue>>;
export type WhenValue = string | boolean | readonly string[] | { readonly set: true };

/** Whether a condition names a list of allowed values. */
export const isValueList = (value: WhenValue): value is readonly string[] => Array.isArray(value);

/**
 * A rule finer than an `Access` word. Each operation may be limited to rows in a certain state:
 * reading, changing and removing look at the row as it is; adding looks at the row being added
 * ("a family may add a gate pass only as `requested`").
 */
export interface Rule {
  read?: boolean | When;
  insert?: boolean | When;
  update?: boolean | When;
  delete?: boolean | When;
}

export type AccessRule = Access | Rule;

export interface TableMeta {
  /** The module that owns the table, as in the plan: `M02`. */
  module: `M${number}${number}`;
  scope: TableScope;
  /** The column holding the organisation id: `orgId` unless stated (`id` on the organisations table). */
  orgColumn?: string;
  /** What staff of the organisation may do. Default: `write` on `org` and `branch` tables, `read` on `global`, `none` on `platform`. */
  staff?: AccessRule;
  /** What every member of the organisation may do, families included. Default: `none`; `read` on `global` tables. */
  member?: AccessRule;
  /** `+family`: the column holding the student id (`studentId` unless stated; `id` for the students table). */
  family?: string;
  /** With `+family`: what a guardian or student may do with rows about their own students. Default `read`. */
  familyRule?: AccessRule;
  /** `+household`: reachable by the family the row belongs to. */
  household?: boolean;
  /** With `+household`: the column holding the family id: `familyId` unless stated (`id` on the families table). */
  householdColumn?: string;
  /** With `+household`: what a guardian or student may do with their family's rows. Default `read`. */
  householdRule?: AccessRule;
  /**
   * The column holding the id of the guardian a row is about (`id` on the guardians table).
   * That guardian, signed in, may reach the row. Stated in a `Policy:` line of the spec.
   */
  guardian?: string;
  /** With `guardian`: what that guardian may do. Default `read`. */
  guardianRule?: AccessRule;
  /** `+self`: the column holding the owning user's id (`userId` unless stated). */
  self?: string;
  /** With `+self`: what the owner may do with their own rows. Default `write`. */
  selfAccess?: AccessRule;
  /** With `+self` on an organisation table: the owner reaches their rows in every organisation, not only the one signed in to. */
  selfAcrossOrgs?: boolean;
  /** `+cap(name)`: staff need this capability. */
  cap?: 'hr' | 'payroll' | 'health' | 'counselling' | 'papers';
  /** With `+cap`: the column holding the staff id of the person the row is about, who may always reach it. */
  capOwner?: string;
  /** No update or delete, by anyone, enforced by a trigger as well as by the absence of a policy. */
  appendOnly?: boolean;
  /**
   * The table has a hand-written policy the rules above cannot describe (stated in a `Policy:` line of its spec).
   * The generated tests still prove organisation isolation; `tests/api/security/custom-policies.test.ts` proves the rest.
   */
  custom?: boolean;
}

export interface RegisteredTable extends TableMeta {
  /** The table's name in the database. */
  name: string;
  table: PgTable;
}

const tables = new Map<string, RegisteredTable>();

export function registerTable<T extends PgTable>(table: T, name: string, meta: TableMeta): T {
  if (tables.has(name)) throw new Error(`Table "${name}" is registered twice`);
  assertColumns(table, name, meta);
  tables.set(name, { ...meta, name, table });
  return table;
}

/** A rule with every part spelt out. */
export interface ResolvedRule {
  read: boolean | When;
  insert: boolean | When;
  update: boolean | When;
  delete: boolean | When;
}

export interface ResolvedRules {
  staff: ResolvedRule;
  member: ResolvedRule;
  family?: ResolvedRule & { column: string };
  household?: ResolvedRule & { column: string };
  guardian?: ResolvedRule & { column: string };
  self?: ResolvedRule & { column: string; acrossOrgs: boolean };
}

const words: Record<Access, ResolvedRule> = {
  none: { read: false, insert: false, update: false, delete: false },
  read: { read: true, insert: false, update: false, delete: false },
  insert: { read: false, insert: true, update: false, delete: false },
  append: { read: true, insert: true, update: false, delete: false },
  update: { read: true, insert: false, update: true, delete: false },
  write: { read: true, insert: true, update: true, delete: true },
};

const resolve = (rule: AccessRule): ResolvedRule =>
  typeof rule === 'string'
    ? words[rule]
    : {
        read: rule.read ?? false,
        insert: rule.insert ?? false,
        update: rule.update ?? false,
        delete: rule.delete ?? false,
      };

/** Who may do what, once the defaults for the table's scope are applied. */
export function resolveRules(meta: TableMeta): ResolvedRules {
  const byScope: Record<TableScope, { staff: Access; member: Access }> = {
    global: { staff: 'read', member: 'read' },
    platform: { staff: 'none', member: 'none' },
    org: { staff: 'write', member: 'none' },
    branch: { staff: 'write', member: 'none' },
  };
  const defaults = byScope[meta.scope];
  return {
    staff: resolve(meta.staff ?? defaults.staff),
    member: resolve(meta.member ?? defaults.member),
    ...(meta.family && { family: { column: meta.family, ...resolve(meta.familyRule ?? 'read') } }),
    ...(meta.household && {
      household: {
        column: meta.householdColumn ?? 'familyId',
        ...resolve(meta.householdRule ?? 'read'),
      },
    }),
    ...(meta.guardian && {
      guardian: { column: meta.guardian, ...resolve(meta.guardianRule ?? 'read') },
    }),
    ...(meta.self && {
      self: {
        column: meta.self,
        acrossOrgs: meta.selfAcrossOrgs === true,
        ...resolve(meta.selfAccess ?? 'write'),
      },
    }),
  };
}

/** Every `When` named anywhere in a table's rules. */
export function conditionsOf(rules: ResolvedRules): When[] {
  const found: When[] = [];
  for (const rule of [
    rules.staff,
    rules.member,
    rules.family,
    rules.household,
    rules.guardian,
    rules.self,
  ]) {
    if (!rule) continue;
    for (const part of [rule.read, rule.insert, rule.update, rule.delete]) {
      if (typeof part === 'object') found.push(part);
    }
  }
  return found;
}

/**
 * The columns a table's scope and modifiers rely on must exist. This also catches the one failure that
 * would otherwise be silent: a circular import that leaves `baseColumns` empty while a table file loads.
 */
function assertColumns(table: PgTable, name: string, meta: TableMeta): void {
  const columns = getColumns(table) as Record<string, unknown>;
  const needed: [string, string][] = [];
  if (meta.scope === 'org' || meta.scope === 'branch')
    needed.push([meta.orgColumn ?? 'orgId', `scope "${meta.scope}"`]);
  if (meta.scope === 'branch') needed.push(['branchId', 'scope "branch"']);
  if (meta.family) needed.push([meta.family, '+family']);
  if (meta.household) needed.push([meta.householdColumn ?? 'familyId', '+household']);
  if (meta.guardian) needed.push([meta.guardian, 'a guardian rule']);
  if (meta.self) needed.push([meta.self, '+self']);
  if (meta.capOwner) needed.push([meta.capOwner, '+cap owner']);
  for (const condition of conditionsOf(resolveRules(meta))) {
    for (const column of Object.keys(condition)) needed.push([column, 'a rule condition']);
  }
  for (const [column, reason] of needed) {
    if (!(column in columns))
      throw new Error(`Table "${name}" is registered with ${reason} but has no "${column}" column`);
  }
  if (meta.capOwner && !meta.cap)
    throw new Error(`Table "${name}" names a capability owner but no capability`);
  if (meta.selfAccess && !meta.self)
    throw new Error(`Table "${name}" sets selfAccess but has no +self column`);
  if (meta.familyRule && !meta.family)
    throw new Error(`Table "${name}" sets familyRule but has no +family column`);
  if ((meta.householdRule || meta.householdColumn) && !meta.household)
    throw new Error(`Table "${name}" sets a household rule or column but is not +household`);
  if (meta.guardianRule && !meta.guardian)
    throw new Error(`Table "${name}" sets guardianRule but names no guardian column`);
}

/** Every registered table, in registration order. Import `./schema` first so the tables have registered. */
export const registeredTables = (): RegisteredTable[] => [...tables.values()];
export const findRegisteredTable = (name: string): RegisteredTable | undefined => tables.get(name);

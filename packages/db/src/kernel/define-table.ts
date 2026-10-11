import { sql, type SQL } from 'drizzle-orm';
import {
  pgPolicy,
  type AnyPgColumn,
  type AnyPgColumnBuilder,
  type PgBuildExtraConfigColumns,
  type PgTableExtraConfigValue,
} from 'drizzle-orm/pg-core';
import { authenticatedRole } from 'drizzle-orm/supabase';
import {
  isValueList,
  registerTable,
  resolveRules,
  type ResolvedRule,
  type TableMeta,
  type When,
} from '../registry';
import { enumChecks, identifier, table } from './columns';

/*
 * `defineTable` declares a table together with who may reach its rows.
 *
 *   export const gatePasses = defineTable(
 *     'gate_passes',
 *     { module: 'M09', scope: 'branch', family: 'studentId', familyRule: 'append' },
 *     { ...baseColumns, branchId: branchIdColumn(), studentId: uuid().notNull()..., ... },
 *     (t) => [index(...), check(...)],
 *   );
 *
 * From the one description (the second argument) it builds the row-level-security policies,
 * adds a check constraint for every allowed-value column, and registers the table, so the policies,
 * the registry and the generated security tests can never describe three different things.
 *
 * The policy templates and what they mean: docs/plan/00-foundation/06-tenancy-roles-and-access.md.
 */

type Columns = Record<string, AnyPgColumn>;

const literal = (value: string | boolean): SQL =>
  typeof value === 'boolean'
    ? sql.raw(value ? 'true' : 'false')
    : sql.raw(`'${value.replace(/'/g, "''")}'`);

/** `status = 'published' and is_shared = true`, for the columns of `t`. */
function whenSql(name: string, t: Columns, when: When): SQL {
  const parts = Object.entries(when).map(([key, value]) => {
    const column = t[key];
    if (!column)
      throw new Error(`Table "${name}": a rule names the column "${key}", which does not exist`);
    if (isValueList(value)) {
      return sql`${column} in (${sql.join(
        value.map((item) => literal(item)),
        sql.raw(', '),
      )})`;
    }
    // `{ set: true }`: the column has a value.
    if (typeof value === 'object') return sql`${column} is not null`;
    return sql`${column} = ${literal(value)}`;
  });
  return sql.join(parts, sql.raw(' and '));
}

/** The policies of one audience: a single `for all` policy when nothing is held back, else one per operation. */
function audiencePolicies(
  name: string,
  audience: string,
  t: Columns,
  base: SQL,
  rule: ResolvedRule,
) {
  const narrowed = (part: boolean | When) =>
    typeof part === 'object' ? sql`${base} and ${whenSql(name, t, part)}` : base;
  const named = (suffix: string) => identifier(`${name}_${audience}${suffix}`);

  if (rule.read === true && rule.insert === true && rule.update === true && rule.delete === true) {
    return [
      pgPolicy(named(''), { for: 'all', to: authenticatedRole, using: base, withCheck: base }),
    ];
  }
  const policies = [];
  if (rule.read) {
    policies.push(
      pgPolicy(named('_read'), {
        for: 'select',
        to: authenticatedRole,
        using: narrowed(rule.read),
      }),
    );
  }
  if (rule.insert) {
    policies.push(
      pgPolicy(named('_insert'), {
        for: 'insert',
        to: authenticatedRole,
        withCheck: narrowed(rule.insert),
      }),
    );
  }
  if (rule.update) {
    // The row must be in the stated condition to be changed; what it is changed to is the service's business.
    policies.push(
      pgPolicy(named('_update'), {
        for: 'update',
        to: authenticatedRole,
        using: narrowed(rule.update),
        withCheck: base,
      }),
    );
  }
  if (rule.delete) {
    policies.push(
      pgPolicy(named('_delete'), {
        for: 'delete',
        to: authenticatedRole,
        using: narrowed(rule.delete),
      }),
    );
  }
  return policies;
}

const isStaff = sql`(select app.is_staff())`;

/** The row-level-security policies a table's registry entry describes. */
export function policiesFor(name: string, t: Columns, meta: TableMeta) {
  const need = (key: string, why: string): AnyPgColumn => {
    const column = t[key];
    if (!column) throw new Error(`Table "${name}" is declared ${why} but has no "${key}" column`);
    return column;
  };
  const rules = resolveRules(meta);
  const policies = [];

  if (meta.scope === 'global') {
    // Everyone signed in may read; only migrations and platform services write.
    policies.push(
      pgPolicy(identifier(`${name}_read`), {
        for: 'select',
        to: authenticatedRole,
        using: sql`true`,
      }),
    );
  } else if (meta.scope === 'platform') {
    // A policy that allows nothing: it switches row-level security on, and the table is then
    // reachable only through the privileged connection (plus the owner of a `+self` row, below).
    policies.push(
      pgPolicy(identifier(`${name}_platform`), {
        for: 'all',
        to: authenticatedRole,
        using: sql`false`,
        withCheck: sql`false`,
      }),
    );
  } else {
    const orgId = need(meta.orgColumn ?? 'orgId', `with scope "${meta.scope}"`);
    const sameOrg = sql`${orgId} = (select app.org_id())`;
    policies.push(
      ...audiencePolicies(name, 'staff', t, sql`${sameOrg} and ${isStaff}`, rules.staff),
      ...audiencePolicies(name, 'member', t, sameOrg, rules.member),
    );

    if (rules.family) {
      const studentId = need(rules.family.column, '+family');
      policies.push(
        ...audiencePolicies(
          name,
          'family',
          t,
          sql`${sameOrg} and ${studentId} = any ((select app.student_ids())::uuid[])`,
          rules.family,
        ),
      );
    }
    if (rules.household) {
      const familyId = need(rules.household.column, '+household');
      policies.push(
        ...audiencePolicies(
          name,
          'household',
          t,
          sql`${sameOrg} and ${familyId} = (select app.family_id())`,
          rules.household,
        ),
      );
    }
    if (rules.guardian) {
      const guardianId = need(rules.guardian.column, 'a guardian rule');
      policies.push(
        ...audiencePolicies(
          name,
          'guardian',
          t,
          sql`${sameOrg} and ${guardianId} = (select app.guardian_id())`,
          rules.guardian,
        ),
      );
    }
    if (meta.scope === 'branch') {
      const branchId = need('branchId', 'with scope "branch"');
      const ownBranch = sql`(not ${isStaff} or (select app.all_branches()) or ${branchId} = any ((select app.branch_ids())::uuid[]))`;
      policies.push(
        pgPolicy(identifier(`${name}_branch`), {
          as: 'restrictive',
          for: 'all',
          to: authenticatedRole,
          using: ownBranch,
          withCheck: ownBranch,
        }),
      );
    }
    if (meta.cap) {
      const own = meta.capOwner
        ? sql` or ${need(meta.capOwner, '+cap owner')} = (select app.staff_id())`
        : sql``;
      const allowed = sql`(not ${isStaff} or (select app.has_cap(${sql.raw(`'${meta.cap}'`)}))${own})`;
      policies.push(
        pgPolicy(identifier(`${name}_cap`), {
          as: 'restrictive',
          for: 'all',
          to: authenticatedRole,
          using: allowed,
          withCheck: allowed,
        }),
      );
    }
  }

  if (rules.self) {
    const userId = need(rules.self.column, '+self');
    const mine = sql`${userId} = (select app.user_id())`;
    const hasOrg = meta.scope === 'org' || meta.scope === 'branch';
    // On an organisation table the row must also belong to the organisation the user is signed in to,
    // unless the table says a person's rows are theirs everywhere (their own memberships).
    const base =
      hasOrg && !rules.self.acrossOrgs
        ? sql`${need(meta.orgColumn ?? 'orgId', '+self')} = (select app.org_id()) and ${mine}`
        : mine;
    policies.push(...audiencePolicies(name, 'self', t, base, rules.self));
  }
  // A table nobody reaches through the application role (survey answers, read only as counts by the
  // service) still needs a policy: without one, row-level security would not be switched on at all.
  if (policies.length === 0) {
    policies.push(
      pgPolicy(identifier(`${name}_closed`), {
        for: 'all',
        to: authenticatedRole,
        using: sql`false`,
        withCheck: sql`false`,
      }),
    );
  }
  return policies;
}

/**
 * Declares and registers a table. `extra` returns the table's own checks and indexes and, for the
 * rare table marked `custom`, its hand-written policies.
 */
export function defineTable<
  TName extends string,
  TColumns extends Record<string, AnyPgColumnBuilder>,
>(
  name: TName,
  meta: TableMeta,
  columns: TColumns,
  extra?: (t: PgBuildExtraConfigColumns<TColumns>) => PgTableExtraConfigValue[],
) {
  const built = table(name, columns, (t) => [
    ...enumChecks(name, t as unknown as Columns),
    ...(extra ? extra(t) : []),
    ...policiesFor(name, t as unknown as Columns, meta),
  ]);
  return registerTable(built, name, meta);
}

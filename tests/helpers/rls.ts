import { randomUUID } from 'node:crypto';
import { getColumns, sql, type SQL } from 'drizzle-orm';
import { getTableConfig, type PgColumn } from 'drizzle-orm/pg-core';
import {
  conditionsOf,
  isValueList,
  resolveRules,
  rowsOf,
  withAdminTx,
  type RegisteredTable,
  type ResolvedRule,
  type Tx,
  type When,
  type WhenValue,
} from '@takhti/db';

/*
 * The engine behind the generated row-level-security tests.
 *
 * For one table it:
 *   1. writes rows in different "places" (own organisation and branch, another branch, another
 *      organisation), with foreign-key checks switched off so no parent rows are needed;
 *   2. acts as a set of users through the same two statements the API uses (`set_config` of the
 *      claims, `set local role authenticated`);
 *   3. records what each user can read, change, remove and add;
 *   4. works out, from the table's entry in the registry alone, what each user should be able to do.
 *
 * The test compares 3 with 4. Everything runs in a transaction that is rolled back.
 * A policy that is missing, or wider than the registry says, shows up as a difference.
 *
 * Where a rule depends on the state of the row ("a family reads it once published"), the whole
 * probe is repeated with the rows in each such state, and once more with the rows in none of them.
 */

// ---------------------------------------------------------------------------------------------
// The cast: two organisations, two branches, families and users
// ---------------------------------------------------------------------------------------------

export const cast = {
  orgA: randomUUID(),
  orgB: randomUUID(),
  branch1: randomUUID(),
  branch2: randomUUID(),
  branchB: randomUUID(),
  student1: randomUUID(),
  student2: randomUUID(),
  studentB: randomUUID(),
  family1: randomUUID(),
  family2: randomUUID(),
  familyB: randomUUID(),
  guardian1: randomUUID(),
  guardian2: randomUUID(),
  guardianB: randomUUID(),
  staff1: randomUUID(),
  staff2: randomUUID(),
  staffB: randomUUID(),
  /** The user who owns the "home" row of a `+self` table. Signed in as a guardian of family 1. */
  userSelf: randomUUID(),
  userOther: randomUUID(),
  userInOrgB: randomUUID(),
};

/** Where a row sits. Every identity column of a table is filled from the row's place. */
export interface Place {
  name: 'home' | 'away' | 'foreign' | 'foreignMine';
  org: string;
  branch: string;
  student: string;
  family: string;
  /** The guardian a row is about, on tables with a guardian rule. */
  guardian: string;
  /** The owner on `+self` tables. */
  user: string;
  /** The staff member a `+cap` row is about. */
  staff: string;
}

const places: Record<Place['name'], Place> = {
  /** Own organisation, own branch, own child, own family, own row. */
  home: {
    name: 'home',
    org: cast.orgA,
    branch: cast.branch1,
    student: cast.student1,
    family: cast.family1,
    guardian: cast.guardian1,
    user: cast.userSelf,
    staff: cast.staff1,
  },
  /** Own organisation, but another branch, another family's child and another user's row. */
  away: {
    name: 'away',
    org: cast.orgA,
    branch: cast.branch2,
    student: cast.student2,
    family: cast.family2,
    guardian: cast.guardian2,
    user: cast.userOther,
    staff: cast.staff2,
  },
  /** Another organisation altogether. */
  foreign: {
    name: 'foreign',
    org: cast.orgB,
    branch: cast.branchB,
    student: cast.studentB,
    family: cast.familyB,
    guardian: cast.guardianB,
    user: cast.userInOrgB,
    staff: cast.staffB,
  },
  /** Another organisation, but a row the home user owns there. */
  foreignMine: {
    name: 'foreignMine',
    org: cast.orgB,
    branch: cast.branchB,
    student: cast.studentB,
    family: cast.familyB,
    guardian: cast.guardianB,
    user: cast.userSelf,
    staff: cast.staffB,
  },
};

export interface Actor {
  name: string;
  staff: boolean;
  org?: string;
  user?: string;
  allBranches: boolean;
  branches: string[];
  students: string[];
  family?: string;
  guardianId?: string;
  staffId?: string;
  caps: string[];
}

const allCaps = ['hr', 'payroll', 'health', 'counselling', 'papers'];

export const actors: Actor[] = [
  {
    name: 'staff with every branch',
    staff: true,
    org: cast.orgA,
    user: randomUUID(),
    allBranches: true,
    branches: [],
    students: [],
    staffId: randomUUID(),
    caps: allCaps,
  },
  {
    name: 'staff of branch 1 only',
    staff: true,
    org: cast.orgA,
    user: randomUUID(),
    allBranches: false,
    branches: [cast.branch1],
    students: [],
    staffId: randomUUID(),
    caps: allCaps,
  },
  {
    name: 'staff without capabilities',
    staff: true,
    org: cast.orgA,
    user: randomUUID(),
    allBranches: true,
    branches: [],
    students: [],
    staffId: cast.staff1,
    caps: [],
  },
  {
    name: 'guardian of family 1',
    staff: false,
    org: cast.orgA,
    user: cast.userSelf,
    allBranches: false,
    branches: [],
    students: [cast.student1],
    family: cast.family1,
    guardianId: cast.guardian1,
    caps: [],
  },
  {
    name: 'guardian of another family',
    staff: false,
    org: cast.orgA,
    user: randomUUID(),
    allBranches: false,
    branches: [],
    students: [randomUUID()],
    family: randomUUID(),
    guardianId: randomUUID(),
    caps: [],
  },
  {
    name: 'staff of another organisation',
    staff: true,
    org: cast.orgB,
    user: randomUUID(),
    allBranches: true,
    branches: [],
    students: [],
    staffId: randomUUID(),
    caps: allCaps,
  },
  {
    name: 'signed in without claims',
    staff: false,
    allBranches: false,
    branches: [],
    students: [],
    caps: [],
  },
];

/** The claims the API would set for this actor. */
export function claimsOf(actor: Actor): Record<string, unknown> {
  if (!actor.org) return {};
  return {
    sub: actor.user,
    role: 'authenticated',
    org_id: actor.org,
    kind: actor.staff ? 'staff' : 'guardian',
    all_branches: actor.allBranches,
    branch_ids: actor.branches,
    student_ids: actor.students,
    ...(actor.staffId && actor.staff && { staff_id: actor.staffId }),
    ...(actor.family && { family_id: actor.family }),
    ...(actor.guardianId && { guardian_id: actor.guardianId }),
    caps: actor.caps,
  };
}

// ---------------------------------------------------------------------------------------------
// What the registry says each user may do
// ---------------------------------------------------------------------------------------------

type Operation = 'read' | 'insert' | 'update' | 'delete';

/** The values a fixture row has in the columns its table's rules look at. */
export type State = Readonly<Record<string, unknown>>;

const hasOrg = (table: RegisteredTable) => table.scope === 'org' || table.scope === 'branch';

const holds = (when: When, state: State): boolean =>
  Object.entries(when).every(([key, wanted]) => {
    if (isValueList(wanted)) return wanted.includes(String(state[key]));
    // `{ set: true }`: the column has a value.
    if (typeof wanted === 'object') return state[key] !== null && state[key] !== undefined;
    return state[key] === wanted;
  });

function allows(rule: ResolvedRule | undefined, operation: Operation, state: State): boolean {
  if (!rule) return false;
  const part = rule[operation];
  return typeof part === 'object' ? holds(part, state) : part;
}

function granted(
  table: RegisteredTable,
  actor: Actor,
  place: Place,
  operation: Operation,
  state: State,
): boolean {
  const rules = resolveRules(table);
  const sameOrg = !hasOrg(table) || (actor.org !== undefined && actor.org === place.org);
  // A `global` table is readable by anyone signed in; on every other table an actor needs an organisation.
  const signedIn = table.scope === 'global' || actor.org !== undefined;

  const byStaff = actor.staff && sameOrg && allows(rules.staff, operation, state);
  const byMember = signedIn && sameOrg && allows(rules.member, operation, state);
  const byFamily =
    sameOrg && actor.students.includes(place.student) && allows(rules.family, operation, state);
  const byHousehold =
    sameOrg &&
    actor.family !== undefined &&
    actor.family === place.family &&
    allows(rules.household, operation, state);
  const byGuardian =
    sameOrg &&
    actor.guardianId !== undefined &&
    actor.guardianId === place.guardian &&
    allows(rules.guardian, operation, state);
  const bySelf =
    !!rules.self &&
    actor.user !== undefined &&
    actor.user === place.user &&
    (!hasOrg(table) || rules.self.acrossOrgs || sameOrg) &&
    allows(rules.self, operation, state);

  const branchAllows =
    table.scope !== 'branch' ||
    !actor.staff ||
    actor.allBranches ||
    actor.branches.includes(place.branch);
  const capAllows =
    !table.cap ||
    !actor.staff ||
    actor.caps.includes(table.cap) ||
    (!!table.capOwner && actor.staffId === place.staff);

  return (
    (byStaff || byMember || byFamily || byHousehold || byGuardian || bySelf) &&
    branchAllows &&
    capAllows
  );
}

/** Whether the registry lets this actor perform the operation on a row in this place and state. */
export function expected(
  table: RegisteredTable,
  actor: Actor,
  place: Place,
  operation: Operation,
  state: State = {},
): boolean {
  if (operation === 'read' || operation === 'insert')
    return granted(table, actor, place, operation, state);
  // Postgres lets a user change or remove only rows that user can also see.
  return (
    granted(table, actor, place, operation, state) && granted(table, actor, place, 'read', state)
  );
}

/** One state the rows are probed in. The first has no label: the state in which no rule's condition holds. */
interface Variant {
  label: string;
  state: State;
}

/** The marker for "this column has a value" among the values a condition may name. */
const SET = Symbol('set');
type Named = string | boolean | typeof SET;

const listOf = (value: WhenValue): readonly Named[] =>
  isValueList(value) ? value : typeof value === 'object' ? [SET] : [value];

/**
 * The states worth probing for a table: one in which none of its rules' conditions holds,
 * then one for every value a condition names. A table without conditions has the one, empty, state.
 */
function variantsOf(table: RegisteredTable): Variant[] {
  const conditions = conditionsOf(resolveRules(table));
  if (conditions.length === 0) return [{ label: '', state: {} }];
  const columns = getColumns(table.table) as Record<string, PgColumn>;

  const named = new Map<string, Set<Named>>();
  for (const when of conditions) {
    for (const [key, value] of Object.entries(when)) {
      const values = named.get(key) ?? new Set<Named>();
      for (const item of listOf(value)) values.add(item);
      named.set(key, values);
    }
  }
  const columnOf = (key: string): PgColumn => {
    const column = columns[key];
    if (!column) throw new Error(`Table "${table.name}" has no column "${key}" (named in a rule)`);
    return column;
  };

  const off: Record<string, unknown> = {};
  for (const [key, values] of named) {
    const column = columnOf(key);
    if (values.has(SET)) {
      // "Has a value" is switched off by leaving the column empty.
      off[key] = null;
      continue;
    }
    const candidates: readonly (string | boolean)[] =
      column.getSQLType() === 'boolean' ? [false, true] : (column.enumValues ?? [`not-${key}`]);
    // Where every possible value is named by some condition there is no "none of them" state; the first value stands in.
    off[key] = candidates.find((candidate) => !values.has(candidate)) ?? candidates[0];
  }

  const variants: Variant[] = [{ label: '', state: off }];
  const seen = new Set<string>();
  for (const when of conditions) {
    const entries = Object.entries(when);
    const longest = Math.max(...entries.map(([, value]) => listOf(value).length));
    for (let choice = 0; choice < longest; choice++) {
      const chosen = entries.map(([key, value]) => {
        const list = listOf(value);
        return [key, list[Math.min(choice, list.length - 1)] as Named] as const;
      });
      const label = chosen
        .map(([key, value]) => `${key}=${value === SET ? 'set' : String(value)}`)
        .join(' and ');
      if (seen.has(label)) continue;
      seen.add(label);
      const state = Object.fromEntries(
        chosen.map(([key, value]) => [key, value === SET ? sample(columnOf(key), 0) : value]),
      );
      variants.push({ label, state: { ...off, ...state } });
    }
  }
  return variants;
}

// ---------------------------------------------------------------------------------------------
// Making a valid row for any table
// ---------------------------------------------------------------------------------------------

/**
 * Values the row generator cannot guess, per table: `(place, index, state) => { column: value }`.
 * `state` holds the values the probe is about to give the columns the table's rules look at, for the
 * rare check constraint that ties another column to them ("an approved row names its approver").
 */
export type FixtureOverrides = Record<
  string,
  (place: Place, index: number, state: State) => Record<string, unknown>
>;

let serial = 0;

function literal(column: PgColumn, value: unknown): SQL {
  const type = column.getSQLType();
  const dimensions = (column as { dimensions?: number }).dimensions ?? 0;
  if (value === null) return sql`null`;
  if (dimensions > 0) return sql`${`{${(value as unknown[]).join(',')}}`}::${sql.raw(`${type}[]`)}`;
  if (type === 'jsonb') return sql`${JSON.stringify(value)}::jsonb`;
  return sql`${value as string | number | boolean}::${sql.raw(type)}`;
}

function sample(column: PgColumn, index: number): unknown {
  const type = column.getSQLType();
  const dimensions = (column as { dimensions?: number }).dimensions ?? 0;
  if (dimensions > 0) return [];
  const values = column.enumValues;
  if (values && values.length > 0) return values[index % values.length];
  if (type === 'uuid') return randomUUID();
  if (type === 'text') return `t${++serial}`;
  // Whole numbers differ from row to row, so rows that must differ in one (a sequence, a level) do.
  if (type === 'integer' || type === 'bigint') return 1 + (index % 4);
  if (type.startsWith('numeric')) return 1;
  if (type === 'boolean') return false;
  if (type === 'timestamp with time zone') return `2026-01-0${(index % 9) + 1}T05:00:00Z`;
  if (type === 'date') return `2026-01-0${(index % 9) + 1}`;
  if (type === 'time') return '08:00';
  if (type === 'jsonb') return {};
  throw new Error(`The row generator does not know the column type "${type}" (${column.name})`);
}

interface FixtureRow {
  place: Place;
  /** The value of the locator column, as text. */
  locator: string;
  insert: SQL;
}

/** The column used to find the fixture rows again: `id` when there is one, else the first column. */
function locatorOf(table: RegisteredTable): PgColumn {
  const columns = getColumns(table.table) as Record<string, PgColumn>;
  const first = Object.values(columns)[0];
  const locator = columns.id ?? first;
  if (!locator) throw new Error(`Table "${table.name}" has no columns`);
  return locator;
}

function buildRow(
  table: RegisteredTable,
  place: Place,
  index: number,
  overrides: FixtureOverrides,
  state: State = {},
): FixtureRow {
  const columns = getColumns(table.table) as Record<string, PgColumn>;
  const identity: Record<string, unknown> = {};
  if (hasOrg(table)) identity[table.orgColumn ?? 'orgId'] = place.org;
  if (table.scope === 'branch') identity.branchId = place.branch;
  if (table.family) identity[table.family] = place.student;
  if (table.household) identity[table.householdColumn ?? 'familyId'] = place.family;
  if (table.guardian) identity[table.guardian] = place.guardian;
  if (table.self) identity[table.self] = place.user;
  if (table.capOwner) identity[table.capOwner] = place.staff;
  const chosen = {
    ...(overrides[table.name]?.(place, index, state) ?? {}),
    ...state,
    ...identity,
  };

  for (const key of Object.keys(chosen)) {
    if (!columns[key])
      throw new Error(
        `Table "${table.name}" has no column "${key}" (named in the registry or the fixture overrides)`,
      );
  }

  const names: SQL[] = [];
  const values: SQL[] = [];
  const locator = locatorOf(table);
  let locatorValue: unknown;
  for (const [key, column] of Object.entries(columns)) {
    // The database works a generated column out itself and refuses a value for it.
    if ((column as { generated?: unknown }).generated) continue;
    let value: unknown;
    if (key in chosen) value = chosen[key];
    else if (column.notNull && !column.hasDefault) value = sample(column, index);
    else if (column === locator) value = sample(column, index);
    else continue;
    if (column === locator) locatorValue = value;
    names.push(sql`${sql.identifier(column.name)}`);
    values.push(literal(column, value));
  }
  return {
    place,
    locator: String(locatorValue),
    insert: sql`insert into ${sql.identifier(table.name)} (${sql.join(names, sql`, `)}) values (${sql.join(values, sql`, `)})`,
  };
}

/** Whether a table holds one row for each organisation: a unique index on the organisation column alone. */
function onePerOrg(table: RegisteredTable): boolean {
  const columns = getColumns(table.table) as Record<string, PgColumn>;
  const orgColumn = columns[table.orgColumn ?? 'orgId']?.name;
  return getTableConfig(table.table).indexes.some(
    (index) =>
      index.config.unique &&
      index.config.columns.length === 1 &&
      (index.config.columns[0] as { name?: string }).name === orgColumn,
  );
}

function placesFor(table: RegisteredTable): Place[] {
  if (!hasOrg(table)) return [places.home, places.away];
  // On the organisations table the organisation id is the row's own id, so one organisation is one row.
  // The same holds for a table of settings that keeps a single row for each organisation.
  if (table.orgColumn === 'id' || onePerOrg(table)) return [places.home, places.foreign];
  // A personal table also gets a row the home user owns in the other organisation: reachable only where the registry says so.
  return table.self
    ? [places.home, places.away, places.foreign, places.foreignMine]
    : [places.home, places.away, places.foreign];
}

// ---------------------------------------------------------------------------------------------
// Acting as a user
// ---------------------------------------------------------------------------------------------

class Undo extends Error {}

/**
 * Runs `work` in a savepoint that is always rolled back; returns its result or the error it threw.
 *
 * The savepoint is released as well as rolled back. A savepoint that is only rolled back stays open,
 * and the next one is then nested inside it: a probe makes dozens of attempts in one transaction, and
 * ending a transaction with that many levels overruns the small stack of the in-process engine.
 */
async function attempt<T>(
  tx: Tx,
  work: (sp: Tx) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  await tx.execute(sql`savepoint attempt`);
  try {
    return { ok: true, value: await work(tx) };
  } catch (error) {
    return { ok: false, error };
  } finally {
    await tx.execute(sql`rollback to savepoint attempt`);
    await tx.execute(sql`release savepoint attempt`);
  }
}

/** The Postgres error code, wherever the driver or Drizzle put it. */
export function sqlState(error: unknown): string | undefined {
  for (
    let e = error, depth = 0;
    typeof e === 'object' && e !== null && depth < 6;
    e = (e as { cause?: unknown }).cause, depth++
  ) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}

export const INSUFFICIENT_PRIVILEGE = '42501';

async function become(tx: Tx, actor: Actor): Promise<void> {
  await tx.execute(
    sql`select set_config('request.jwt.claims', ${JSON.stringify(claimsOf(actor))}, true)`,
  );
  await tx.execute(sql`set local role authenticated`);
}

export interface Sandbox {
  tx: Tx;
  /** Continue as this user, exactly as a request would. */
  as(actor: Actor): Promise<void>;
  /** Continue as the privileged connection again. */
  asAdmin(): Promise<void>;
  /** Runs a statement that may be refused; nothing it did is kept. Gives the rows, or the Postgres error code. */
  attempt<T = Record<string, unknown>>(
    statement: SQL,
  ): Promise<{ rows: T[]; error?: undefined } | { rows?: undefined; error: string }>;
  /** Runs a statement and keeps what it did (until the sandbox ends). */
  run<T = Record<string, unknown>>(statement: SQL): Promise<T[]>;
}

/**
 * For hand-written policy tests: one privileged transaction with foreign-key checks off, rolled back at the end.
 */
export async function sandbox(work: (tools: Sandbox) => Promise<void>): Promise<void> {
  try {
    await withAdminTx(async (tx) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      await work({
        tx,
        as: (actor) => become(tx, actor),
        asAdmin: async () => {
          await tx.execute(sql`reset role`);
        },
        attempt: async <T>(statement: SQL) => {
          const outcome = await attempt(tx, async (sp) => rowsOf<T>(await sp.execute(statement)));
          return outcome.ok
            ? { rows: outcome.value }
            : { error: sqlState(outcome.error) ?? String(outcome.error) };
        },
        run: async <T>(statement: SQL) => rowsOf<T>(await tx.execute(statement)),
      });
      throw new Undo();
    });
  } catch (error) {
    if (!(error instanceof Undo)) throw error;
  }
}

/**
 * What a set of users could do, as `{ "<actor> can read": ["home", "away"], ... }`.
 * On a table whose rules depend on the row's state there is a line per state as well:
 * `"<actor> can read when status=published"`; the plain line is then the state where no condition holds.
 */
export type Report = Record<string, string[]>;

export interface ProbeResult {
  actual: Report;
  expected: Report;
  /** For an append-only table: the error code the privileged connection got when it tried to change and remove a row. */
  appendOnly?: { update: string | undefined; delete: string | undefined };
}

/**
 * Probes one table. For a table marked `custom` only the users outside the organisation are
 * compared, and only against this organisation's rows (they must reach none of them); its own
 * policies are proven by hand-written tests.
 */
export async function probeTable(
  table: RegisteredTable,
  overrides: FixtureOverrides = {},
): Promise<ProbeResult> {
  const actual: Report = {};
  const wanted: Report = {};
  const result: ProbeResult = { actual, expected: wanted };
  const tablePlaces = placesFor(table);
  const locator = locatorOf(table);
  const name = sql.identifier(table.name);
  const column = sql.identifier(locator.name);
  const probed = table.custom ? actors.filter((actor) => actor.org !== cast.orgA) : actors;
  // What an outsider reaches in their own organisation depends on the table's own rules, which only
  // its hand-written tests know. So for such a table only this organisation's rows are reported.
  const reported = (place: Place['name']) => !table.custom || place === 'home' || place === 'away';

  // Each state is probed in a transaction of its own, so rows in two states never meet a unique index together.
  for (const [position, variant] of variantsOf(table).entries()) {
    const line = (actor: Actor, operation: Operation) =>
      variant.label
        ? `${actor.name} can ${operation} when ${variant.label}`
        : `${actor.name} can ${operation}`;

    try {
      await withAdminTx(async (tx) => {
        // Foreign keys are checked by triggers; switching them off lets a row stand without its parents.
        await tx.execute(sql`set local session_replication_role = replica`);
        const rows = tablePlaces.map((place, index) =>
          buildRow(table, place, index, overrides, variant.state),
        );
        for (const row of rows) await tx.execute(row.insert);
        const all = sql`array[${sql.join(
          rows.map((row) => sql`${row.locator}`),
          sql`, `,
        )}]::text[]`;
        const placeOf = new Map(rows.map((row) => [row.locator, row.place.name]));
        const found = (rowsFound: { locator: string }[]) =>
          rowsFound
            .map((row) => placeOf.get(row.locator) ?? '?')
            .filter((place) => place === '?' || reported(place as Place['name']))
            .sort();

        for (const actor of probed) {
          const want = (operation: Operation) =>
            tablePlaces
              .filter((place) => expected(table, actor, place, operation, variant.state))
              .map((place) => place.name)
              .filter(reported)
              .sort();
          await become(tx, actor);

          const read = rowsOf<{ locator: string }>(
            await tx.execute(
              sql`select ${column}::text as locator from ${name} where ${column}::text = any (${all})`,
            ),
          );
          actual[line(actor, 'read')] = found(read);
          wanted[line(actor, 'read')] = want('read');

          const updated = await attempt(tx, async (sp) =>
            rowsOf<{ locator: string }>(
              await sp.execute(
                sql`update ${name} set ${column} = ${column} where ${column}::text = any (${all}) returning ${column}::text as locator`,
              ),
            ),
          );
          actual[line(actor, 'update')] = updated.ok
            ? found(updated.value)
            : [`error ${sqlState(updated.error) ?? String(updated.error)}`];
          wanted[line(actor, 'update')] = want('update');

          const removed = await attempt(tx, async (sp) =>
            rowsOf<{ locator: string }>(
              await sp.execute(
                sql`delete from ${name} where ${column}::text = any (${all}) returning ${column}::text as locator`,
              ),
            ),
          );
          actual[line(actor, 'delete')] = removed.ok
            ? found(removed.value)
            : [`error ${sqlState(removed.error) ?? String(removed.error)}`];
          wanted[line(actor, 'delete')] = want('delete');

          const inserted: string[] = [];
          for (const [index, place] of tablePlaces.entries()) {
            // Row-level security is checked before any constraint, so only its own refusal counts as "denied".
            const row = buildRow(table, place, index + 10, overrides, variant.state);
            const outcome = await attempt(tx, (sp) => sp.execute(row.insert));
            if (
              reported(place.name) &&
              (outcome.ok || sqlState(outcome.error) !== INSUFFICIENT_PRIVILEGE)
            )
              inserted.push(place.name);
          }
          actual[line(actor, 'insert')] = inserted.sort();
          wanted[line(actor, 'insert')] = want('insert');

          await tx.execute(sql`reset role`);
        }

        if (table.appendOnly && position === 0) {
          // Even the privileged connection is refused, and even with ordinary triggers switched off as they are here.
          const first = sql`${rows[0]?.locator ?? ''}`;
          const update = await attempt(tx, (sp) =>
            sp.execute(
              sql`update ${name} set ${column} = ${column} where ${column}::text = ${first}`,
            ),
          );
          const remove = await attempt(tx, (sp) =>
            sp.execute(sql`delete from ${name} where ${column}::text = ${first}`),
          );
          result.appendOnly = {
            update: update.ok ? undefined : sqlState(update.error),
            delete: remove.ok ? undefined : sqlState(remove.error),
          };
        }

        throw new Undo();
      });
    } catch (error) {
      if (!(error instanceof Undo)) throw error;
    }
  }
  return result;
}

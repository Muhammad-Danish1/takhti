# 07 · Backend kernel

The kernel is the set of reusable files every module is built on. It is written once in Phase 0. Seven of its files already exist and pass tests in the [reference skeleton](../../reference/backend-skeleton/); copy them and extend them as described here.

Legend: **✔ exists** = in the skeleton, copy and extend. **new** = write in Phase 0.

## `@takhti/contracts` — `src/kernel/`

### `primitives.ts` — new

Small Zod pieces used by every contract, so a phone number is validated the same way everywhere.

| Export | Accepts | Notes |
|---|---|---|
| `Id` | uuid | |
| `Money` | whole number ≥ 0 | Paisa |
| `SignedMoney` | whole number | For adjustments |
| `DateStr` | `YYYY-MM-DD` | Rejects impossible dates such as 2026-02-30 |
| `TimeStr` | `HH:MM` | |
| `Timestamp` | ISO date-time | |
| `Period` | `YYYY-MM` | |
| `Phone` | Pakistani number | Accepts `03001234567`, `0300-1234567`, `+923001234567`; outputs `+923001234567` |
| `Cnic` | `12345-1234567-1` | Accepts 13 digits with or without dashes; outputs with dashes |
| `Percent` | 0 to 100, two decimals | |
| `Marks` | number ≥ 0, two decimals | |
| `Name` | trimmed, 2 to 120 characters | Collapses repeated spaces |
| `NameUr` | Urdu text, up to 120 | Optional everywhere |
| `ShortText` / `LongText` | up to 200 / 5,000 | Trimmed |
| `Email` | lower-cased email | |
| `Gender`, `BloodGroup`, `Religion`, `Locale` | fixed lists | Lists exported as `const` arrays |

Tests: each primitive with valid, invalid and edge inputs (leap day, leading zeros, Urdu digits, surrounding spaces).

### `resource.ts` — ✔ exists

`baseEntity`, `listQuery()`, `defineResource()`, `IdParams`, `Page<T>` and the type helpers `EntityOf`, `CreateInput`, `CreateData`, `UpdateInput`, `UpdateData`, `ListInput`, `ListData`.

Extend with:

- `BulkResult<T>`: `{ succeeded: T[]; failed: { index: number; code: ErrorCode; message: string; fields? }[] }`.
- `listQuery` gains `pageSize` up to 200 for exports and an optional `cursor`.
- `defineResource` gains `permissions`: the resource's permission list with labels.

### `errors.ts` — ✔ exists

The nine error codes and the response body types. No change.

### `settings.ts` — new

```ts
defineSetting({ key: 'fees.late_fine', scope: 'org' | 'branch', schema, default, label })
```

A typed registry. A setting that is not registered cannot be read or written.

### `events.ts` — new

`defineEvent({ key, category, payload, variables, rules, templates })`, for example `fee.payment-received`. Each module declares its events in `packages/contracts/src/modules/<module>/<module>.events.ts`; `packages/contracts/src/catalogue.ts` gathers them all. Notifications, jobs and webhooks subscribe to events by key. The full shape is in [M37](../10-modules/m37-messaging-hub.md).

## `@takhti/db` — `src/kernel/`

### `columns.ts` — ✔ exists

`table` (from `snakeCase.table`), `baseColumns`, `timestamptz()`. Extend with:

| Export | Purpose |
|---|---|
| `branchColumns` | `baseColumns` plus `branchId` with its foreign key |
| `appendColumns` | `id`, `orgId`, `createdAt`, `createdBy` only |
| `paisa()` | `bigint` in number mode, not null, check `>= 0` |
| `signedPaisa()` | `bigint` without the check |
| `dateStr()` | `date` in string mode |
| `enumText(values)` | `text` with the TypeScript union and a check constraint |
| `percent()`, `marks()` | `numeric` in number mode |

### `policies.ts` — ✔ exists

`orgScoped`, `branchScoped`. Extend with `familyRead(column)`, `householdRead()`, `selfOwned(column)`, `capRestricted(capability, ownerColumn?)`, `globalRead()`, `platformOnly()`, `appendOnly()` exactly as defined in [06](06-tenancy-roles-and-access.md).

### `client.ts` — ✔ exists

| Export | Connection | Use |
|---|---|---|
| `withUserTx(claims, work)` | `DATABASE_URL`, role `takhti_api` | Every request. Sets the claims and `role authenticated` |
| `adminDb` | `DATABASE_ADMIN_URL`, privileged | Migrations, seed, platform services, permission lookups, rate limits, the worker's job claiming |
| `withAdminTx(work)` | privileged | The few system writes listed below |

`takhti_api` is created `noinherit`: a query run outside `withUserTx` has no table rights at all and fails loudly instead of leaking.

**The only code allowed to use the privileged connection:** `kernel/context.ts` (`runAsPlatform`), `kernel/session.ts` and `kernel/permissions.ts` (finding a membership and loading its access, before any transaction for the user exists), `kernel/rate-limit.ts`, `kernel/jobs.ts` (claiming and finishing jobs, schedules), `kernel/idempotency.ts` (cleanup only), platform services (`modules/platform/*`), the seed script and migrations. An ESLint rule forbids importing `adminDb` or `withAdminTx` anywhere else.

By design the privileged connection is never used *inside* a user's transaction: access is loaded and limits are counted before it opens. This also matters for tests, where one in-process session plays both parts.

### First migration — `foundation` (custom SQL)

Migration folders are named by timestamp, so "first" means the earliest. It must run on Supabase's Postgres and on a plain one (the in-process test database), so anything Supabase already provides is created only when missing.

1. Extensions: `pg_trgm` and `btree_gist`, in the `extensions` schema. (`gen_random_uuid()` is built into Postgres; emails are lower-cased by their contract, so `pgcrypto` and `citext` are not needed.)
2. Roles: `authenticated`, `anon` and `service_role` when missing; `takhti_api` (`nologin noinherit`; `pnpm db:migrate` sets its login password from the environment); `grant authenticated to takhti_api`.
3. Schema `app` and the helper functions in [06](06-tenancy-roles-and-access.md).
4. `app.touch_updated_at()`: a safety net that fills `updated_at` only when an update forgot to. `app.forbid_change()`: refuses update and delete on append-only tables, attached as an ALWAYS trigger so it also fires during a bulk load; a delete is allowed only to the retention job, which says so with `set local app.retention_purge`.
5. `app.sync_table_rules(append_only)`: brings every table's triggers in line with those two conventions, and stops the run if any table has row-level security off.
6. Privileges: `authenticated` gets select, insert, update and delete on tables in `public`, never truncate; `anon` gets nothing.

The access-token hook reads the membership tables, so it is a later migration (`wave-0-auth-hook`). It is `security definer`, callable only by the Auth service, never blocks a sign-in, and leaves capabilities out of the token.

### `migrate.ts` — the migration runner

`applyMigrations(target)` is the one way the schema changes: locally (`pnpm db:migrate`), in every test database, and in production. It applies each pending folder in its own transaction, then calls `app.sync_table_rules` with the append-only tables named by the registry, then brings the `permissions` table in line with the catalogue in code. It refuses to continue when an applied migration was edited, when an applied one is missing from the folder, or when a new one sorts before one already applied; and two runs at once wait for each other.

### `provision.ts`

`provisionOrg`, `ensureProfile` and `addMember`: the rows a new school starts with (the organisation, its branches, the built-in roles with their default permissions, its modules, the setup checklist). Used by the seed, the test helpers and the platform's "create organisation" service, so all three make a school the same way.

## `@takhti/core` — `src/kernel/`

### `context.ts` — ✔ exists, extend

```ts
interface Ctx {
  db: Tx;
  actor: Actor;
  requestId: string;
  source: 'api' | 'sync' | 'job' | 'ai';
  now: string;      // ISO timestamp fixed at the start of the unit of work
  today: string;    // Pakistan calendar date for `now`
  log: Logger;      // already tagged with requestId, orgId, userId
}

runAs(actor, meta, work)            // one transaction as a signed-in user
runAsSystem(orgId, meta, work)      // jobs: a system actor confined to one organisation by RLS
runAsPlatform(admin, meta, work)    // Takhti staff: privileged, always audited
```

`runAsSystem` uses `withUserTx` with staff claims for that organisation and all branches, so even a buggy job cannot cross organisations. `runAsPlatform` takes the name of the action and writes it to `platform_audit_log` in the same transaction as the work.

### `session.ts` — new

`actorFor({ userId, membershipId?, tokenVersion? })` turns "this person proved who they are" into an `Actor`, reading everything from the database: which membership (the chosen one, or the only active one), whether it is active, whether the school is, then `loadAccess`. `membershipsOf(userId)` lists a person's schools; `platformAdminFor(userId)` checks Takhti's own staff. The host app only verifies the token and passes the user id.

Tests: claims reach Postgres; a throw rolls back; `now` and `today` are stable inside one unit of work; nested `runAs` is refused.

### `errors.ts` — ✔ exists, extend

`AppError`, `notFound`, `forbidden`, `rule`, plus new `invalid(fields)`, `conflict(message)`, `stale(label)`, `unauthenticated()`, `rateLimited(retryAfterSeconds)`. `toErrorResponse` maps `AppError`, `ZodError` and Postgres codes to the one response shape.

Add a **constraint name → message** map: each module registers friendly text for its unique indexes, so a duplicate admission number says "Admission number is already in use" and points at the field, instead of the generic conflict message.

### `permissions.ts` — ✔ exists, extend

```ts
can(ctx, resource, action): boolean
assertCan(ctx, resource, action): void
loadAccess(membershipId): Promise<Access>      // roles, permissions, branches, children; cached 60 s
invalidateAccess(membershipId | orgId): void   // called when roles or memberships change
```

`owner` and `auditor` are computed as described in [06](06-tenancy-roles-and-access.md).

### `modules.ts` — new

`assertModule(ctx, moduleKey)` and `enabledModules(ctx)`, reading `org_modules` (cached 60 seconds).

### `audit.ts` — ✔ exists, extend

`audit(ctx, entity, action, entityId, { before, after })` stores only the fields that changed. A redaction list (CNIC, B-Form, bank account, tokens) replaces values with `"•••"` in the log. Runs in the caller's transaction.

### `db-service.ts` — ✔ exists, extend

`createDbService(table, config)` gives: `find`, `get`, `list`, `insert`, `insertMany`, `update`, `remove`. Add:

| Addition | Purpose |
|---|---|
| `findMany(ctx, ids)` | Load several rows, in the order asked |
| `exists(ctx, where)`, `count(ctx, where)` | Cheap checks |
| `restore(ctx, id)` | Undo a soft delete |
| `lock(ctx, id)` | `select … for update`, for read-then-write flows such as collecting a fee |
| `config.baseWhere` | A condition added to every read (for example "current academic year") |
| `config.cursor` | Keyset paging for very long lists (ledgers, logs) |

`list` runs the items query and the count query; for tables past a configured size it switches to an estimated count and says so in the page metadata.

### `crud-service.ts` — ✔ exists, extend

`createCrudService({ contract, db, rules, toInsert?, toPatch? })`. Add:

- `events`: `{ created?, updated?, removed? }` event names emitted after the write.
- `scope(ctx)`: an extra condition applied to every read and checked on every write (teacher sections, own children).
- `module`: the module key passed to `assertModule`.

### `http.ts` — ✔ exists, extend

`createRoutes({ authenticate, run })` returns `defineRoute`, `collectionRoutes`, `itemRoutes`. Extend the route spec:

| Option | Effect |
|---|---|
| `access: 'public' \| 'signed-in' \| 'platform' \| 'webhook'` | Default is a signed-in organisation member |
| `idempotent: true` | Requires an `Idempotency-Key` header; see below |
| `rateLimit: { max, windowSeconds, by: 'user' \| 'ip' \| 'org' }` | |
| `raw: true` | Gives the handler the raw body, for webhook signature checks |
| `response: 'json' \| 'file' \| 'stream'` | CSV and PDF downloads |
| `source` | Defaults to `api`; the sync upload sets `sync` |

Every response carries `x-request-id`. Every mutating request that relies on the session cookie must have an `Origin` matching the app (a simple, strong defence against cross-site requests); a request carrying a bearer token is exempt, because another site cannot make a browser send one.

In code the `access` option is four builders, so each handler receives exactly what its kind of caller has: `defineRoute` (a member of a school; the default), `defineUserRoute` (signed in, no school chosen yet), `definePlatformRoute` (Takhti's staff; always audited) and `definePublicRoute` (`kind: 'page' | 'webhook'`). `collectionRoutes`, `itemRoutes`, `restoreRoute` and `bulkRoute` build the standard routes of a resource.

### `idempotency.ts` — new

`withIdempotency(ctx, key, requestHash, work)`.

- First request with a key: runs `work`, stores status and body for 24 hours, in the same transaction.
- Same key, same body: returns the stored response without running `work`.
- Same key, different body: `409 CONFLICT` "This request key was already used for a different request."
- Two identical requests at the same moment: the second waits on the unique index, then receives the first one's stored response.

Tests: double-click, retry after a timeout, key reuse, concurrent duplicates.

### `rate-limit.ts` — new

`limit({ key, max, windowSeconds })` on a `rate_limits` table with an atomic upsert. Counts even when the request later fails. Throws `RATE_LIMITED` with `retry-after`. The interface allows a Redis-backed version in production.

### `sequences.ts` — new

`nextNumber(ctx, key, { branchId?, period?, format })` → `"FV-2610-00412"`. One atomic upsert on `number_sequences`. Runs in the caller's transaction, so a rollback returns the number.

Tests: 50 parallel callers get 50 different consecutive numbers; a rollback leaves no gap.

### `scope.ts` — new

`branchFilter(ctx, column)`, `assertOwnStudent(ctx, studentId)`, `assertBranch(ctx, branchId)`, `assertNotSelf(ctx, userId)`.

`teacherSectionIds(ctx)`, `wingGradeIds(ctx)` and `enrollmentReach(ctx)` read the academic tables, so they are in `packages/core/src/modules/academics/scope.ts`. Each answers `null` (or no condition) for a person who is not limited: a person is limited to their sections only when every role they hold is a teaching role, and to their wing only when they are a section head holding nothing wider. A school's own custom role counts as wider.

### `state-machine.ts` — new

```ts
const voucher = defineMachine({
  unpaid:    ['partial', 'paid', 'cancelled'],
  partial:   ['paid', 'cancelled'],
  paid:      [],
  cancelled: [],
});
voucher.assert(from, to, 'Voucher');   // throws RULE "Voucher cannot go from paid to cancelled"
```

Every status column in the product has one machine, defined beside its contract.

### `money.ts` — new

`rupees(n)`, `formatRs(paisa)`, `roundToRupee(paisa)`, `percentOf(paisa, percent)`, `allocate(total, weights)` (parts always sum to the total), `sum(list)`.

Tests: rounding half up; allocation of Rs 100 across three siblings; no floating-point use anywhere (a lint rule bans `*` and `/` on money outside this file).

### `dates.ts` — new

Pure functions on date strings: `todayPk(now)`, `addDays`, `addMonths`, `diffDays`, `periodOf`, `startOfMonth`, `endOfMonth`, `weekdayOf`, `isWorkingDay(date, weekPattern, holidays)`, `workingDaysBetween`, `ageOn(dob, date)`.

Tests: month ends, leap years, the hour before midnight UTC (which is already tomorrow in Pakistan), year boundaries.

### `settings.ts` — new

`getSetting(ctx, key, branchId?)` returns the branch value, else the organisation value, else the registered default — always parsed by its schema. `setSetting` validates, audits and invalidates the cache.

### `jobs.ts` — new

```ts
defineJob({ name, payload: ZodSchema, retries: 5, backoff: 'exponential', timeoutSeconds: 120,
            handler: (ctx, payload) => Promise<void> })
enqueue(ctx, name, payload, { runAt?, dedupeKey?, priority? })
```

`enqueue` inserts into `jobs` in the caller's transaction. Full design in [13](13-notifications-jobs-and-files.md). The worker's half is in the same file (`claimJobs`, `runClaimedJob`, `reapStuckJobs`, `defineSchedule`, `syncSchedules`, `enqueueDueSchedules`); `cron.ts` evaluates five-field cron expressions in Pakistan time.

### `events.ts` and `notify.ts` — new

`emit(ctx, 'fee.payment-received', payload)` records the event and queues the notifications subscribed to it. See [13](13-notifications-jobs-and-files.md).

### `files.ts` — new

`createUpload`, `confirmUpload`, `signedDownload`, `attach`, `detach`. Enforces size and type limits per purpose. See [13](13-notifications-jobs-and-files.md).

### `approval.ts` — new

`requestApproval(ctx, { entityType, entityId, amount?, summary })`, `decide(ctx, requestId, 'approve' | 'reject', note)`. Policies per organisation decide who approves and above which amount. The requester can never be the approver. Tables in [M00](../10-modules/m00-shared-kernel.md).

### `bulk.ts` — new

`runBulk(ctx, items, work)` runs each item in its own savepoint, so one bad row does not undo the others, and returns a `BulkResult`. Used by promotions, bulk attendance, voucher generation and imports.

### `import.ts` and `export.ts` — new

- **Import** is always two steps: upload and validate into a staging table with an error per row and a preview, then commit only the valid rows. Nothing is written to business tables until the person confirms. A module describes what it can import with `defineImporter`.
- **Export**: a module describes a list with `defineExporter`. Up to 5,000 rows the file is returned at once; above that it becomes a job and the user is notified when the file is ready.
- Both read and write CSV through `csv.ts`, which neutralises a cell that a spreadsheet would run as a formula. XLSX arrives with the spreadsheet library, when the first screen needs it; until then an upload is saved as CSV first.

### `search.ts` — new

`searchCondition(columns, q)` with escaping, and `normaliseUrdu(text)` so that the different keyboard forms of ی, ک and ہ match.

### `crypto.ts` — new

`randomToken()`, `hashToken()` (tokens are stored hashed), `encryptSecret()` / `decryptSecret()` (AES-256-GCM with a key from the environment) for integration credentials.

### `logger.ts` and `env.ts` — new

- `logger`: pino, JSON in production and readable locally, with `requestId`, `orgId`, `userId` on every line. Never logs request bodies, tokens, CNIC numbers or phone numbers.
- `env`: one Zod schema for every environment variable. The app refuses to start with a missing or malformed value and says which one.

## `apps/web/src/server/`

| File | Status | Purpose |
|---|---|---|
| `auth.ts` | ✔ exists, extend | Verifies the Supabase token from the cookie or bearer header, checks `memberships.status`, calls `loadAccess`, returns the `Actor` |
| `route.ts` | ✔ exists | `createRoutes({ authenticate, run: runAs })` |
| `supabase.ts` | new | Server and browser Supabase clients (`@supabase/ssr`) |

`apps/web/proxy.ts` (new) refreshes the session cookie and redirects signed-out users away from `(app)` routes.

## `@takhti/api-client` and `@takhti/hooks` — `src/kernel/`

| File | Status | Extend with |
|---|---|---|
| `client.ts` | ✔ exists | Automatic `Idempotency-Key` on calls marked idempotent; one silent retry for `GET` on a network error; a hook point for "session expired" |
| `crud-api-service.ts` | ✔ exists | `restore`, `bulk` |
| `crud-hooks.ts` | ✔ exists | Optimistic update option; `useInfiniteList`; error-to-form mapping helper `applyApiError(form, error)` |

## Test harness — `tests/helpers/` — new

| Helper | Purpose |
|---|---|
| `createTestDb()` | A fresh PGlite database with all migrations applied (loaded from a prepared copy); or, when `TEST_DB=postgres`, a database on the Docker Postgres cloned from a template |
| `seedOrg()` | A school group with two branches, an academic year, grades and sections |
| `actors` | One ready actor per built-in role |
| `as(actor, work)` | Runs `work` with a `ctx`, exactly like a request |
| `callRoute(handler, { as, method, url, body })` | Calls a real Route Handler as a seeded person; only the token check is replaced |
| `fetchThrough(routes, as)` | A `fetch` that hands requests to Route Handlers, so the API client is driven against the real API |
| `probeTable(table)` | The engine of the generated security tests |
| `build.student()`, `build.voucher()`, … | Builders with sensible defaults |
| `expectError(code, work)` | Asserts the error code |
| `freezeTime(iso)` | Sets `ctx.now` and `ctx.today` |

## Phase 0 exit check for the kernel

1. Every file above exists with the tests listed.
2. The skeleton's 32 checks pass in the real repository layout.
3. `tests/types/guarantees.ts` compiles, proving the compile-time checks still bite.
4. The ESLint boundary rules reject a deliberately wrong import in each direction.

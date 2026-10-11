# Phase 0 · Setup and kernel

**Goal.** An empty repository becomes a working monorepo with a running Next.js app, a local Supabase in Docker, the whole backend kernel with its tests, a job worker, and one real resource (`branches`) passing through all seven layers.

**Depends on.** Nothing.

**Produces.** The reusable files every later phase is built on. After this phase, adding a resource is a matter of filling in five small files.

**Modules touched.** [M00](../10-modules/m00-shared-kernel.md), [M01](../10-modules/m01-platform-console.md), [M02](../10-modules/m02-organisation-branches.md), [M03](../10-modules/m03-identity-roles-audit.md) — database and contracts only, because the kernel cannot be tested without tenants, users, roles and the shared tables.

## Read first

| Document | Why |
|---|---|
| [02 · Decisions and stack](../00-foundation/02-decisions-and-stack.md) | The versions to install |
| [04 · Repository layout](../00-foundation/04-repository-layout.md) | Where every file goes |
| [05 · Conventions](../00-foundation/05-conventions.md) | Naming, base columns, numbers |
| [06 · Tenancy, roles and access](../00-foundation/06-tenancy-roles-and-access.md) | Claims, helper functions, policy templates |
| [07 · Backend kernel](../00-foundation/07-backend-kernel.md) | **The specification for this phase**: every kernel file and its tests |
| [08 · API standards](../00-foundation/08-api-standards.md) | Envelope, errors, lists, idempotency |
| [17 · Local environment](../00-foundation/17-local-environment.md) | Tools, ports, variables |
| [`docs/reference/backend-skeleton/`](../../reference/backend-skeleton/) | Seven kernel files already written and verified; copy, do not retype |

## Work packages

Do them in order. Each ends with `pnpm check` passing.

### 0.1 · Repository

- [x] `git init` on `main`.
- [x] First commit. Made on 11 October 2026, when the owner asked for it: one commit on `main` holding everything up to the start of Phase 2. No remote is set. Later commits are made only when the owner asks.
- [x] `git config core.longpaths true` (Windows).
- [x] Root `package.json` (`"private": true`, `"type": "module"`, `"packageManager": "pnpm@10.x"`, `"engines": { "node": ">=22" }`) with the scripts listed in [04](../00-foundation/04-repository-layout.md).
- [x] `pnpm-workspace.yaml` listing `apps/*` and `packages/*`.
- [x] `turbo.json` with tasks `typecheck`, `lint`, `test`, `build`, `dev` (the last two not cached).
- [x] `.gitignore` (node_modules, `.next`, `.env*` except `.env.example`, `supabase/.branches`, `supabase/.temp`, `backups/`, `test-results/`, `playwright-report/`, `docs/plan/_tools/out/`).
- [x] `.editorconfig`, `.prettierrc` (single quotes, trailing commas, 100 columns), `.nvmrc` (`22`).
- [x] `.env.example` with every variable in [17](../00-foundation/17-local-environment.md).

Done when: `pnpm install` succeeds on an empty workspace.

### 0.2 · Shared configuration — `packages/config`

- [x] `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `moduleResolution: "bundler"`, `target: "ES2023"`, no `baseUrl` paths (packages are imported by name).
- [x] ESLint flat config in its own package, `packages/eslint-config`: `typescript-eslint` strict, the React and Next rules, and the rules below. Boundaries are `no-restricted-imports` per folder rather than a plugin; the package carries TypeScript 6 as the linter's parser ([02](../00-foundation/02-decisions-and-stack.md)).
- [x] **Boundary rules** (each proven by a deliberately wrong file in `tests/lint/rules.test.ts`, given to ESLint with the path it would have):
  - `contracts` imports nothing but `zod`.
  - `db` imports `contracts` only.
  - `core` imports `contracts` and `db`.
  - `api-client`, `hooks`, `ui` never import `db` or `core`.
  - Only the files listed in [07](../00-foundation/07-backend-kernel.md) may import `adminDb`.
  - `apps/web` screens (`src/features`, `app/(app)`) never import `core` or `db`; only `app/api` and `src/server` may.
- [x] **Project rules**: no `*` or `/` on something named like money in a module (a heuristic by name, since these lint rules do not see types); no `new Date()` in server code outside `kernel/dates.ts`, `kernel/cron.ts` and tests; no `console`; no `any`; no non-null assertion; no physical CSS direction classes (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`); no rounded corners.

Done when: `pnpm lint` passes and each wrong-import fixture fails as expected.

### 0.3 · Packages

Create each package with a `package.json` whose `exports` points at `./src/index.ts` and a `tsconfig.json` extending the base.

- [x] `@takhti/contracts` — dependency: `zod`.
- [x] `@takhti/db` — `drizzle-orm`, `postgres`, `@electric-sql/pglite` (dev), `drizzle-kit` (dev).
- [x] `@takhti/core` — `pino`, `@supabase/supabase-js`.
- [x] `@takhti/api-client` — no runtime dependency beyond `contracts`.
- [x] `@takhti/hooks` — `@tanstack/react-query`, `react` (peer).
- [x] `@takhti/ui` — empty for now; filled in [Phase 4](phase-04-frontend-foundation.md).
- [x] `@takhti/worker` — `tsx` to run.

Install the exact versions in [02](../00-foundation/02-decisions-and-stack.md). Pin them (no `^`) for `next`, `react`, `typescript`, `drizzle-orm`, `drizzle-kit`, `zod`, `@supabase/*`.

Done when: `pnpm typecheck` passes with an empty `index.ts` in each.

### 0.4 · The web app — `apps/web`

- [x] Create the Next.js app (App Router, TypeScript, Tailwind v4, ESLint off because the workspace config is used). `next.config.ts` loads the repository root's `.env.local`, because Next.js only looks beside the app.
- [x] `next.config.ts`: `transpilePackages` with every `@takhti/*` package; `reactCompiler: true`; `typedRoutes: true`; security headers from [10](../00-foundation/10-security-and-privacy.md).
- [x] Folder structure exactly as in [04](../00-foundation/04-repository-layout.md): `app/(auth)`, `app/(app)/{platform,hq,school,teach,family,learn}`, `app/s/[school]`, `app/print`, `app/api/health`, `app/api/v1`. Each portal folder gets a placeholder page that says its name.
- [x] `app/api/health/route.ts`: `200` when the process is up. `app/api/ready/route.ts`: `{ ok, db }` after asking the database; `503` when it is unreachable ([08](../00-foundation/08-api-standards.md), "Health").
- [x] `src/server/supabase.ts`: server and browser clients with `@supabase/ssr`.
- [x] `proxy.ts`: refreshes the session cookie; sends a signed-out visitor of `(app)` routes to `/sign-in?next=…`.
- [x] Copy `docs/design/theme/globals.css` to `apps/web/app/globals.css` so the placeholder pages already wear the theme.

Done when: `pnpm dev` serves `http://localhost:3000` and `/api/health` answers.

### 0.5 · Local Supabase

- [x] `supabase init`; edit `supabase/config.toml` to the values in [17](../00-foundation/17-local-environment.md), including the SMS provider block and the access-token hook. Ports are in the 6432x block; the Data API is off.
- [ ] The test OTP map. **Moved to [Phase 5](phase-05-auth.md)**, with the guardians' phone numbers it maps.
- [x] `pnpm db:start`, then `pnpm db:env` writes `.env.local` from the running stack (nothing is copied by hand, nothing secret is printed).
- [x] Root scripts: `db:start`, `db:stop`, `db:studio`, `db:generate`, `db:migrate`, `db:seed`, `db:reset`, `db:backup`, `db:restore`. `db:reset` runs `supabase db reset`, applies migrations, sets the `takhti_api` password from `TAKHTI_API_DB_PASSWORD`, then seeds. Also `db:env`, `db:status` and `db:verify-plan`. `db:backup` and `db:restore` were proven together: back up, empty, restore, then the smoke test.

Done when: `pnpm db:reset` finishes cleanly on an empty migration folder.

### 0.6 · Kernel in `@takhti/contracts`

From [07](../00-foundation/07-backend-kernel.md): `primitives.ts`, `resource.ts` (copy from the skeleton, then extend), `errors.ts` (copy), `settings.ts`, `events.ts`, `machine.ts`, `permissions.ts`. Plus `access/roles.ts` (the 32 role keys and the groups), `access/capabilities.ts`, `access/modules.ts` (the 45 modules), and `catalogue.ts` (gathers every module's permissions, settings and events).

Done when: each file's unit tests pass, including every primitive with valid, invalid and edge inputs.

### 0.7 · Kernel in `@takhti/db`

- [x] `kernel/columns.ts`, `kernel/policies.ts`, `client.ts` (copy from the skeleton, then extend as in [07](../00-foundation/07-backend-kernel.md)). Policies include `householdRead` and `capRestricted`.
- [x] `drizzle.config.ts` pointing at `src/schema/**/*.table.ts` and `migrations/`.
- [x] Migration **`foundation`** (custom SQL): extensions, the `app` schema with every helper function in [06](../00-foundation/06-tenancy-roles-and-access.md) (`org_id`, `user_id`, `kind`, `is_staff`, `all_branches`, `branch_ids`, `student_ids`, `staff_id`, `guardian_id`, `family_id`, `has_cap`, `today`), the `takhti_api` role and grants, default privileges, `app.touch_updated_at()`, `app.forbid_change()` and `app.sync_table_rules()`. The access-token hook reads the membership tables, so it is its own migration after the tables (`wave-0-auth-hook`).
- [x] `src/migrate.ts`: the migration runner used locally, by every test database and in production ([07](../00-foundation/07-backend-kernel.md)).
- [x] A **table registry**, `src/registry.ts`: every table exported with its scope and modifiers. The generated security tests and the plan checker both read it.

Done when: `0000_foundation` applies on PGlite and on Docker Postgres; a test sets claims and reads each helper function back.

### 0.8 · Wave 0 of the schema: M00, M01, M02, M03

For each table in these four specs: the table file (`*.table.ts`) with its indexes, checks and policies, in the notation the spec gives, and the allowed-value lists its checks are built from. Full resource contracts were written for what Phase 0 serves (organisation, branches, rooms, wings, settings, onboarding, `me`, file uploads); **the remaining Wave 0 resource contracts** (roles, memberships, invitations, the audit log, approval policies, custom fields, notes, saved views, plans, subscriptions) **are written in [Phase 1](phase-01-database.md)** with every other module's.

- [x] Order: M02 `orgs`, `branches` first; then M03; then M00; then M01; then the rest of M02.
- [x] M03's `permissions` table is brought in line with the code catalogue (`packages/contracts/src/catalogue.ts`) on every migration run. Roles belong to an organisation, so the 30 roles a school holds are created with it, by `provisionOrg`. For now the catalogue holds only the permissions of these four modules.
- [x] `pnpm db:verify-plan`: every table, column, type, allowed value and foreign key in code is compared with the plan.
- [x] `pnpm db:generate --name wave-0-tenancy-identity-kernel` → migration `0001`. Read the SQL before applying.
- [x] `tests/helpers/`: `createTestDb`, `seedOrg` (whose `actor(role)` gives a signed-in person for any built-in role), `as`, `callRoute`, `fetchThrough`, `expectError`, `freezeTime`. Record builders (`build.student()`) arrive with the records they build, in Phase 1.
- [x] **Generated security tests** (`tests/api/security/rls.generated.test.ts`): for every table in the registry, by scope — another organisation reads and writes nothing; another branch reads and writes nothing; `+family`, `+household`, `+self` and `+cap` behave as defined; `append-only` refuses update and delete; `platform` refuses everything. `rls.engine.test.ts` damages a table on purpose and checks that these tests notice; `custom-policies.test.ts` covers the two tables with hand-written policies.
- [x] Minimal seed (`packages/db/src/seed/`): Roshan Public School with its two branches, wings and rooms ([M02 §14](../10-modules/m02-organisation-branches.md)), Al-Noor Grammar School as the second tenant, the roles and permissions, the storage buckets, the two platform admins, and one user per built-in role with a membership. Accounts and their local passwords are defined in `seed/accounts.ts` and printed at the end of the run; they are never written anywhere else.

Done when: the migration applies on both engines; the generated security tests pass for all Wave 0 tables; `pnpm db:reset` prints the accounts.

### 0.9 · Kernel in `@takhti/core`

Every file under "`@takhti/core` — `src/kernel/`" in [07](../00-foundation/07-backend-kernel.md), each with the tests listed there. Suggested order, because later files use earlier ones:

1. `env.ts`, `logger.ts`, `errors.ts`, `money.ts`, `dates.ts`, `crypto.ts`, `search.ts`, `state-machine.ts` (pure; no database).
2. `context.ts` (`runAs`, `runAsSystem`, `runAsPlatform`).
3. `session.ts`, `permissions.ts`, `modules.ts`, `settings.ts`, `scope.ts`. (`teacherSectionIds` and `wingGradeIds` read academic tables, so they are written with the academics module.)
4. `audit.ts`, `sequences.ts`, `idempotency.ts`, `rate-limit.ts`.
5. `db-service.ts`, `crud-service.ts`.
6. `jobs.ts`, `cron.ts`, `events.ts`, `notify.ts`. The dispatch job is in place; the dispatcher itself is installed by the messaging module (M37), which owns the notification tables. Until then an event is recorded and the job finishes without telling anyone.
7. `files.ts` (behind a storage interface: Supabase Storage for real, an in-memory one in tests), `approval.ts`, `bulk.ts`, `import.ts`, `export.ts`, `csv.ts`. Imports and exports are CSV for now.
8. `http.ts` (`createRoutes`).
9. `providers/`: one interface and a local stand-in each for SMS, WhatsApp, email, push (`log`), payments (`fake`), AI (`fake`, replaying recorded answers) and PDF (`noop` until [Phase 16](phase-16-documents-and-printing.md)). No real provider is written before [Phase 18](phase-18-integrations.md).

Done when: every kernel test in [07](../00-foundation/07-backend-kernel.md) passes, including: 50 parallel callers get 50 consecutive numbers; a double-clicked idempotent request runs once; nested `runAs` is refused; a job queued in a rolled-back transaction does not exist.

### 0.10 · Server wiring — `apps/web/src/server`

- [x] `auth.ts`: verify the Supabase token (cookie or bearer) and read which membership was chosen (the `x-membership-id` header or the `takhti_membership` cookie). Everything after that is `actorFor` in the kernel: check `status` and the school, `loadAccess`, return the `Actor` with `caps` and `familyId`.
- [x] `route.ts`: `createRoutes({ authenticate, run: runAs })`.
- [x] `GET /api/v1/me`: the profile, the user's memberships, the active membership's roles, permissions, branches, enabled modules and locale. Every portal shell will be built from this one response.
- [x] `GET /api/v1/me/memberships` and `POST /api/v1/me/switch-org`: lists the user's memberships and switches the active one ([M03](../10-modules/m03-identity-roles-audit.md)).

Done when: a seeded account's token gets its `me` response; a suspended membership gets `403`; no token gets `401`.

### 0.11 · Kernel in `@takhti/api-client` and `@takhti/hooks`

Copy `client.ts`, `crud-api-service.ts` and `crud-hooks.ts` from the skeleton and extend them as in [07](../00-foundation/07-backend-kernel.md): automatic `Idempotency-Key`, one retry for `GET`, the "session expired" hook point, `restore`, `bulk`, optimistic updates, `useInfiniteList`, `applyApiError`. Add `query-keys.ts` (one factory, so invalidation is never guessed) and `query-client.ts` (defaults: `staleTime` 30 s, no retry on 4xx, retry once on network errors).

Done when: the client drives real Route Handlers through a fake `fetch` in tests, and type tests prove a wrong filter or sort key fails to compile. (The hooks are proven by the compiler here; tests that render them arrive with the component tests of [Phase 4](phase-04-frontend-foundation.md).)

### 0.12 · The worker — `packages/worker`

The loop in [13](../00-foundation/13-notifications-jobs-and-files.md): claim with `for update skip locked`, run inside `runAsSystem`, finish or requeue with backoff, reap stuck jobs, read `job_schedules` each minute, per-organisation fairness, clean shutdown. `pnpm worker` runs it.

Done when: tests show that two workers never run the same job; a failing job retries with growing delays and ends `failed`; a job stuck past its timeout is reaped; a schedule fires once per due time; SIGINT lets the running job finish.

### 0.13 · The first resource through all seven layers: `branches`

This is the proof that the pattern works in the real repository, and the template every later resource copies.

| Layer | File |
|---|---|
| Contract | `packages/contracts/src/modules/organisation/branches.contract.ts` |
| Table | `packages/db/src/schema/organisation/branches.table.ts` (from 0.8) |
| DB-service | `packages/core/src/modules/organisation/branches.db-service.ts` |
| Service | `packages/core/src/modules/organisation/branches.service.ts` with the rules in [M02 §5](../10-modules/m02-organisation-branches.md) |
| Routes | `apps/web/app/api/v1/branches/route.ts`, `…/[id]/route.ts`, `…/[id]/activate/route.ts`, `…/[id]/deactivate/route.ts` |
| API-service | `packages/api-client/src/modules/organisation/branches.api-service.ts` |
| Hooks | `packages/hooks/src/modules/organisation/branches.hooks.ts` |
| Tests | `tests/api/organisation/branches.test.ts`: the full list in [11](../00-foundation/11-testing-strategy.md) "For every resource" |

Then write **`docs/reference/adding-a-resource.md`**: the eight steps, with `branches` as the worked example. Later phases follow it.

Done when: every test for `branches` passes, including each `R-org-…` and `F-org-…` that concerns branches.

### 0.14 · The gate

- [x] `pnpm check` = `typecheck` + `lint` + `test`, all green.
- [x] `pnpm test:db` runs the same tests against Docker Postgres.
- [x] `pnpm plan:check` runs `docs/plan/_tools/check.mjs`.
- [x] A `tests/types/guarantees.ts` file with `@ts-expect-error` lines proving: a contract that does not fit its table fails; an unknown filter fails; an unknown sort column fails; a patch cannot touch a column the kernel maintains; an unknown permission, a wrong setting type, and a job or event payload that does not fit all fail. (Money arithmetic is held by a lint rule, not by a type.)
- [x] A git hook (`.githooks/pre-commit`, enabled with `git config core.hooksPath .githooks`) runs `pnpm typecheck && pnpm lint`.

## Exit checks

1. `pnpm install && pnpm db:start && pnpm db:env && pnpm db:reset && pnpm dev` works from a fresh clone, following [17](../00-foundation/17-local-environment.md) only. Then `pnpm smoke` passes.
2. `pnpm check` and `pnpm test:db` are green.
3. The four checks at the end of [07](../00-foundation/07-backend-kernel.md) hold.
4. Generated security tests cover every Wave 0 table, and deleting a policy from one table makes a test fail.
5. `GET /api/v1/branches` returns the seeded branches for the principal's account and `403` for the guardian's; a driver may read them (every member of staff holds `branches:read`) and gets `403` on `POST`.
6. `pnpm worker` runs a queued job to `succeeded`. (No route queues a job before Phase 2; the nightly cleanup job, queued the way the scheduler queues it, was used.)
7. `docs/reference/adding-a-resource.md` exists and a second resource (`rooms`) was added by following it without touching the kernel.

## How it went

Finished on 10 October 2026. What the gates showed on that day:

| Gate | Result |
|---|---|
| `pnpm typecheck` | 10 packages and the tests, no errors, on TypeScript 7 |
| `pnpm lint` | No errors, no warnings |
| `pnpm test` (in-process Postgres) | 361 passed, 1 skipped (it needs the real server) |
| `pnpm test:db` (Docker Postgres 17) | 362 passed |
| `pnpm db:verify-plan` | 55 tables in code match the plan |
| `pnpm plan:check` | No errors |
| `pnpm smoke` (real sign-ins against the running app) | 17 of 17 |

### What the build taught, now written into the plan

| Finding | Where it is recorded |
|---|---|
| Supabase's own Data API would have been a second door past every service rule. It is switched off, and `anon` holds no table privilege | [06](../00-foundation/06-tenancy-roles-and-access.md) "One door", [10](../00-foundation/10-security-and-privacy.md) |
| A table file loaded in the middle of a circular import silently lost its base columns. The base columns no longer import any table, and registering a table checks its columns | `packages/db/src/kernel/base-columns.ts`, `registry.ts` |
| An insert with `returning`, or with `on conflict (columns)`, makes Postgres apply the table's read policy to the new row, which refuses a family user who may write but not read | [`adding-a-resource.md`](../../reference/adding-a-resource.md), `kernel/jobs.ts` |
| A limit on a whole transaction ends the connection, and the driver then throws outside any handler. Jobs use a statement limit plus the worker's own clock | [13](../00-foundation/13-notifications-jobs-and-files.md) |
| A `+self` policy without the organisation let a person in two schools reach one school's rows from the other. The generated tests now write such a row for every personal table | [06](../00-foundation/06-tenancy-roles-and-access.md) |
| `auth.email.enable_signup = false` would have switched off signing in by email, not only signing up | [17](../00-foundation/17-local-environment.md) |
| The in-process test engine has no timers and one session, so two tests run only on the real server, and `pnpm test:db` is a real gate, not a formality | [11](../00-foundation/11-testing-strategy.md) |
| Every foreign key is indexed by the `table()` helper itself; `org_id` is exempt | [05](../00-foundation/05-conventions.md) |

## Left for later, on purpose

- Every other table, and the remaining Wave 0 resource contracts: [Phase 1](phase-01-database.md).
- A remote and the first push: when the owner asks. (The first commit was made on 11 October 2026.)
- The test OTP map and phone sign-in for guardians: [Phase 5](phase-05-auth.md).
- XLSX import and export, with a spreadsheet library: when the first screen needs it.
- Screens: nothing beyond placeholder pages until [Phase 4](phase-04-frontend-foundation.md).
- Real message, payment and AI providers: [Phase 18](phase-18-integrations.md) and [Phase 19](phase-19-ai.md).
- Cloud deployment: [Phase 21](phase-21-hardening-and-launch.md).

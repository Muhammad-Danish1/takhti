# Takhti

School management software for Pakistan (Grades 1 to 10): multi-branch, 44 modules, offline-capable, with AI. Next.js 16 (frontend and API), Supabase (Postgres, Auth, Storage, Realtime), Drizzle, Zod, TanStack Query, Tailwind and shadcn/ui.

**Starting a new session? Read [`docs/STATUS.md`](docs/STATUS.md) first.** It says what is built, what was checked and when, what comes next, what was left out on purpose, and how the owner wants the work done. Update it before you stop.

**The plan is the specification.** Start at [`docs/plan/README.md`](docs/plan/README.md). Work is done phase by phase from [`docs/plan/20-phases/`](docs/plan/20-phases/); what to build for each module is in [`docs/plan/10-modules/`](docs/plan/10-modules/).

## How to work here

1. Read `docs/STATUS.md`, then find the current phase in the progress table of `docs/plan/README.md`. Read that phase file, its "How it is going" section and its "Read first" list before writing anything.
2. Build exactly what the module spec says: its tables, rules, permissions, routes, hooks and screens. Do not add features, columns or routes that are not in a spec.
3. If a spec is wrong or incomplete, change the spec first, run `pnpm plan:check`, then write the code. Never let the code and the plan disagree silently.
4. Every rule (`R-…`), failure case (`F-…`) and listed test (`T-…`) in a spec gets a test whose name starts with its id.
5. `pnpm check` must pass before a commit. A phase closes only when its exit checks pass.
6. Tick the checkboxes in the phase file as work is done; update the progress table when a phase closes.
7. Before ending a session, bring `docs/STATUS.md` up to date: what now exists, what was checked, what is next, and anything put off with where it is picked up. Something learned the hard way goes into `docs/reference/lessons-learned.md`.

## How the owner wants the work done

- **Backend first, in this order:** every table, then every service and route, then every API client and hook; then the frontend foundation, sign-in for every role, the portals one by one, the marketing site, and the mobile apps last. Do not reorder it.
- **Speed over polish.** Finish a layer for every module before enriching one module. Do not hand-write large demo data: create it by calling the services. Run the quick checks often and the full suite at milestones.
- **Report progress in everyday words:** what now exists, what does not, when something visible comes. Keep answers short in conversation and put the detail in the files.
- **Carry on without asking** during long runs. "Continue" or "try again" means exactly that.
- **Never open or cite the older "EDU-ERP v2" documents** (`Desktop/projects/EDU-ERP`). The owner is removing them.

## Rules that are never broken

**Architecture**

- Seven layers, in this order: contract → table → db-service → service → route → api-service → hooks. Files go where [`docs/plan/00-foundation/04-repository-layout.md`](docs/plan/00-foundation/04-repository-layout.md) says.
- All data access from a browser or app goes through `/api/v1` Route Handlers. No business logic in Server Actions, Server Components or screens.
- A route parses, calls one service function and returns. A db-service reads and writes and holds no rule. Rules live in services and pure rule files.
- `ctx` is the first argument of every service and db-service function.
- `api-client`, `hooks` and `ui` never import `core` or `db`. Screens import hooks, contracts and UI components only, and never call `fetch`.
- New reusable behaviour goes into the kernel once, not into a module.
- A new resource follows the eight steps in [`docs/reference/adding-a-resource.md`](docs/reference/adding-a-resource.md), with `rooms` as the example.

**Data**

- Every table has row-level security, created in the same migration as the table, from the policy templates in [`06-tenancy-roles-and-access.md`](docs/plan/00-foundation/06-tenancy-roles-and-access.md).
- Money is whole paisa in `bigint`. Use `kernel/money.ts`; never multiply or divide money elsewhere; never use floating point for money.
- Calendar dates are `YYYY-MM-DD` strings end to end. Use `kernel/dates.ts` and `ctx.today`; do not create `Date` objects for business logic. "Today" is Pakistan time.
- Rows are soft-deleted. Financial records are never edited or deleted: they are reversed, voided or adjusted by a new record with a reason.
- Every write that takes money or creates a numbered document is idempotent and happens in one transaction together with its ledger entry.
- A merged migration is never edited. The schema changes only through `pnpm db:migrate` (`packages/db/src/migrate.ts`), never through the Supabase CLI.
- Every table is registered in `packages/db/src/registry.ts` with what staff and members may do. The generated security tests read it; a table that is not registered, or whose policies disagree with its entry, fails them.
- **Tables of Wave 1 onwards are generated.** A file that begins `// Generated by docs/plan/_tools/scaffold.mjs` is never edited: change the module spec or `docs/plan/_tools/scaffold-hints.mjs` and run `pnpm scaffold`. A test fails when a generated file is out of date. The generator refuses a spec sentence it cannot read until the hints account for it; never silence it by deleting the sentence.
- **The plain API of a resource is generated too.** A file that begins `// Generated by docs/plan/_tools/scaffold-api.mjs` (a contract, db-service, service, route, API client or hooks file) is never edited. It applies permissions and nothing of the module's own rules. To give a resource rules, list its table under `handWritten` in `docs/plan/_tools/api-hints.mjs`, remove the header from its files and edit them from then on. Named actions, reports and family routes are always written by hand.
- A route says which permission it needs (`defineRoute({ permission })`), so a caller without it is refused before the request is read; the service checks again.
- A table's access is declared once, in `defineTable(name, access, columns)`; its policies, registry entry and security test all come from that. A table that departs from its scope's template has a `Policy:` line in its spec saying how.
- Families never read the `staff` table; they read the view `staff_directory`. A new view filters by organisation itself, is read-only, is added to the list in `tests/db/foundation.test.ts` and proved in `tests/api/security/views.test.ts`.
- SQL that Drizzle cannot express (exclusion constraints, views, functions) is written in the hints, lands in `packages/db/src/custom-sql/wave-N.sql`, and is added to the wave's migration with `pnpm db:custom-sql N`.
- From a script, run the migration generator with its input closed (`drizzle-kit generate … < /dev/null`): with a keyboard attached it can wait for an answer for ever.
- Chat belongs to the people in a thread. Staff have no rule of their own on the chat tables: reading goes through a row in `chat_participants`, and that table changes only through the service.
- Demo data whose figures are calculated (fees, payroll, marks, results, stock) is created by calling the module's service, never by inserting finished rows in the seed.
- Supabase's own Data API stays switched off. Takhti's API is the only way to data.
- Only the kernel files listed in the ESLint config may use the privileged connection (`adminDb`, `withAdminTx`), and never inside a user's transaction.
- A row that a family user may add but not read (an audit entry, an event, a job) is inserted without `returning` and without naming columns in `on conflict`: either makes Postgres apply the read policy to the new row.

**Frontend**

- The approved theme is Kashi. **Border radius is 0 everywhere.** Colours, spacing and type come from tokens only.
- No text in components: every string is in the English and Urdu message files, and Urdu is written with the screen, not later.
- Logical CSS properties only (`ms-`, `me-`, `ps-`, `pe-`), so right-to-left works.
- Money screens are never optimistic and disable their button until the server answers.

**Law and money**

- Tax rates, slabs, thresholds, contribution rates and grade points are data with an effective date, entered and confirmed by a person. Never write one into code, never invent one, and never ship a confirmed rule in production seed data.
- Anything marked **(confirm)** in [`12-pakistan-domain-rules.md`](docs/plan/00-foundation/12-pakistan-domain-rules.md) stays marked until a qualified person confirms it.

**Secrets and accounts**

- No secret in the repository, in logs, in error messages or in chat. Secrets live in `.env.local` and, later, the host's secret store.
- Seeded sign-in passwords and PINs exist only in `packages/db/src/seed/accounts.ts` and are printed by the seed run. Do not copy them into documentation, tests, commit messages or replies.
- Do not commit or push unless asked. Never force-push `main`.

**Dependencies**

- Exact versions only; no `^` or `~`. The verified versions are in [`02-decisions-and-stack.md`](docs/plan/00-foundation/02-decisions-and-stack.md). Add a package only when a phase calls for it, at the latest version on that day, pinned.
- Three things that are easy to get wrong from memory: Drizzle 1.0 has no `casing` option on the connection (use the shared `table()` helper); Zod 4 applies `.default()` inside optional and partial objects (build update schemas from fields without defaults); Supabase verifies a user on the server with `auth.getClaims()` and the public key variable is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Before writing code against an outside service (a payment provider, WhatsApp, PowerSync), read its current documentation. Before writing any Claude API code, load the `claude-api` skill.

## Commands

| Command                                                 | Does                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm db:start` / `pnpm db:stop`                        | Starts or stops local Supabase (Docker must be running)                                  |
| `pnpm db:env`                                           | Writes `.env.local` from the running stack. Prints nothing secret                        |
| `pnpm scaffold`                                         | Writes the generated data layer from the module specs (`--check` only compares)          |
| `pnpm scaffold:api`                                     | Writes the plain API of every resource (`--check` compares, `--report` says what waits)  |
| `pnpm db:generate --name <what>` then `pnpm db:migrate` | A new migration from the table files, then apply it                                      |
| `pnpm db:custom-sql <wave>`                             | Adds a wave's hand-written SQL to the migration just generated for it                    |
| `pnpm db:verify-plan`                                   | Compares the tables and permissions in code with the plan                                |
| `pnpm db:lint`                                          | The database convention tests on their own                                               |
| `pnpm db:reset`                                         | Empties the database, migrates, seeds, prints the seeded accounts (`--today`, `--small`) |
| `pnpm db:seed --timing`                                 | Seeds, and says how long each part took                                                  |
| `pnpm db:verify-seed` / `pnpm db:seed-stats`            | Checks the seeded data is sound / prints what it holds                                   |
| `pnpm dev`                                              | The web app at http://localhost:3000                                                     |
| `pnpm worker`                                           | The background job worker                                                                |
| `pnpm check`                                            | Typecheck, lint and tests. The gate before every commit                                  |
| `pnpm test:db`                                          | The tests against Docker Postgres. A real gate: concurrency and timeouts only show there |
| `pnpm smoke`                                            | Real sign-ins against the running app (`pnpm dev` must be up)                            |
| `pnpm test:e2e`                                         | Browser tests                                                                            |
| `pnpm plan:check`                                       | Checks the plan's cross-references and rebuilds its indexes                              |

Local setup and troubleshooting: [`17-local-environment.md`](docs/plan/00-foundation/17-local-environment.md).

## Things to know about this machine

- Windows. Keep the repository at a short path; some Node tools fail when a path passes 260 characters.
- Everything runs on local Supabase in Docker until Phase 21. No cloud account is needed before Phase 18.
- Takhti's local stack uses ports 64320 to 64324, because other Supabase projects on this machine use the usual ones. Do not stop the other stacks.
- The network to the npm registry is slow here. Every package Phase 0 needs is already in the local pnpm store, so `pnpm install --offline` works; a new package needs a patient online install.
- TypeScript 7 type-checks; the linter carries its own TypeScript 6. Call `./node_modules/.bin/tsc` directly rather than `npx tsc`.
- Seeded passwords are printed by the seed run. When running `pnpm db:reset` or `pnpm db:seed` from an assistant session, hide that line of the output.
- After Windows restarts, Docker Desktop is not running: start it before anything that needs the database.
- The machine has 16 GB of memory and can run out of virtual memory after days without a restart. When the type-checker, `tsx` or Docker crash on start ("paging file is too small", `ERR_WORKER_OUT_OF_MEMORY`), check memory before suspecting the code, and tell the owner: only a restart fixes it. Never stop Docker or WSL to free memory.
- The full test suite takes about fifteen minutes on each engine. Run it in the background; run one file with `./node_modules/.bin/vitest run <path>` (or `pnpm test:db <path>` on Docker) while working.

## Where things are

| Need                                                             | Look in                                                                                            |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Where the build stands, what is next, what was left out          | `docs/STATUS.md`                                                                                   |
| What to build next, in full                                      | `docs/plan/README.md` → the current phase file                                                     |
| Which planned routes exist and which wait                        | `pnpm scaffold:api --report --all`                                                                 |
| Traps already fallen into                                        | `docs/reference/lessons-learned.md`                                                                |
| A module's tables, rules, routes, screens                        | `docs/plan/10-modules/mNN-….md`                                                                    |
| Every table, route, permission, event, job                       | `docs/plan/30-reference/*-index.md` (generated)                                                    |
| Which page goes where in the menu                                | `docs/plan/30-reference/navigation.md`                                                             |
| How to build a screen                                            | `docs/plan/30-reference/building-a-screen.md`                                                      |
| The demo school and its named records                            | `docs/plan/30-reference/seed-data.md`                                                              |
| How to add a resource, step by step                              | `docs/reference/adding-a-resource.md`                                                              |
| How a wave of tables is built from the specs                     | `docs/plan/20-phases/phase-01-database.md`; the decisions in `docs/plan/_tools/scaffold-hints.mjs` |
| The seed: the two schools, named records, integrity checks       | `packages/db/src/seed/` (`schools.ts`, `waveN/`, `verify.ts`)                                      |
| The first worked example of the seven layers (before Phase 0)    | `docs/reference/backend-skeleton/`                                                                 |
| The kernel every module is built on                              | `packages/core/src/kernel/`, described in `docs/plan/00-foundation/07-backend-kernel.md`           |
| Test helpers: a seeded school, acting as a role, calling a route | `tests/helpers/`                                                                                   |
| The theme: tokens, logo, preview                                 | `docs/design/theme/`                                                                               |

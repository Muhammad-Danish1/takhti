# Phase 2 · Services and routes

**Goal.** The entire backend works over HTTP. Every route in every module spec exists as a Next.js Route Handler under `/api/v1`, backed by a service that enforces every rule, with a named test for every rule and every failure case.

**Depends on.** [Phase 1](phase-01-database.md).

**Produces.** Layers 3, 4 and 5 for all 45 modules: db-services, services, pure rule modules, jobs, events and 1,615 routes. When this phase closes, the product could be driven end to end from a REST client.

## Read first

[07 · Backend kernel](../00-foundation/07-backend-kernel.md), [08 · API standards](../00-foundation/08-api-standards.md), [09 · Reliability and error-proofing](../00-foundation/09-reliability-and-error-proofing.md), [11 · Testing strategy](../00-foundation/11-testing-strategy.md) ("For every resource"), [13 · Jobs, notifications, files and documents](../00-foundation/13-notifications-jobs-and-files.md), and `docs/reference/adding-a-resource.md` written in Phase 0. Then, for each module, sections 4 to 7, 10, 11 and 13 of its spec.

## How to write one module's backend

For each module, in this order. Do not move to the next module until the current one's test list is green.

1. **DB-services** — `packages/core/src/modules/<module>/<resource>.db-service.ts`. One per table that needs queries, made with `createDbService`: the searchable columns, the filters and sortable columns named in the contract, any `baseWhere`. Add the custom queries the spec's composite shapes need (a family's open vouchers, a section's roster on a date). **A db-service contains no business rule**; it reads and writes.
2. **Pure rules** — `<module>.rules.ts` and the named calculation files (`charges.ts`, `allocate.ts`, `compute.ts`, `calculate.ts`, `leave-days.ts`, the tax calculators, the score functions). No database access, no clock: everything arrives as arguments. Table-driven unit tests beside the file. This is where money, grades, tax and days are worked out, and where most `R-…` rules are proved cheapest.
3. **Services** — `<resource>.service.ts`. Plain CRUD through `createCrudService`; everything else as named functions that take `ctx` first. A service: checks the module is on, checks the permission, applies scope, validates with the contract, loads and locks what it needs, calls pure rules, writes through db-services, audits, emits events and queues jobs — all in the caller's one transaction.
4. **Jobs** — `<module>.jobs.ts` with `defineJob`: every job named in the spec's section 10, idempotent, each with its schedule registered in `job_schedules` where it has one.
5. **Events** — the service calls `emit` at the points the spec's section 10 implies. The payloads are the schemas declared in Phase 1.
6. **Routes** — `apps/web/app/api/v1/…/route.ts`, one folder per path segment, using `collectionRoutes`, `itemRoutes` and `defineRoute`. Each route declares its permission (or access word), its input schemas, whether it is idempotent, and its rate limit. **A route contains no logic**: it parses, calls one service function and returns.
7. **Tests** — `tests/api/<module>/…`: the generic list from [11](../00-foundation/11-testing-strategy.md) for every resource, then one test per `R-…`, `F-…` and `T-…` id in the spec, named with the id.

### What every service function must do

| Concern | How |
|---|---|
| Module switched on | `assertModule(ctx, key)` first |
| Permission | `assertCan(ctx, resource, action)`; elevated actions (`override`, `waive`, `unlock`) are checked at the point they are used |
| Scope | `scope.ts` helpers: branch, teacher's sections, own children, not self |
| Input | Parsed by the contract at the route; the service receives typed data |
| Reads then writes | `lock()` the rows it will change; never read, decide, then write without a lock |
| Status changes | Through the resource's state machine |
| Numbers | `nextNumber` inside the same transaction |
| Money | `money.ts` only |
| Dates | `ctx.today` and `dates.ts`; never the server clock |
| Stale data | `version` checked on update; `STALE` on mismatch |
| Audit | One entry per business action, not per row touched |
| Side effects | `emit` and `enqueue` in the transaction; never call an outside service directly |
| Errors | `AppError` with a code from [08](../00-foundation/08-api-standards.md) and a message a school clerk can act on |
| Result | The contract's shape, small; lists are paged |

### Cross-cutting pieces built in this phase

Build these first; the modules depend on them.

| Piece | Where | Notes |
|---|---|---|
| **Route manifest** | `apps/web/src/server/manifest.ts`, built by `pnpm api:manifest` from `defineRoute` metadata | Method, path, permission, idempotency, rate limit for every route |
| **`pnpm api:verify-plan`** | script | Compares the manifest with `plan.json`: every planned route exists with the planned permission, and nothing unplanned exists |
| **Generated permission tests** | `tests/api/security/routes.generated.test.ts` | For every route in the manifest: `401` with no token; `403` for a seeded role that lacks the permission; not `403` for one that has it |
| **Ledger posting** | [M23](../10-modules/m23-accounting.md) `ledger.ts` | Written before any module that posts (fees, payroll, purchases, stock, shop) |
| **Stock movement** | [M32](../10-modules/m32-inventory-assets.md) `stock.ts` | Before goods receipts and the shop |
| **Tax calculators** | [M25](../10-modules/m25-tax-compliance.md) `calc/` | Before fees and payroll |
| **Notification dispatch** | [M37](../10-modules/m37-messaging-hub.md) `notify.dispatch`, `notify.deliver` with the `log` channel adapters | Before any module's events are tested |
| **Developer outbox** | `GET /dev/outbox` | Reads what the local adapters "sent"; development only, absent from production builds |
| **Approvals** | [M00](../10-modules/m00-shared-kernel.md) | Each module registers what happens when its request is approved or rejected |
| **Imports and exports** | [M00](../10-modules/m00-shared-kernel.md) | Each import kind in [13](../00-foundation/13-notifications-jobs-and-files.md) registers its row schema, validator and committer |
| **Report registry and analysis** | [M42](../10-modules/m42-dashboards-reports.md) | `defineReport`, the vocabulary, the KPI catalogue; modules register as they are built |
| **Calendar entries** | [M39](../10-modules/m39-notices-events-calendar.md) | Each module exposes `calendarEntries(ctx, range)` |
| **Documents** | `kernel/documents.ts` | `requestDocument(ctx, kind, params)` records a `generated_documents` row and queues rendering; the renderer is a stand-in that writes a one-page placeholder PDF until [Phase 16](phase-16-documents-and-printing.md) |
| **Sync upload** | `POST /sync/upload` ([M00](../10-modules/m00-shared-kernel.md), [14](../00-foundation/14-offline-design.md)) | Each offline-writable table registers an operation handler that calls the same service as the route, plus its conflict policy. Tested by replaying recorded operation batches |
| **Payment adapter, `fake`** | [M22](../10-modules/m22-online-payments-reconciliation.md) | With a development page that completes, fails or delays a payment |

## Order of work

The same waves as the database, because services lean on each other in the same direction.

| Step | Modules | Routes | Notes |
|---|---|---|---|
| 2.1 | Cross-cutting pieces above | — | |
| 2.2 | [M00](../10-modules/m00-shared-kernel.md), [M02](../10-modules/m02-organisation-branches.md), [M03](../10-modules/m03-identity-roles-audit.md), [M01](../10-modules/m01-platform-console.md) | 160 | Finishes what Phase 0 began: files, approvals, imports, invitations, roles, audit, the platform services on the privileged connection |
| 2.3 | [M04](../10-modules/m04-school-setup.md), [M26](../10-modules/m26-staff-recruitment.md), [M11](../10-modules/m11-academic-structure.md), [M07](../10-modules/m07-students.md) | 176 | The people everything else is about |
| 2.4 | [M05](../10-modules/m05-integrations-api.md), [M06](../10-modules/m06-admissions.md), [M08](../10-modules/m08-certificates-id-cards.md), [M09](../10-modules/m09-front-office.md), [M10](../10-modules/m10-alumni.md) | 136 | |
| 2.5 | [M12](../10-modules/m12-timetable.md), [M13](../10-modules/m13-syllabus-lesson-plans.md), [M14](../10-modules/m14-student-attendance.md), [M15](../10-modules/m15-homework-diary.md) | 109 | |
| 2.6 | [M19](../10-modules/m19-question-bank-papers.md), [M16](../10-modules/m16-lms.md), [M17](../10-modules/m17-exams-marks.md), [M18](../10-modules/m18-results-report-cards.md), [M20](../10-modules/m20-behaviour-houses.md) | 170 | `compute.ts` for results is the heart of this step |
| 2.7 | [M23](../10-modules/m23-accounting.md), [M25](../10-modules/m25-tax-compliance.md) | 61 | Ledger and tax before anything that uses them |
| 2.8 | [M21](../10-modules/m21-fees.md), [M22](../10-modules/m22-online-payments-reconciliation.md) | 106 | The most careful work in the phase. See "Money paths" below |
| 2.9 | [M24](../10-modules/m24-expenses-procurement.md), [M32](../10-modules/m32-inventory-assets.md) | 108 | Inventory is pulled forward because purchasing posts stock |
| 2.10 | [M27](../10-modules/m27-staff-attendance-leave.md), [M28](../10-modules/m28-payroll.md), [M29](../10-modules/m29-appraisal-training.md) | 120 | |
| 2.11 | [M30](../10-modules/m30-transport.md), [M31](../10-modules/m31-library.md), [M33](../10-modules/m33-shop-canteen.md), [M34](../10-modules/m34-health-clinic.md), [M35](../10-modules/m35-hostel.md), [M36](../10-modules/m36-maintenance-helpdesk.md) | 207 | |
| 2.12 | [M37](../10-modules/m37-messaging-hub.md), [M38](../10-modules/m38-chat-ptm.md), [M39](../10-modules/m39-notices-events-calendar.md), [M40](../10-modules/m40-complaints-surveys.md), [M41](../10-modules/m41-school-website.md) | 182 | Campaigns, chat, notices, surveys, the public site's read API |
| 2.13 | [M42](../10-modules/m42-dashboards-reports.md), [M43](../10-modules/m43-owner-analytics.md), [M44](../10-modules/m44-ai-suite.md) | 80 | Reports and KPIs over everything; for M44 the score jobs, the draft store and the fake provider — the model-backed features are [Phase 19](phase-19-ai.md) |
| 2.14 | Seed through services | — | See below |

### Money paths

For [M21](../10-modules/m21-fees.md), [M22](../10-modules/m22-online-payments-reconciliation.md), [M23](../10-modules/m23-accounting.md), [M24](../10-modules/m24-expenses-procurement.md), [M28](../10-modules/m28-payroll.md), [M32](../10-modules/m32-inventory-assets.md) and [M33](../10-modules/m33-shop-canteen.md), four extra kinds of test are compulsory:

1. **Atomicity.** For each multi-step operation (collect a payment, approve payroll, post a goods receipt, check out a sale), a test forces a failure after each step in turn and asserts that nothing at all was written.
2. **Concurrency.** Fifty simultaneous requests against the same family, wallet, stock level or sequence, on Docker Postgres, with the invariant asserted afterwards.
3. **Idempotency.** The same key twice, at the same moment and a minute apart.
4. **Posting map.** After each operation, the journal entry produced equals the row of the posting map in [M23](../10-modules/m23-accounting.md), and the nightly integrity checks pass.

### 2.14 · Re-seeding through services

Phase 1's seed inserted rows directly. Now that rules exist:

- [ ] Rewrite the money-related seeds (fees, payments, payroll, purchases, stock, shop) to call services, so the seeded ledger is produced by the real posting code.
- [ ] Add `pnpm db:verify-seed`: runs every module's integrity checks and a sample of rule checks over the seeded data. Any rule the seed violates is a bug in the seed or the rule; fix whichever is wrong.

## Work packages

Each step in the table above is a work package with the same checklist:

- [ ] db-services, pure rules with table tests, services, jobs, events, routes for each module in the step.
- [ ] Reports, KPIs, calendar entries, import kinds and approval handlers that the module registers.
- [ ] Sync operation handlers for the module's offline-writable tables.
- [ ] Tests: every `R-…`, `F-…` and `T-…` id in the spec has a test whose name starts with the id.
- [ ] `pnpm api:manifest && pnpm api:verify-plan` shows the module complete.
- [ ] `pnpm check`.

A helper, `pnpm plan:coverage`, lists which ids from `plan.json` have no test with that id in its name. The phase is not finished while that list has entries.

## Exit checks

1. `pnpm api:verify-plan`: all 1,615 planned routes exist with the planned permission; no unplanned route.
2. `pnpm plan:coverage`: every rule, failure case and test id in every spec has a named test — 737 rules, 416 failure cases, 553 listed tests.
3. Generated permission tests pass for every route.
4. `pnpm check` and `pnpm test:db` are green; the concurrency tests run on Docker Postgres.
5. `pnpm db:reset && pnpm db:verify-seed` passes.
6. With `pnpm dev` and `pnpm worker` running, this walk succeeds using only a REST client and the seeded accounts: enquiry → application → admission → fee plan → voucher generated → payment collected → receipt document requested → journal entry visible in the trial balance → guardian's dues show zero → the payment notification appears in `/dev/outbox`.
7. The same walk's writes are all in `audit_log`, each with the right actor.
8. A scheduled job (late fines) runs from the worker and is idempotent when run twice.
9. Every list route answers in under 300 ms on the standard seed, and under 800 ms on `--large` (`tests/perf/lists.test.ts`).

## How it is going

### The plain operations are generated (11 Oct 2026)

Of the 1,615 planned routes, 567 are the plain ones: list, add, read, change and delete on a path that is a table's own (`/fee-heads`, `/fee-heads/[id]`). `pnpm scaffold:api` (`docs/plan/_tools/scaffold-api.mjs`) writes them, for 222 resources, from three sources: the route tables of the specs (which operations exist and the permission each needs), the tables as they are in code (which columns exist, which are required), and `docs/plan/_tools/api-hints.mjs` (what neither can say). For each resource it writes the input contract, the db-service, the service, the Route Handlers, the API client and the hooks, so layers 6 and 7 of [Phase 3](phase-03-client-layer.md) exist for these resources too.

What a generated service does: the module switch, the permission of each operation, validation by the contract, the write through the db-service, the audit entry. **What it does not do: any rule of the module's section 5.** A resource gets its rules by being taken over: its table is listed under `handWritten` in the hints, the generated files lose their header and are edited from then on.

How the scaffolder decides what a client may send:

- never the columns the server keeps: ids of the organisation, versions, stamps, generated columns, a `status` that has a default (states change through named actions, not through `PATCH`), counters, and any column whose rule says it is computed, copied, maintained or numbered from a sequence;
- `…_by` columns that point at a person are filled with whoever is acting; a `…_by_staff_id` column defaults to their staff record; the branch of a new row defaults to the one the person is working in;
- when a required column is one only the server can fill (a receipt number, a total, a copied value), the scaffolder does not write `POST` at all and says so. 37 routes wait for that reason.

`pnpm scaffold:api --report` lists, module by module, what exists and what waits. `tests/lint/generated.test.ts` fails when a generated file is out of date.

### Changes to the kernel made for it

- **A route checks its permission before it reads the request.** `defineRoute({ permission })` refuses a caller as soon as they are known, so a person without access is told exactly that and never sees what the route would have made of their input. The service checks again. The plain-route builders take the permission from the service (`service.permissions`).
- **Listing and opening one record may need different permissions** (`actions.list`, `actions.get`; `read` still covers both), because the plan sometimes says so.
- **A permission may belong to another resource** (`actions: { create: 'behaviour:manage' }`), and `signed-in` lets every member of the school through, leaving the rest to row-level security.

### The test that walks every generated route

`tests/api/security/routes.generated.test.ts` calls each of the 567 routes through its real Route Handler three ways: with no session (401), as a person whose role lacks the permission (403), and as one whose role holds it (never 401, 403 or a server error; a list must answer 200, which runs the generated query against the real table). Roles and their default permissions come from the catalogue.

### What waits, and why

| Routes | Why they are not generated |
|---|---|
| 951 | Not plain: named actions (approve, publish, collect, compute), nested paths, reports, the family's own routes, public pages and webhooks |
| 46 | Wave 0 resources (M00 to M03), finished by hand in step 2.2 |
| 37 | Adding one needs a service of its own: the server must fill a number, a total or a copied value |
| 8 | Append-only tables: rows are written by a service, never changed |
| 5 | Tables with a hand-written access rule (chat, question papers) |
| 1 | A list shared by every school (`boards`) |

The order of work for these is the table under "Order of work" above.

### Where each step stands (11 Oct 2026)

| Step | State |
|---|---|
| 2.1 · Cross-cutting pieces | **Built**, each with its tests. The route manifest with `pnpm api:manifest` and `pnpm api:verify-plan`; the test that calls every route in the manifest; `pnpm plan:coverage`; ledger posting; the tax calculators and `taxService.ruleFor`; notification dispatch, delivery and `/dev/outbox`; stock movement; `requestDocument` with its stand-in page; the report registry with the library and "run" routes; the calendar with `GET /calendar`; the offline upload `POST /sync/upload`; the `fake` payment provider. See "The cross-cutting pieces, one by one" below. Approvals, imports and exports were already in the kernel from Phase 0 (`kernel/approval.ts`, `import.ts`, `export.ts`); what they lack is their routes, which are part of M00 in step 2.2 |
| 2.2 · M00, M02, M03, M01 | **Half done (12 Oct 2026).** [M00](../10-modules/m00-shared-kernel.md) is complete: 53 of 53 routes, and every rule, failure case and listed test of its spec has a test named after it. [M02](../10-modules/m02-organisation-branches.md) is complete: 25 of 25 routes, likewise. [M03](../10-modules/m03-identity-roles-audit.md) (30 of 33 routes wait) and [M01](../10-modules/m01-platform-console.md) (49 wait) are not started. See "Step 2.2, module by module" below |
| 2.3 to 2.13 · every other module | **Plain routes only.** For each module: the generated contract, db-service, service, routes, API client and hooks of its plain resources. Not started: rules, named actions, settings, events, state machines, jobs, the tests named after `R-…`, `F-…` and `T-…` ids |
| 2.14 · Seeding through services | **Not started.** `pnpm db:verify-seed` already exists from Phase 1 with 38 checks for Waves 1 to 3. Demo data for M16 to M20 and for Waves 4 to 8 is created here, with each module |

### The cross-cutting pieces, one by one (11 Oct 2026)

**The route manifest.** Every handler made by a route builder carries what it is: the access word of the plan (a permission key, `signed-in`, `public`, `platform` or `webhook`), whether it asks for an `Idempotency-Key`, and its rate limit (`routeMetaOf` in `kernel/http.ts`). `pnpm api:manifest` loads every route file under `app/api/v1`, asks each handler, and writes `apps/web/src/server/manifest.ts`. A handler not made by a builder, or a route for members of a school that names no permission, stops it. So **every `defineRoute` states `permission`**: a key, or `'signed-in'`.

**`pnpm api:verify-plan`** compares the manifest with the plan. It fails on a route the plan does not have, a permission that differs, or a route the plan calls idempotent that does not ask for a key; it prints, module by module, how many planned routes exist (`--waiting` and `--module M21` list the missing ones; `--complete` also fails while any is missing, which is the exit check). The plan checker now reads the `Idempotent:` line under each route table (102 routes) and refuses one that names a route no table has. Both run inside `pnpm check` (`tests/lint/generated.test.ts`). On its first run it found three differences, all since put right: `rooms` served a "read one" the plan does not have, and two plain "add" routes the plan calls idempotent did not ask for a key (a resource contract now has `idempotentCreate`, which the route and the API client both follow).

**The test that calls every route** (`tests/api/security/routes.generated.test.ts`) now walks the manifest, so a hand-written route is covered the moment it exists: no session gives 401, a role without the permission 403, a role with it is let in, and nothing answers with a server error. It also holds the manifest to the code: every route file is in it, and each entry says what its handler says.

**`pnpm plan:coverage`** lists, module by module, how many rules, failure cases and listed tests have a test whose name starts with their id (`--missing`, `--module M21`, `--complete`). A test named after an id the plan does not have fails the run, and so fails `pnpm check`.

**Ledger posting** (`packages/core/src/modules/accounting/ledger.ts`, with its arithmetic in `ledger.rules.ts`): `ledger.post`, `ledger.reverse` (by source), `ledger.reverseEntry` (by id, for a manual entry), `ledger.assertOpen`, `ledger.linesOf`. It resolves mapping keys (a branch's own choice first), leaves out lines of nothing, checks the balance, adds inter-branch lines so each branch balances, refuses a closed period, an inactive or group account, a control account from a manual entry and a key with no account, numbers the entry `FEE-2627-000123` and writes it posted, in the caller's transaction. One source posts once: a second call returns the first entry, also when twenty requests arrive together (proved on Docker Postgres). Tests: `tests/api/accounting/ledger.test.ts` and `ledger.rules.test.ts`.

A new school now starts with its accounting: `provisionOrg` writes a chart of 137 accounts, the nine journals, an account for every mapping key and the fiscal year that holds the day it is created (`packages/db/src/provision/accounting.ts`). The seed and every test school get the same.

Still to come for accounting in step 2.7: manual journal entries (draft, approve above the limit, post), transfers, periods and year-end, the reports, the integrity job, `accounting.lock_days`, and taking `journal-entries` over (its generated `PATCH` still lets a permitted person change an entry's header).

**A fault found on the way.** Two "unique" rules forgot the school: an account mapping and a statutory filing were unique by key and branch alone, so a group-level one could exist for only one school on the whole platform. Both specs, the hints and a new migration (`unique-per-school-fixes`) put the organisation into the index, and `tests/db/conventions.test.ts` now refuses any unique rule of a school's table that is not tied to the school, with its seventeen deliberate exceptions listed.

**Tax calculators** (`packages/core/src/modules/tax/calc/`): `salaryTaxForMonth`, `feeAdvanceTax`, `vendorWithholding`, `eobi`, `socialSecurity`, `providentFund`, each a pure function that takes the rule it works from and returns the amount with a breakdown. The shapes of a rule's figures are Zod schemas in `packages/contracts/src/modules/tax/tax-rule-params.ts` (a gap or an overlap between salary slabs is refused, naming the amounts). `taxService.ruleFor(ctx, kind, date, province?)` returns the confirmed rule in force or refuses, naming the kind and the date. **No rate, slab, threshold or ceiling is in the code**; the figures in the tests are invented and say so. How each calculator reads its rule is written in [M25](../10-modules/m25-tax-compliance.md) section 4 and is marked for confirmation by a tax adviser.

**Notification dispatch** (`packages/core/src/modules/messaging/`): `dispatch.ts` is installed as the kernel's dispatcher, so `emit` now reaches people. For an event it finds the rule (the school's own, else the catalogue's), turns each audience into people (`audiences.ts`: guardians of a student, a family or a section, the student, the class teacher and the teachers of a section, a staff member and their manager, everyone holding a role at a branch or in the school, a named login, the requester, the owner of a record), writes the bell for everyone with a login, and places one message on the first channel that can reach the person. A channel that cannot (no number, opted out, no approved WhatsApp template) is recorded as skipped with its reason and the next channel is linked to it; a muted channel is recorded and nothing replaces it; an urgent event goes on every channel and ignores quiet hours and mutes; a compulsory one ignores mutes and cannot be switched off. In quiet hours a message is `held` and its sending job waits for the morning. `notify.deliver` sends through the provider: a temporary failure is tried again after 1, 5 and 15 minutes, then the message fails and the next channel takes over. Everything has a dedupe key of event, person and channel, so running dispatch twice adds nothing. Wording comes from the school's template, else the catalogue's; a module supplies amounts, dates and links with `registerEventVariables`. `render.ts` fills templates and counts SMS parts (160 or 70 characters). Tests: `tests/api/messaging/dispatch.test.ts` and the two unit files beside the code.

`GET /dev/outbox` lists what the local stand-ins "sent" (deliveries whose provider is `log`), newest first, and answers 404 in production.

Left for step 2.12 with the rest of M37: what a message costs and the credit it uses, daily digests (a digest event writes the bell now and no outside message), the sending rate, provider callbacks and the status sweep, flagging an invalid contact, expiry of held messages, campaigns, and every route of the module except the outbox. The catalogue has no events yet: each module declares its own with its service. Staff are written to in English for now (see `docs/STATUS.md`, "Left out on purpose").

**Stock movement** (`packages/core/src/modules/inventory/stock.ts`, arithmetic in `stock.rules.ts`): `stock.move` locks the item and the level, refuses to take a store below nothing (saying what is left) or to move an item a stock count is counting, costs stock going out at the item's average and stock coming in at its price, recalculates the average across the organisation and revalues every store's level, numbers and writes the movement, and posts to the ledger as the table in [M32](../10-modules/m32-inventory-assets.md) section 4 says. A source moves an item once. Eight simultaneous issues of the last ten reams end with one issued and seven refused (proved on Docker Postgres). Tests: `tests/api/inventory/stock.test.ts` and `stock.rules.test.ts`. Left for step 2.9: `inventory.allow_negative`, and every route of the module that is not plain.

**Documents** (`packages/core/src/kernel/documents.ts`): `requestDocument(ctx, { kind, entityType, entityId, number?, verify?, title, lines })` makes the file, stores it in the `generated` bucket and records it in `generated_documents` with the hash of its content, in the caller's transaction. A document asked for with `verify` returns its verification code once and keeps only the hash; a number is never used twice for one kind. The renderer is a stand-in (`placeholderPdf`): one plain A4 page, written by hand as a valid PDF, saying what the document is. [Phase 16](phase-16-documents-and-printing.md) replaces the renderer and nothing else. The table needs a file for every row, so the stand-in renders at once instead of queueing; batches become jobs with the real renderer. Only staff and background jobs write the register: a job passes `requestedBy`, because a stored file needs an owner. Tests: `tests/api/kernel/documents.test.ts`.

**The report registry** (`packages/core/src/modules/reports/registry.ts`): `defineReport`, `defineMeasure`, `defineKpi` and `defineWidget`, each with its list and lookup, plus two pure functions: `analysisProblems` (a request outside the vocabulary or the person's permissions is refused, naming what was not allowed) and `combineKpi` (a rate across branches is summed numerators over summed denominators). `reportsService` (`reports.service.ts`) gives the catalogue a person may run, one report's definition with its parameters as JSON Schema, and `run`: the report's own permission first, parameters checked by its schema, every query through the caller's `ctx`, totals worked out from every row, a page of rows returned, the run recorded in `report_runs`, and a report longer than 5,000 rows refused on screen rather than cut short. Routes: `GET /reports`, `GET /reports/[key]`, `POST /reports/[key]/run`. Tests: `tests/api/reports/reports.test.ts` and `registry.test.ts`. No module has registered a report yet: each does with its own service, in `<module>.reports.ts`. Left for step 2.13: export, saved reports, schedules, the analysis engine and its vocabulary, KPI snapshots, dashboards and the settings of the module.

**The calendar** (`packages/core/src/modules/notices/calendar.service.ts`): a module with dates calls `registerCalendarSource({ source, module, entries })`; `calendarService.range(ctx, from, to)` asks every source of a module that is on, each in its own savepoint, and merges what touches the range, oldest first. A source that fails is named in `unavailable` and the rest are still shown. Route: `GET /calendar`. Tests: `tests/api/notices/calendar.test.ts`. No source is registered yet.

**The offline upload** (`packages/core/src/kernel/sync.ts`): a module makes a table writable offline with `registerSyncTable({ table, module, policy, apply: { PUT, PATCH, DELETE } })`, each handler calling the same service as the online route. `applySyncBatch` checks the device is the caller's own and active (a revoked one is answered `wipe: true` and nothing is applied), then takes the operations in order, each in a savepoint with `ctx.source = 'sync'` and the device id: applied; duplicate when its `opId` was dealt with before; rejected, with the reason kept in `sync_rejections`, for a table or a kind that is not registered or for anything the service refuses; conflict, with both values kept in `sync_conflicts`, when the handler says the server's value stays. An error nobody expected stops the batch with a server error and keeps none of it. Route: `POST /sync/upload`. Tests: `tests/api/kernel/sync.test.ts`. No table is registered yet; each module's "Offline" section says which are. The other seven `/sync` routes (devices, rejections, conflicts) are part of M00 in step 2.2.

**The `fake` payment provider** (`packages/core/src/providers/payments.ts`) was written in Phase 0 and now has tests (`payments.test.ts`). One fault was put right: asked about a payment it had never heard of, it answered "failed"; the web app and the worker each hold their own stand-in, so the worker's inquiry would have failed a payment started in the web app. It now answers "cannot tell". The page that completes, fails or delays a fake payment (`/dev/payments`) is a screen of [Phase 4](phase-04-frontend-foundation.md) and needs the payment intents of step 2.8. The M22 specification names the adapter's functions `verifyCallback` and `parseSettlement` and puts adapters in `packages/core/src/integrations/payments/`; the code has `parseWebhook`, `refund` and `providers/payments.ts`. Settle that difference, spec first, at step 2.8.

### Step 2.2, module by module (12 Oct 2026)

**M00, the shared kernel: complete.** `pnpm api:verify-plan --module M00` and `pnpm plan:coverage --module M00` both say so. What each group of routes does, and what was decided on the way, is written into the spec itself (section 4); in short:

| Routes | Service | What was decided |
|---|---|---|
| Files, attachments | `modules/shared/files.service.ts` | Confirming an upload answers with the file's state: a quarantine is a fact to keep, so it is an answer and not an error. A download link goes to the uploader or to whoever can read a record the file is attached to. `registerRecordAccess` (`kernel/record-access.ts`) is how "any record" answers who may read and change it; every plain resource registers itself |
| Approvals, approval policies | `approvals.service.ts`, `approval-policies.service.ts` | The inbox has three scopes (`waiting`, `mine`, `all`). The kernel now checks the approver's branch and emits the three approval events. A record deleted while it waits cancels its request (the generic delete does it) |
| Jobs | `jobs.service.ts` | A failed job is retried by hand at most three times, counted from the audit log. The `jobs` table gained an update policy for staff (a migration) |
| Imports, exports | `imports.service.ts` | Checked at upload and committed inside the request for now; the two import jobs take over when a file is large enough to need them. A commit that is cut short keeps nothing and can be run again |
| Custom fields | `custom-fields.service.ts`, `custom-fields.rules.ts` | Key, entity and type are fixed once a field exists; deleting switches it off. `customFieldsService.validate` is what a module's service calls |
| Notes, saved views | `notes.service.ts` | A `leaders` note is read by the leaders and its author. A person has one default view for each list and at most 30 views of it |
| Global search | `search.service.ts`; sources in `students/students.search.ts`, `staff/staff.search.ts`, `fees/fees.search.ts` | Each kind of record answers for itself (`registerSearchSource`). A teacher finds only the students of their sections; `teacherSectionIds`, `wingGradeIds` and `enrollmentReach` now exist in `modules/academics/scope.ts` |
| Integrity findings | `integrity.service.ts` | `registerIntegrityCheck` and the nightly job `shared.integrity`. No module has registered a check yet: each does with its own service |
| Devices, refused changes, conflicts | `sync.service.ts` | The server gives a device its two-character code. Registering again is how a device checks in. Taking a device's value in a conflict goes through the `takeDevice` handler of the table's module |
| Nightly cleanup | `cleanup.job.ts` | Also removes an upload that was never finished after 24 hours |

`tests/api/security/rls.modules.test.ts` holds, module by module, the listed test "row-level security for every table in this module": it proves that every table the plan gives the module is in the registry (and so is probed by the generated security tests) and has its policies in the database. Add the module's line to it when a module is finished.

**M02, organisation and branches: complete.** New: `org.service.ts` (the profile, with R-org-7 and R-org-8), `settings.service.ts` (who may read and who may change which setting), `wings.service.ts`, `onboarding.service.ts`, and `modules/accounting/fiscal-calendar.ts` (moving the first fiscal year while it is untouched). Decided on the way, and written into the spec:

- A setting says who may change it (`permission`) and who may read it through the API (`readableBy`). `registerSettingForTests` lets a test prove a rule on a setting made for the purpose.
- Wings have a `gender` (a migration), because R-org-9 lets a boys' wing and a girls' wing share grades and nothing in the table said which was which.
- What stops a branch from being deactivated, or the way of billing from changing, is answered by the module that owns the blocking records: `students/students.blockers.ts` and `fees/fees.blockers.ts` register the real counts.
- A new branch needs no copy of the working week (it has the group's value until it has its own). `branch.created` carries `copyBellSchedule` and `copyFeeStructuresFrom`; **the timetable and fees modules must subscribe and do the copying** when they are built (steps 2.5 and 2.8).
- Staff are shown a branch's own setting values only at a branch they work at.

The event catalogue now holds the seven events of M00 and the three of M02.

### What to do next

1. Step 2.2, the rest: M03 (30 routes wait), then M01 (49 wait). M03 needs a stand-in for the sign-in service (`providers/auth.ts`, like the other providers), since invitations, forced sign-out and password resets act on logins; read Supabase Auth's current documentation before writing the real one.
2. Then each module in the order of the table. As a module's service is written it also declares its events and their wording, its settings, its reports, its calendar source and its offline tables: the registries are waiting for them.

After a change to any route file run `pnpm api:manifest`, then `pnpm api:verify-plan`.

**Taking a resource over** (when it gets rules of its own):

1. Add its table to `handWritten` in `docs/plan/_tools/api-hints.mjs`.
2. Remove the three-line "Generated by" header from its `*.contract.ts`, `*.db-service.ts`, `*.service.ts`, its route files, `*.api-service.ts` and `*.hooks.ts`. From then on they are ordinary files.
3. Run `pnpm scaffold:api`: the four `generated` lists stop exporting those files, so add the exports to each package's `index.ts` by hand, next to `rooms`. The scaffolder deletes nothing; if it lists a file as "no longer generated", that file still carries the header.
4. Write the rules in the service (`rules.beforeCreate`, `beforeUpdate`, `beforeRemove`, `afterWrite`), tighten the contract, register friendly constraint messages, add the named actions beside it, and write the tests named after the spec's ids.

`rooms` (plain, with rules) and `branches` (with named actions) are the worked examples.

**Thirty-seven "add" operations wait** because a required column is one the server fills. Most truly need a service (a number from a sequence, a total, a posting). A few were held back only by the generator's cautious reading of the column's rule and may just need the column listed under `input` in the hints: check `bell_schedules.lesson_count`, `student_discounts.calc`, `salary_components.calc`, `notices.branch_ids`, `vendors.code` and `inventory_items.sku` against their specs. `pnpm scaffold:api --report --all` lists all thirty-seven with the column that blocks each.

## Left for later, on purpose

- API-services and hooks for the routes that are not plain: [Phase 3](phase-03-client-layer.md). The plain ones already have theirs.
- Real PDFs: [Phase 16](phase-16-documents-and-printing.md). Real providers: [Phase 18](phase-18-integrations.md). Model-backed AI: [Phase 19](phase-19-ai.md).
- The PowerSync service itself: [Phase 17](phase-17-offline.md); only the upload endpoint and its handlers exist now.

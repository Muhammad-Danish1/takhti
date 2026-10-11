# Phase 1 · Database, contracts and seed data

**Goal.** The whole data model of the product exists: every table with its constraints, indexes and row-level security; every contract (the Zod schemas and TypeScript types the other layers share); and seed data rich enough to test and demonstrate every module.

**Depends on.** [Phase 0](phase-00-setup-and-kernel.md).

**Produces.** Layers 1 and 2 for all 45 modules: 416 tables (55 already exist from Phase 0), the permission, event, setting and state-machine catalogues, and a seeded demo school.

**Why the whole schema first.** Tables reference each other across module boundaries in every direction. Building all of them before any service means a service is never written against a table that later changes shape, and the generated security tests cover the entire product from the start.

## Read first

[05 · Conventions](../00-foundation/05-conventions.md) (base columns, money, dates, enums, soft delete, versions), [06 · Tenancy, roles and access](../00-foundation/06-tenancy-roles-and-access.md) (scopes and policy templates), [12 · Pakistan domain rules](../00-foundation/12-pakistan-domain-rules.md), [14 · Offline design](../00-foundation/14-offline-design.md) (what the schema must allow), and section 3, 4 and 14 of each module spec as you reach it.

## How to write one module's data layer

The tables, value lists, record schemas and permissions are **generated from the module specs** by `pnpm scaffold`; nobody types a column twice. Why, and the rules that keep it honest, are under "How it is going" below. For each wave, in this order:

1. **Read each module's sections 3, 5, 6 and 14** and decide, table by table, what the fixed notation cannot say. Write those decisions in `docs/plan/_tools/scaffold-hints.mjs`:
   - who may reach the rows, where it differs from the scope's template (and add a `Policy:` line to the spec saying so);
   - a check constraint for every rule the database can enforce ("required for `probation`", "one of the two is required", "different from `from_branch_id`"), or a note that the service enforces it;
   - what a unique rule means when one of its columns may be empty;
   - statements Drizzle cannot express (see the table below).
2. **Run `pnpm scaffold`** with `throughWave` raised. It stops with a list if anything in a spec is not accounted for. It writes the files listed under "How it is going".
3. **Add the foreign keys owed to earlier waves** by editing the earlier table file (see "Columns that point forward").
4. **Generate the migration**: `pnpm db:generate --name wave-N-<name>`, then `pnpm db:custom-sql N` to add the hand-written SQL to it. Read the SQL.
5. **Prove what the generated tests cannot**: a table marked `custom`, a view, a trigger each get a hand-written test. Every other table is covered by the generated security tests the moment it exists.
6. **Seed** — `packages/db/src/seed/waveN/<module>.ts`, creating what the spec's section 14 lists, through plain inserts on the privileged connection (services do not exist yet). Deterministic: the same "today" always gives the same ids, names and amounts. Add the wave's integrity checks to `seed/verify.ts`.
7. **Run** `pnpm db:reset`, `pnpm db:verify-seed`, `pnpm check`, `pnpm test:db`, `pnpm db:verify-plan`, `pnpm smoke`.

**Carried over from Phase 0** — the resource contracts of the Wave 0 tables that Phase 0 did not need (roles, memberships, invitations, the audit log, login events, approval policies and requests, custom fields, notes, saved views, sync devices, plans, subscriptions and their invoices, demo requests) are written in Phase 2 with their services, like every other input contract. Their tables, policies and security tests already exist.
### Rules that apply to every table

- Primary keys are `uuid`, created by the application (UUID v7), so a device can create a record offline.
- Every table has row-level security switched on in the same migration that creates it. A table with RLS on and no policy is unreachable, which is the safe failure.
- Money is `bigint` paisa; dates are `date` read as strings; timestamps are `timestamptz`; enums are `text` with a check.
- A foreign key to a parent that is soft-deleted stays valid; nothing is ever physically deleted except by the retention jobs.
- `on delete` is `restrict` everywhere, except child rows that have no meaning without their parent (lines of a draft document), which `cascade`.
- Every foreign key column has an index unless a composite index already starts with it. The `table()` helper adds the missing ones itself; `org_id` is exempt, and a column marked `unindexed(...)` says why beside it ([05](../00-foundation/05-conventions.md)).
- Every table that an offline device writes ([14](../00-foundation/14-offline-design.md)) has `client_op_id` uniqueness where its spec says so.

### Things Drizzle cannot express — custom SQL in the wave's migration

| Object | Where |
|---|---|
| Exclusion constraints (`btree_gist`) | `hostel_allocations` (one boarder per bed per period), `facility_bookings` (no overlapping approved bookings of a room), `salary_structures` (no overlapping active structures per person), `fiscal_years` (no overlap), `tax_rules` (no overlapping confirmed rules of a kind and province) |
| Deferred constraint trigger | `journal_entries` / `journal_lines`: a posted entry must balance overall and per branch. A second trigger refuses any change to a posted line |
| Generated columns | `fee_vouchers.balance`, `fee_payments.unallocated`, `vendor_bills.balance`, `leave_balances.available`, `assets.book_value`, `health_screenings.bmi`, `knowledge_chunks.search`, `kpi_snapshots.dims_key`, `budget_lines.annual`, `increments.percent` |
| Partial unique indexes ("among live rows", "one open … per …") | Wherever a spec's `Unique:` line says so |
| Trigram and full-text indexes | Names and numbers used by search boxes; `questions.text`; `library_items`; `knowledge_chunks.search` |
| Monthly partitions | None yet. `vehicle_locations` and the other large tables (`audit_log`, `message_deliveries`, `biometric_punches`) stay plain until [Phase 21](phase-21-hardening-and-launch.md) measures whether they need it |
| Append-only guard | A trigger on every `append-only` table refusing update and delete even for a role that bypasses RLS |
| `vector` extension | Not enabled yet. `knowledge_chunks.embedding` is a plain list of numbers; the migration that turns vector search on changes it to pgvector's type and adds its index. The in-process engine the tests run on has no pgvector |

## Waves

Waves are ordered so that foreign keys point backwards. Table counts are from the [tables index](../30-reference/tables-index.md).

| Wave | Modules | Tables | Seed scenario at the end of the wave |
|---|---|---|---|
| 0 (done) | M00, M01, M02, M03 | 55 | A school group, two branches, roles, one account per role |
| 1 · Setup and people | [M04](../10-modules/m04-school-setup.md), [M26](../10-modules/m26-staff-recruitment.md), [M11](../10-modules/m11-academic-structure.md), [M07](../10-modules/m07-students.md) | 42 | The current academic year with terms and holidays; all staff; grades, sections and subjects; about 1,150 students with families and guardians |
| 2 · Front door | [M05](../10-modules/m05-integrations-api.md), [M06](../10-modules/m06-admissions.md), [M08](../10-modules/m08-certificates-id-cards.md), [M09](../10-modules/m09-front-office.md), [M10](../10-modules/m10-alumni.md) | 28 | An admissions pipeline in every stage; certificates and ID cards; a day of visitors and gate passes |
| 3 · Academics | [M12](../10-modules/m12-timetable.md), [M13](../10-modules/m13-syllabus-lesson-plans.md), [M14](../10-modules/m14-student-attendance.md), [M15](../10-modules/m15-homework-diary.md), [M19](../10-modules/m19-question-bank-papers.md), [M16](../10-modules/m16-lms.md), [M17](../10-modules/m17-exams-marks.md), [M18](../10-modules/m18-results-report-cards.md), [M20](../10-modules/m20-behaviour-houses.md) | 62 | A published timetable; three months of attendance; diary and homework; exams in every state with marks; published results |
| 4 · Finance | [M23](../10-modules/m23-accounting.md), [M25](../10-modules/m25-tax-compliance.md), [M21](../10-modules/m21-fees.md), [M22](../10-modules/m22-online-payments-reconciliation.md), [M24](../10-modules/m24-expenses-procurement.md) | 63 | Six months of vouchers and payments with a ledger that balances; bank statements partly reconciled; purchases and expenses |
| 5 · People operations | [M27](../10-modules/m27-staff-attendance-leave.md), [M28](../10-modules/m28-payroll.md), [M29](../10-modules/m29-appraisal-training.md) | 30 | Staff attendance and leave; six payroll runs; an appraisal cycle |
| 6 · Operations | [M32](../10-modules/m32-inventory-assets.md), [M30](../10-modules/m30-transport.md), [M31](../10-modules/m31-library.md), [M33](../10-modules/m33-shop-canteen.md), [M34](../10-modules/m34-health-clinic.md), [M35](../10-modules/m35-hostel.md), [M36](../10-modules/m36-maintenance-helpdesk.md) | 71 | Stock and assets; routes with trips; a library in use; shop sales and wallets; clinic visits; a hostel; helpdesk tickets |
| 7 · Communication | [M37](../10-modules/m37-messaging-hub.md), [M38](../10-modules/m38-chat-ptm.md), [M39](../10-modules/m39-notices-events-calendar.md), [M40](../10-modules/m40-complaints-surveys.md), [M41](../10-modules/m41-school-website.md) | 41 | Notifications and deliveries; chats; notices and events; complaints and surveys; a published website |
| 8 · Insight | [M42](../10-modules/m42-dashboards-reports.md), [M43](../10-modules/m43-owner-analytics.md), [M44](../10-modules/m44-ai-suite.md) | 24 | KPI snapshots for 90 days; targets and alerts; AI drafts, scores and flags |

### Columns that point forward

Thirteen columns refer to a table created in a later wave. Create the column in its own wave as a plain `uuid`; add the foreign key in the later wave's migration by editing the earlier table file then.

| Column | Points to | Constraint added in |
|---|---|---|
| `branches.principal_staff_id`, `wings.head_staff_id` | `staff` | Wave 1 |
| `branches.board_id` | `boards` | Wave 1 |
| `memberships.staff_id` | `staff` | Wave 1 |
| `memberships.guardian_id`, `memberships.student_id` | `guardians`, `students` | Wave 1 |
| `students.source_application_id` | `admission_applications` | Wave 2 |
| `students.house_id` | `houses` | Wave 3 |
| `substitutions.leave_request_id` | `leave_requests` | Wave 5 |
| `staff.work_schedule_id` | `work_schedules` | Wave 5 |
| `purchase_request_lines.item_id`, `po_lines.item_id` | `inventory_items` | Wave 6 |
| `goods_receipts.warehouse_id` | `warehouses` | Wave 6 |

Inside a wave, tables that refer to each other (for example `staff` and `departments.head_staff_id`) are created together; drizzle-kit writes all `create table` statements first and the foreign keys after them.

## Seed data

The full description is in [seed data](../30-reference/seed-data.md). In short:

- **One demo school group**, "Roshan Public School", with two branches of different size and character, so every multi-branch feature has something to show.
- **A second, small organisation** ("Al-Noor Grammar School", one branch, twenty students), which exists only so that every isolation test has another tenant to try to reach.
- **Dated relative to today.** The seed takes "today" as a parameter (default: the day it runs) and places everything relative to it: the academic year contains today, this month's vouchers are open, an exam is in progress. `pnpm db:seed --today 2026-11-15` reproduces a particular day.
- **Consistent, not random.** Fee payments match the ledger. Attendance matches the leave requests. Results match the marks. The integrity checks in [09](../00-foundation/09-reliability-and-error-proofing.md) must pass on freshly seeded data; that is one of this phase's exit checks.
- **Realistic.** Pakistani names in English and Urdu, real-looking CNIC and phone formats that are not real numbers (phone numbers use the reserved test range the local OTP map expects), plausible amounts.
- **Sizes.** `pnpm db:seed` loads the standard set in under two minutes. `pnpm db:seed --large` multiplies students to 5,000 for the performance tests.

## Work packages

### 1.1 · Tooling for the phase

- [x] `pnpm db:verify-plan`: reads `docs/plan/_tools/out/plan.json` (written by `pnpm plan:check --json`) and the table registry, and reports any table or column that is in one and not the other, and any scope that differs. It also compares every module's permission keys and default roles with the plan.
- [x] `pnpm db:lint` (`tests/db`, part of `pnpm test`): every table has RLS on; every foreign key column is indexed; every `text` enum has a check that names exactly its values; every `*_at` is `timestamptz` and every `*_on` or `*_date` a `date`; no table lacks the base columns for its scope; every unique index leaves deleted rows out unless listed as "for ever"; only the views listed exist. Money columns are covered by `db:verify-plan`, which compares every column type with the plan.
- [x] Seed framework: `seed/context.ts` (fixed ids, repeatable random numbers, date arithmetic around "today"), `seed/people.ts` (names in English and Urdu, numbers that belong to nobody), `seed/schools.ts` (the two schools, needing only a database), `seed/run.ts` (the command: sign-in accounts and storage buckets around it), `seed/verify.ts` (integrity checks), `seed/accounts.ts`.
- [x] **`pnpm scaffold`** (added): writes each module's tables, value lists, record schemas, permissions and type tests from its spec. See "How it is going" below.

### 1.2 to 1.9 · One work package per wave (1 to 8)

The list below is the recipe for a wave, kept for reference. Every step of it is done for all eight waves except the seed step, which is done for Waves 1 and 2 and for part of Wave 3; the table after it says which.

For each wave:

- [ ] Decisions for the wave in `docs/plan/_tools/scaffold-hints.mjs`: who reaches each table, constraints the notation cannot carry, hand-written SQL. A `Policy:` line in the spec for every table that departs from its scope's template.
- [ ] Raise `throughWave`; `pnpm scaffold` (tables, value lists, record schemas, permissions, type tests, test fixtures).
- [ ] Foreign keys owed to earlier waves (the forward-pointing columns).
- [ ] `pnpm db:generate --name wave-N-<name>`; `pnpm db:custom-sql N`; review the SQL.
- [ ] Hand-written tests for anything the generated tests cannot prove: custom policies, views, triggers.
- [ ] Seeds for the wave and its checks in `seed/verify.ts`; `pnpm db:reset`; `pnpm db:verify-seed`.
- [ ] `pnpm check`, `pnpm test:db`, `pnpm db:verify-plan`, `pnpm smoke`.

| Wave | State |
|---|---|
| 1 · Setup and people | **Done 10 Oct 2026.** 42 tables, 56 permissions, one view. Seed: 92 staff, 33 sections, 1,152 active students in 933 families at Roshan; 20 students at Al-Noor |
| 2 · Front door | **Done 10 Oct 2026.** 28 tables, 44 permissions. Seed: stand-in connections and an attendance machine; 120 enquiries and 45 applications in every state; certificate types and templates, 37 certificates, ID cards for two classes and one department; a week at the reception desk; 180 alumni |
| 3 · Academics | **Tables done 11 Oct 2026.** 62 tables, 82 permissions, one view. Seed: a published timetable at every campus with this week's substitutions; a syllabus for every subject with term plans, progress and two weeks of lesson plans; the register of every school day of the year with leave and corrections; three weeks of diary and homework. Demo data for quizzes, the question bank, exams, results and behaviour comes through the services (see "Demo data moves to the services") |
| 4 · Finance | **Tables done 11 Oct 2026.** 63 tables. No demo data yet |
| 5 · People operations | **Tables done 11 Oct 2026.** 30 tables. No demo data yet |
| 6 · Operations | **Tables done 11 Oct 2026.** 71 tables. No demo data yet |
| 7 · Communication | **Tables done 11 Oct 2026.** 41 tables; chat is closed to everyone but the people in a thread. No demo data yet |
| 8 · Insight | **Tables done 11 Oct 2026.** 24 tables. No demo data yet |

All 416 tables and 439 permissions are now in code and match the plan (`pnpm db:verify-plan`).

### 1.10 · The catalogues

- [x] `packages/contracts/src/catalogue.ts` gathers every module's **permissions** (all 439); the `permissions` table is brought in line with it on every migration run.
- [ ] The same catalogue for **settings and events** of the modules of Waves 1 to 8. Not written: they are declared with each module's service in [Phase 2](phase-02-services-and-routes.md). Today the catalogue holds only the organisation module's settings.
- [x] Default role grants. Done differently from the first plan: there is no `default-grants.ts`. Each permission carries its default roles in the generated `*.permissions.ts`, `defaultPermissionsFor(role)` in the catalogue works a role's grants out from them, and `pnpm db:verify-plan` compares every key and its default roles with the plan.
- [x] Module keys with their tiers (`packages/contracts/src/access/modules.ts`).
- [ ] The map from a subscription plan to the modules it switches on, for `org_modules`. Not written; the seed switches modules on by hand (`seed/schools.ts`).

### 1.11 · Squash

Before this phase closes, and only now, the migrations of Waves 0 to 8 may be squashed into `0001_initial` (keeping `0000_foundation` separate), because no database with real data exists yet. After this point a migration is never edited or removed.

- [ ] Not done, and optional. There are 11 migrations today. Decide before the first real database exists.

## Exit checks

1. `pnpm db:verify-plan` reports no difference: 416 tables, every column, every scope.
2. `pnpm db:lint` passes.
3. `pnpm db:reset` on Docker Postgres finishes in under three minutes and prints the accounts.
4. The generated security tests pass for every table on both engines.
5. Every check constraint and unique index has a test that it refuses a bad row (generated where the registry can describe the constraint, hand-written otherwise).
6. The integrity checks pass on freshly seeded data: every journal entry balances; the trial balance nets to zero; fee receivable in the ledger equals open voucher balances; stock levels equal their movements; wallet balances equal their transactions; leave balances equal their ledgers.
7. `pnpm typecheck` passes with every contract's type agreeing with its table.
8. A second organisation's user, acting through `withUserTx`, can read no row of the first in any of the 416 tables (one generated test that loops over the registry).

### Where the exit checks stand (11 Oct 2026)

| # | State |
|---|---|
| 1 | **Passes.** 416 tables and 439 permissions match the plan |
| 2 | **Passes** |
| 3 | **Not met.** Emptying the database and applying the eleven migrations took two and a half minutes when measured on their own, and the full-size seed about a minute and a half (attendance alone about a minute). A complete reset took six minutes while other tests were running on the machine. `--small` is much quicker. To do: load attendance in fewer, larger statements, and see whether a squash shortens the migrations |
| 4 | **Passes** on both engines |
| 5 | **Not done.** The generated tests prove who may reach each table; no test yet feeds every check constraint and unique index a bad row. The hand-written policy and view tests cover their own cases only |
| 6 | **Waits.** The ledger, stock, wallet and leave-balance checks need demo data that is created through the services in Phase 2. The 38 checks that exist cover Waves 1 to 3 |
| 7 | **Passes** |
| 8 | **Passes**: it is part of the generated security tests |

The phase is therefore not closed. Phase 2 was started without waiting for it, on the owner's instruction to move on to the API.

## How it is going

Written while the phase is under way; it becomes "How it went" when the phase closes.

### The data layer is generated from the specs

361 tables cannot be typed by hand without mistakes, and the specs' notation is regular enough to read by program. So `pnpm scaffold` (`docs/plan/_tools/scaffold.mjs`) writes, for every module of a wave:

| File | Holds |
|---|---|
| `packages/db/src/schema/<module>/<module>.table.ts` | Every table: columns, checks, unique rules, indexes, foreign keys and who may reach its rows |
| `packages/contracts/src/modules/<module>/<module>.constants.ts` | The allowed-value lists |
| `packages/contracts/src/modules/<module>/<module>.entities.ts` | One Zod schema and type per table: the record as the API returns it |
| `packages/contracts/src/modules/<module>/<module>.permissions.ts` | The Permissions table |
| `tests/types/entities/<module>.ts` | A compile-time proof that each record type matches its table |
| `tests/api/security/rls-fixtures.generated.ts` | Values that satisfy the generated checks, for the security tests |
| `packages/db/src/custom-sql/wave-N.sql` | What Drizzle cannot express: exclusion constraints, views, functions |

Its only inputs are the specs and `docs/plan/_tools/scaffold-hints.mjs`, which holds every decision the notation cannot carry. Three rules keep this honest:

1. **Nothing is dropped silently.** A sentence under a table that the generator cannot read, a `Policy:` line nobody acted on, a column rule that sounds like a constraint ("one primary per staff member", "required for `probation`"), a unique rule over an optional column: each is an error until the hints say what is done about it.
2. **Generated files are never edited.** A test runs `pnpm scaffold --check`; a difference fails the build. A change goes into the spec or the hints.
3. **The plan and the code cannot drift.** The same specs feed `pnpm db:verify-plan`, which compares the finished tables and permissions with the plan from the other side.

### What each wave delivers, and what waits for Phase 2

Delivered here for every module: tables with all constraints and access rules, value lists, record schemas and types, permissions, security tests, seed data.

Moved to [Phase 2](phase-02-services-and-routes.md), to be written with the service that uses them: the `Create`, `Update` and `List` inputs of each resource, settings, events, state machines and the friendly messages for constraint names. Writing them now would mean guessing which fields a client may set and which steps exist; an input schema is only right once its service is.

### Access rules are declared, not hand-written

A table is declared with `defineTable(name, access, columns, extra)`. From the one `access` description come its policies, its registry entry and its generated security test, so the three cannot disagree. Beyond the scope templates it can say:

- what staff and ordinary members may do (`staff`, `member`), each as a word (`read`, `append`, `write`) or operation by operation;
- that a rule holds only while a row is in a certain state: `member: { read: { status: 'published' } }`;
- what a family may do with rows about its own students (`familyRule`), a household with its own rows (`householdRule`), a guardian with the row about themself (`guardian`), a user with their own (`selfAccess`).

The security tests probe a table once for every state its rules name, and once in none of them. Notation added to the specs for this: `+household(column)`. Tables that a family's screens need, although their scope is staff-only, carry a `Policy:` line saying every member may read: the school calendar, grades, sections, subjects and who teaches what.

**Families never read the staff table.** They read the view `staff_directory`: id, name, gender, photograph and whether the person still works here. A view runs with its owner's rights, so each view filters by organisation itself, is read-only, is listed in `tests/db/foundation.test.ts` and proved in `tests/api/security/views.test.ts`.

### Found while building Wave 1

- **Memberships now point at real people.** Once `staff`, `guardians` and `students` existed, the three person columns of `memberships` became foreign keys. The token hook and the API's access loader both learned a guardian's children (the students they are linked to, not the whole family, so removing a link removes the reach) and the family of a guardian or student.
- **One enrolment per year was too strict.** A transfer between campuses, or a re-admission in the same year, closes one enrolment and opens another. The unique rule now leaves out rows that are `left` or `transferred` ([M07](../10-modules/m07-students.md), R-students-5).
- **`staff_change_requests` is `+cap(hr)`.** Its `Policy:` line (the person themself, or HR) is exactly what the capability wall does, and a request carries private details.
- **Examination boards are product data.** The `boards` table follows a list in code on every migration run, like permissions, so production has them without a seed.
- **The seed writes each school in one transaction**, not one per module: a failure then leaves no half-made school, and "already there, left alone" stays true.
- **Documents are not seeded yet.** A document row needs an uploaded file; they arrive with the phase that builds uploads.
- **Spec figures corrected to one set**: the seed sections of M04, M07, M11 and M26 and the [seed reference](../30-reference/seed-data.md) now give the same sizes.

### Found while building Wave 2

- **A family may add a row only in its starting state.** A guardian asks for a gate pass, an appointment or a certificate from the portal. The rule now says so in the database as well: `familyRule: { read: true, insert: { status: 'requested' } }` lets a family add a `requested` row and no other, so a request can never arrive already approved, whatever the service does.
- **A time of day is named `…_time`.** `…_at` is kept for moments. Six columns in M09, M30 and M38 were renamed (`leave_time`, `return_expected_time`, `pickup_start_time`, `drop_start_time`, and `start_time` and `end_time` of a parent–teacher meeting); the convention test that found them now guards the rule.
- **A tracking token is unique**, like every other token: `admission_applications.tracking_token_hash`.
- **Some unique rules hold for ever**, deleted rows included: a provider's event id, an API key's hash, an ID card's QR token. Each is listed, with its reason, in `tests/db/conventions.test.ts`.
- **The seed's "today" at the gate is the last school day.** When the seed is placed on a weekend, the visitors still inside, the morning's punches and the passes waiting for a decision belong to the Friday before.
- **Not seeded yet, each for the same reason** (it needs something a later phase builds): application, staff and student documents (uploads); webhook deliveries (events written by services); a certificate's printed file (the documents service).
- **Alumni are students who graduated.** The three classes before this year are written as student records with status `graduated`, each with a family and a guardian; only last year's class has an enrolment, because the seed holds two school years.

### Found while building Wave 3

- **A rule may wait for a column to have a value.** Families read an exam once its date sheet is out: `member: { read: { datesheetPublishedAt: { set: true } } }`.
- **Some rows follow their parent.** A paper's sections and questions are readable exactly when the paper is; a result's subjects, report card and co-scholastic scores exactly when the result is. These are hand-written restrictive policies, proved in `tests/api/security/custom-policies.academics.test.ts`.
- **A fifth capability, `papers`.** A confidential question paper is read before its exam only by its writer and by those who approve papers or may see them all. Counselling notes are reached by their writer, and by `counselling:read-all` alone.
- **Families see house totals, not house points.** The view `house_point_totals` gives the sum per house and year, never who was given points or why.
- **`exam_seating` is `+family`**: a family reads its own child's seat.
- **The security tests run in batches of 25 tables**, each on a fresh database, and release their savepoints: the in-process engine loses stack with every refused statement.
- **On the real server a refused statement fails its transaction at the end, even when it was caught** and rolled back to a savepoint: that is how the driver works. A test that probes with statements it expects to be refused ends its transaction with an error of its own.
- **The seed knows where a student sat on each day.** A child who changed campus or section has two stays; attendance, homework and (later) marks of a day belong to the section of that day.
- **The register covers every school day of the year so far**, not sixty days, so a term result can print days present.
- **Most teachers have no sign-in in the seed** (there is one per role). What such a teacher did is recorded under the academic office of their campus. Only four families can sign in until Phase 5, so only they have acknowledged the diary.

### Found while building Waves 4 to 8

- **"Required when" is a check.** `neededWhen: { paid_from: 'bank' }` in the hints becomes `paid_from <> 'bank' or bank_account_id is not null`, and the security tests are given a row that asks for nothing. Rules that need other rows or a setting to judge stay with the service, and say so.
- **A posted journal line is fixed; a draft one is not.** `journal_lines` is no longer append-only: a trigger refuses any change to a posted line, and a deferred constraint trigger refuses to commit a posted entry that does not balance within each branch. `fee_voucher_lines` and `fee_payment_allocations` became append-only, as their text already said.
- **Chat belongs to the people in it.** Being staff opens nothing. A thread and its messages are read through a row in `chat_participants`, and nobody, staff included, can add or change such a row except through the service; a private reply is read by two people. `chat_messages` is not append-only, because a message can be removed. Proved in `tests/api/security/custom-policies.communication.test.ts`.
- **A closed table still has a policy.** Survey responses and answers are read by nobody through the application role; a table with no rule at all gets one that allows nothing, so row-level security is on.
- **Headings corrected**: `shop_sales` is `+family`, `dashboard_layouts` is `+self`. `chat_participants` and `survey_answers` gained a `Policy:` line.
- **Money that may be negative says so**: a cash difference, an overdrawn balance, a reversal, stock going out.
- **Generated columns name their siblings through the table**, not through `t`, which does not exist where columns are declared.
- **An index cannot join a list of words**, so the library's search index goes through `app.words`.
- **Two names keep their meaning against the convention**: `payslips.tax_to_date` and `taxable_to_date` are running totals, not days; both are listed with the reason in `tests/db/conventions.test.ts`.
- **`drizzle-kit generate` waits for a keyboard** when one is attached; from a script it is run with its input closed.

### Demo data moves to the services

On 11 October the order of work changed: the tables of every remaining module were built first, without demo data, so that the services and routes of [Phase 2](phase-02-services-and-routes.md) can start. Writing demo data by hand for money, marks and results would also have meant writing the fee, payroll and result calculations twice, once in the seed and once in the service; the [seed principles](../30-reference/seed-data.md) already ask for it to be made by the real code.

So the demo data of M16 to M20 (quizzes, question bank, exams, results, behaviour) and of every module of Waves 4 to 8 is created by calling the services, in the phase that builds each service. Until then those tables are empty in a seeded database, and exit check 6 (the ledger and stock integrity checks on seeded data) waits with them.

## Left for later, on purpose

- No services, no routes: [Phase 2](phase-02-services-and-routes.md). The seed therefore bypasses business rules; Phase 2 re-validates it by running rule checks over seeded data. Until then `pnpm db:verify-seed` checks what must hold of seeded data.
- Inputs, settings, events, state machines and constraint messages: with their services, as above.
- Notification wording: placeholders until [Phase 12](phase-12-communication.md).
- The PowerSync publication: [Phase 17](phase-17-offline.md).

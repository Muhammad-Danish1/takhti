# 05 · Conventions

Three parts: how code is written, how data is shaped, and how this plan is written.

## Part A — Code

### TypeScript

- `strict` and `noUncheckedIndexedAccess` are on. No `any`, except the few casts inside the kernel factories, each with a comment saying why.
- Named exports only. Default exports only where Next.js requires them (pages, layouts, config).
- No `enum` keyword. An allowed-values list is a `const` array in the contract; the Zod enum and the database check are both built from it.
- Never `new Date()` in a service or rule. Use `ctx.now` (ISO timestamp of the request) and `ctx.today` (Pakistan calendar date). Tests set both.
- Never `console.log`. Use `ctx.log` or the kernel logger.
- No floating-point maths on money. Use the functions in `kernel/money.ts`.

### Naming

| Thing | Rule | Example |
|---|---|---|
| File | kebab-case, with its layer as a suffix | `fee-vouchers.service.ts` |
| Resource (contract `name`) | kebab-case plural noun | `fee-vouchers` |
| Database table and column | snake_case; tables plural | `fee_vouchers.due_date` |
| TypeScript property | camelCase (Drizzle maps it to snake_case) | `dueDate` |
| Zod schema and its type | PascalCase, same name for both | `FeeVoucher`, `CreateFeeVoucher` |
| DB-service object | `<resource>Db` | `feeVouchersDb` |
| Service object | `<resource>Service` | `feeVouchersService` |
| API-service object | `<resource>Api` | `feeVouchersApi` |
| Hook | `use` + verb/noun | `useFeeVouchers`, `useCollectFee` |
| Permission | `<resource>:<action>` | `fee-vouchers:generate` |
| Foreign key column | `<singular>_id` | `student_id` |
| Boolean column | `is_…`, `has_…`, `can_…` | `is_primary` |
| Timestamp column | `…_at` | `published_at` |
| Time-of-day column | `…_time` | `start_time`, `leave_time` |
| Date column | `…_on` or `…_date` | `admitted_on`, `due_date` |
| Urdu text column | same name + `_ur` | `full_name_ur` |

### Functions

- Every db-service and service function takes `ctx` first.
- A **db-service** function reads or writes rows and nothing else. It may throw only `NOT_FOUND` and `STALE`.
- A **service** function follows one order: check permission → load → check rules → write → audit → queue jobs → return through the contract.
- A calculation with no database access (fee totals, grades, payroll, rounding) goes in `<module>.rules.ts` as a pure function with unit tests.
- A function that changes state says what it does in its name: `collect`, `publish`, `approve`, `cancel`. Never `process` or `handle`.

### Errors

- Services throw `AppError` through the helpers `notFound()`, `forbidden()`, `rule()`, `invalid()`, `conflict()`. Anything else is a bug and becomes a `500`.
- A rule message is written for the person on the screen: what is wrong and what to do. "This voucher is already paid. Refresh the page to see the receipt."
- Never swallow an error. Never catch one only to log it.

### Comments

Explain why, not what. Every kernel function and every non-obvious rule gets a short comment. A plain CRUD line gets none.

### Git

- One long-lived branch, `main`. Work on `phase-07/students-list`-style branches.
- Conventional Commits: `feat(fees): collect partial payment`.
- `pnpm check` passes before every commit.
- A migration that has been merged is never edited. Fix it with a new migration.

## Part B — Data

### Columns every business table has

Spread from `baseColumns`:

| Column | Type | Meaning |
|---|---|---|
| `id` | uuid | Made by the database, or by an offline device before it syncs |
| `org_id` | uuid | The school group. Row-level security filters on it |
| `version` | int | Starts at 1, goes up by 1 on every change |
| `created_at`, `updated_at` | timestamptz | |
| `created_by`, `updated_by` | uuid | The acting user |
| `deleted_at` | timestamptz | Empty while the row is live |

Branch-level tables add `branch_id`. Append-only tables (audit, ledgers, logs) have only `id`, `org_id`, optional `branch_id`, `created_at` and `created_by`.

### Value formats

| Value | Stored as | Rule |
|---|---|---|
| Money | `bigint`, in **paisa** | Rs 8,500 is `850000`. Shown in rupees. Voucher totals and net salaries are rounded to whole rupees, half up, at calculation time |
| Calendar date | `date`, read as text `YYYY-MM-DD` | Never a JavaScript `Date` |
| Time of day | `time`, read as text `HH:MM` | 24-hour |
| Moment in time | `timestamptz`, read as ISO text | |
| Period (month) | text `YYYY-MM` | `2026-10` |
| "Today" | Pakistan time (UTC+5, no daylight saving) | `ctx.today`; SQL uses `app.today()` |
| Phone | text, E.164 | `+923001234567`. Shown as `0300 1234567` |
| CNIC and B-Form | text with dashes | `35202-1234567-1` |
| Percentage | `numeric(5,2)` | `92.50` |
| Marks | `numeric(6,2)` | Half marks are allowed |
| Allowed values | `text` with a check constraint | Built from the contract's list |
| Free-form settings | `jsonb` | Always validated by a Zod schema before saving |
| Person name | `full_name` plus optional `full_name_ur` | Father's name is its own column: `father_name` |

### Rules for tables

1. Every foreign key is declared and indexed. The `table()` helper adds the index itself when no index, unique constraint or primary key already starts with the column (a partial index, when the column is optional). Two exceptions: `org_id`, which is never the column a query is found by; and a column marked `unindexed(...)` on a very large, insert-heavy table, with the reason written beside it.
2. "Unique" always means unique within the school group among live rows: a partial unique index with `where deleted_at is null`, starting with `org_id`.
3. A table that is listed with filters has a composite index starting with `org_id` (and `branch_id` when it has one).
4. A column searched by `q` gets a trigram index.
5. Amounts have `check (amount >= 0)` unless negative is meaningful, and then the column name says so (`delta`, `adjustment`).
6. A status column has a check constraint and a documented state machine.
7. A row is never hard-deleted by the application. Exceptions are named in the module spec (for example, an unsent draft message).

### Numbering

Human-facing numbers (admission, voucher, receipt, employee, certificate) come from `kernel/sequences.ts`. Formats are settings per school group. Defaults:

| Number | Default format | Resets |
|---|---|---|
| Admission | `{branch}-{yy}-{0000}` | Per branch per year |
| Fee voucher | `FV-{yymm}-{00000}` | Per branch per month |
| Receipt | `R-{yymm}-{00000}` | Per branch per month |
| Employee | `E-{0000}` | Never |
| Certificate | `{type}-{yyyy}-{0000}` | Per year |

A number is taken inside the transaction that uses it, so a failed save never burns a number and two cashiers can never get the same one.

## Part C — How this plan is written

The module specifications use a fixed notation so a script (`pnpm plan:check`) can verify them and build the indexes in [`../30-reference/`](../30-reference/).

### Table blocks

```
#### `fee_vouchers` · branch +family
One bill for one student for one period.

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| status | enum(unpaid, partial, paid, cancelled) | required; default unpaid |
```

- The heading is the table name in backticks, a middle dot, then its **scope**.
- Base columns are not listed. The scope implies them.
- `uuid → students` is a foreign key to `students.id`.
- Under the table, lines starting `Unique:` and `Index:` list constraints.

**Scopes** (each maps to a row-level security template in [06](06-tenancy-roles-and-access.md)):

| Scope | Who can reach the rows |
|---|---|
| `global` | Everyone signed in may read; only migrations and platform staff write |
| `platform` | Takhti staff only |
| `org` | Staff of the school group |
| `branch` | Staff of the school group, limited to their branches |
| `+family` | Also readable by a guardian or student, for their own students only. The column is `student_id` unless given: `+family(id)` |
| `+household` | Also readable by the family the row belongs to as a whole. The column is `family_id` unless given: `+household(id)` |
| `+self` | Also reachable by the user the row belongs to. The column is `user_id` unless given: `+self(raised_by)` |
| `+cap(name)` | Staff need the named capability (`hr`, `payroll`, `health`, `counselling`), or the row must be about themselves |
| `append-only` | No update or delete, by anyone |

Under the table, a line starting `Policy:` states any access that differs from what the scope and its modifiers give: that every member may read, that a family may add a row, that a rule holds only while a row is in a certain state. Every such line is matched by a decision in `docs/plan/_tools/scaffold-hints.mjs`, and the generator refuses a table where one exists without the other.

**Types:** `uuid`, `text`, `int`, `bigint`, `paisa`, `bool`, `date`, `time`, `timestamptz`, `jsonb`, `numeric(p,s)`, `text[]`, `uuid[]`, `enum(a, b, c)`.

**Rules cells** are fragments separated by `;`. The generator reads these: `required`, `optional`, `default <value>`, `unique`, `unique per organisation`, `unique per branch`, `> N`, `≥ N`, `N to N`, `> / ≥ / ≤ / after` followed by another column in backticks, `first day of a month`, `a Monday`, `at least N characters`, `at most N characters`, `never below zero`, `lower case`, `signed`, `generated`, `from the <key> sequence`. Anything else is kept as a comment on the column. A fragment that reads like a constraint but is not in this list ("one primary per staff member", "required for `contract`") stops the generator until the hints say whether a check, an index or the service enforces it.

**`Unique:` and `Index:` lines** list tuples of columns, each optionally followed by `among live rows`, `where set` or `where status is a, b or c`. A unique rule always leaves out deleted rows. A unique rule over a column that may be empty must say in the hints whether two empty values clash.

### Route tables

```
| Method | Path | Permission | Does |
|---|---|---|---|
| POST | `/fee-vouchers/[id]/collect` | `fee-payments:collect` | Records a payment against the voucher |
```

Paths are under `/api/v1`. The permission cell is a permission key, or one of `public`, `signed-in`, `platform`, `webhook`.

### Permission tables

```
| Permission | Allows | Default roles |
|---|---|---|
| `fee-payments:collect` | Take a payment | FINANCE, principal |
```

Default roles are role keys or the role groups in capitals, both defined in [06](06-tenancy-roles-and-access.md). `owner` holds every permission and is never listed.

### Identifiers

- Rules are numbered `R-<module>-<n>`: `R-fees-7`.
- Test cases are numbered `T-<module>-<n>`.
- Failure cases are numbered `F-<module>-<n>`.

### Every module specification has the same fifteen sections

1. Purpose
2. Depends on
3. Tables
4. Contracts
5. Rules
6. Permissions
7. Routes
8. Client layer
9. Screens
10. Notifications and jobs
11. Offline
12. AI
13. Failure cases
14. Seed data
15. Tests

A section that does not apply says "None" rather than being left out.

## Definition of done

A piece of work is done only when all of its lines are true.

**A table** — columns, checks, indexes and policies match the spec; the migration applies to an empty database and to the previous state; a row-level security test proves another school and another branch cannot read or write it.

**A resource's backend** — contract, db-service, service and routes exist; every rule in the spec has a test; every route has a happy-path test, a permission test and a validation test; `pnpm check` passes.

**A resource's client layer** — api-service and hooks exist; the type-guarantee file compiles; an API test drives the real routes through the api-service.

**A screen** — works in light and dark, in English and Urdu, at 1440px and 400px; has loading, empty, error, forbidden and offline states; is usable by keyboard; every write shows success or a clear error; a Playwright test covers its main task for each role that can open it.

**A phase** — every checkbox in its file is ticked, its exit checks pass, and the progress table in the [plan README](../README.md) is updated.

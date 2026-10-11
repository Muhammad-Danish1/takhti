# 11 · Testing strategy

Tests are how "error-proof" is proved rather than claimed. Each layer has its own kind of test, and a phase is not finished until its tests pass.

## Tools

| Tool | For |
|---|---|
| Vitest | Unit, service and API tests |
| PGlite | A real Postgres engine inside the test process: fast, parallel, no Docker needed |
| Docker Postgres (`TEST_DB=postgres`) | The same tests against the real server version, run before each phase is closed |
| Playwright | Browser tests against the running app and local Supabase |
| Testing Library | Component tests for the design system |
| axe (through Playwright) | Accessibility checks |
| `tsc` with `@ts-expect-error` files | Compile-time guarantees |

## Kinds of test

| Kind | Tests what | Where | Speed |
|---|---|---|---|
| **Unit** | Pure rules: money, dates, grading, fee and payroll calculations, state machines, formatters | beside the code, `*.test.ts` | milliseconds |
| **Type** | A wrong filter value, a missing sort column, a contract that does not fit its table all fail to compile | `tests/types/` | compile time |
| **Service** | A service against a real database: rules, permissions, scope, audit, transactions | `tests/api/<module>/` | fast |
| **Security** | Row-level security for every table; a permission test for every route | `tests/api/security/` (generated from the registry) | fast |
| **Database** | The foundation migration, the conventions every table must keep, the access-token hook | `tests/db/` | fast |
| **Lint rules** | Each layer boundary and project rule, with a deliberately wrong file | `tests/lint/` | fast |
| **Smoke** | Real sign-ins against the running app and the local stack | `tests/smoke/`, run with `pnpm smoke` | on demand |
| **API** | Real Route Handlers called with real requests: status codes, validation, error bodies, idempotency | `tests/api/<module>/` | fast |
| **Client** | The api-service driving the real handlers through a fake `fetch` | `tests/api/<module>/` | fast |
| **Component** | Design-system components: states, keyboard use, both themes, both directions | `packages/ui` | fast |
| **End to end** | A person's task in a browser, per role | `tests/e2e/<portal>/` | slower |
| **Integrity** | The nightly checks from [09](09-reliability-and-error-proofing.md), run on the seeded database | `tests/api/integrity/` | fast |
| **Performance** | List and write budgets on 5,000 students | `tests/perf/` | on demand |

## What must be tested

### For every table (Phase 1)

- The migration applies to an empty database.
- A user from another organisation can neither read nor write a row.
- A user limited to another branch can neither read nor write a branch-scoped row.
- A guardian reads only rows for their own children, on tables marked `+family`.
- Every check constraint and unique index refuses a bad row.

These are generated from the table registry, so a new table without them fails the suite.

### For every resource (Phase 2)

| Test | Proves |
|---|---|
| Create, read, list, update, delete | The happy path, with the response matching the contract |
| List with search, each filter, each sort, paging | The list engine is wired correctly |
| Each rule `R-…` in the spec | One test per rule, named with the rule id |
| Each failure case `F-…` in the spec | One test per case |
| Missing permission | `403` for a role without it |
| Wrong scope | A teacher outside the section, a guardian of another child |
| Validation | `422` with the right field names |
| Stale version | `409 STALE` |
| Idempotent routes | A repeated key returns the first response; one record exists |
| Audit | Each write produced one entry with the right actor |
| Events and jobs | The expected job rows were queued, and only on commit |
| Rollback | A failure late in the service leaves nothing behind |

### For every screen (Phases 5 onward)

- The main task succeeds for each role that may use it.
- A role that may not use it is turned away.
- Loading, empty, error and forbidden states render.
- A failed save shows the server's message under the right field.
- The page passes the automated accessibility check.
- It renders in light and dark, English and Urdu, at 1440px and 400px, without horizontal scrolling. (Screenshot comparison on the key pages.)

## The role matrix

One Playwright project signs in as each built-in role using the seeded accounts and walks that role's main paths. The matrix lives in `tests/e2e/roles.ts`: for each role, the pages it must reach and the pages it must be refused. A new page must be added to the matrix or the suite fails.

## Test data

- **Builders** create valid records with one line and accept overrides: `build.student({ gradeLevel: 9 })`.
- **Seed scenarios** set up whole situations: a branch mid-term with attendance, a fee month half collected, an exam with marks entered.
- **No test depends on another test.** Each gets a fresh database (PGlite makes this cheap) or runs in a transaction that is rolled back.
- **Time is frozen** in any test that touches dates.
- Names, numbers and amounts in tests are realistic Pakistani data, the same as in the [seed data](../30-reference/seed-data.md), so a failing test reads like a real case.

## Naming

```
tests/api/fees/fee-payments.test.ts

describe('fee payments')
  it('R-fees-19: a payment larger than the balance becomes family credit')
  it('F-fees-2: two cashiers collecting for one family never allocate the same rupee twice')
  it('403: a teacher cannot collect a fee')
```

## Gates

| When | Must pass |
|---|---|
| Before every commit | `pnpm check` (typecheck, lint, unit, service, API tests on PGlite) |
| Before closing a module | That module's full test list from its spec |
| Before closing a phase | `pnpm check`, `pnpm test:db`, `pnpm db:verify-plan`, the phase's exit checks, and from Phase 5 on `pnpm test:e2e` |
| Before launch | Everything, plus performance, security and restore checks |

Coverage is measured but the gate is the test lists in the specs, not a percentage: every rule and every failure case has a named test.

## What is deliberately not tested with mocks

- The database. Service and API tests always use a real Postgres engine.
- The security tests themselves. `tests/api/security/rls.engine.test.ts` damages a table's protection on purpose (a dropped policy, a policy that is too wide, row-level security switched off) and checks that the generated tests notice.
- Row-level security. It is tested by acting as real users.
- Money maths. Tested with real numbers, including awkward ones (Rs 100 split three ways, a 7.5% discount on Rs 8,333).

Outside services are the only things replaced, by the local adapters that also run in development: the message log, the fake payment gateway, the fake AI provider that returns recorded answers.

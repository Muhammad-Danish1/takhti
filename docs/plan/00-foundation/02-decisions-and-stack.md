# 02 · Decisions and stack

Everything here is settled. Change a line only by agreeing to it and recording the date.

## Product decisions

| # | Decision | Agreed |
|---|---|---|
| D1 | The product is called **Takhti**. | 10 Oct 2026 |
| D2 | Pakistan only, Grades 1 to 10, multi-branch, sold as a cloud service. | 9 Oct 2026 |
| D3 | 44 modules, 12 portals, 32 built-in roles plus custom roles. | 9 Oct 2026 |
| D4 | Build order: whole backend first, then the frontend portal by portal, then the marketing site, then the mobile apps. | 10 Oct 2026 |
| D5 | Theme **Kashi**: cobalt, turquoise, marigold; corner radius zero; light and dark. | 10 Oct 2026 |
| D6 | Everything runs on a **local Supabase in Docker** until the launch phase. No cloud account is needed before Phase 21. | 10 Oct 2026 |
| D7 | The mobile apps (Expo) come after the web product. | 10 Oct 2026 |
| D8 | Every feature must handle failure: validation, fallbacks and every realistic use case. [09 · Reliability](09-reliability-and-error-proofing.md) is the standard. | 10 Oct 2026 |

## Technical decisions

| # | Decision | Why |
|---|---|---|
| T1 | **Next.js 16** (App Router, React 19, TypeScript) is both the frontend and the API. All API code is Route Handlers under `/api/v1`. | One codebase, one deploy. |
| T2 | **One versioned HTTP API** is the only way to read or write data. No business logic in Server Actions or Server Components. | The mobile apps, the offline upload and outside integrations all need the same door. |
| T3 | **Supabase** provides Postgres, Auth, Storage and Realtime. | Asked for; it is also self-hostable. |
| T4 | **Drizzle ORM 1.0** (release candidate, pinned to an exact version) for tables, migrations and typed queries. `supabase-js` is used only for Auth, Storage and Realtime. | Fee, accounting and payroll writes must be all-or-nothing transactions written in TypeScript. |
| T5 | **Seven backend layers**: contract, table, db-service, service, route, api-service, hooks. | Proved by the [reference skeleton](../../reference/backend-skeleton/) with 32 passing checks. |
| T6 | **Monorepo** (pnpm workspaces + Turborepo). | The mobile apps reuse `contracts`, `api-client` and `hooks`. |
| T7 | **Row-level security on every table**, as a second wall behind the permission checks in the service layer. | A bug in a query must not leak another school's data. |
| T8 | **Money is stored as whole paisa** in `bigint` columns. | Integer maths cannot produce rounding drift. |
| T9 | **Calendar dates are text** (`YYYY-MM-DD`) from database to screen. Timestamps are ISO text. Business "today" is always Pakistan time. | Removes the off-by-one-day bugs that JavaScript dates cause. |
| T10 | **Rows are never physically deleted** in business tables. They are marked `deleted_at`. | Audit, undo, and offline devices must learn that a row is gone. |
| T11 | **Every row has a `version`.** An edit made against an old version is refused. | Two people editing the same record cannot silently overwrite each other. |
| T12 | **Background work uses a job queue inside Postgres** (an outbox table plus a worker process). | It runs on the local Docker setup with no outside service, and a job is saved in the same transaction as the change that caused it. |
| T13 | **Outside services sit behind adapters** with a local stand-in: SMS, WhatsApp, email, push, payment gateways, AI. | The whole product runs and is testable offline on a laptop. |
| T14 | **PDFs are made from HTML by headless Chromium.** | A real browser engine prints Urdu Nastaliq correctly. |
| T15 | **Offline uses PowerSync** (local SQLite on the device, synced with Postgres). Built in Phase 17, but the database is ready for it from Phase 1: device-made ids, soft deletes, versions. | Server stays the authority; staff devices keep working. |
| T16 | **AI uses the Claude API** through the official TypeScript SDK. Default model `claude-opus-5-5`. | See [15 · AI design](15-ai-design.md). |
| T17 | **English and Urdu** from the first screen. Text lives in message files, never in components. | Retrofitting translation later costs more than doing it now. |

### Change from the earlier discussion

Trigger.dev was the first choice for background jobs. Decision D6 (everything local on Docker) made a Postgres job queue the better default, because it needs no outside account and commits jobs atomically with data. Trigger.dev remains an option in Phase 21 for heavy production jobs; the job code is written against an interface so the runner can be swapped.

## Versions

Verified by installing and type-checking on 10 Oct 2026:

| Package | Version |
|---|---|
| `next` | 16.4.0 |
| `react`, `react-dom` | 19.3.0 |
| `typescript` | 7.0.2 |
| `drizzle-orm`, `drizzle-kit` | 1.0.0-rc.4 |
| `zod` | 4.6.5 |
| `@tanstack/react-query` | 5.104.1 |
| `@supabase/supabase-js` | 2.117.3 |
| `@supabase/ssr` | 0.12.7 |
| `postgres` | 3.4.9 |
| `@electric-sql/pglite` (tests) | 0.5.8 |
| `tsx` (scripts) | 4.23.15 |
| `vitest` | 5.0.3 |
| `eslint` | 10.12.0 |
| `typescript-eslint` | 8.71.1 |
| `typescript` for the linter only | 6.0.3 |
| `prettier` | 3.9.9 |
| `turbo` | 2.11.7 |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.3 |
| `pino` | 10.4.0 |
| Supabase CLI (local stack) | 2.109.1 |
| Node.js | 22 LTS |
| pnpm | 10 |

Installed later, pinned to the exact latest version on the day they are added (check with `pnpm view <name> version`): shadcn/ui, Radix primitives, React Hook Form, TanStack Table, TanStack Virtual, next-intl, Recharts, nuqs, Zustand, date-fns, Playwright, Testing Library, Puppeteer, Serwist, `@powersync/web`, `@anthropic-ai/sdk`, and a spreadsheet library for XLSX import and export.

**Two TypeScripts, on purpose.** TypeScript 7 type-checks the code (`pnpm typecheck`) and Next.js runs on it. The linter cannot read TypeScript 7 yet (`typescript-eslint` supports up to 6), so `packages/eslint-config` carries its own TypeScript 6 as its parser. Lint rules here do not use type information, so the two never disagree. When `typescript-eslint` supports 7, delete the second copy.

**Rule:** `package.json` never contains `^` or `~`. Upgrades are deliberate, one package at a time, with the test suite run after each.

## Three things the research changed

These are easy to get wrong from memory. They are already correct in the reference skeleton.

1. **Drizzle 1.0** has no `casing` option on the connection. Tables are declared with a shared `table()` helper built from `snakeCase.table`. Generic table code uses `InferSelectModel<T>`.
2. **Zod 4** applies `.default()` even inside optional and partial objects. An update schema must be built from fields that have no defaults, or omitting a field silently resets it.
3. **Supabase** verifies a user on the server with `auth.getClaims()`, and the public key variable is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Open items

None of these blocks the build. Each is decided in the phase named, by the person named, and recorded here with its date when it is.

| Item | Who decides | Decided in |
|---|---|---|
| Subscription plans, prices, trial length and which modules each plan includes | Product owner | [Phase 6](../20-phases/phase-06-platform-console.md) |
| The figures marked **(confirm)** in [12 · Pakistan domain rules](12-pakistan-domain-rules.md): salary tax slabs, advance tax on fees, vendor withholding, EOBI, social security, grade points per board, the fee-increase cap per province | Product owner with a qualified tax adviser; then each school for its own rules | [Phase 9](../20-phases/phase-09-finance.md) for demonstrations; each school at onboarding |
| A native Urdu reader to review every notification template and both family portals | Product owner | [Phase 12](../20-phases/phase-12-communication.md), [Phase 14](../20-phases/phase-14-family-portals.md) |
| Which payment channel to integrate first (1BILL, JazzCash, Easypaisa) | Product owner; needs a commercial agreement | [Phase 18](../20-phases/phase-18-integrations.md) |
| WhatsApp Business access, SMS provider with a registered sender name, email service and sending domain | Product owner | [Phase 18](../20-phases/phase-18-integrations.md) |
| Which biometric machines and vehicle trackers the first schools use | Product owner with the pilot school | [Phase 18](../20-phases/phase-18-integrations.md) |
| The Claude model for each AI feature, after measuring cost and quality | Product owner | [Phase 19](../20-phases/phase-19-ai.md) |
| Production region, after a speed test from Pakistan; where the web app and worker run | Product owner with the developer | [Phase 21](../20-phases/phase-21-hardening-and-launch.md) |
| Whether heavy jobs move to a hosted runner, and whether rate limits and caches move to Redis | Developer, from load test results | [Phase 21](../20-phases/phase-21-hardening-and-launch.md) |
| Error tracker, uptime monitor, support hours | Product owner | [Phase 21](../20-phases/phase-21-hardening-and-launch.md) |
| Privacy notice, terms and data processing agreement, reviewed by a lawyer | Product owner | [Phase 21](../20-phases/phase-21-hardening-and-launch.md) |
| The pilot school | Product owner | [Phase 21](../20-phases/phase-21-hardening-and-launch.md) |
| Domain name and company details for the marketing site | Product owner | [Phase 22](../20-phases/phase-22-marketing-site.md) |
| One mobile app per audience, or two apps with roles inside | Product owner | [Phase 23](../20-phases/phase-23-mobile-apps.md) |

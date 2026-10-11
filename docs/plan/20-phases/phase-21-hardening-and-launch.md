# Phase 21 · Hardening and launch

**Goal.** The product moves from a developer's machine to a place schools can rely on: proven secure, proven fast at real size, backed up and restorable, watched, and with a tested way to bring a school's existing data in. It ends with the first school using Takhti for real.

**Depends on.** Every phase before it. Phases [22](phase-22-marketing-site.md) and [23](phase-23-mobile-apps.md) can follow launch.

**This is the first phase that needs cloud accounts and that spends money on hosting.**

## Read first

[09 · Reliability and error-proofing](../00-foundation/09-reliability-and-error-proofing.md), [10 · Security and privacy](../00-foundation/10-security-and-privacy.md) ("Security checks before launch"), [03 · Architecture](../00-foundation/03-architecture.md) (environments), [02 · Decisions and stack](../00-foundation/02-decisions-and-stack.md) (open decisions).

## Decisions to take

| Decision | How to decide |
|---|---|
| Database region | Measure from Pakistan (Lahore, Karachi and Islamabad, on mobile and fixed lines) to the candidate regions; choose the lower median and 95th-percentile latency. Check the region's data-residency position against [10](../00-foundation/10-security-and-privacy.md) with the product owner |
| Where the web app and the worker run | A platform that runs a Next.js server and a long-running worker process near the database region, with autoscaling for the web and at least two worker instances |
| Jobs | Keep the Postgres queue unless load tests show it limiting; only then consider moving heavy jobs to a hosted runner |
| Rate limits and caches | Keep them in Postgres unless load tests show contention; only then add Redis behind the existing interfaces |
| Error and uptime monitoring | An error tracker and an uptime monitor with alerts to a phone |
| Support hours and channel | Who answers a school's call, when, and how issues are tracked |

Record each in [02](../00-foundation/02-decisions-and-stack.md).

## Work packages

### 21.1 · Environments

- [ ] `staging` and `production` Supabase projects in the chosen region: Auth settings matching `config.toml` (sign-up off, token lifetimes, two-factor, the access token hook), the storage buckets and their limits, point-in-time recovery on production.
- [ ] Database roles: `takhti_api` with its own password; the admin connection restricted to migrations, the worker and platform services; connection pooling for the web app; `prepare: false` kept for the pooler.
- [ ] Deployment pipeline: on a tag, run `pnpm check` and `pnpm test:db`, build, apply migrations to staging, deploy web and worker, run the browser smoke suite against staging; production is the same pipeline with a manual approval. A failed migration stops the deployment before any code is switched.
- [ ] Migrations are forward-only and backward-compatible with the previous release (add, then use, then remove in a later release), so a deployment can be rolled back.
- [ ] Secrets only in the platform's secret store. A script checks that every variable in `.env.example` is set in each environment and that no local default is in use.
- [ ] The PowerSync service and the PDF worker deployed beside the app.
- [ ] Development-only pages and stand-in providers are absent from production builds; a test requests each on the deployed staging site.

### 21.2 · Security review

Work through "Security checks before launch" in [10](../00-foundation/10-security-and-privacy.md), plus:

- [ ] An **independent penetration test** of staging by someone who did not build it, covering sign-in, tenant isolation, the API, file uploads, public pages and webhooks. Every high and medium finding fixed and re-tested.
- [ ] The generated isolation tests (every table, every route) run against staging's real database with two real organisations.
- [ ] Dependency audit; lockfile committed; automated alerts for vulnerable packages.
- [ ] Headers: content security policy without inline scripts, HSTS, frame denial, referrer policy, permissions policy.
- [ ] Upload scanning, type sniffing and size limits verified with hostile files.
- [ ] Secrets rotation rehearsed: database password, service key, encryption key (with re-encryption of stored integration credentials), provider keys.
- [ ] Platform staff access: two-factor enforced, named accounts only, every action in `platform_audit_log`, support sessions time-boxed.
- [ ] Privacy: the privacy notice and terms reviewed by a lawyer familiar with Pakistani law; a data processing agreement for schools; the retention jobs running; a tested procedure for a parent's request to see or correct their data and for a school leaving with its data.

### 21.3 · Performance at real size

- [ ] Seed staging with a **large** organisation: 12 branches, 25,000 students, three years of attendance, fees and results; plus 200 small organisations.
- [ ] Budgets, measured at the 95th percentile from Pakistan: list pages under 1 s; a detail page under 800 ms; the fee counter's search under 300 ms and a payment under 1 s; marking attendance for a class under 1 s; dashboards under 2 s with snapshots; the parent portal's first load under 4 s on slow 3G.
- [ ] Load tests: Monday 8 am (5,000 teachers marking attendance within 15 minutes); the 1st to 10th of the month (200 cashiers collecting, 2,000 parents paying online in an hour); result day (20,000 parents opening results in ten minutes); a bulk job day (vouchers for 25,000 students, 25,000 report cards).
- [ ] For each slow query found: the plan, the index or rewrite, the before and after, recorded.
- [ ] Decide from the measurements whether `audit_log`, `message_deliveries` and `biometric_punches` need partitioning, and whether any decision in the table above changes.
- [ ] The worker under load: queue depth and job latency stay bounded; one large school does not starve the others.

### 21.4 · Backups, recovery and continuity

- [ ] Daily backups and point-in-time recovery on production; storage buckets backed up.
- [ ] **A restore drill**: restore last night's backup into a fresh project, point a staging build at it, run the integrity checks and the smoke suite. Time it. Repeat quarterly.
- [ ] A single-organisation export: everything a school owns as files, for a school that leaves or asks for a copy.
- [ ] Runbooks, each rehearsed once: the database is down; the worker is stuck; a payment provider is failing; a bad release needs rolling back; a migration failed halfway; a suspected data leak; a school reports wrong fee balances.
- [ ] A status page.

### 21.5 · Monitoring

- [ ] Errors with request ids, organisation and user (no personal data in the payload); alerts on new error types and on rates.
- [ ] Uptime checks on `/api/health`, the sign-in page, a public school site and the sync service.
- [ ] Dashboards: request latency by route, database load, queue depth and oldest job, failed jobs, message delivery rates, payment callback health, storage growth.
- [ ] The nightly integrity job's findings reach a person every morning; a finding in the money checks pages someone.
- [ ] Logs retained 30 days, searchable by request id.

### 21.6 · Bringing a school's data in

- [ ] The import templates of [13](../00-foundation/13-notifications-jobs-and-files.md) reviewed against what real schools hold: students with guardians, staff, fee structures, **opening fee balances**, opening ledger balances, this year's attendance summary, last results, library books, inventory.
- [ ] A migration guide for a school moving from paper, spreadsheets or another system, with the order to import in and how to reconcile totals before going live ([R-fees-35](../10-modules/m21-fees.md), [R-acct-11](../10-modules/m23-accounting.md)).
- [ ] A rehearsal with real, anonymised exports from one willing school.

### 21.7 · Live integrations

- [ ] Live credentials for the chosen payment channel, WhatsApp, SMS and email entered in production; a real payment of a small amount made and refunded; a real message of each kind delivered; sender name and WhatsApp templates approved; SPF, DKIM and DMARC passing.
- [ ] Each school's own tax rules entered and **confirmed by the school** before its first payroll and before advance tax on fees is switched on.

### 21.8 · Help and training

- [ ] In-app help: a short guide per screen group, in English and Urdu, reachable from the top bar; short videos for the six most used tasks (mark attendance, collect a fee, generate vouchers, enter marks, publish results, send a notice).
- [ ] An onboarding plan for a school: who is trained on what, in what order, over the first two weeks.
- [ ] Printable one-page guides for cashiers, teachers and parents.

### 21.9 · Pilot

- [ ] One school, one branch first. Parallel running with their existing method for one fee cycle and one attendance month.
- [ ] A daily check-in for the first two weeks; every issue logged, triaged, fixed or scheduled.
- [ ] Reconciliation at the end of the cycle: fee totals, attendance counts and the trial balance agree with the school's own records.
- [ ] Go or no-go for a wider launch, decided against written criteria agreed before the pilot starts.

## Exit checks

1. Every item in "Security checks before launch" in [10](../00-foundation/10-security-and-privacy.md) is done; the penetration test has no open high or medium finding.
2. Every performance budget is met at the large size; the four load tests pass with error rates under 0.1%.
3. A restore drill succeeded within the target time and is scheduled to repeat.
4. Every runbook was rehearsed.
5. Monitoring pages a person within five minutes of the health check failing, proven by a deliberate outage on staging.
6. One school has completed a full fee cycle and a month of attendance in production, and its figures reconcile.
7. The legal documents are reviewed and published.
8. The full test suite passes against staging: `pnpm check`, `pnpm test:db`, `pnpm test:e2e`, the offline suite, and the sandbox journeys of [Phase 18](phase-18-integrations.md).

## After launch

A release rhythm (for example, weekly on a quiet evening, never in the first ten days of a month or on a result day); a changelog schools can read; the restore drill, the dependency audit and the access review on a calendar; the pass marks of the AI evaluations re-run on every prompt or model change.

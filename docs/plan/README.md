# Takhti — the build plan

Takhti is school management software for Pakistan, for school groups teaching Grades 1 to 10: 44 modules, 12 portals, 32 built-in roles, offline-capable, with AI. This folder is the complete plan for building it, written so that each step can be carried out without having to decide anything that is already decided here.

**Where the build stands, what comes next and what was left out on purpose: [`docs/STATUS.md`](../STATUS.md).** Read it before starting a session and update it before ending one.

**Status:** Phase 0 is built and passing. [Phase 1](20-phases/phase-01-database.md) has all 416 tables in place with their access rules and security tests (11 Oct 2026); demo data exists for setup, people, admissions, the front office and the classroom modules, and the rest is created through the services of Phase 2. [Phase 2](20-phases/phase-02-services-and-routes.md) is under way: the plain operations of 222 resources are generated and tested, and the pieces every module leans on are built (ledger posting, stock movement, tax calculators, notification dispatch, documents, the report registry, the calendar, the offline upload), and the first two modules are finished by hand with every rule tested (the shared kernel and the organisation, 12 Oct 2026), so 653 of 1,615 routes exist; the identity and platform modules are next, then every other module's own rules and named actions.

## How the plan is organised

| Folder | What is in it | Read it when |
|---|---|---|
| [`00-foundation/`](00-foundation/) | 17 documents: scope, decisions, architecture, conventions, the backend kernel, standards for the API, reliability, security, testing, Pakistan's rules, and the designs for notifications, offline, AI and the frontend | Once, before starting. Then whenever a phase says "Read first" |
| [`10-modules/`](10-modules/) | 45 module specifications, each in the same 15 sections: tables, contracts, rules, permissions, routes, hooks, screens, notifications, offline, AI, failure cases, seed data, tests | When you build that module's database, backend, client or screens |
| [`20-phases/`](20-phases/) | 24 phases: what to build, in what order, with checklists and exit checks | This is the work list. Do them in order |
| [`30-reference/`](30-reference/) | Navigation map, seed data, notification and document catalogues, glossary, and generated indexes of every table, route, permission, event, job and setting | To look something up |
| [`_tools/`](_tools/) | `check.mjs`: checks the plan for broken references and rebuilds the indexes | After changing any spec |

Two folders beside this one matter too: [`docs/reference/backend-skeleton/`](../reference/backend-skeleton/) (the seven backend layers, already written and verified for one resource) and [`docs/design/theme/`](../design/theme/) (the approved Kashi theme).

## The size of it

| | |
|---|---|
| Modules | 45 (M00 shared kernel + M01 to M44) |
| Tables | 416 |
| API routes | 1,615 |
| Permissions | 439 |
| Business rules (`R-…`) | 737 |
| Failure cases (`F-…`) | 416 |
| Listed tests (`T-…`) | 553 |
| Events | 372 |
| Background jobs | 172 |

These figures are produced by `pnpm plan:check` from the specs. They are the definition of "complete": every one of them becomes code with a test.

## The phases

The order follows the decision to build the whole backend first, then the frontend portal by portal, then the marketing site, then the mobile apps.

| Phase | What | Result |
|---|---|---|
| **Backend** | | |
| [0](20-phases/phase-00-setup-and-kernel.md) | Setup and kernel | The repository, Next.js, local Supabase, the reusable backend files, one resource through all seven layers |
| [1](20-phases/phase-01-database.md) | Database, contracts and seed data | All 416 tables with security, every type, a seeded demo school |
| [2](20-phases/phase-02-services-and-routes.md) | Services and routes | All 1,615 routes, every rule enforced and tested |
| [3](20-phases/phase-03-client-layer.md) | API-services and hooks | A typed function and a hook for every route |
| **Frontend foundation** | | |
| [4](20-phases/phase-04-frontend-foundation.md) | Frontend foundation | The theme, every component, the shells, Urdu, the gallery |
| [5](20-phases/phase-05-auth.md) | Sign-in and access for every role | All 32 roles sign in and land in the right place |
| **Portals** | | |
| [6](20-phases/phase-06-platform-console.md) | Platform console | Takhti's staff create and manage schools |
| [7](20-phases/phase-07-school-setup-and-people.md) | School setup and people | Settings, classes, staff, admissions, students |
| [8](20-phases/phase-08-academics.md) | Academics | Timetable, attendance, exams, results, question bank, behaviour |
| [9](20-phases/phase-09-finance.md) | Finance | Fees, payments, accounts, purchasing, tax |
| [10](20-phases/phase-10-hr.md) | HR and payroll | Staff records, leave, payroll, appraisal |
| [11](20-phases/phase-11-front-office-and-operations.md) | Front office and operations | Gate, transport, library, inventory, shop, clinic, hostel, helpdesk |
| [12](20-phases/phase-12-communication.md) | Communication | Notifications, chat, notices, events, complaints, surveys |
| [13](20-phases/phase-13-teacher-portal.md) | Teacher portal | The teacher's day on a phone |
| [14](20-phases/phase-14-family-portals.md) | Parent and student portals | What families see and do |
| [15](20-phases/phase-15-head-office-and-reports.md) | Head office and reports | The owner's view; the report library |
| **Across the product** | | |
| [16](20-phases/phase-16-documents-and-printing.md) | Documents and printing | Every challan, receipt, report card, certificate and letter |
| [17](20-phases/phase-17-offline.md) | Offline | Classroom, counter, gate and bus keep working without internet |
| [18](20-phases/phase-18-integrations.md) | Integrations | Real payments, WhatsApp, SMS, email, biometric, trackers |
| [19](20-phases/phase-19-ai.md) | AI | The assistant, drafting, document reading, scores |
| [20](20-phases/phase-20-public-website.md) | Public school website | Each school's site and its public forms |
| **Launch and after** | | |
| [21](20-phases/phase-21-hardening-and-launch.md) | Hardening and launch | Security, performance, backups, cloud, the first school |
| [22](20-phases/phase-22-marketing-site.md) | Marketing site | Takhti's own website |
| [23](20-phases/phase-23-mobile-apps.md) | Mobile apps | Parent, teacher, student, driver and owner apps |

### How this maps to the phases first proposed

| Proposed | In this plan |
|---|---|
| Install Next.js, set up, build the reusable backend files | Phase 0 |
| Migrations and types for the whole product, with seed data | Phase 1 |
| DB-services and routes (Next.js API) for the whole product | Phase 2 |
| API-services and hooks | Phase 3 |
| Frontend setup: theme, components, reusable pieces | Phase 4 |
| Auth screens, built and tested for every role | Phase 5 |
| Portals and their modules, one by one | Phases 6 to 15 |
| — | Phases 16 to 20 add what cuts across every portal; 21 launches; 22 and 23 follow |

Everything runs on a local Supabase in Docker through Phase 17. Phase 18 needs sandbox accounts with outside providers. Phase 21 is the first to need cloud hosting.

## How to work through a phase

1. Read the phase file top to bottom, and its "Read first" documents.
2. Do the work packages in order. Tick each checkbox in the file as it is done (the phase files are the progress record).
3. For each module the phase touches, open its spec and build exactly what its sections say. If something in a spec is wrong or missing, fix the spec first, run `pnpm plan:check`, then write the code.
4. Run `pnpm check` before every commit.
5. Close the phase only when every exit check passes. Update the progress table below.

"Done" is defined once, in [05 · Conventions](00-foundation/05-conventions.md), for a resource, a module and a phase. The steps and checklist for a screen are in [building a screen](30-reference/building-a-screen.md).

## Progress

| Phase | Status | Started | Finished |
|---|---|---|---|
| 0 · Setup and kernel | Done | 10 Oct 2026 | 10 Oct 2026 |
| 1 · Database, contracts and seed data | **Tables done; closing tasks open.** 416 of 416 tables and 439 permissions, generated from the specs by `pnpm scaffold`. Demo data exists for Waves 1 and 2 and part of Wave 3; the rest is created through the services. Open: the settings and events catalogues, the plan-to-module map, the optional squash, exit checks 3, 5 and 6 | 10 Oct 2026 | |
| 2 · Services and routes | **In progress.** 653 of 1,615 routes exist: the plain list, add, read, change and delete operations of 222 resources, written by `pnpm scaffold:api`; the cross-cutting pieces (step 2.1); and, by hand with every rule, failure case and listed test named, the shared kernel (M00) and the organisation (M02). Next: identity (M03) and the platform console (M01) to finish step 2.2, then each module's rules, named actions and demo data | 11 Oct 2026 | |
| 3 · API-services and hooks | Not started as a phase. The 222 plain resources already have their API client and hooks, written with their routes | | |
| 4 · Frontend foundation | Not started | | |
| 5 · Sign-in and access | Not started | | |
| 6 · Platform console | Not started | | |
| 7 · School setup and people | Not started | | |
| 8 · Academics | Not started | | |
| 9 · Finance | Not started | | |
| 10 · HR and payroll | Not started | | |
| 11 · Front office and operations | Not started | | |
| 12 · Communication | Not started | | |
| 13 · Teacher portal | Not started | | |
| 14 · Parent and student portals | Not started | | |
| 15 · Head office and reports | Not started | | |
| 16 · Documents and printing | Not started | | |
| 17 · Offline | Not started | | |
| 18 · Integrations | Not started | | |
| 19 · AI | Not started | | |
| 20 · Public school website | Not started | | |
| 21 · Hardening and launch | Not started | | |
| 22 · Marketing site | Not started | | |
| 23 · Mobile apps | Not started | | |

## Foundation documents

| # | Document | In one line |
|---|---|---|
| 01 | [Product and scope](00-foundation/01-product-and-scope.md) | What Takhti is, the 44 modules, the 12 portals, what is out of scope |
| 02 | [Decisions and stack](00-foundation/02-decisions-and-stack.md) | What is decided, the versions, what is still open and who decides it |
| 03 | [Architecture](00-foundation/03-architecture.md) | How a request flows; the environments |
| 04 | [Repository layout](00-foundation/04-repository-layout.md) | Where every file goes; the commands |
| 05 | [Conventions](00-foundation/05-conventions.md) | Naming, columns, numbers, the definition of done |
| 06 | [Tenancy, roles and access](00-foundation/06-tenancy-roles-and-access.md) | Organisations, branches, the 32 roles, permissions, row-level security |
| 07 | [Backend kernel](00-foundation/07-backend-kernel.md) | Every reusable backend file and its tests |
| 08 | [API standards](00-foundation/08-api-standards.md) | The envelope, errors, lists, idempotency |
| 09 | [Reliability and error-proofing](00-foundation/09-reliability-and-error-proofing.md) | How "nothing breaks silently" is built in |
| 10 | [Security and privacy](00-foundation/10-security-and-privacy.md) | Threats, controls, children's data, the launch checklist |
| 11 | [Testing strategy](00-foundation/11-testing-strategy.md) | Which tests, where, and the gates |
| 12 | [Pakistan domain rules](00-foundation/12-pakistan-domain-rules.md) | Boards, grading, fees, tax, language, what must be confirmed |
| 13 | [Jobs, notifications, files and documents](00-foundation/13-notifications-jobs-and-files.md) | The four shared services |
| 14 | [Offline design](00-foundation/14-offline-design.md) | What works offline and how changes reach the server once |
| 15 | [AI design](00-foundation/15-ai-design.md) | Features, safety rules, cost control |
| 16 | [Frontend architecture](00-foundation/16-frontend-architecture.md) | The design system, page patterns, shells, Urdu |
| 17 | [Local environment](00-foundation/17-local-environment.md) | Tools, setup, ports, variables, troubleshooting |

## Modules

| Group | Modules |
|---|---|
| Shared | [M00 Shared kernel tables](10-modules/m00-shared-kernel.md) |
| Platform and setup | [M01 Platform console](10-modules/m01-platform-console.md) · [M02 Organisation and branches](10-modules/m02-organisation-branches.md) · [M03 Identity, roles and audit](10-modules/m03-identity-roles-audit.md) · [M04 School setup](10-modules/m04-school-setup.md) · [M05 Integrations and API](10-modules/m05-integrations-api.md) |
| Admissions and students | [M06 Admissions](10-modules/m06-admissions.md) · [M07 Students](10-modules/m07-students.md) · [M08 Certificates and ID cards](10-modules/m08-certificates-id-cards.md) · [M09 Front office](10-modules/m09-front-office.md) · [M10 Alumni](10-modules/m10-alumni.md) |
| Academics | [M11 Academic structure](10-modules/m11-academic-structure.md) · [M12 Timetable](10-modules/m12-timetable.md) · [M13 Syllabus and lesson plans](10-modules/m13-syllabus-lesson-plans.md) · [M14 Student attendance](10-modules/m14-student-attendance.md) · [M15 Homework and diary](10-modules/m15-homework-diary.md) · [M16 Learning](10-modules/m16-lms.md) · [M17 Exams and marks](10-modules/m17-exams-marks.md) · [M18 Results and report cards](10-modules/m18-results-report-cards.md) · [M19 Question bank and papers](10-modules/m19-question-bank-papers.md) · [M20 Behaviour and houses](10-modules/m20-behaviour-houses.md) |
| Finance | [M21 Fees](10-modules/m21-fees.md) · [M22 Online payments and reconciliation](10-modules/m22-online-payments-reconciliation.md) · [M23 Accounting](10-modules/m23-accounting.md) · [M24 Expenses and procurement](10-modules/m24-expenses-procurement.md) · [M25 Tax and compliance](10-modules/m25-tax-compliance.md) |
| HR | [M26 Staff and recruitment](10-modules/m26-staff-recruitment.md) · [M27 Staff attendance and leave](10-modules/m27-staff-attendance-leave.md) · [M28 Payroll](10-modules/m28-payroll.md) · [M29 Appraisal and training](10-modules/m29-appraisal-training.md) |
| Operations | [M30 Transport](10-modules/m30-transport.md) · [M31 Library](10-modules/m31-library.md) · [M32 Inventory and assets](10-modules/m32-inventory-assets.md) · [M33 Shop and canteen](10-modules/m33-shop-canteen.md) · [M34 Health and clinic](10-modules/m34-health-clinic.md) · [M35 Hostel](10-modules/m35-hostel.md) · [M36 Maintenance and helpdesk](10-modules/m36-maintenance-helpdesk.md) |
| Communication | [M37 Messaging hub](10-modules/m37-messaging-hub.md) · [M38 Chat and parent–teacher meetings](10-modules/m38-chat-ptm.md) · [M39 Notices, events and calendar](10-modules/m39-notices-events-calendar.md) · [M40 Complaints and surveys](10-modules/m40-complaints-surveys.md) · [M41 School website](10-modules/m41-school-website.md) |
| Insight and AI | [M42 Dashboards and reports](10-modules/m42-dashboards-reports.md) · [M43 Owner analytics](10-modules/m43-owner-analytics.md) · [M44 AI suite](10-modules/m44-ai-suite.md) |

## Reference

| Document | Use |
|---|---|
| [Navigation map](30-reference/navigation.md) | Every page of every portal, its path and what it needs |
| [Building a screen](30-reference/building-a-screen.md) | The steps and the checklist for every screen |
| [Seed data](30-reference/seed-data.md) | The demo school, the accounts, the named records tests rely on |
| [Notification catalogue](30-reference/notification-catalogue.md) | Categories, audiences, urgent and compulsory events, wording rules |
| [Document catalogue](30-reference/document-catalogue.md) | Every printed document with its size and variants |
| [Glossary](30-reference/glossary.md) | School, money and project terms |
| [Tables index](30-reference/tables-index.md) · [Routes index](30-reference/routes-index.md) · [Permissions index](30-reference/permissions-index.md) · [Events index](30-reference/events-index.md) · [Jobs index](30-reference/jobs-index.md) · [Settings index](30-reference/settings-index.md) | Generated from the specs; never edited by hand |

## Keeping the plan true

The plan is the specification, and it is checked by a script.

```bash
node docs/plan/_tools/check.mjs
```

(`pnpm plan:check` once the repository exists.) It verifies that every foreign key points to a table some module defines; every route's permission exists; every role named is a real role; every table's scope and columns agree; every rule, failure and test id is unique and every reference to one is right; every link resolves; and each spec has its 15 sections. Then it rebuilds the indexes. `--json` also writes a machine-readable copy of the plan that the repository's own scripts compare with the real database and the real routes (`pnpm db:verify-plan`, `pnpm api:verify-plan`, `pnpm plan:coverage`), so the code cannot drift from the plan without a check failing.

When the plan and the code disagree, decide which is right, change the plan first, run the check, then change the code.

## What is verified and what is not

**Verified by running it:** everything in [Phase 0](20-phases/phase-00-setup-and-kernel.md): the whole backend kernel, two resources through all seven layers, row-level security for all 55 tables of the first wave (on the in-process engine and on the real Postgres), the routes inside a running Next.js server, and Supabase Auth with the access-token hook; the package versions in [02](00-foundation/02-decisions-and-stack.md); the Kashi theme's contrast and chart colours; this plan's internal consistency, by the checker.

**Designed, not yet run:** everything else. In particular: the other 361 tables; phone and student sign-in; Realtime; PowerSync; each outside provider. Each of these is proved in the phase that builds it, and the phase's exit checks say how.

**Must be confirmed by someone qualified before real use:** every tax and contribution figure, grade points per board, and the fee-increase cap, all marked **(confirm)** in [12 · Pakistan domain rules](00-foundation/12-pakistan-domain-rules.md); the legal documents; the Urdu wording. The product ships with no confirmed tax rules, and each school enters its own.

## Open decisions

Listed with who decides and when in [02 · Decisions and stack](00-foundation/02-decisions-and-stack.md). None blocks Phases 0 to 5.

# Seed data

What `pnpm db:seed` creates. The seed is the product's demonstration, its test fixture and its first user manual: every module has something in every state, and the whole set is consistent.

Detail for each module is in section 14 of its spec. This document gives the shared frame those sections sit in.

## Principles

1. **Relative to "today".** The seed takes a date (default: the day it runs; `pnpm db:seed --today 2026-11-15` to pin it; `pnpm db:reset` passes the option on) and places everything around it: the academic year contains today, this month's vouchers are open, an exam is being marked, a payroll run is under review.
2. **Deterministic.** The same date gives the same ids, names and amounts on every machine, so a test can refer to "the Ahmed family" and a bug report can be reproduced.
3. **Consistent.** Payments match the ledger. Attendance matches leave. Results match marks. Stock matches movements. The nightly integrity checks pass on a fresh seed; that is tested.
4. **Made by the real code.** From [Phase 2](../20-phases/phase-02-services-and-routes.md) on, anything involving money is seeded by calling services, so the figures are produced by the same posting code a school will use.
5. **Fictional.** Every name, number and address is invented. Identity numbers have a valid shape and no real owner. No real school, person or child appears.
6. **Local only.** Seeded accounts exist only in a local or staging database. The production database is never seeded with demo data.

## Organisations

| | Roshan Public School | Al-Noor Grammar School |
|---|---|---|
| Purpose | The demonstration school | A second tenant, so every isolation test has something it must not reach |
| Slug (school code) | `roshan` | `alnoor` |
| City, province | Lahore, Punjab | Karachi, Sindh |
| Academic year starts | April | August |
| Fiscal year starts | July | July |
| Branches | Main Campus (`MC`), City Campus (`CC`) | One (`AN`) |
| Students | 1,152 enrolled, and 41 who left this year | 20 |
| Staff | About 90 | 10 |
| Plan | Enterprise, every module on | Starter, a few modules off (transport, hostel, shop) so "module off" behaviour is always exercised |

### Roshan's two branches

| | Main Campus | City Campus |
|---|---|---|
| Character | Large, mixed, Grades 1 to 10, with a hostel and transport | Smaller, girls, Grades 1 to 8, no hostel |
| Wings and rooms | 3 wings, 24 rooms | 2 wings, 14 rooms |
| Sections | 20: two each for Grades 1 to 8; Grade 9 and 10 each with a Science–Biology and a Science–Computer section | 13: two each for Grades 1 to 5; one each for Grades 6 to 8 |
| Students | 720 | 432 |
| Staff | About 60 | About 30 |
| Shifts | Morning | Morning |
| Extras | Hostel (70 boarders), 5 bus routes, shop and canteen, clinic with a nurse | 3 van routes, canteen |
| Seeded to look | On track | On watch for fee collection, so head office screens have a story to tell |

## The calendar the seed lives in

With today as 10 October 2026 (other dates shift everything by the same amount):

| | |
|---|---|
| Academic year | 2026–27, 1 April 2026 to 31 March 2027; last year 2025–26 closed, with promoted students and archived results |
| Terms | First: April to mid-August (summer vacation June to mid-August). Second: mid-August to December. Third: January to March |
| Fiscal year | FY 2026–27 from 1 July; periods closed up to August |
| Today | Mid second term. When the seed is placed on a weekend, what happens "today" at school (visitors inside, the morning's punches, passes waiting for a decision) is placed on the last school day |
| Exams | First-term exam: marked, locked, result published. September monthly test: published. October monthly test: being marked. Second-term exam in December: date sheet published |
| Fees | Vouchers May to October; a three-month summer voucher; October due on the 10th |
| Payroll | April to September paid; October not yet run; September's run kept "under review" at Main Campus to show the review screen |
| Attendance | Every school day of the year so far; today partly marked |

## Accounts

One sign-in for every built-in role, all in Roshan unless stated. Identifiers follow a pattern so they are easy to remember; **passwords, PINs and the fixed one-time code are defined only in `packages/db/src/seed/accounts.ts`** and are printed by the seed run. They are never written in documentation, tests or chat.

| Kind | Identifier pattern | Notes |
|---|---|---|
| Platform staff | `superadmin@takhti.test`, `support@takhti.test` | Two-factor already enrolled with a seed secret |
| Staff | `<role>@roshan.test`, for example `principal@roshan.test`, `cashier@roshan.test` | One per staff role, 28 in all. Roles that need two-factor have it enrolled |
| A second principal | `principal.cc@roshan.test` | City Campus only, for branch isolation tests |
| A teacher who is also a parent | `teacher.parent@roshan.test` | Two memberships in one organisation: Ms Sobia Arif teaches science and is the mother of Rayyan (3-B) |
| Guardians | Phone numbers in a block the seed sets aside (`+92 300 555 0000` onwards), mapped to the fixed code in `supabase/config.toml` from [Phase 5](../20-phases/phase-05-auth.md) | About 1,330 guardian records. Until Phase 5 only `guardian@roshan.test` (Mr Farhan Ahmed, father of the Ahmed children) signs in |
| A guardian in two schools | `guardian.both@roshan.test` (Mr Kashif Mehmood), with a child at Roshan and another at Al-Noor | Tests "choose where to go" |
| Students | School code `roshan` plus the admission number, from Phase 5 | Grades 6 to 10 have logins; younger grades do not. Until Phase 5 only `student@roshan.test` (Maryam Ahmed, 6-B) signs in |
| Al-Noor | `owner@alnoor.test`, `accountant@alnoor.test`, `teacher@alnoor.test`, `guardian@alnoor.test`, `student@alnoor.test` | |

`.test` is a reserved top-level domain; nothing can be sent to these addresses. Locally, email goes to the mail catcher and messages to `/dev/outbox`.

## Named records that tests and demonstrations rely on

These have fixed ids and names. Everything else is generated.

### Families and students

| Who | Where | Why they exist |
|---|---|---|
| The **Ahmed** family: Hassan (3-A), Maryam (6-B), Usman (9-A) | Main | Three siblings: sibling discounts, one family challan, one message for three children; always pays on time |
| The **Malik** family: Sara (4-A, City), Omar (8-A, Main) | Both | Children in two branches: cross-branch family dues, shared credit, each cashier limited to their own branch |
| The **Hussain** family: Ali (5-B), Hina (7-A) | Main | Defaulters: three months unpaid, fines, follow-ups with a broken promise, an instalment plan, a withheld result |
| The **Sheikh** family: one child (2-A) | City | Overpaid: carries family credit that the next voucher uses |
| **Ayesha Raza** (7-B) | Main | A staff child: her mother teaches at the school; `staff_child` discount linked to the staff record |
| **Bilal Khan** (9-A) | Main | At risk: attendance and marks falling, three behaviour records, an open concern; in the high band |
| **Fatima Noor** (5-A) | Main | A severe nut allergy: medical alert, a health profile, a wallet with blocked canteen items |
| **Hamza Tariq** (8-A) | Main | A boarder: hostel allocation, mess plan, authorised people, weekend leave |
| **Zainab Ali** (6-A) | City | Rides a van; her guardian has no WhatsApp, so messages fall back to SMS |
| **Daniel Masih** (9-B) | Main | Takes Ethics in place of Islamiyat; tests subject alternatives and exam slots |
| **Noor Fatima** (10-A) | Main | An orphan with a full need-based discount ending this term; board registration complete |
| **Ibrahim Qureshi** (4-B) | Main | Admitted this week: a new enrolment, an admission voucher, no history |
| **Sana Javed** | Was 6-A, City | Transferred to Main Campus last month: history in both branches |
| **Adeel Shah** | Was 8-B, Main | Withdrawn in September: clearance, a refunded security deposit, a leaving certificate, an alumni record |
| A guardian without custody | The Khan family | Bilal's father is on record in the family, but his link to Bilal is no longer in force: he sees nothing of the child |

### Staff

| Who | Role | Why they exist |
|---|---|---|
| **Mrs Saima Akhtar** | Principal, Main (`principal@roshan.test`) | Approves most things; has `/school`, and through the director's grant, a branch scorecard |
| **Mr Tariq Mehmood** | Owner | Lands on `/hq` |
| **Ms Nadia Raza** | Class teacher of 7-B, teaches English (`class.teacher@roshan.test`) | The teacher portal's main account; also Ayesha's mother |
| **Mr Imran Siddiqui** | Subject teacher, Mathematics, Grades 8 to 10 (`subject.teacher@roshan.test`) | Marks to enter, papers to set, a question paper awaiting approval |
| **Ms Rabia Anwar** | Teacher on approved leave this week | Her lessons need substitutes |
| **Mr Kamran Yousaf** | Teacher on probation ending in ten days | The reminder and the confirm action |
| **Ms Farah Iqbal** | Accountant | Cash sessions to approve, proofs to verify, a reconciliation open |
| **Mr Asif Butt** | Cashier, Main | An open cash session with this morning's payments |
| **Ms Hira Baig** | HR manager | A leave queue, an exit in clearance |
| **Mr Naveed Ashraf** | A driver | Today's two trips |
| **Mr Waqas Latif** | Left in August, rejoined in October | Tests rejoin on the old employee number |
| A staff member on notice | Mr Sajid Niazi, library assistant | Clearance in progress; a final settlement in draft |

## What each area contains

One line each; the detail is in section 14 of the module.

**Seeded today:** setup, students, staff records and recruitment, admissions, the front door, and of the classroom the timetable, syllabus, attendance, diary and homework. **Everything else below is created through the services**, from [Phase 2](../20-phases/phase-02-services-and-routes.md) on, so that fees, payroll, marks and results are produced by the code a school will use; until then those tables are empty.

| Area | Seeded |
|---|---|
| Setup | Two academic years, each with three terms; the holidays of the current year (Eid dates worked out from the Islamic calendar and marked tentative until they pass); a morning shift at each campus; the national 10-point scheme, the older 7-grade scheme and the school's own 5-band scheme for Grades 1 to 8; grades, sections, subjects with groups, a curriculum for both years, teacher assignments with four cells left empty on purpose |
| Admissions | Six lead sources; 120 enquiries in every stage with their follow-ups, about 20 due today; seats for every grade; 45 applications in every state (6 accepted, 4 waitlisted, 3 through the public form, 1 enrolled: Ibrahim Qureshi), with entry tests. Application documents arrive with uploads |
| Students | 933 families and about 1,330 guardians; enrolments for this year and last; last year's promotion, grade by grade, with a few children kept back; 30 children of staff; about 20 orphans; 41 who left this year; about 20 who moved between the campuses, and two transfers still open; a finished withdrawal and two in progress; seven requests for a correction. Documents arrive with the phase that builds uploads |
| Academics | A published timetable and a draft, bell schedules for summer and winter, substitutions; syllabus for five subjects, schemes, lesson plans in every state; ten weeks of attendance with leave and corrections; diary, homework and submissions; resources and quizzes |
| Exams | Exams in every state, seating, eligibility, marks with question scores for Grades 9 and 10, corrections; results published, withheld and revised; report card records; board registrations; a question bank of about 1,500 and papers in every state |
| Behaviour | Categories, six weeks of records, concerns, house points, counselling notes |
| Finance | Structures, plans, discounts; six months of vouchers and payments by every method; reversals, bounced cheques, refunds, instalments, proofs, follow-ups; cash sessions; online intents and settlements on the fake provider; bank statements partly reconciled; a chart of accounts with a balancing ledger; expenses, petty cash, budgets, purchasing in every state; sample tax rules marked as samples |
| People | About 90 staff with private details, a bank account, qualifications, an appointment contract and a history; two on probation, two on contract, one suspended, one on notice with a clearance under way, two who left and one who left and came back; five job openings with forty applicants and their interviews. Then: three months of staff attendance from punches; leave in every state; six payroll runs; loans; an appraisal cycle; training |
| Front door | A stand-in connection for every outside service and an attendance machine at Main Campus with a morning of punches; every system certificate type with an English and an Urdu template, 37 certificates in every state, ID cards for 6-B, 9-A and the finance department; a week of visitors (three still inside), 12 gate passes, 40 calls, 25 post entries, 10 appointments; 180 alumni over three classes |
| Operations | Visitors and gate passes; vehicles, routes, three weeks of trips; a library of about 1,200 titles in use; stock and assets with movements and depreciation; shop sales and wallets; clinic visits and campaigns; a hostel; helpdesk tickets |
| Communication | Notifications and deliveries over two months; campaigns; chats; notices and events; a completed and an open parent–teacher meeting; complaints; surveys; a published website |
| Insight | Ninety days of KPI snapshots, targets, alerts, digests; AI drafts, risk and defaulter scores, topic mastery, activity flags |

## Sizes

| Command | Students | Use |
|---|---|---|
| `pnpm db:seed` | About 1,170 enrolled across both organisations | Development and demonstrations. About 25 seconds with Wave 1; the budget for the full seed is two minutes |
| `pnpm db:seed --small` | About 120 | Quick resets while building one screen. Also what `tests/db/seed.test.ts` writes into a test database on every test run |
| `pnpm db:seed --large` | About 4,500 in Roshan | Performance tests on a developer machine |
| Staging only | 25,000 in a twelve-branch organisation, plus 200 small organisations | The load tests of [Phase 21](../20-phases/phase-21-hardening-and-launch.md) |

## Rules for changing the seed

- A new status, rule or screen needs a seeded example in the same change.
- Never edit generated ids or the named records' ids; tests depend on them.
- After any change: `pnpm db:reset && pnpm db:verify-seed && pnpm check`. `pnpm db:verify-seed` runs the integrity checks of `packages/db/src/seed/verify.ts`; `pnpm db:seed-stats` prints what the database holds, which is where the figures on this page come from.
- A test that needs something unusual builds it with a builder inside the test; the seed is for what many tests and every demonstration share.

# 01 · Product and scope

## What Takhti is

Takhti is school management software for Pakistan, for schools that teach Grades 1 to 10. A school group signs up, adds its branches, and runs everything in one place: admissions, students, attendance, timetable, exams, fees, accounts, staff, payroll, transport, library and communication with parents. It is sold as a cloud service. One installation serves many school groups, and each group sees only its own data.

A *takhti* is the wooden slate children in Pakistan learn to write on.

## Who uses it

| Person | What they need from Takhti |
|---|---|
| Owner / CEO of a school group | One view of every branch: enrolment, fee recovery, results, profit |
| Principal / branch admin | Run one branch day to day |
| Coordinator, exam controller | Timetable, syllabus pace, exams, results |
| Teacher | Mark attendance, enter marks, give homework, talk to parents — fast, on a phone |
| Accountant, cashier | Issue vouchers, collect fees, keep the books balanced |
| HR and payroll officer | Staff records, leave, salaries |
| Front desk, admissions officer | Enquiries, visitors, gate passes, admissions |
| Librarian, transport manager, store keeper, nurse, warden | Their own corner of the school |
| Parent | See attendance, results and fees for all their children; pay; message teachers |
| Student | Timetable, homework, results, learning material |
| Takhti staff (us) | Create and bill school groups, support them |

## What makes it different

1. **Complete.** 44 modules, where local products have 9 to 30.
2. **Multi-branch from day one.** Central policy, local operation, consolidated accounts.
3. **Works when the internet does not.** Attendance, marks and cash fee collection keep working offline and sync later.
4. **AI that does real work.** An assistant for every role that can only see what that role may see, and a person approves everything it writes.
5. **Built for Pakistan only.** Boards, the 2026 grading scale, three-copy bank challans, Urdu in Nastaliq, WhatsApp first.
6. **Hard to break.** Every write is validated, audited and safe to retry. See [09 · Reliability](09-reliability-and-error-proofing.md).

## Scope: 44 modules

Each module has its own specification in [`../10-modules/`](../10-modules/). `M00` holds tables every module shares.

| # | Module | Group | Tier |
|---|---|---|---|
| M00 | Shared kernel tables | — | Core |
| M01 | Platform console (Super Admin) | Platform & group | Core |
| M02 | Organisation and branches | Platform & group | Core |
| M03 | Identity, roles and audit | Platform & group | Core |
| M04 | School setup | Platform & group | Core |
| M05 | Integrations and API | Platform & group | Extended |
| M06 | Admissions | Admissions & students | Core |
| M07 | Students | Admissions & students | Core |
| M08 | Certificates and ID cards | Admissions & students | Extended |
| M09 | Front office | Admissions & students | Extended |
| M10 | Alumni | Admissions & students | Optional |
| M11 | Academic structure | Academics | Core |
| M12 | Timetable | Academics | Core |
| M13 | Syllabus and lesson plans | Academics | Extended |
| M14 | Student attendance | Academics | Core |
| M15 | Homework and diary | Academics | Core |
| M16 | Learning (LMS) | Academics | Extended |
| M17 | Exams and marks | Academics | Core |
| M18 | Results and report cards | Academics | Core |
| M19 | Question bank and papers | Academics | Extended |
| M20 | Behaviour and houses | Academics | Extended |
| M21 | Fees | Finance | Core |
| M22 | Online payments and reconciliation | Finance | Extended |
| M23 | Accounting | Finance | Core |
| M24 | Expenses and procurement | Finance | Extended |
| M25 | Tax and compliance | Finance | Extended |
| M26 | Staff and recruitment | HR | Core |
| M27 | Staff attendance and leave | HR | Core |
| M28 | Payroll | HR | Core |
| M29 | Appraisal and training | HR | Optional |
| M30 | Transport | Operations | Extended |
| M31 | Library | Operations | Extended |
| M32 | Inventory and assets | Operations | Extended |
| M33 | School shop and canteen | Operations | Optional |
| M34 | Health clinic | Operations | Optional |
| M35 | Hostel | Operations | Optional |
| M36 | Maintenance helpdesk | Operations | Optional |
| M37 | Messaging hub | Communication | Core |
| M38 | Parent–teacher chat and meetings | Communication | Extended |
| M39 | Notices, events and calendar | Communication | Core |
| M40 | Complaints and surveys | Communication | Extended |
| M41 | School website | Communication | Optional |
| M42 | Dashboards and reports | Intelligence | Core |
| M43 | Owner analytics | Intelligence | Extended |
| M44 | AI suite | Intelligence | Extended |

**Tier** says how the module is sold and switched on, not when its backend is built. The backend for all 44 is built in Phases 1 to 3. Screens are built portal by portal from Phase 6 on, Core first.

- **Core** — every school has it.
- **Extended** — on by default in higher plans.
- **Optional** — off until the school asks.

## Portals

A portal is a tailored home, menu and set of screens for one kind of person. Seven web shells carry the 12 portals.

| # | Portal | Shell (URL) | Who |
|---|---|---|---|
| 1 | Super Admin | `/platform` | Takhti staff |
| 2 | CEO / Owner | `/hq` | Owner, director, group finance and academic heads, auditor |
| 3 | Branch Admin | `/school` | Principal, vice principal, branch admin |
| 4 | Academics and Exams | `/school` (academics workspace) | Section head, coordinator, exam controller, counsellor |
| 5 | Finance | `/school` (finance workspace) | Accountant, cashier |
| 6 | HR | `/school` (HR workspace) | HR manager, payroll officer |
| 7 | Front office and admissions | `/school` (front office workspace) | Admissions officer, receptionist, security guard |
| 8 | Operations | `/school` (operations workspace) | Librarian, transport manager, store keeper, nurse, warden, IT admin |
| 9 | Teacher | `/teach` | Class teacher, subject teacher |
| 10 | Student | `/learn` | Student |
| 11 | Parent | `/family` | Guardian |
| 12 | Public | `/s/[school]` | Anyone: school website, online admission, fee payment link, certificate check |

Portals 3 to 8 share one shell, `/school`. The menu and the dashboard change with the person's roles, so an accountant never sees the timetable menu and a librarian never sees payroll. Every member of staff also gets a self-service area (my profile, my payslips, my leave, my attendance) inside whichever shell they use.

## Mobile apps (after the web product)

Parent, Teacher, Student, Admin/Owner and Driver apps are built with Expo after the web product is complete. They reuse `contracts`, `api-client` and `hooks` unchanged. See [Phase 23](../20-phases/phase-23-mobile-apps.md).

## Out of scope

- Pre-school (Montessori, nursery, KG) and college (Grades 11 and 12). The data model does not block them, but no screen or rule is built for them.
- Any country other than Pakistan: no other currency, tax regime, language or board.
- Holding money. Fees go from the parent to the school's own bank or wallet account. Takhti records and reconciles; it never holds funds.
- Built-in video calling. A live class is a link to Zoom, Meet or Teams.
- Timetable generation by a mathematical solver in the first release. Phase 8 ships a rule-checked manual editor with auto-fill; the AI phase adds generation.

## Product principles

These decide arguments during implementation.

1. **One source of truth.** A fact is stored once. A total that can be computed from rows is computed, not stored, unless it must be frozen (a published result, a paid voucher).
2. **Every write is checked, audited and safe to repeat.** No exceptions for "internal" screens.
3. **A status always carries its word.** Colour never carries meaning alone.
4. **The server decides.** The browser may hide a button, but the service layer and the database are what enforce a rule.
5. **Offline where the work happens.** A teacher at the classroom door and a cashier at the counter must never be blocked by the network.
6. **AI drafts, people approve.** Nothing written by AI reaches a parent, a report card or the books without a named person accepting it.
7. **Fail loudly to staff, gently to parents.** Staff see what went wrong and how to fix it. Parents see a calm message and a way forward.
8. **Square corners.** Radius is zero everywhere. See [the theme](../../design/theme/kashi-theme.html).

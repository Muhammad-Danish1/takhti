# Navigation map

Every page of every portal, where it sits in the menu, and what a person needs to see it. This is the source for each shell's `nav.ts` ([Phase 4](../20-phases/phase-04-frontend-foundation.md)). An item is rendered only when the person holds the permission in **Needs** and the module is switched on.

**Needs** shows one permission; where a page serves several roles the menu item uses "any of" the permissions its tabs need, and each tab checks its own.

Paths are under `apps/web/app/(app)/`. **Phase** is where the page is built.

## `/school` — the working app for branch staff

A sidebar with groups. A person sees only the groups that contain something for them, so an accountant's sidebar is Home, Fees, Finance and their own items; a librarian's is Home, Library and their own items.

### Home

| Item | Path | Needs | Module | Phase |
|---|---|---|---|---|
| Dashboard | `/school` | signed in | M42 | 7 |
| Approvals | `/school/approvals` | `approvals:read` | M00 | 7 |
| Calendar | `/school/calendar` | signed in | M39 | 12 |
| Reports | `/school/reports` | `reports:read` | M42 | 15 |

### Admissions and students

| Item | Path | Needs | Module | Phase |
|---|---|---|---|---|
| Admissions | `/school/admissions` | `admission-enquiries:read` | M06 | 7 |
| Students | `/school/students` | `students:read` | M07 | 7 |
| Promotion and transfers | `/school/students/promotion` | `promotions:read` | M07 | 7 |
| Withdrawals | `/school/students/withdrawals` | `withdrawals:read` | M07 | 7 |
| Behaviour | `/school/students/behaviour` | `behaviour:read` | M20 | 8 |
| Houses | `/school/students/houses` | `behaviour:read` | M20 | 8 |
| Counselling | `/school/students/counselling` | `counselling:create` | M20 | 8 |
| Students at risk | `/school/students/risk` | `risk:read` | M44 | 19 |
| Certificates | `/school/certificates` | `certificates:read` | M08 | 7 |
| ID cards | `/school/id-cards` | `id-cards:read` | M08 | 7 |
| Alumni | `/school/alumni` | `alumni:read` | M10 | 7 |

### Academics

| Item | Path | Needs | Module | Phase |
|---|---|---|---|---|
| Classes and subjects | `/school/academics/structure` | `sections:read` | M11 | 7 |
| Timetable | `/school/academics/timetable` | `timetables:read` | M12 | 8 |
| Syllabus and plans | `/school/academics/syllabus` | `syllabus:read` | M13 | 8 |
| Attendance | `/school/academics/attendance` | `attendance:read` | M14 | 8 |
| Diary and homework | `/school/academics/diary` | `diary:read` | M15 | 8 |
| Learning | `/school/academics/learning` | `learning-resources:read` | M16 | 8 |

### Exams

| Item | Path | Needs | Module | Phase |
|---|---|---|---|---|
| Exams | `/school/exams` | `exams:read` | M17 | 8 |
| Results | `/school/exams/results` | `results:read` | M18 | 8 |
| Board registrations | `/school/exams/board` | `board-registrations:manage` | M18 | 8 |
| Question bank and papers | `/school/exams/questions` | `questions:read` | M19 | 8 |

### Fees

| Item | Path | Needs | Module | Phase |
|---|---|---|---|---|
| Collect fees | `/school/fees/collect` | `fee-payments:collect` | M21 | 9 |
| Vouchers | `/school/fees/vouchers` | `fee-vouchers:read` | M21 | 9 |
| Payments | `/school/fees/payments` | `fee-payments:read` | M21 | 9 |
| Defaulters | `/school/fees/defaulters` | `fees:reports` | M21 | 9 |
| Discounts | `/school/fees/discounts` | `discounts:read` | M21 | 9 |
| Structures | `/school/fees/structures` | `fee-structures:read` | M21 | 9 |
| Adjustments and refunds | `/school/fees/adjustments` | `fee-adjustments:create` | M21 | 9 |
| Payment proofs | `/school/fees/proofs` | `payment-proofs:verify` | M21 | 9 |
| Cash sessions | `/school/fees/sessions` | `fee-payments:read` | M21 | 9 |
| Fee reports | `/school/fees/reports` | `fees:reports` | M21 | 9 |

### Finance

| Item | Path | Needs | Module | Phase |
|---|---|---|---|---|
| Online payments | `/school/finance/online` | `online-payments:read` | M22 | 9 |
| Bank and reconciliation | `/school/finance/bank` | `reconciliation:read` | M22 | 9 |
| Accounts | `/school/finance/accounts` | `accounts:read` | M23 | 9 |
| Journal | `/school/finance/journal` | `journal-entries:read` | M23 | 9 |
| Expenses | `/school/finance/expenses` | `expenses:read` | M24 | 9 |
| Purchasing | `/school/finance/purchasing` | `purchase-orders:read` | M24 | 9 |
| Vendors | `/school/finance/vendors` | `vendors:read` | M24 | 9 |
| Budgets | `/school/finance/budgets` | `budgets:read` | M24 | 9 |
| Tax | `/school/finance/tax` | `tax-rules:read` | M25 | 9 |
| Financial reports | `/school/finance/reports` | `financial-reports:read` | M23 | 9 |
| Unusual activity | `/school/finance/activity` | `activity-flags:read` | M44 | 19 |

### Staff

| Item | Path | Needs | Module | Phase |
|---|---|---|---|---|
| Staff | `/school/staff` | `staff:read` | M26 | 7 |
| Staff attendance | `/school/staff/attendance` | `staff-attendance:read` | M27 | 10 |
| Leave | `/school/staff/leave` | `leave:read` | M27 | 10 |
| Recruitment | `/school/staff/recruitment` | `job-applicants:read` | M26 | 10 |
| Exits | `/school/staff/exits` | `staff-exits:manage` | M26 | 10 |
| Appraisal and training | `/school/staff/appraisal` | `appraisals:read` | M29 | 10 |
| Payroll | `/school/payroll` | `payroll:read` | M28 | 10 |

### Operations

| Item | Path | Needs | Module | Phase |
|---|---|---|---|---|
| Front office | `/school/front-office` | `visitors:read` | M09 | 11 |
| Gate | `/school/gate` | `gate-passes:exit` | M09 | 11 |
| Transport | `/school/transport` | `transport:read` | M30 | 11 |
| My trips | `/school/trips` | `trips:operate` | M30 | 11 |
| Library | `/school/library` | `library:read` | M31 | 11 |
| Library desk | `/school/library/desk` | `library:circulate` | M31 | 11 |
| Inventory | `/school/inventory` | `inventory:read` | M32 | 11 |
| Assets | `/school/assets` | `assets:read` | M32 | 11 |
| Shop and canteen | `/school/shop` | `shop:read` | M33 | 11 |
| Point of sale | `/school/shop/sell` | `shop:sell` | M33 | 11 |
| Clinic | `/school/clinic` | `clinic:manage` | M34 | 11 |
| Incidents | `/school/incidents` | `incidents:read` | M34 | 11 |
| Hostel | `/school/hostel` | `hostel:read` | M35 | 11 |
| Helpdesk | `/school/helpdesk` | `tickets:read` | M36 | 11 |
| Room bookings | `/school/bookings` | `facility-bookings:create` | M36 | 11 |

### Communication

| Item | Path | Needs | Module | Phase |
|---|---|---|---|---|
| Messages | `/school/communication/inbox` | `chat:use` | M38 | 12 |
| Send a message | `/school/communication/messages` | `campaigns:create` | M37 | 12 |
| Delivery log | `/school/communication/deliveries` | `messages:read` | M37 | 12 |
| Notices | `/school/communication/notices` | `notices:read` | M39 | 12 |
| Events | `/school/communication/events` | `events:read` | M39 | 12 |
| Parent–teacher meetings | `/school/communication/ptm` | `ptm:read` | M38 | 12 |
| Complaints | `/school/communication/complaints` | `complaints:handle` | M40 | 12 |
| Surveys | `/school/communication/surveys` | `surveys:manage` | M40 | 12 |
| Website | `/school/website` | `website:read` | M41 | 20 |

### Settings — `/school/settings`

A Settings page with a left list. Each section needs its own permission.

| Section | Path | Needs | Module | Phase |
|---|---|---|---|---|
| School and branches | `/school/settings` | `org:read` | M02 | 7 |
| Academic year, terms, holidays, grading | `/school/settings/academics` | `academic-years:read` | M04 | 7 |
| Users and roles | `/school/settings/users` | `memberships:read` | M03 | 7 |
| Approvals | `/school/settings/approvals` | `approval-policies:read` | M00 | 7 |
| Custom fields | `/school/settings/custom-fields` | `custom-fields:read` | M00 | 7 |
| Imports | `/school/settings/imports` | `imports:read` | M00 | 7 |
| Admissions | `/school/settings/admissions` | `admission-settings:update` | M06 | 7 |
| Fees | `/school/settings/fees` | `fee-setup:manage` | M21 | 9 |
| Results | `/school/settings/results` | `result-policies:manage` | M18 | 8 |
| Staff | `/school/settings/staff` | `staff-setup:manage` | M26 | 10 |
| Leave and work schedules | `/school/settings/leave` | `leave-setup:manage` | M27 | 10 |
| Payroll | `/school/settings/payroll` | `salary-components:manage` | M28 | 10 |
| Notifications | `/school/settings/notifications` | `notification-settings:manage` | M37 | 12 |
| Integrations | `/school/settings/integrations` | `integrations:read` | M05 | 18 |
| Devices | `/school/settings/devices` | `sync-devices:read` | M00 | 17 |
| Compliance | `/school/settings/compliance` | `compliance:read` | M25 | 9 |
| AI | `/school/settings/ai` | `ai-settings:manage` | M44 | 19 |
| Audit log | `/school/settings/audit-log` | `audit-log:read` | M03 | 7 |
| Background jobs | `/school/settings/jobs` | `jobs:read` | M00 | 7 |
| Data checks | `/school/settings/data-checks` | `integrity:read` | M00 | 7 |
| Recently deleted | `/school/settings/recently-deleted` | `students:delete` | M00 | 7 |
| Subscription | `/school/settings/subscription` | `subscription:read` | M01 | 7 |

### My work — in the user menu of every staff shell

No permission needed; each page shows the person's own records.

| Item | Path | Module | Phase |
|---|---|---|---|
| My account | `/school/me` | M03 | 5 |
| My attendance | `/school/me/attendance` | M27 | 10 |
| My leave | `/school/me/leave` | M27 | 10 |
| My salary | `/school/me/salary` | M28 | 10 |
| My growth | `/school/me/growth` | M29 | 10 |
| My items | `/school/me/items` | M32 | 11 |
| My reports of problems | `/school/me/tickets` | M36 | 11 |
| Raise a concern | `/school/me/concerns` | M40 | 12 |
| My tax | `/school/me/tax` | M25 | 10 |

## `/hq` — head office

| Item | Path | Needs | Module | Phase |
|---|---|---|---|---|
| Overview | `/hq` | `hq:read` | M43 | 15 |
| Branches | `/hq/branches` | `hq:read` | M43 | 15 |
| Compare | `/hq/comparison` | `hq:read` | M43 | 15 |
| Movements | `/hq/movements` | `hq:read` | M43 | 15 |
| Decisions | `/hq/decisions` | `hq:read` | M43 | 15 |
| Finance | `/hq/finance` | `financial-reports:read` | M23 | 15 |
| Forecast | `/hq/forecast` | `hq:read` | M43 | 15 |
| Reports | `/hq/reports` | `reports:read` | M42 | 15 |
| Analysis | `/hq/analysis` | `analysis:use` | M42 | 15 |
| Targets | `/hq/targets` | `targets:manage` | M43 | 15 |
| Alerts | `/hq/alerts` | `alerts:handle` | M43 | 15 |
| Unusual activity | `/hq/activity` | `activity-flags:read` | M44 | 19 |
| Digests | `/hq/digests` | `hq:read` | M43 | 15 |
| Organisation | `/hq/settings` | `org:read` | M02 | 15 |
| Group academic settings | `/hq/settings/academics` | `academic-years:read` | M04 | 15 |
| Subscription | `/hq/subscription` | `subscription:read` | M01 | 15 |

A branch switcher in the top bar sets "all my branches" or a subset for every page.

## `/teach` — teachers, on a phone

A bottom bar of five, and everything else under **More**.

| Item | Path | Needs | Module | Phase |
|---|---|---|---|---|
| **Today** | `/teach` | signed in | M12 | 13 |
| **Classes** | `/teach/classes` | `sections:read` | M11 | 13 |
| **Marks** | `/teach/marks` | `marks:enter` | M17 | 13 |
| **Messages** | `/teach/messages` | `chat:use` | M38 | 13 |
| **More** | `/teach/more` | signed in | — | 13 |
| Attendance | `/teach/attendance` | `attendance:mark` | M14 | 13 |
| Timetable | `/teach/timetable` | `timetables:read` | M12 | 13 |
| Diary | `/teach/diary` | `diary:create` | M15 | 13 |
| Homework | `/teach/homework` | `homework:create` | M15 | 13 |
| Lesson plans | `/teach/plans` | `lesson-plans:create` | M13 | 13 |
| Syllabus progress | `/teach/sections` | `syllabus-progress:update` | M13 | 13 |
| Resources | `/teach/resources` | `learning-resources:create` | M16 | 13 |
| Quizzes | `/teach/quizzes` | `quizzes:create` | M16 | 13 |
| Question bank and papers | `/teach/questions` | `questions:read` | M19 | 13 |
| Remarks | `/teach/remarks` | `results:remarks` | M18 | 13 |
| Invigilation | `/teach/invigilation` | signed in | M17 | 13 |
| Parent–teacher meetings | `/teach/ptm` | `ptm:conduct` | M38 | 13 |
| Notices | `/teach/notices` | signed in | M39 | 13 |
| Calendar | `/teach/calendar` | signed in | M39 | 13 |
| Library | `/teach/library` | signed in | M31 | 13 |
| Report a problem | `/teach/problems` | `tickets:create` | M36 | 13 |
| My leave, attendance, salary, growth | `/teach/me/…` | signed in | M27, M28, M29 | 13 |
| Account | `/teach/me` | signed in | M03 | 5 |

## `/family` — parents, on a phone

A child switcher at the top (all children, or one). A bottom bar of five.

| Item | Path | Module | Phase |
|---|---|---|---|
| **Home** | `/family` | M42 | 14 |
| **Fees** | `/family/fees` | M21, M22 | 14 |
| **Attendance** | `/family/attendance` | M14 | 14 |
| **Results** | `/family/results` | M18 | 14 |
| **More** | `/family/more` | — | 14 |
| Diary | `/family/diary` | M15 | 14 |
| Homework | `/family/homework` | M15 | 14 |
| Timetable | `/family/timetable` | M12 | 14 |
| Exams | `/family/exams` | M17 | 14 |
| Learning | `/family/learning` | M16 | 14 |
| Messages | `/family/messages` | M38 | 14 |
| Notices | `/family/notices` | M39 | 14 |
| Calendar | `/family/calendar` | M39 | 14 |
| Events | `/family/events` | M39 | 14 |
| Parent–teacher meetings | `/family/ptm` | M38 | 14 |
| Leave request | `/family/leave` | M14 | 14 |
| Early pickup | `/family/pickup` | M09 | 14 |
| Meet a teacher | `/family/appointments` | M09 | 14 |
| Behaviour | `/family/behaviour` | M20 | 14 |
| Transport | `/family/transport` | M30 | 14 |
| Library | `/family/library` | M31 | 14 |
| Wallet | `/family/wallet` | M33 | 14 |
| Health | `/family/health` | M34 | 14 |
| Hostel | `/family/hostel` | M35 | 14 |
| Certificates | `/family/certificates` | M08 | 14 |
| Raise a concern | `/family/concerns` | M40 | 14 |
| Surveys | `/family/surveys` | M40 | 14 |
| Family profile | `/family/profile` | M07 | 14 |
| My tax | `/family/tax` | M25 | 14 |
| Account | `/family/me` | M03 | 5 |

Items appear only when the school has the module and, for Transport, Hostel and Wallet, when a child uses it.

## `/learn` — students

| Item | Path | Module | Phase |
|---|---|---|---|
| **Home** | `/learn` | M42 | 14 |
| **Timetable** | `/learn/timetable` | M12 | 14 |
| **Homework** | `/learn/homework` | M15 | 14 |
| **Results** | `/learn/results` | M18 | 14 |
| **More** | `/learn/more` | — | 14 |
| Subjects and resources | `/learn/resources` | M16 | 14 |
| Quizzes | `/learn/quizzes` | M16 | 14 |
| Diary | `/learn/diary` | M15 | 14 |
| Attendance | `/learn/attendance` | M14 | 14 |
| Exams | `/learn/exams` | M17 | 14 |
| Library | `/learn/library` | M31 | 14 |
| Wallet | `/learn/wallet` | M33 | 14 |
| Notices and calendar | `/learn/notices` | M39 | 14 |
| Surveys | `/learn/surveys` | M40 | 14 |
| Study help | `/learn/help` | M44 | 19 |
| Profile | `/learn/profile` | M07 | 14 |

## `/platform` — Takhti's own staff

All pages need a platform admin ([M01](../10-modules/m01-platform-console.md)). Built in [Phase 6](../20-phases/phase-06-platform-console.md).

| Item | Path |
|---|---|
| Dashboard | `/platform` |
| Organisations | `/platform/orgs` |
| Plans | `/platform/plans` |
| Subscriptions | `/platform/subscriptions` |
| Invoices | `/platform/invoices` |
| Demo requests | `/platform/demo-requests` |
| Support sessions | `/platform/support-sessions` |
| Announcements | `/platform/announcements` |
| Feature flags | `/platform/feature-flags` |
| Usage | `/platform/usage` |
| Metrics | `/platform/metrics` |
| Jobs | `/platform/jobs` |
| Audit log | `/platform/audit-log` |
| Admins | `/platform/admins` |
| Settings | `/platform/settings` |

## `/s/[school]` — the public site

No sign-in. Built in [Phase 20](../20-phases/phase-20-public-website.md). Urdu pages are the same paths under `/s/[school]/ur`.

| Page | Path | Module |
|---|---|---|
| Home and the school's own pages | `/s/[school]`, `/s/[school]/[slug]` | M41 |
| News | `/s/[school]/news`, `/s/[school]/news/[slug]` | M41 |
| Events | `/s/[school]/events` | M39 |
| Admissions | `/s/[school]/admissions`, `…/enquire`, `…/apply`, `…/track` | M06 |
| Jobs | `/s/[school]/jobs`, `/s/[school]/jobs/[id]` | M26 |
| Transport routes | `/s/[school]/transport` | M30 |
| Check a certificate | `/s/[school]/verify` | M08 |
| Pay fees | `/s/[school]/pay` | M22 |
| Contact | `/s/[school]/contact` | M41 |

## Command palette

`Ctrl+K` in every staff shell searches the navigation items above (filtered the same way) and records: students by name, father's name or admission number; staff by name or employee number; vouchers and receipts by number. A record result opens its detail page. Record search calls each module's list route with `q`, so it can never show what the person could not otherwise see.

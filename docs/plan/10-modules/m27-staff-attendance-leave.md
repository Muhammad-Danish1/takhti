# M27 · Staff attendance and leave

## 1 · Purpose

When staff came and went, and when they were away with permission. Attendance comes mostly from the biometric machine; leave is requested and approved in the app, checked against a balance, and both feed payroll and the timetable's substitutions.

## 2 · Depends on

[M26](m26-staff-recruitment.md) (`staff`), [M04](m04-school-setup.md) (holidays, working week), [M05](m05-integrations-api.md) (biometric punches), [M00](m00-shared-kernel.md) (approvals, files). Feeds [M12](m12-timetable.md) (substitutions) and [M28](m28-payroll.md) (paid days, deductions).

## 3 · Tables

#### `work_schedules` · org
Expected working hours.

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation; "Teaching staff — summer" |
| branch_id | uuid → branches | optional; empty means usable by any branch |
| days | jsonb | required; seven entries `{ weekday, isOff, start?, end? }` |
| late_grace_minutes | int | default 10 |
| half_day_after_minutes | int | default 120; arriving later than this counts as half a day |
| early_leave_grace_minutes | int | default 10 |
| effective_from | date | optional; for seasonal schedules |
| effective_to | date | optional |
| is_default | bool | default false; one default per branch |
| is_active | bool | default true |

#### `staff_attendance` · branch
One row per staff member per day.

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| att_date | date | required |
| status | enum(present, absent, late, half_day, leave, on_duty, holiday, weekly_off) | required |
| check_in | timestamptz | optional |
| check_out | timestamptz | optional; after `check_in` |
| minutes_late | int | default 0 |
| minutes_early | int | default 0 |
| worked_minutes | int | optional |
| source | enum(biometric, manual, mobile, import, leave, system) | required |
| leave_request_id | uuid → leave_requests | optional |
| is_manual_override | bool | default false |
| note | text | optional |
| is_locked | bool | default false; set when payroll for the month is approved |

Policy: staff of the branch with `staff-attendance:read`; a staff member may read their own rows.
Unique: (staff_id, att_date).
Index: (org_id, branch_id, att_date, status).

#### `staff_attendance_corrections` · branch

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| att_date | date | required |
| requested_status | text | required |
| requested_check_in | timestamptz | optional |
| requested_check_out | timestamptz | optional |
| reason | text | required |
| status | enum(pending, approved, rejected) | default pending |
| approval_request_id | uuid → approval_requests | optional |
| requested_by | uuid → profiles | required |

Policy: a staff member may insert and read their own.

#### `leave_types` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation |
| name_ur | text | optional |
| code | text | required; `CL`, `SL`, `AL` |
| kind | enum(casual, sick, annual, maternity, paternity, hajj, iddat, compensatory, study, unpaid, other) | required |
| is_paid | bool | default true |
| accrual | enum(yearly, monthly, none) | default yearly; `none` for leave given case by case |
| carry_forward_max | numeric(5,1) | default 0 |
| is_encashable | bool | default false |
| max_days_at_once | numeric(5,1) | optional |
| document_after_days | int | optional; a certificate is required beyond this many days |
| notice_days | int | default 0; how far ahead it must be requested |
| gender | enum(all, female, male) | default all |
| min_service_months | int | default 0 |
| counts_non_working_days | bool | default false; when true, holidays inside the leave count as leave |
| half_day_allowed | bool | default true |
| is_active | bool | default true |

#### `leave_policies` · org
How many days of each type a group of staff gets in a year.

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation |
| employment_types | text[] | required; which employment types it covers |
| staff_type | enum(teaching, non_teaching, all) | default all |
| entitlements | jsonb | required; `{ leaveTypeId, daysPerYear }[]` |
| is_active | bool | default true |

#### `leave_balances` · org
One row per staff member, leave type and leave year.

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| leave_type_id | uuid → leave_types | required |
| leave_year | int | required; the year in which the leave year starts |
| opening | numeric(5,1) | default 0; carried forward |
| accrued | numeric(5,1) | default 0 |
| used | numeric(5,1) | default 0 |
| pending | numeric(5,1) | default 0; requested, not yet decided |
| adjusted | numeric(5,1) | default 0 |
| encashed | numeric(5,1) | default 0 |
| available | numeric(5,1) | generated: `opening + accrued + adjusted - used - pending - encashed` |

Policy: staff with `leave:manage`; a staff member may read their own rows.
Unique: (staff_id, leave_type_id, leave_year).

#### `leave_ledger` · org append-only
Why a balance is what it is.

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| leave_type_id | uuid → leave_types | required |
| leave_year | int | required |
| kind | enum(opening, accrual, taken, cancelled, carry_forward, lapsed, encashed, adjustment, compensatory_earned) | required |
| days | numeric(5,1) | required; signed |
| leave_request_id | uuid → leave_requests | optional |
| note | text | optional |

#### `leave_requests` · branch

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| leave_type_id | uuid → leave_types | required |
| from_date | date | required |
| to_date | date | required; ≥ `from_date` |
| half_day | enum(none, first_half, second_half) | default none; only when `from_date = to_date` |
| days | numeric(5,1) | required; computed by the server |
| unpaid_days | numeric(5,1) | default 0; the part beyond the balance |
| reason | text | required |
| file_id | uuid → files | optional |
| contact_phone | text | optional |
| handover_note | text | optional |
| status | enum(pending, approved, rejected, cancelled) | default pending |
| approval_request_id | uuid → approval_requests | optional |
| decided_at | timestamptz | optional |
| applied_by | uuid → profiles | required; the person or HR on their behalf |

Policy: a staff member may insert for themselves, read their own and cancel their own pending or future request.
Index: (org_id, staff_id, from_date); (org_id, branch_id, status).

## 4 · Contracts

`packages/contracts/src/modules/staff-attendance/`: `work-schedules`, `staff-attendance`, `leave-types`, `leave-policies`, `leave-balances`, `leave-requests`.

- `DayBoard`: for a branch and date — every staff member with status, times, and a flag for "no punch yet".
- `MonthSheet`: staff down, days across, a letter per cell, with totals: present, absent, late, half days, leave by type, paid days.
- `LeaveQuote`: `{ leaveTypeId, fromDate, toDate, halfDay }` → days counted, balance before and after, unpaid days, lessons affected, warnings. Computed without saving.
- `MyLeave`: balances by type, requests, and the team calendar for a manager.
- `PayrollAttendance`: per staff member for a pay period — working days, paid days, absent days, unpaid leave days, late count, deductible half days. This is the only thing payroll reads.

Day counting lives in `packages/core/src/modules/staff-attendance/leave-days.ts`, pure and table-tested.

Settings: `leave.year_start_month` (default 1), `staff_attendance.source` (`biometric` | `manual` | `both`), `staff_attendance.absent_if_no_punch_by` (default 12:00), `staff_attendance.lates_per_half_day` (default 3; 0 switches it off), `staff_attendance.self_correction_days` (default 3), `leave.allow_negative` (default false), `leave.excess_becomes_unpaid` (default true), `leave.max_team_absent_percent` (default 25; a warning for the approver).

## 5 · Rules

**Attendance**

- **R-sattend-1** Each staff member has one row per day. A job turns the day's biometric punches into it: the first punch is `check_in`, the last is `check_out`. A punch within 2 minutes of the previous one is ignored.
- **R-sattend-2** Status is worked out from the person's work schedule for that date: `late` when `check_in` is past the start plus grace; `half_day` when it is past `half_day_after_minutes`, or when `check_out` is that much before the end; otherwise `present`.
- **R-sattend-3** A non-working day in the schedule is `weekly_off`; a holiday for the branch is `holiday`; an approved leave day is `leave`; an approved official duty away from school is `on_duty`. These are written ahead by the system and are replaced by `present` if the person punches in anyway (the leave is not consumed for that day and the staff member is told).
- **R-sattend-4** A working day with no punch and no leave becomes `absent` at `staff_attendance.absent_if_no_punch_by`, and the person and their manager are told. A later punch changes it.
- **R-sattend-5** A missing check-out leaves `worked_minutes` empty and the day flagged; it is not treated as absence.
- **R-sattend-6** Manual marking and manual changes set `is_manual_override`, need a note, and are audited. A person cannot change their own row; they ask for a correction, within `staff_attendance.self_correction_days`.
- **R-sattend-7** With `staff_attendance.lates_per_half_day` above zero, every that-many late arrivals in a pay period count as one deductible half day, reported to payroll; it does not change the attendance rows.
- **R-sattend-8** When payroll for a month is approved, that month's rows are locked. A change afterwards needs `staff-attendance:unlock` and becomes an adjustment in the next payroll.
- **R-sattend-9** Staff working at two branches are recorded at their home branch; a punch at another branch's machine counts for the same day's row.

**Leave**

- **R-sattend-10** Entitlement comes from the leave policy that matches the person's employment type and staff type. A yearly type is credited at the start of the leave year (pro rata for a joiner, by months remaining); a monthly type is credited on the first of each month.
- **R-sattend-11** A type with `min_service_months` or `gender` is offered only to those who qualify.
- **R-sattend-12** Days are counted over working days of the person's schedule, excluding holidays, unless the type has `counts_non_working_days`. A half day counts 0.5.
- **R-sattend-13** A request overlapping another pending or approved request of the same person is refused. A request is refused when it is shorter notice than the type requires, unless it is sick leave or HR applies it.
- **R-sattend-14** When the days exceed what is available: with `leave.excess_becomes_unpaid`, the excess is shown as unpaid days and the person must confirm; otherwise the request is refused. Balances never go negative unless `leave.allow_negative`.
- **R-sattend-15** A certificate is required when the days exceed the type's `document_after_days`. It may be attached up to 3 days after returning; until then the request is flagged.
- **R-sattend-16** Approval follows the approval policy for leave: normally the reporting manager, then the principal beyond a number of days. A person never approves their own leave. The approver sees who else in the team is away on those dates.
- **R-sattend-17** Requesting moves the days to `pending`; approval moves them to `used` and writes the ledger; rejection or cancellation releases them. All in one transaction with the request.
- **R-sattend-18** On approval, attendance rows for those dates are written as `leave`, and the timetable creates substitution needs for the person's lessons ([R-timetable-8](m12-timetable.md)).
- **R-sattend-19** A person can cancel a pending request, or an approved one whose first day has not come. Cancelling part of a leave that has started is done by HR ("returned early"), which restores the unused days.
- **R-sattend-20** At the end of the leave year a job carries forward up to each type's `carry_forward_max`, lapses the rest, and writes both to the ledger.
- **R-sattend-21** Leave that spans two leave years is split between them at the year boundary.
- **R-sattend-22** Encashment is recorded here as `encashed` and paid through payroll ([M28](m28-payroll.md)); only encashable types, only up to the available balance.
- **R-sattend-23** Maternity and similar statutory leave are leave types whose length the school sets after checking the law of its province; the product ships no fixed figure.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `staff-attendance:read` | See staff attendance in scope | HR, LEADERS, section_head |
| `staff-attendance:mark` | Mark and change staff attendance by hand | HR, branch_admin |
| `staff-attendance:unlock` | Change attendance in a month whose payroll is approved | hr_manager |
| `work-schedules:manage` | Maintain work schedules | HR, branch_admin |
| `leave-setup:manage` | Maintain leave types and policies | hr_manager |
| `leave:read` | See leave requests and balances in scope | HR, LEADERS, section_head, coordinator |
| `leave:manage` | Apply leave on someone's behalf; adjust balances; record early return | HR |
| `leave:approve` | Decide leave requests routed to one's role | LEADERS, section_head, HR |
| `staff-attendance:export` | Export attendance and leave reports | HR, LEADERS |

Every staff member can see their own attendance and balances and request leave; that needs no permission.

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/work-schedules` | `staff-attendance:read` | Lists |
| POST | `/work-schedules` | `work-schedules:manage` | Creates |
| PATCH | `/work-schedules/[id]` | `work-schedules:manage` | Edits |
| GET | `/staff-attendance/day` | `staff-attendance:read` | The day board for a branch and date |
| GET | `/staff-attendance/month` | `staff-attendance:read` | The month sheet |
| PUT | `/staff-attendance` | `staff-attendance:mark` | Marks or changes rows by hand |
| GET | `/staff/[id]/attendance` | `staff-attendance:read` | One person's attendance for a period |
| GET | `/staff-attendance/corrections` | `staff-attendance:read` | Lists correction requests |
| POST | `/staff-attendance/corrections/[id]/decide` | `staff-attendance:mark` | Approves or rejects |
| POST | `/staff-attendance/reprocess` | `staff-attendance:mark` | Rebuilds days from punches for a date range |
| GET | `/staff-attendance/summary` | `staff-attendance:read` | Totals by branch, department and day |
| GET | `/staff-attendance/payroll` | `staff-attendance:read` | The payroll attendance figures for a period |
| GET | `/staff-attendance/export` | `staff-attendance:export` | Exports |
| GET | `/leave-types` | `signed-in` | Lists the types the caller may use |
| POST | `/leave-types` | `leave-setup:manage` | Creates |
| PATCH | `/leave-types/[id]` | `leave-setup:manage` | Edits |
| GET | `/leave-policies` | `leave:read` | Lists |
| POST | `/leave-policies` | `leave-setup:manage` | Creates |
| PATCH | `/leave-policies/[id]` | `leave-setup:manage` | Edits |
| GET | `/leave-balances` | `leave:read` | Balances; filter by branch, type, year |
| POST | `/leave-balances/adjust` | `leave:manage` | Adjusts a balance with a reason |
| GET | `/leave-requests` | `leave:read` | Lists; filter by status, dates, branch |
| POST | `/leave-requests` | `leave:manage` | Applies on someone's behalf |
| GET | `/leave-requests/[id]` | `leave:read` | One request with its approval trail |
| POST | `/leave-requests/[id]/return-early` | `leave:manage` | Shortens a leave that has started |
| GET | `/leave/calendar` | `leave:read` | Who is away, by day |
| GET | `/me/attendance` | `signed-in` | My attendance |
| POST | `/me/attendance/corrections` | `signed-in` | Asks for a correction |
| GET | `/me/leave` | `signed-in` | My balances and requests |
| POST | `/me/leave/quote` | `signed-in` | Counts days and shows the effect |
| POST | `/me/leave` | `signed-in` | Requests leave |
| POST | `/me/leave/[id]/cancel` | `signed-in` | Cancels my request |

Decisions on leave are made through the approvals inbox ([M00](m00-shared-kernel.md)).

Idempotent: `POST /me/leave`, `POST /leave-requests`, `PUT /staff-attendance`.

## 8 · Client layer

Custom hooks: `useStaffDayBoard` (refreshes every minute during the morning), `useStaffMonthSheet`, `useMarkStaffAttendance`, `useLeaveQuote` (debounced as dates change), `useRequestLeave`, `useMyLeave`, `useLeaveCalendar`, `useLeaveBalances`, `useAdjustLeaveBalance`, `useMyAttendance`.

## 9 · Screens

Built in [Phase 10](../20-phases/phase-10-hr.md); the self-service screens also appear in [Phase 13](../20-phases/phase-13-teacher-portal.md).

| Screen | Pattern | Where |
|---|---|---|
| Staff attendance today | Grid | `/school/staff/attendance`: photo, name, in, out, status; "no punch yet" at the top; mark by hand |
| Month sheet | Grid | Staff down, days across; colour and a letter per cell; totals at the right |
| Corrections | List | Approve or reject with the punches shown |
| Leave requests | List | Pending first; the approval trail in a side sheet |
| Leave calendar | Calendar | Who is away, by team; clashes highlighted |
| Balances | Grid | Staff down, leave types across; adjust in a sheet |
| Leave setup | Settings | Types and policies |
| Work schedules | Settings | A week grid per schedule |
| **Staff:** My attendance | Calendar | The month with times; ask for a correction |
| **Staff:** My leave | Dashboard | Balance tiles; request form with the live quote (days, balance after, lessons affected); history |

## 10 · Notifications and jobs

Events: `staff-attendance.absent` (to the person and manager), `staff-attendance.late-pattern` (third late in a period), `staff-attendance.missing-checkout`, `staff-attendance.correction-requested`, `leave.requested` (to the approver), `leave.approved`, `leave.rejected`, `leave.cancelled`, `leave.certificate-missing`, `leave.balance-low`, `leave.returning-tomorrow` (to the coordinator).

Jobs: `staff-attendance.build-days` (every 5 minutes on working days: turns punches into rows), `staff-attendance.mark-absent` (per branch at the cut-off time), `staff-attendance.write-ahead` (daily 00:10: holidays, weekly offs and approved leave for the day), `leave.monthly-accrual` (1st of each month), `leave.year-end` (first day of the leave year), `leave.certificate-reminders` (daily).

Documents: staff attendance register (month), leave application form, leave balance statement.

## 11 · Offline

A staff member can see their own balances and requests offline. Requests need a connection.

## 12 · AI

Staff attendance patterns are one input to unusual-activity checks (S5): repeated manual overrides by the same person, punches at odd hours. Nothing else.

## 13 · Failure cases

- **F-sattend-1** The biometric machine is offline all morning → nobody is marked absent while the device shows offline; HR sees "device offline" and can mark by hand; when it reconnects its stored punches rebuild the day.
- **F-sattend-2** A teacher forgets to punch in but taught all day → they ask for a correction; the manager approves; the row is marked as overridden.
- **F-sattend-3** A person requests 5 days of casual leave with 3 available → the quote shows 3 paid and 2 unpaid and asks for confirmation.
- **F-sattend-4** Two requests for the same dates are submitted from two devices → the second is refused as overlapping.
- **F-sattend-5** A holiday is declared after leave covering it was approved → a job recounts the leave, returns the day to the balance and tells the person.
- **F-sattend-6** Leave is approved, then the person comes to work → the day is `present`, the day is returned to the balance, and the substitution for that day is cancelled.
- **F-sattend-7** The approver is on leave → the approval policy's fallback (their manager) receives it after 24 hours.
- **F-sattend-8** HR changes attendance in a month already paid → refused without `staff-attendance:unlock`; with it, the difference becomes a payroll adjustment next month.
- **F-sattend-9** The device clock is an hour wrong → punches are kept and flagged ([R-integ-13](m05-integrations-api.md)); HR can shift them by a set number of minutes with one action, audited.
- **F-sattend-10** A joiner starts on the 20th → yearly leave is credited pro rata; attendance before the joining date is blank, not absent.

## 14 · Seed data

Work schedules for teaching and non-teaching staff, with a summer variant. Nine leave types and three policies. Balances for all staff for the current year. Three months of attendance built from seeded punches: mostly present, with lates, half days, absences and missing check-outs; one device-offline morning. About 60 leave requests in every status, several with unpaid days, two awaiting certificates, one spanning the year boundary. Six correction requests.

## 15 · Tests

- **T-sattend-1** `leave-days.ts`: working days, holidays inside, half days, schedules with different off days, year boundary split.
- **T-sattend-2** Status from punches for each schedule rule; duplicate punches ignored; missing check-out.
- **T-sattend-3** Write-ahead of holiday, weekly off and leave; replaced by a punch.
- **T-sattend-4** Absent at cut-off; not while the device is offline.
- **T-sattend-5** A person cannot change their own attendance; corrections flow.
- **T-sattend-6** Lates to half days for payroll.
- **T-sattend-7** Lock after payroll approval.
- **T-sattend-8** Entitlement: yearly pro rata, monthly accrual, eligibility by gender and service.
- **T-sattend-9** Request: overlap, notice, excess to unpaid, certificate rule.
- **T-sattend-10** Balance movements in one transaction for request, approve, reject, cancel, early return; the ledger always sums to the balance.
- **T-sattend-11** Approval writes attendance and creates substitution needs.
- **T-sattend-12** Year end: carry forward and lapse.
- **T-sattend-13** A staff member reads only their own attendance, balances and requests.
- **T-sattend-14** `PayrollAttendance` figures for seeded staff equal a hand count.
- **T-sattend-15** Row-level security and branch scope.

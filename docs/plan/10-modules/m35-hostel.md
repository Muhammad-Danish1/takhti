# M35 · Hostel

## 1 · Purpose

For schools with boarders: hostels, rooms and beds, who sleeps where, the night roll-call, leave to go home, who may visit or collect a child, and the hostel and mess charges. A school without a hostel switches this module off.

## 2 · Depends on

[M07](m07-students.md), [M26](m26-staff-recruitment.md) (`staff`), [M21](m21-fees.md) (hostel and mess charges), [M09](m09-front-office.md) (visitors). Works with [M34](m34-health-clinic.md) and [M20](m20-behaviour-houses.md).

## 3 · Tables

#### `hostels` · branch

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per branch; "Boys' hostel — Iqbal House" |
| kind | enum(boys, girls) | required |
| warden_staff_id | uuid → staff | optional |
| assistant_warden_staff_id | uuid → staff | optional |
| phone | text | optional |
| curfew_time | time | default 20:00 |
| is_active | bool | default true |

#### `hostel_rooms` · branch

| Column | Type | Rules |
|---|---|---|
| hostel_id | uuid → hostels | required |
| room_no | text | required |
| floor | text | optional |
| kind | enum(dormitory, shared, single) | default shared |
| beds_count | int | required; ≥ 1; beds are created to match |
| monthly_fee | paisa | required; ≥ 0; per bed |
| grade_ids | uuid[] | default empty; the grades it is meant for |
| status | enum(in_use, closed) | default in_use |

Unique: (hostel_id, room_no).

#### `hostel_beds` · branch

| Column | Type | Rules |
|---|---|---|
| room_id | uuid → hostel_rooms | required |
| bed_no | text | required |
| status | enum(free, occupied, out_of_service) | default free; maintained with allocations |

Unique: (room_id, bed_no).

#### `mess_plans` · branch

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per branch; "Full board", "Lunch only" |
| monthly_fee | paisa | required; ≥ 0 |
| meals | text[] | required; `breakfast`, `lunch`, `dinner`, `snack` |
| is_active | bool | default true |

#### `mess_menus` · branch

| Column | Type | Rules |
|---|---|---|
| hostel_id | uuid → hostels | optional; empty means every hostel of the branch |
| week_start | date | required; a Monday |
| days | jsonb | required; `{ weekday, breakfast, lunch, dinner, snack? }[]` |
| status | enum(draft, published) | default draft |

Policy: staff of the branch; families of boarders may read published menus.
Unique: (branch_id, hostel_id, week_start).

#### `hostel_allocations` · branch +family

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| hostel_id | uuid → hostels | required |
| bed_id | uuid → hostel_beds | required |
| mess_plan_id | uuid → mess_plans | optional |
| from_date | date | required |
| to_date | date | optional; ≥ `from_date` |
| room_fee | paisa | required; copied from the room |
| mess_fee | paisa | default 0; copied from the plan |
| room_fee_item_id | uuid → student_fee_items | optional |
| mess_fee_item_id | uuid → student_fee_items | optional |
| local_guardian_name | text | optional |
| local_guardian_phone | text | optional |
| status | enum(active, ended) | default active |
| end_reason | text | optional |

Unique: one active allocation per student. An exclusion constraint refuses two allocations of one bed whose dates overlap.
Index: (org_id, hostel_id, status).

#### `hostel_authorised_people` · branch +family
Who may visit a boarder or take them out.

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| guardian_id | uuid → guardians | optional; a registered guardian |
| name | text | required |
| relation | text | required |
| cnic | text | optional; required when not a registered guardian |
| phone | text | optional |
| photo_file_id | uuid → files | optional |
| may_visit | bool | default true |
| may_take_out | bool | default false |
| added_by | uuid → profiles | required |
| is_active | bool | default true |

Policy: a guardian with custody ([M07](m07-students.md)) may add and remove people for their own child; changes by a guardian are active only after the warden confirms them.

#### `hostel_attendance` · branch +family

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| hostel_id | uuid → hostels | required |
| att_date | date | required |
| roll_call | enum(morning, evening, night) | required |
| status | enum(present, absent, on_leave, in_clinic, late) | required |
| marked_by | uuid → profiles | required |
| marked_at | timestamptz | required |
| note | text | optional |

Unique: (student_id, att_date, roll_call).
Index: (org_id, hostel_id, att_date, roll_call).

#### `hostel_leave` · branch +family

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| kind | enum(weekend, home, medical, outing, vacation) | required |
| leaves_at | timestamptz | required |
| returns_at | timestamptz | required; after `leaves_at` |
| destination | text | optional |
| going_with_id | uuid → hostel_authorised_people | optional; required when the student does not travel alone |
| reason | text | optional |
| requested_by | uuid → profiles | required |
| guardian_confirmed_at | timestamptz | optional |
| status | enum(requested, approved, rejected, out, returned, overdue, cancelled) | default requested |
| decided_by | uuid → profiles | optional |
| went_out_at | timestamptz | optional |
| came_back_at | timestamptz | optional |
| checked_out_by | uuid → profiles | optional |
| checked_in_by | uuid → profiles | optional |

Policy: a guardian may insert for their own child, read their own, and cancel one that is not yet `out`.

#### `hostel_visits` · branch +family

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| person_id | uuid → hostel_authorised_people | optional |
| visitor_name | text | required |
| relation | text | required |
| cnic | text | optional |
| arrived_at | timestamptz | required |
| left_at | timestamptz | optional |
| allowed_by | uuid → profiles | required |
| note | text | optional |

## 4 · Contracts

`packages/contracts/src/modules/hostel/`: `hostels`, `hostel-rooms`, `mess-plans`, `hostel-allocations`, `hostel-authorised-people`, `hostel-attendance`, `hostel-leave`, `hostel-visits`.

- `HostelMap`: floors, rooms and beds with who is in each and what is free.
- `RollCall`: for a hostel, date and roll-call — boarders by room with status prefilled for those on approved leave or in the clinic.
- `BoarderCard`: the student with room, bed, mess plan, authorised people with photos, leave history, medical alert.
- `ChildHostel` (family): room, warden contact, this week's menu, attendance, leave, visits.
- `Occupancy`: beds in use against capacity by hostel and month.

Settings: `hostel.roll_calls` (default `[morning, night]`), `hostel.leave_needs_guardian_confirmation` (default true), `hostel.overdue_grace_minutes` (default 60), `hostel.proration` (follows `fees.proration`), `hostel.visit_hours` (text shown to families).

## 5 · Rules

- **R-hostel-1** A student is allocated only to a hostel of their gender, to a free bed, and has one active allocation.
- **R-hostel-2** A bed holds one boarder at a time; the database refuses overlapping allocations. Moving room ends one allocation and starts another on the same date.
- **R-hostel-3** Allocating creates `student_fee_items` (source `hostel`) for the room fee and, when a mess plan is chosen, the mess fee, from that month; ending the allocation closes them at the end of the month. A change of room or mess plan changes the charge from the next month unless the accountant prorates.
- **R-hostel-4** An allocation ends automatically when the student leaves the school; the hostel item in withdrawal clearance ([R-students-10](m07-students.md)) is clear only when the allocation has ended and no hostel property is outstanding.
- **R-hostel-5** Roll-call is taken at the times in `hostel.roll_calls`. Boarders on approved leave or in the clinic are prefilled. A boarder marked `absent` at night roll-call with no leave alerts the warden and the principal at once, and the guardian after the warden confirms the child is not in the building.
- **R-hostel-6** A roll-call not taken 30 minutes after its time alerts the warden.
- **R-hostel-7** Hostel leave is requested by a guardian or by the warden on their behalf, approved by the warden, and, with `hostel.leave_needs_guardian_confirmation`, a request made by staff waits for the guardian to confirm in the app or by a recorded phone call.
- **R-hostel-8** A boarder leaves only with someone on their authorised list who has `may_take_out`, unless the approved leave says they travel alone. The person's identity is checked against the list at check-out, and the check-out records who checked.
- **R-hostel-9** Leave states: `requested → approved → out → returned`. A boarder not back `hostel.overdue_grace_minutes` after `returns_at` becomes `overdue`; the warden and the guardian are told.
- **R-hostel-10** While a boarder is `out`, school attendance for those days follows the school's own leave rules; hostel leave does not excuse a school day by itself.
- **R-hostel-11** A visitor is admitted only if on the authorised list with `may_visit`, or with the warden's recorded decision. Every visit is logged with arrival and departure.
- **R-hostel-12** A guardian's change to the authorised list takes effect when the warden confirms it. Removing a person takes effect at once.
- **R-hostel-13** A boarder sent to hospital or kept in the clinic overnight is shown `in_clinic` at roll-call from the clinic visit ([M34](m34-health-clinic.md)).
- **R-hostel-14** Day scholars cannot be marked in hostel attendance or given hostel leave.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `hostel:read` | See hostels, boarders, attendance, leave and visits | hostel_warden, LEADERS, nurse, security_guard |
| `hostel-setup:manage` | Maintain hostels, rooms, beds and mess plans | hostel_warden, branch_admin |
| `hostel-allocations:manage` | Allocate, move and end boarders | hostel_warden, branch_admin |
| `hostel-attendance:mark` | Take roll-call | hostel_warden |
| `hostel-leave:decide` | Approve and reject hostel leave | hostel_warden, principal |
| `hostel-gate:record` | Check boarders out and in; log visits | hostel_warden, security_guard |
| `hostel-people:confirm` | Confirm changes to authorised people | hostel_warden |
| `hostel:export` | Export hostel reports | hostel_warden, LEADERS |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/hostels` | `hostel:read` | Lists with occupancy |
| POST | `/hostels` | `hostel-setup:manage` | Creates |
| PATCH | `/hostels/[id]` | `hostel-setup:manage` | Edits |
| GET | `/hostels/[id]/map` | `hostel:read` | The hostel map |
| PUT | `/hostels/[id]/rooms` | `hostel-setup:manage` | Saves rooms and beds |
| PATCH | `/hostel-beds/[id]` | `hostel-setup:manage` | Takes a bed out of or back into service |
| GET | `/mess-plans` | `hostel:read` | Lists |
| POST | `/mess-plans` | `hostel-setup:manage` | Creates |
| PATCH | `/mess-plans/[id]` | `hostel-setup:manage` | Edits |
| GET | `/mess-menus` | `signed-in` | The menu for a week |
| PUT | `/mess-menus` | `hostel-setup:manage` | Saves and publishes |
| GET | `/hostel-allocations` | `hostel:read` | Lists boarders |
| POST | `/hostel-allocations` | `hostel-allocations:manage` | Allocates a bed |
| POST | `/hostel-allocations/[id]/move` | `hostel-allocations:manage` | Moves to another bed |
| POST | `/hostel-allocations/[id]/end` | `hostel-allocations:manage` | Ends |
| GET | `/boarders/[studentId]` | `hostel:read` | The boarder card |
| GET | `/boarders/[studentId]/people` | `hostel:read` | Authorised people |
| PUT | `/boarders/[studentId]/people` | `hostel-allocations:manage` | Saves authorised people |
| POST | `/hostel-authorised-people/[id]/confirm` | `hostel-people:confirm` | Confirms a guardian's change |
| GET | `/hostel-attendance` | `hostel:read` | The roll-call for a hostel, date and roll-call |
| PUT | `/hostel-attendance` | `hostel-attendance:mark` | Saves a roll-call |
| GET | `/hostel-leave` | `hostel:read` | Lists; filter by status |
| POST | `/hostel-leave` | `hostel-leave:decide` | Creates on a guardian's behalf |
| POST | `/hostel-leave/[id]/decide` | `hostel-leave:decide` | Approves or rejects |
| POST | `/hostel-leave/[id]/check-out` | `hostel-gate:record` | Records the boarder going out |
| POST | `/hostel-leave/[id]/check-in` | `hostel-gate:record` | Records the return |
| GET | `/hostel-visits` | `hostel:read` | Lists |
| POST | `/hostel-visits` | `hostel-gate:record` | Logs a visitor in |
| POST | `/hostel-visits/[id]/leave` | `hostel-gate:record` | Logs them out |
| GET | `/hostel/occupancy` | `hostel:read` | Occupancy |
| GET | `/hostel/export` | `hostel:export` | Exports |
| GET | `/family/children/[id]/hostel` | `signed-in` | A child's hostel view |
| POST | `/family/children/[id]/hostel-leave` | `signed-in` | Requests leave |
| POST | `/family/hostel-leave/[id]/confirm` | `signed-in` | Confirms a leave the school proposed |
| POST | `/family/hostel-leave/[id]/cancel` | `signed-in` | Cancels |
| PUT | `/family/children/[id]/hostel-people` | `signed-in` | Proposes changes to authorised people |

Idempotent: `POST /hostel-allocations`, `PUT /hostel-attendance`, `POST /hostel-leave/[id]/check-out`, `POST /hostel-leave/[id]/check-in`.

## 8 · Client layer

Custom hooks: `useHostelMap`, `useAllocateBed`, `useBoarderCard`, `useRollCall(hostelId, date, rollCall)`, `useSaveRollCall` (optimistic), `useHostelLeave`, `useDecideHostelLeave`, `useGateCheck`, `useHostelVisits`, `useOccupancy`, `useChildHostel`, `useRequestHostelLeave`.

## 9 · Screens

Built in [Phase 11](../20-phases/phase-11-front-office-and-operations.md) and [Phase 14](../20-phases/phase-14-family-portals.md).

| Screen | Pattern | Where |
|---|---|---|
| Hostels | Dashboard | `/school/hostel`: occupancy, tonight's roll-call status, boarders out, overdue returns |
| Hostel map | Grid | Floors and rooms; a bed is a cell with a name or "free"; allocate by picking a free bed |
| Boarders | List + Detail | The boarder card with authorised people and photos |
| Roll-call | Checklist | By room; large rows; one tap each; on leave and in clinic prefilled |
| Leave | List | Requested, out, overdue; approve; check out with identity check; check in |
| Visits | List + Form in a sheet | Pick from the authorised list or record the warden's decision |
| Mess | Grid editor | Weekly menu; plans |
| Setup | Settings | Hostels, rooms, beds |
| **Parent:** Hostel | Detail | Room and warden contact; attendance; menu; request leave; manage authorised people |

## 10 · Notifications and jobs

Events: `hostel.allocated`, `hostel.absent-at-night` (urgent, to the warden and principal; then the guardian), `hostel.roll-call-missed` (to the warden), `hostel.leave-requested`, `hostel.leave-decided`, `hostel.leave-confirmation-needed` (to the guardian), `hostel.checked-out`, `hostel.checked-in`, `hostel.overdue-return` (urgent), `hostel.visitor` (optional, to the guardian), `hostel.people-change` (to the warden), `mess.menu-published`.

Jobs: `hostel.roll-call-watch` (every 10 minutes around roll-call times), `hostel.overdue-check` (every 15 minutes), `hostel.end-allocations` (daily: students who left).

Documents: hostel admission form, room list, roll-call sheet, leave pass, boarder ID tag.

## 11 · Offline

Roll-call can be taken offline on the warden's phone, through the `hostel.rollcall` stream: latest write wins per boarder per roll-call. Check-out and check-in need a connection, because they depend on the current leave status.

## 12 · AI

None.

## 13 · Failure cases

- **F-hostel-1** Two wardens allocate the same bed at once → the second is refused by the database; the bed shows as taken.
- **F-hostel-2** A boarder is absent at night roll-call but is actually in the clinic → the nurse's open visit prefills `in_clinic`; no alert.
- **F-hostel-3** A man not on the list arrives to collect a boarder → check-out is refused; the warden may call the guardian and, if the guardian adds him in the app and the warden confirms, proceed.
- **F-hostel-4** A boarder returns two hours late → the leave was `overdue`, alerts went out; check-in sets `returned` and records the lateness.
- **F-hostel-5** A leave is approved, then the guardian cancels on the day → allowed until check-out; the warden is told.
- **F-hostel-6** A room is closed for repairs with boarders in it → refused until they are moved; the map offers free beds.
- **F-hostel-7** A boarder becomes a day scholar mid-term → the allocation ends; charges stop from next month; history stays.
- **F-hostel-8** The warden's phone has no signal at night roll-call → the roll-call is saved on the phone; the "missed" alert is held back for 30 minutes and cancelled when it uploads.

## 14 · Seed data

One branch (Main Campus) has hostels: a boys' and a girls' hostel, 24 rooms, about 90 beds, 70 boarders with mess plans and fee items. Authorised people for each boarder, two changes waiting for confirmation. Three weeks of roll-calls with a few absences. Leave in every state including one overdue. Visits. Menus for this and next week.

## 15 · Tests

- **T-hostel-1** Gender rule; one active allocation; overlapping bed allocations refused under concurrency.
- **T-hostel-2** Allocation creates fee items; move and end change them.
- **T-hostel-3** Allocation ends when the student leaves; clearance state.
- **T-hostel-4** Roll-call prefill from leave and clinic; night absence alert order.
- **T-hostel-5** Leave flow with guardian confirmation; overdue job.
- **T-hostel-6** Check-out only with a person allowed to take out; identity recorded.
- **T-hostel-7** Visits only for authorised people or with the warden's decision.
- **T-hostel-8** A guardian's list change waits for confirmation; removal is immediate.
- **T-hostel-9** A guardian acts only for their own child; only a guardian with custody edits the list.
- **T-hostel-10** Day scholars cannot be in hostel attendance.
- **T-hostel-11** Row-level security and branch scope.

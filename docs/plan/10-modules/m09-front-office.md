# M09 · Front office

## 1 · Purpose

The reception desk and the gate: who came in, which child left early and with whom, calls and post, and appointments with staff. Its most important job is safety: a child leaves only with a person the family has authorised.

## 2 · Depends on

[M02](m02-organisation-branches.md), [M07](m07-students.md), [M26](m26-staff-recruitment.md). Enquiries go to [M06](m06-admissions.md); complaints go to [M40](m40-complaints-surveys.md).

## 3 · Tables

#### `visitors` · branch

| Column | Type | Rules |
|---|---|---|
| full_name | text | required |
| phone | text | optional |
| cnic | text | optional; sensitive |
| purpose | enum(meeting, parent_visit, admission_enquiry, delivery, maintenance, official, interview, other) | required |
| purpose_detail | text | optional |
| host_staff_id | uuid → staff | optional; whom they came to see |
| student_id | uuid → students | optional; a parent visiting about a child |
| vehicle_no | text | optional |
| badge_no | text | optional |
| photo_file_id | uuid → files | optional |
| checked_in_at | timestamptz | required |
| checked_out_at | timestamptz | optional |
| is_flagged | bool | default false; left without checking out, or a concern |
| notes | text | optional |

Index: (org_id, branch_id, checked_in_at); trigram on `full_name`.

#### `gate_passes` · branch +family
Permission for a student to leave during school hours.

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| pass_date | date | required |
| kind | enum(early_leave, medical, appointment, temporary_exit) | required |
| reason | text | required |
| requested_via | enum(staff, portal) | default staff |
| pickup_guardian_id | uuid → guardians | optional; an authorised guardian |
| pickup_name | text | required; who will collect |
| pickup_relation | text | required |
| pickup_cnic | text | optional; required when the person is not a registered guardian |
| leave_time | time | required |
| return_expected_time | time | optional; temporary exit |
| verification_code_hash | text | required; a 4-digit code the guardian shows at the gate |
| status | enum(requested, approved, rejected, exited, returned, cancelled, expired) | default requested |
| decided_by | uuid → profiles | optional |
| exited_at | timestamptz | optional |
| exit_recorded_by | uuid → profiles | optional |
| returned_at | timestamptz | optional |

Policy: a guardian may insert for their own child and read their own passes.
Index: (org_id, branch_id, pass_date, status).

#### `call_logs` · branch

| Column | Type | Rules |
|---|---|---|
| direction | enum(incoming, outgoing) | required |
| caller_name | text | required |
| phone | text | optional |
| regarding | text | required |
| student_id | uuid → students | optional |
| called_at | timestamptz | required |
| duration_minutes | int | optional |
| follow_up_on | date | optional |
| is_follow_up_done | bool | default false |
| note | text | optional |

#### `postal_logs` · branch

| Column | Type | Rules |
|---|---|---|
| direction | enum(received, dispatched) | required |
| logged_on | date | required |
| party | text | required; from or to |
| subject | text | required |
| reference_no | text | optional |
| courier | text | optional |
| tracking_no | text | optional |
| addressed_to_staff_id | uuid → staff | optional |
| handed_to | text | optional |
| handed_at | timestamptz | optional |
| file_id | uuid → files | optional; a scan |

#### `appointments` · branch +family

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required; whom the meeting is with |
| guardian_id | uuid → guardians | optional |
| student_id | uuid → students | optional |
| visitor_name | text | required |
| phone | text | optional |
| purpose | text | required |
| starts_at | timestamptz | required |
| ends_at | timestamptz | required; after `starts_at` |
| room_id | uuid → rooms | optional |
| requested_via | enum(staff, portal) | default staff |
| status | enum(requested, confirmed, completed, cancelled, no_show) | default requested |
| note | text | optional |

Policy: a guardian may request and read appointments about their own child.

## 4 · Contracts

`packages/contracts/src/modules/front-office/`: `visitors`, `gate-passes`, `call-logs`, `postal-logs`, `appointments`.

- `CheckInVisitor`, `CheckOutVisitor`.
- `RequestGatePass` (portal): `{ studentId, passDate, kind, reason, leaveTime, pickup: { guardianId } | { name, relation, cnic } }`.
- `RecordExit`: `{ code }` — the 4-digit code.

Settings: `front_office.gate_pass_needs_approval` (default true), `front_office.pickup_code_required` (default true), `front_office.auto_checkout_time` (default 18:00).

## 5 · Rules

- **R-front-1** A visitor is "inside" until checked out. At `front_office.auto_checkout_time` anyone still inside is checked out automatically and flagged for review the next morning.
- **R-front-2** Gate pass states: `requested → approved → exited → returned`; `requested → rejected`; `approved → cancelled`; `approved → expired` at the end of the pass date.
- **R-front-3** The pickup person must be a guardian of the student with `can_pickup`, or a named person with a CNIC. A named person who is not a registered guardian always needs approval by a leader, whatever the setting.
- **R-front-4** A pass requested by a guardian for a registered pickup guardian is approved automatically when `gate_pass_needs_approval` is false; otherwise the class teacher or a leader approves.
- **R-front-5** On approval a 4-digit code is sent to the requesting guardian. The gate records the exit only with the correct code (when `pickup_code_required`), 5 attempts at most.
- **R-front-6** Recording the exit writes an attendance note for the student ("left early at 11:40, collected by mother") through [M14](m14-student-attendance.md), and tells the class teacher and the primary guardian.
- **R-front-7** A student already marked absent for the day cannot have a gate pass exit recorded; the guard sees "not in school today".
- **R-front-8** A temporary exit not marked returned within 30 minutes of `return_expected_time` alerts the front office.
- **R-front-9** Only one active pass per student per date.
- **R-front-10** An appointment cannot overlap another confirmed appointment of the same staff member, nor a period they are teaching in the timetable.
- **R-front-11** A call log with `follow_up_on` appears in the follow-ups list until marked done.
- **R-front-12** A visitor with purpose `admission_enquiry` can be turned into an enquiry in [M06](m06-admissions.md) with one action; the visitor row keeps a link.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `visitors:read` | See the visitor log | ADMINS, FRONT, security_guard |
| `visitors:create` | Check visitors in and out | FRONT, security_guard, ADMINS |
| `visitors:export` | Export the visitor log | ADMINS |
| `gate-passes:read` | See gate passes | ADMINS, FRONT, security_guard, TEACHERS, section_head |
| `gate-passes:create` | Issue a pass for a student | ADMINS, FRONT, class_teacher, section_head, nurse |
| `gate-passes:approve` | Approve or reject a pass | LEADERS, section_head, class_teacher |
| `gate-passes:exit` | Record exit and return at the gate | security_guard, FRONT, ADMINS |
| `call-logs:read` | See call logs | ADMINS, FRONT |
| `call-logs:create` | Add and edit call logs | FRONT, ADMINS |
| `postal-logs:read` | See postal logs | ADMINS, FRONT |
| `postal-logs:create` | Add and edit postal logs | FRONT, ADMINS |
| `appointments:read` | See appointments | ADMINS, FRONT, TEACHERS, ACADEMIC |
| `appointments:update` | Book, confirm and cancel appointments | ADMINS, FRONT |

Any member of staff may confirm or decline an appointment that is with them.

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/visitors` | `visitors:read` | Lists; filter by date, inside now, purpose |
| POST | `/visitors` | `visitors:create` | Checks a visitor in |
| GET | `/visitors/export` | `visitors:export` | Exports |
| GET | `/visitors/[id]` | `visitors:read` | One visitor |
| PATCH | `/visitors/[id]` | `visitors:create` | Edits |
| POST | `/visitors/[id]/check-out` | `visitors:create` | Checks out |
| POST | `/visitors/[id]/to-enquiry` | `admission-enquiries:create` | Creates an admission enquiry from the visit |
| GET | `/gate-passes` | `gate-passes:read` | Lists; filter by date and status |
| POST | `/gate-passes` | `gate-passes:create` | Issues a pass |
| GET | `/gate-passes/[id]` | `gate-passes:read` | One pass |
| POST | `/gate-passes/[id]/approve` | `gate-passes:approve` | Approves and sends the code |
| POST | `/gate-passes/[id]/reject` | `gate-passes:approve` | Rejects with a reason |
| POST | `/gate-passes/[id]/cancel` | `gate-passes:create` | Cancels |
| POST | `/gate-passes/[id]/exit` | `gate-passes:exit` | Records the exit with the code |
| POST | `/gate-passes/[id]/return` | `gate-passes:exit` | Records the return |
| GET | `/call-logs` | `call-logs:read` | Lists |
| POST | `/call-logs` | `call-logs:create` | Adds |
| PATCH | `/call-logs/[id]` | `call-logs:create` | Edits or marks the follow-up done |
| DELETE | `/call-logs/[id]` | `call-logs:create` | Deletes |
| GET | `/postal-logs` | `postal-logs:read` | Lists |
| POST | `/postal-logs` | `postal-logs:create` | Adds |
| PATCH | `/postal-logs/[id]` | `postal-logs:create` | Edits or records handing over |
| DELETE | `/postal-logs/[id]` | `postal-logs:create` | Deletes |
| GET | `/appointments` | `appointments:read` | Lists; a teacher sees their own |
| POST | `/appointments` | `appointments:update` | Books |
| PATCH | `/appointments/[id]` | `appointments:update` | Reschedules |
| POST | `/appointments/[id]/status` | `signed-in` | Confirm, complete, cancel or no-show; the host or front office |
| GET | `/family/gate-passes` | `signed-in` | A guardian's children's passes |
| POST | `/family/gate-passes` | `signed-in` | A guardian requests a pass |
| POST | `/family/gate-passes/[id]/cancel` | `signed-in` | Cancels their own request |
| GET | `/family/appointments` | `signed-in` | Their appointments |
| POST | `/family/appointments` | `signed-in` | Requests an appointment with a teacher |

Idempotent: `POST /gate-passes/[id]/exit`.

## 8 · Client layer

Generated CRUD for visitors, call logs, postal logs and appointments. Custom hooks: `useVisitorsInside`, `useCheckOut`, `useGatePassesToday`, `useApproveGatePass`, `useRecordExit`, `useRecordReturn`, `useRequestGatePass`, `useRequestAppointment`.

## 9 · Screens

Under `/school/front-office`. Built in [Phase 11](../20-phases/phase-11-front-office-and-operations.md).

| Screen | Pattern | Notes |
|---|---|---|
| Front desk | Dashboard | Inside now, passes awaiting approval, today's appointments, follow-ups due |
| Visitors | List | "Inside now" tab; one-tap check out; quick check-in dialog |
| Gate passes | List | Tabs: Requested, Approved today, Exited, All |
| New gate pass | Dialog form | Student picker shows authorised guardians with photos |
| **Gate view** | List, phone-first | `/school/gate`: today's approved passes; tap, enter code, confirm exit. Large targets. Offline-capable |
| Calls | List + Dialog form | Follow-ups tab |
| Post | List + Dialog form | Received and dispatched tabs |
| Appointments | Calendar + List | Per staff member |
| **Teacher:** Passes and meetings | List | `/teach/more`: approve passes for their class; their appointments |
| **Parent:** Early pickup | Form page + List | `/family/pickup`: request, see the code |
| **Parent:** Meet a teacher | Form page | `/family/appointments` |

## 10 · Notifications and jobs

Events: `gate-pass.requested` (to the class teacher and section head), `gate-pass.approved` (the code, to the guardian), `gate-pass.rejected`, `gate-pass.exited` (to the class teacher and primary guardian), `gate-pass.not-returned`, `visitor.arrived` (to the host), `appointment.requested`, `appointment.confirmed`, `appointment.cancelled`.

Jobs: `front-office.auto-checkout` (daily at the configured time), `front-office.expire-passes` (daily), `front-office.return-watch` (every 10 minutes during school hours).

## 11 · Offline

Offline-writable through the `frontdesk.today` stream:

| Table | Operation | Conflict policy |
|---|---|---|
| `visitors` | create, check out | Always added; latest check-out wins |
| `gate_passes` | exit, return | Refused if the pass is no longer `approved`; code checked against the hash held on the device |

## 12 · AI

None.

## 13 · Failure cases

- **F-front-1** The guardian did not receive the code → staff can resend it or, with `gate-passes:approve`, record the exit after checking the person's CNIC against the pass; the override is audited.
- **F-front-2** A wrong code is entered five times → the pass locks for 10 minutes and the front office is alerted.
- **F-front-3** Two guards record the same exit → the second sees "already exited at 11:40".
- **F-front-4** A different person arrives than the one named → the guard cannot proceed; the front office edits the pass (new approval needed if the person is not a registered guardian).
- **F-front-5** A pass is approved but the child was marked absent → the exit is refused with the reason.
- **F-front-6** The gate device is offline → exits are recorded locally and synced; the attendance note and messages follow on sync.
- **F-front-7** A visitor never checks out → auto-checkout flags them; the list of flagged visitors is on the next morning's dashboard.
- **F-front-8** A parent requests a pass for tomorrow at 11 pm → accepted; approval messages wait for the end of quiet hours.

## 14 · Seed data

A week of visitors (about 15 a day, 3 inside now), 12 gate passes across all statuses including 2 awaiting approval today, 40 call logs with 5 follow-ups due, 25 postal entries, 10 appointments this week.

## 15 · Tests

- **T-front-1** Visitor check-in and check-out; auto-checkout flags.
- **T-front-2** Every gate pass transition.
- **T-front-3** Pickup rules: registered guardian, guardian without pickup permission, unregistered person needs leader approval.
- **T-front-4** Code: correct, wrong, locked after five, resend.
- **T-front-5** Exit writes the attendance note and queues both messages; absent student refused.
- **T-front-6** One active pass per student per date.
- **T-front-7** Appointment overlap with another appointment and with a taught period.
- **T-front-8** A guardian can request only for their own child and sees only their own passes.
- **T-front-9** Offline exit: applied once; refused when the pass was cancelled meanwhile.
- **T-front-10** Row-level security and branch scope.

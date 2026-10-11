# M36 · Maintenance and helpdesk

## 1 · Purpose

Keeping the building working. Any staff member reports a problem — a broken fan, a leaking tap, a dead projector — from their phone; it goes to the right person, is tracked against a time limit, and is closed when the reporter agrees it is fixed. The module also books shared spaces and schedules routine checks.

## 2 · Depends on

[M02](m02-organisation-branches.md) (rooms), [M26](m26-staff-recruitment.md) (`staff`), [M32](m32-inventory-assets.md) (assets), [M24](m24-expenses-procurement.md) (vendors, expenses), [M12](m12-timetable.md) (room clashes), [M00](m00-shared-kernel.md) (files, sequences, approvals).

## 3 · Tables

#### `ticket_categories` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation; "Electrical", "Plumbing", "IT and projector" |
| name_ur | text | optional |
| kind | enum(electrical, plumbing, furniture, civil, it, cleaning, security, grounds, transport, other) | required |
| default_assignee_role | text | optional; a role key, such as `it_admin` |
| response_hours | int | default 4; time to first action |
| resolve_hours | int | default 48; time to fix |
| is_active | bool | default true |

#### `ticket_assignment_rules` · branch
Who gets a category's tickets at this branch.

| Column | Type | Rules |
|---|---|---|
| category_id | uuid → ticket_categories | required |
| assignee_staff_id | uuid → staff | required |

Unique: (branch_id, category_id).

#### `maintenance_tickets` · branch

| Column | Type | Rules |
|---|---|---|
| ticket_no | text | required; from the `ticket` sequence |
| category_id | uuid → ticket_categories | required |
| title | text | required |
| description | text | optional |
| room_id | uuid → rooms | optional |
| place | text | optional; when there is no room record: "back gate" |
| asset_id | uuid → assets | optional |
| priority | enum(low, normal, high, urgent) | default normal |
| is_safety_hazard | bool | default false |
| status | enum(open, assigned, in_progress, waiting, resolved, closed, reopened, cancelled) | default open |
| waiting_reason | enum(parts, vendor, approval, access, other) | optional; required for `waiting` |
| reported_by | uuid → profiles | required |
| assigned_to_staff_id | uuid → staff | optional |
| vendor_id | uuid → vendors | optional; when an outside contractor does the work |
| respond_by | timestamptz | required; from the category |
| resolve_by | timestamptz | required |
| first_response_at | timestamptz | optional |
| resolved_at | timestamptz | optional |
| closed_at | timestamptz | optional |
| resolution | text | optional; required to resolve |
| cost | paisa | default 0 |
| expense_id | uuid → expenses | optional |
| reporter_rating | int | optional; 1 to 5 |
| merged_into_id | uuid → maintenance_tickets | optional |
| schedule_id | uuid → preventive_schedules | optional; when it was created by a routine schedule |

Policy: staff of the branch. A reporter always sees their own tickets.
Index: (org_id, branch_id, status, priority); (org_id, assigned_to_staff_id, status); (org_id, reported_by).

#### `ticket_comments` · branch append-only

| Column | Type | Rules |
|---|---|---|
| ticket_id | uuid → maintenance_tickets | required |
| body | text | optional |
| author_id | uuid → profiles | required |
| is_internal | bool | default false; hidden from the reporter |
| status_from | text | optional |
| status_to | text | optional |

#### `preventive_schedules` · branch
Routine work that repeats: generator service, water tank cleaning, fire extinguisher check.

| Column | Type | Rules |
|---|---|---|
| title | text | required |
| category_id | uuid → ticket_categories | required |
| asset_id | uuid → assets | optional |
| room_id | uuid → rooms | optional |
| frequency | enum(weekly, monthly, quarterly, half_yearly, yearly) | required |
| next_due_on | date | required |
| lead_days | int | default 3; how early the ticket is created |
| assignee_staff_id | uuid → staff | optional |
| checklist | jsonb | default `[]`; `{ label }[]` |
| is_active | bool | default true |

#### `facility_bookings` · branch

| Column | Type | Rules |
|---|---|---|
| room_id | uuid → rooms | required; a room marked bookable |
| title | text | required |
| purpose | text | optional |
| booked_by_staff_id | uuid → staff | required |
| starts_at | timestamptz | required |
| ends_at | timestamptz | required; after `starts_at`; the same day |
| attendees | int | optional |
| needs | text | optional; projector, sound system, chairs |
| status | enum(requested, approved, rejected, cancelled) | default requested |
| decided_by | uuid → profiles | optional |
| decision_note | text | optional |

An exclusion constraint refuses two approved bookings of one room whose times overlap.
Index: (org_id, room_id, starts_at).

## 4 · Contracts

`packages/contracts/src/modules/maintenance/`: `ticket-categories`, `maintenance-tickets`, `preventive-schedules`, `facility-bookings`.

- `ReportProblem`: `{ categoryId, title, description?, roomId?, place?, assetId?, priority?, isSafetyHazard?, photoFileIds? }` — designed to be filled in under 30 seconds on a phone.
- `TicketView`: the ticket with its timeline, photos, time left or overdue, and the actions the caller may take.
- `MyWork`: tickets assigned to me, ordered by `resolve_by`.
- `HelpdeskSummary`: open by category and age, overdue, average time to resolve, repeat problems by room and asset, cost by category.
- `RoomDay`: for a bookable room and date — timetable lessons and bookings on one timeline.

Settings: `helpdesk.auto_close_days` (default 3), `helpdesk.bookable_room_kinds` (default hall, lab, library, ground, meeting room), `helpdesk.booking_needs_approval` (default true), `helpdesk.working_hours_only` (default true: time limits count school hours only).

## 5 · Rules

- **R-helpdesk-1** Any staff member can report a problem for their own branch. A ticket gets its time limits from its category; `urgent` halves them.
- **R-helpdesk-2** A new ticket is assigned by the branch's rule for the category, or else to holders of the category's default role at that branch, or else it stays `open` for the branch admin.
- **R-helpdesk-3** A ticket marked as a safety hazard is `urgent`, alerts the branch admin and principal at once, and cannot be cancelled by the reporter.
- **R-helpdesk-4** States: `open → assigned → in_progress → resolved → closed`; `in_progress ↔ waiting`; `resolved → reopened → in_progress`; `open|assigned → cancelled`. While `waiting` with a reason, the clock is paused.
- **R-helpdesk-5** Resolving needs a resolution note. The reporter is asked to confirm; they may reopen within `helpdesk.auto_close_days`, after which the ticket closes by itself.
- **R-helpdesk-6** When half the time to resolve has gone, the assignee is reminded; when it is all gone, the ticket is escalated to the branch admin and shown as overdue.
- **R-helpdesk-7** A new report for the same room and category as an open ticket shows that ticket first and offers "This is the same problem", which adds the reporter as a follower instead of creating another.
- **R-helpdesk-8** Two tickets can be merged; the merged one closes and points to the other.
- **R-helpdesk-9** A cost is recorded on the ticket and can be turned into an expense in [M24](m24-expenses-procurement.md); a ticket never posts to the ledger itself.
- **R-helpdesk-10** A ticket about an asset writes an `asset_maintenance` row when resolved, and can set the asset `under_repair` while open.
- **R-helpdesk-11** A routine schedule creates its ticket `lead_days` before `next_due_on`, with its checklist; when that ticket is resolved, `next_due_on` moves forward by the frequency.
- **R-helpdesk-12** A booking is refused when it overlaps an approved booking of the room. It is flagged, not refused, when it overlaps a timetable lesson in that room; the approver decides.
- **R-helpdesk-13** With `helpdesk.booking_needs_approval`, a booking is approved by the branch admin; otherwise the first to book gets it.
- **R-helpdesk-14** Internal comments are never shown to the reporter.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `tickets:create` | Report a problem; follow, comment on, confirm and reopen one's own | ALL_STAFF |
| `tickets:read` | See all tickets of the branch | LEADERS, it_admin, store_keeper |
| `tickets:work` | Work on tickets assigned to oneself: update, comment, resolve | ALL_STAFF |
| `tickets:manage` | Assign, reprioritise, merge, cancel and close any ticket | branch_admin, it_admin |
| `helpdesk-setup:manage` | Maintain categories, assignment rules and routine schedules | branch_admin |
| `facility-bookings:create` | Request a booking | ALL_STAFF |
| `facility-bookings:decide` | Approve or reject bookings | branch_admin, vice_principal |
| `helpdesk:export` | Export helpdesk reports | branch_admin, LEADERS |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/ticket-categories` | `tickets:create` | Lists |
| POST | `/ticket-categories` | `helpdesk-setup:manage` | Creates |
| PATCH | `/ticket-categories/[id]` | `helpdesk-setup:manage` | Edits |
| PUT | `/ticket-assignment-rules` | `helpdesk-setup:manage` | Saves who gets which category |
| GET | `/maintenance-tickets` | `tickets:read` | Lists; filter by status, category, room, assignee, overdue |
| GET | `/maintenance-tickets/mine` | `tickets:create` | Tickets I reported or follow |
| GET | `/maintenance-tickets/assigned` | `tickets:work` | Tickets assigned to me |
| POST | `/maintenance-tickets/check` | `tickets:create` | Looks for an open ticket for the same room and category |
| POST | `/maintenance-tickets` | `tickets:create` | Reports a problem |
| GET | `/maintenance-tickets/[id]` | `tickets:create` | One ticket, if the caller may see it |
| PATCH | `/maintenance-tickets/[id]` | `tickets:work` | Updates status, waiting reason, cost |
| POST | `/maintenance-tickets/[id]/assign` | `tickets:manage` | Assigns to staff or a vendor |
| POST | `/maintenance-tickets/[id]/comments` | `tickets:create` | Adds a comment |
| POST | `/maintenance-tickets/[id]/follow` | `tickets:create` | Follows an existing ticket |
| POST | `/maintenance-tickets/[id]/resolve` | `tickets:work` | Resolves with a note |
| POST | `/maintenance-tickets/[id]/confirm` | `tickets:create` | The reporter confirms and rates |
| POST | `/maintenance-tickets/[id]/reopen` | `tickets:create` | The reporter reopens |
| POST | `/maintenance-tickets/[id]/merge` | `tickets:manage` | Merges into another |
| POST | `/maintenance-tickets/[id]/cancel` | `tickets:create` | Cancels one's own open ticket |
| GET | `/helpdesk/summary` | `tickets:read` | The summary |
| GET | `/preventive-schedules` | `tickets:read` | Lists |
| POST | `/preventive-schedules` | `helpdesk-setup:manage` | Creates |
| PATCH | `/preventive-schedules/[id]` | `helpdesk-setup:manage` | Edits |
| GET | `/facility-bookings` | `facility-bookings:create` | Lists; filter by room and dates |
| GET | `/facility-bookings/room-day` | `facility-bookings:create` | A room's day with lessons and bookings |
| POST | `/facility-bookings` | `facility-bookings:create` | Requests |
| POST | `/facility-bookings/[id]/decide` | `facility-bookings:decide` | Approves or rejects |
| POST | `/facility-bookings/[id]/cancel` | `facility-bookings:create` | Cancels one's own |
| GET | `/helpdesk/export` | `helpdesk:export` | Exports |

Idempotent: `POST /maintenance-tickets`, `POST /facility-bookings`.

## 8 · Client layer

Custom hooks: `useReportProblem`, `useTicketCheck` (runs as room and category are chosen), `useMyTickets`, `useAssignedTickets`, `useTicket`, `useUpdateTicket` (optimistic status), `useAddTicketComment`, `useHelpdeskSummary`, `useRoomDay`, `useRequestBooking`, `usePreventiveSchedules`.

## 9 · Screens

Built in [Phase 11](../20-phases/phase-11-front-office-and-operations.md); "Report a problem" is also in the teacher portal ([Phase 13](../20-phases/phase-13-teacher-portal.md)).

| Screen | Pattern | Where |
|---|---|---|
| **Report a problem** | Form in a sheet | Available from every staff shell: category tiles, room, a line of text, a photo from the camera; an existing open ticket is offered first |
| Helpdesk | Board | `/school/helpdesk`: columns by status; cards with category, room, age and time left; drag to change status |
| Ticket | Detail | Timeline of comments and status changes; photos; assign; cost; resolve |
| My work | List | For the person fixing things: ordered by time left; large buttons for Start, Waiting, Resolved |
| My reports | List | Status of what I reported; confirm or reopen |
| Summary | Report | Overdue, time to resolve, repeat problems, cost |
| Routine schedules | List + Form in a sheet | Next due dates |
| Bookings | Calendar | Bookable rooms as columns; lessons shown in grey; request by dragging a time range |
| Setup | Settings | Categories, time limits, assignment rules |

## 10 · Notifications and jobs

Events: `ticket.assigned`, `ticket.safety-hazard` (urgent), `ticket.commented`, `ticket.waiting`, `ticket.resolved` (to the reporter and followers, asking for confirmation), `ticket.reopened`, `ticket.due-soon`, `ticket.overdue` (to the branch admin), `booking.requested`, `booking.decided`, `booking.reminder` (an hour before), `schedule.ticket-created`.

Jobs: `helpdesk.deadlines` (every 15 minutes: reminders and escalation), `helpdesk.auto-close` (daily), `helpdesk.routine` (daily 06:00: creates due routine tickets), `helpdesk.booking-reminders` (every 15 minutes).

Documents: job card for a vendor, monthly maintenance report.

## 11 · Offline

A problem can be reported offline from the teacher's app; it is saved on the phone with its photo and sent later. Policy: always added; a duplicate (same reporter, room, category within 10 minutes) is merged.

## 12 · AI

- Suggesting the category and priority from the reporter's text and photo, shown as the preselected choice.
- Spotting repeat problems: the same room or asset three times in 60 days (a count, not a model).

## 13 · Failure cases

- **F-helpdesk-1** Three teachers report the same broken fan → the second and third are shown the first ticket and become followers.
- **F-helpdesk-2** Nobody is set to receive IT tickets at a branch → the ticket stays `open` and the branch admin is told it needs an owner.
- **F-helpdesk-3** The assignee is on leave → tickets assigned to them are listed for the branch admin each morning until reassigned.
- **F-helpdesk-4** A ticket is resolved but the fan still does not work → the reporter reopens; the clock restarts and the ticket is marked as reopened in reports.
- **F-helpdesk-5** A photo fails to upload → the ticket is created; "1 photo not uploaded, retry" stays on it.
- **F-helpdesk-6** Two people book the hall for the same time → the first approved wins; the second is refused or told it clashes.
- **F-helpdesk-7** A booking is approved, then the timetable puts a lesson in that room → the booking is flagged for the approver and the booker.
- **F-helpdesk-8** A waiting ticket has waited 14 days for parts → it is listed for the branch admin regardless of the paused clock.
- **F-helpdesk-9** A routine ticket is never resolved → the next occurrence is not created on top of it; the schedule shows "previous still open".

## 14 · Seed data

Twelve categories with time limits. Assignment rules per branch. About 80 tickets per large branch over two months in every status, including overdue, reopened, merged, safety hazards and tickets with costs and photos. Ten routine schedules (generator, water tanks, fire extinguishers, air conditioners, pest control) with history. Bookings for the hall, labs and ground for the next two weeks, one clash waiting for a decision.

## 15 · Tests

- **T-helpdesk-1** Time limits from category and priority; working-hours counting; pause while waiting.
- **T-helpdesk-2** Assignment: rule, default role, none.
- **T-helpdesk-3** Safety hazard: urgent, alerts, cannot be cancelled by the reporter.
- **T-helpdesk-4** Status transitions allowed and refused.
- **T-helpdesk-5** Resolve needs a note; confirm, reopen, auto-close.
- **T-helpdesk-6** Duplicate check and follow; merge.
- **T-helpdesk-7** Internal comments hidden from the reporter.
- **T-helpdesk-8** Asset link writes maintenance history.
- **T-helpdesk-9** Routine schedule creates and advances.
- **T-helpdesk-10** Booking overlap refused by the database under concurrency; lesson clash flagged.
- **T-helpdesk-11** A reporter sees their own tickets; other staff need `tickets:read`.
- **T-helpdesk-12** Row-level security and branch scope.

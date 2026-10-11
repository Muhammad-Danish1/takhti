# M20 · Behaviour and houses

## 1 · Purpose

Recording good and poor conduct in a few taps, acting on patterns before they grow, and running the house system. It also holds the counsellor's confidential notes.

## 2 · Depends on

[M07](m07-students.md), [M11](m11-academic-structure.md), [M26](m26-staff-recruitment.md) (`staff`), [M00](m00-shared-kernel.md) (approvals). Feeds [M18](m18-results-report-cards.md) (remarks) and the risk score in [M44](m44-ai-suite.md).

## 3 · Tables

#### `houses` · branch

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per branch; "Jinnah", "Iqbal" |
| name_ur | text | optional |
| colour | text | required; a hex colour |
| motto | text | optional |
| house_master_staff_id | uuid → staff | optional |
| is_active | bool | default true |

Policy: staff of the branch; families may read.

#### `behaviour_categories` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation; "Helped a classmate", "Late to class", "Fighting" |
| name_ur | text | optional |
| kind | enum(positive, negative) | required |
| severity | enum(low, medium, high) | default low; for negative categories |
| default_points | int | required; positive for positive, negative for negative |
| notify_guardian | enum(never, digest, immediately) | default digest |
| needs_review | bool | default false; high-severity records go to the section head first |
| is_active | bool | default true |

Policy: every member of the organisation may read, because a record a family reads names its category; staff write, by permission.

#### `behaviour_records` · branch +family

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| category_id | uuid → behaviour_categories | required |
| kind | enum(positive, negative) | required; copied from the category |
| points | int | required |
| occurred_on | date | required; not in the future |
| section_id | uuid → sections | required; the student's section that day |
| reported_by_staff_id | uuid → staff | required |
| description | text | optional; what the guardian reads |
| place | text | optional |
| visibility | enum(family, staff) | default family |
| status | enum(recorded, under_review, confirmed, void) | default recorded |
| void_reason | text | optional |
| concern_id | uuid → behaviour_concerns | optional |

Policy: a guardian or student may read their own `confirmed` or `recorded` rows with `visibility = family`.
Index: (org_id, student_id, occurred_on); (org_id, branch_id, occurred_on, kind).

#### `behaviour_record_notes` · branch
Staff-only notes on a record; never shown to families.

| Column | Type | Rules |
|---|---|---|
| behaviour_record_id | uuid → behaviour_records | required |
| body | text | required |
| author_id | uuid → profiles | required |

#### `behaviour_concerns` · branch
A case that needs follow-up: repeated or serious conduct.

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| title | text | required |
| level | enum(class, section, principal) | default class |
| owner_staff_id | uuid → staff | required |
| opened_on | date | required |
| status | enum(open, monitoring, closed) | default open |
| guardian_informed | bool | default false |
| closed_on | date | optional |
| outcome | text | optional; required to close |

Policy: staff of the branch with `behaviour-concerns:read`; never families.

#### `concern_actions` · branch +family

| Column | Type | Rules |
|---|---|---|
| concern_id | uuid → behaviour_concerns | required |
| student_id | uuid → students | required |
| action | enum(verbal_warning, written_warning, detention, parent_meeting, counselling_referral, community_service, suspension, other) | required |
| action_date | date | required |
| to_date | date | optional; required for `suspension`; ≥ `action_date` |
| assigned_to_staff_id | uuid → staff | optional |
| note | text | optional |
| status | enum(planned, done, cancelled) | default planned |
| approval_request_id | uuid → approval_requests | optional; suspension |
| share_with_family | bool | default true |

Policy: a guardian may read actions shared with the family.

#### `house_points` · branch append-only

| Column | Type | Rules |
|---|---|---|
| house_id | uuid → houses | required |
| student_id | uuid → students | optional; empty for points given to a whole house |
| points | int | required; may be negative |
| reason | text | required |
| source | enum(behaviour, event, manual) | required |
| behaviour_record_id | uuid → behaviour_records | optional |
| academic_year_id | uuid → academic_years | required |
| awarded_on | date | required |
| awarded_by | uuid → profiles | required |

Policy: staff of the branch; families may read totals through the route.
Index: (org_id, house_id, academic_year_id).

#### `counselling_notes` · branch +cap(counselling)
Confidential.

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| counsellor_staff_id | uuid → staff | required |
| session_date | date | required |
| kind | enum(academic, behavioural, emotional, family, career, other) | required |
| summary | text | required; encrypted at rest |
| follow_up_on | date | optional |
| risk_flag | enum(none, watch, urgent) | default none |
| referred_by_staff_id | uuid → staff | optional |

Policy: readable only by the counsellor who wrote it and holders of `counselling:read-all`. Not included in exports, search, the AI assistant or any report other than counts.

## 4 · Contracts

`packages/contracts/src/modules/behaviour/`: `houses`, `behaviour-categories`, `behaviour-records`, `behaviour-concerns`, `house-points`, `counselling-notes`.

- `QuickRecord`: `{ studentIds[], categoryId, description?, occurredOn? }` — one category for several students at once.
- `StudentBehaviour`: totals by kind for the year, a timeline, open concerns (for staff), house and house points.
- `HouseTable`: houses with points this term and year, top contributors.
- `BehaviourPattern`: students crossing a threshold in a period.

Settings: `behaviour.negative_threshold_count` (default 3), `behaviour.negative_threshold_days` (default 14), `behaviour.points_to_house` (default true), `behaviour.digest_time` (default 15:30), `behaviour.suspension_marks_attendance_as` (default `leave`), `behaviour.teachers_see_all_records` (default false).

## 5 · Rules

- **R-behaviour-1** A teacher can record for a student they teach or whose class they lead; duty staff and leaders for any student of the branch.
- **R-behaviour-2** Points default from the category and can be adjusted within ±50% by the recorder; beyond that needs `behaviour:manage`.
- **R-behaviour-3** A record in a `needs_review` category is `under_review` and hidden from the family until the section head confirms it.
- **R-behaviour-4** The guardian is told according to the category: never, in the afternoon digest, or at once. Positive records always go in the digest.
- **R-behaviour-5** A record is never deleted. It can be voided with a reason within 7 days by the recorder, or any time by `behaviour:manage`; voiding reverses its house points and tells the guardian if they had been told.
- **R-behaviour-6** With `behaviour.points_to_house`, a confirmed record for a student with a house adds a `house_points` row for the same points.
- **R-behaviour-7** When a student reaches `behaviour.negative_threshold_count` negative records within `behaviour.negative_threshold_days`, the class teacher and section head get a suggestion to open a concern. One suggestion per student per window.
- **R-behaviour-8** A concern has one owner. Its level decides who can see it: class teacher and above, section head and above, or principal only.
- **R-behaviour-9** A suspension needs approval by the principal, cannot be backdated, and cannot exceed `behaviour.max_suspension_days` (default 5) without the director. While it runs, attendance is marked automatically with the configured status and the note "Suspended".
- **R-behaviour-10** A guardian sees the action, its date and the shared note; never staff notes or who reported.
- **R-behaviour-11** Each student belongs to at most one house per branch, set on the student record. Assigning houses in bulk balances numbers and gender across houses and keeps siblings together when asked.
- **R-behaviour-12** House points are append-only; a correction is a new row with the opposite sign.
- **R-behaviour-13** A counselling note is visible to its author and `counselling:read-all` only. A note flagged `urgent` notifies the principal that a note exists, without its content.
- **R-behaviour-14** Teachers see only records they made, plus those of their own class as class teacher, unless `behaviour.teachers_see_all_records` is on.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `behaviour:read` | See behaviour records in scope | ALL_STAFF |
| `behaviour:create` | Record behaviour; void one's own within 7 days | TEACHERS, LEADERS, section_head, coordinator, counsellor |
| `behaviour:manage` | Confirm, void and edit any record; maintain categories | ADMINS, section_head |
| `behaviour-concerns:read` | See concerns at one's level | LEADERS, section_head, class_teacher, counsellor |
| `behaviour-concerns:manage` | Open, act on and close concerns | LEADERS, section_head, class_teacher |
| `houses:manage` | Maintain houses; assign students; give house points | ADMINS, section_head |
| `house-points:create` | Give house points | TEACHERS, section_head |
| `counselling:create` | Write and read one's own counselling notes | counsellor |
| `counselling:read-all` | Read every counselling note | principal |
| `behaviour:export` | Export behaviour reports | ADMINS, section_head |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/behaviour-categories` | `behaviour:read` | Lists |
| POST | `/behaviour-categories` | `behaviour:manage` | Creates |
| PATCH | `/behaviour-categories/[id]` | `behaviour:manage` | Edits |
| GET | `/behaviour-records` | `behaviour:read` | Lists; filter by student, section, kind, category, dates, status |
| POST | `/behaviour-records` | `behaviour:create` | Records for one or more students |
| GET | `/behaviour-records/[id]` | `behaviour:read` | One record with staff notes |
| PATCH | `/behaviour-records/[id]` | `behaviour:create` | Edits the description within 24 hours |
| POST | `/behaviour-records/[id]/confirm` | `behaviour:manage` | Confirms a record under review |
| POST | `/behaviour-records/[id]/void` | `behaviour:create` | Voids with a reason |
| POST | `/behaviour-records/[id]/notes` | `behaviour:create` | Adds a staff note |
| GET | `/students/[id]/behaviour` | `behaviour:read` | A student's summary and timeline |
| GET | `/behaviour/patterns` | `behaviour:read` | Students over the threshold |
| GET | `/behaviour/summary` | `behaviour:read` | Counts by category, section and week |
| GET | `/behaviour/export` | `behaviour:export` | Exports |
| GET | `/behaviour-concerns` | `behaviour-concerns:read` | Lists |
| POST | `/behaviour-concerns` | `behaviour-concerns:manage` | Opens, optionally from records |
| GET | `/behaviour-concerns/[id]` | `behaviour-concerns:read` | One concern with records and actions |
| PATCH | `/behaviour-concerns/[id]` | `behaviour-concerns:manage` | Edits, escalates |
| POST | `/behaviour-concerns/[id]/actions` | `behaviour-concerns:manage` | Adds an action |
| PATCH | `/concern-actions/[id]` | `behaviour-concerns:manage` | Marks done or cancels |
| POST | `/behaviour-concerns/[id]/close` | `behaviour-concerns:manage` | Closes with an outcome |
| GET | `/houses` | `signed-in` | Lists houses with totals |
| POST | `/houses` | `houses:manage` | Creates |
| PATCH | `/houses/[id]` | `houses:manage` | Edits |
| POST | `/houses/assign` | `houses:manage` | Assigns students in bulk, balanced |
| GET | `/houses/table` | `signed-in` | The house table |
| POST | `/house-points` | `house-points:create` | Gives or removes points |
| GET | `/counselling-notes` | `counselling:create` | Lists the notes I may see |
| POST | `/counselling-notes` | `counselling:create` | Writes a note |
| PATCH | `/counselling-notes/[id]` | `counselling:create` | Edits one's own note |
| GET | `/family/children/[id]/behaviour` | `signed-in` | A child's visible records and shared actions |

## 8 · Client layer

Custom hooks: `useBehaviourRecords`, `useQuickRecord` (optimistic), `useStudentBehaviour`, `useBehaviourPatterns`, `useConcern`, `useAddConcernAction`, `useHouseTable`, `useAssignHouses`, `useGiveHousePoints`, `useCounsellingNotes`, `useChildBehaviour`.

## 9 · Screens

Built in [Phase 8](../20-phases/phase-08-academics.md), [Phase 13](../20-phases/phase-13-teacher-portal.md) and [Phase 14](../20-phases/phase-14-family-portals.md).

| Screen | Pattern | Where |
|---|---|---|
| Behaviour | List | `/school/students/behaviour`: filters; totals above the table |
| Patterns | Report | Students over the threshold; "Open concern" |
| Concerns | List + Detail | A timeline of records and actions; level and owner |
| Categories | Settings | Positive and negative lists with points and notification rule |
| Houses | Dashboard | The house table as coloured bars; members; top contributors |
| Counselling | List + Form page | `/school/students/counselling`; visible only to those allowed |
| **Teacher:** Quick record | Form in a sheet | From the class list: tick students, tap a category tile, optional note, Save |
| **Teacher:** My class | List | Records for the class this week |
| **Parent:** Behaviour | List | Positive first; a calm tone; actions shared with the family |

## 10 · Notifications and jobs

Events: `behaviour.digest` (to guardians, with that day's visible records), `behaviour.serious` (immediate, to the guardian), `behaviour.voided`, `behaviour.review-requested` (to the section head), `behaviour.threshold` (suggestion to the class teacher), `concern.opened` (to its owner), `concern.action-due`, `suspension.approved` (to the guardian), `counselling.urgent` (to the principal, no content), `house.points` (optional weekly table).

Jobs: `behaviour.send-digests` (per branch at the digest time), `behaviour.check-thresholds` (daily 16:00), `behaviour.action-reminders` (daily 08:00), `behaviour.apply-suspensions` (daily 06:00, writes attendance).

## 11 · Offline

`behaviour_records` can be created offline from the teacher's app through `teacher.sections`. Policy: always added; a duplicate (same student, category, day and reporter) is merged.

## 12 · AI

- Behaviour records are one input to the students-at-risk score (S1) and to report-card remarks (A6), as counts and category names only.
- Counselling notes are never sent to a model.

## 13 · Failure cases

- **F-behaviour-1** A teacher records "Fighting" for the wrong student → void with a reason; the guardian who was told gets a correction; house points reverse.
- **F-behaviour-2** A suspension is planned across a holiday → attendance is written only for working days.
- **F-behaviour-3** A student is transferred while a concern is open → the concern stays with the old branch and is closed with outcome "transferred"; the new branch sees a count only.
- **F-behaviour-4** A category is deactivated → past records keep its name; it disappears from the quick-record tiles.
- **F-behaviour-5** A teacher tries to open a principal-level concern → `NOT_FOUND`.
- **F-behaviour-6** The same record is posted twice from a slow phone → idempotency returns the first.
- **F-behaviour-7** A student has no house → the record is saved; no house points row is written.
- **F-behaviour-8** A counsellor leaves the school → their notes pass to `counselling:read-all` holders only; the new counsellor is given access note by note.

## 14 · Seed data

Four houses per branch with every student assigned. Twenty categories (twelve positive, eight negative across severities). About six weeks of records, mostly positive, with eight students over the threshold. Six concerns at different levels and states with actions, one approved suspension. House points from records and from three events. Ten counselling notes, one flagged `watch`.

## 15 · Tests

- **T-behaviour-1** Who can record for whom.
- **T-behaviour-2** Points adjustment limits.
- **T-behaviour-3** Review-needed records are hidden from families until confirmed.
- **T-behaviour-4** Notification rule per category; one digest per family per day.
- **T-behaviour-5** Voiding reverses house points and sends a correction.
- **T-behaviour-6** Threshold suggestion once per window.
- **T-behaviour-7** Concern visibility by level.
- **T-behaviour-8** Suspension needs approval and writes attendance for working days only.
- **T-behaviour-9** Families never receive staff notes, the reporter's name, or concerns.
- **T-behaviour-10** Counselling notes: only the author and read-all; absent from search, exports and AI context.
- **T-behaviour-11** House assignment balances numbers.
- **T-behaviour-12** Row-level security and branch scope.

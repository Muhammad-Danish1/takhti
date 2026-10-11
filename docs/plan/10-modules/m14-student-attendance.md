# M14 · Student attendance

## 1 · Purpose

Who was in school today. Teachers mark a class in a few taps, parents hear the same morning if their child is absent, and the school sees patterns before they become problems. This is the module used most often and the first to work offline.

## 2 · Depends on

[M04](m04-school-setup.md) (working days), [M07](m07-students.md), [M11](m11-academic-structure.md), [M12](m12-timetable.md) (substitutes, period mode). Fed by [M05](m05-integrations-api.md) (biometric) and [M09](m09-front-office.md) (gate passes).

## 3 · Tables

#### `attendance_sessions` · branch
One marking of one section: for a day, or for one lesson in period mode.

| Column | Type | Rules |
|---|---|---|
| section_id | uuid → sections | required |
| session_date | date | required; not in the future |
| lesson_no | int | required; `0` for a daily session, the lesson number in period mode |
| section_subject_id | uuid → section_subjects | optional; period mode |
| taken_by | uuid → profiles | required |
| status | enum(draft, submitted, locked, cancelled) | default draft |
| source | enum(manual, biometric, qr, import) | default manual |
| submitted_at | timestamptz | optional |
| locked_at | timestamptz | optional |
| note | text | optional |

Unique: (section_id, session_date, lesson_no) among live rows.
Index: (org_id, branch_id, session_date).

#### `attendance_records` · branch +family

| Column | Type | Rules |
|---|---|---|
| session_id | uuid → attendance_sessions | required |
| student_id | uuid → students | required |
| enrollment_id | uuid → enrollments | required |
| session_date | date | required; copied from the session for fast filtering |
| status | enum(present, absent, late, leave, half_day) | required |
| minutes_late | int | optional; ≥ 0 |
| note | text | optional |
| marked_at | timestamptz | required |
| marked_by | uuid → profiles | required |
| source | enum(manual, biometric, qr, import, leave_request, gate_pass) | default manual |
| is_manual_override | bool | default false; a person changed what a machine recorded |

Unique: (session_id, student_id).
Index: (org_id, student_id, session_date); (org_id, branch_id, session_date, status).

#### `student_leave_requests` · branch +family

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| from_date | date | required |
| to_date | date | required; ≥ `from_date`; at most 30 days later |
| reason | enum(sick, family, travel, religious, other) | required |
| detail | text | optional |
| file_id | uuid → files | optional; a medical note |
| requested_via | enum(portal, staff) | default portal |
| status | enum(pending, approved, rejected, cancelled) | default pending |
| decided_by | uuid → profiles | optional |
| decided_at | timestamptz | optional |
| decision_note | text | optional |

Policy: a guardian may insert for their own child and cancel their own pending request.

#### `attendance_corrections` · branch
A change asked for after the day is locked.

| Column | Type | Rules |
|---|---|---|
| record_id | uuid → attendance_records | required |
| from_status | text | required |
| to_status | enum(present, absent, late, leave, half_day) | required |
| reason | text | required |
| status | enum(pending, approved, rejected) | default pending |
| decided_by | uuid → profiles | optional |
| decision_note | text | optional |

## 4 · Contracts

`packages/contracts/src/modules/attendance/`: `attendance-sessions`, `attendance-records`, `student-leave-requests`, `attendance-corrections`, `attendance-reports`.

- `MarkAttendance`: `{ sectionId, date, lessonNo?, records: { studentId, status, minutesLate?, note? }[], submit: boolean, id? }` — the whole class in one call.
- `Register`: for a section and date — every enrolled student with today's status (or pre-filled from leave), photo, roll number and medical alert, plus the session's status.
- `StudentAttendanceSummary`: `{ workingDays, present, absent, late, leave, halfDay, percent, byMonth[] }`.
- `ListAbsentees`: `{ branchId, date, gradeId?, sectionId?, notified? }`.
- Pure function `attendancePercent(counts, settings)` exported from contracts.

Settings: `attendance.mode` (per grade: `daily` or `period`), `attendance.who_marks` (`class_teacher` or `any_teacher_of_section`), `attendance.late_after_minutes` (default 10), `attendance.lock_after_hours` (default 24), `attendance.backdate_days` (default 3), `attendance.notify_absent` (default on), `attendance.notify_at` (`on_submit` or a time), `attendance.half_day_weight` (default 0.5), `attendance.leave_counts_as_present` (default false), `attendance.minimum_percent` (default 75), `attendance.consecutive_absence_alert` (default 3).

## 5 · Rules

- **R-attendance-1** A session can exist only for a date that is a working day for the section's branch and inside the section's academic year, and never for a future date.
- **R-attendance-2** A session is marked by the section's class teacher, by a teacher of the section if the setting allows, by that day's substitute for the lesson, or by anyone holding `attendance:mark-any`.
- **R-attendance-3** Submitting requires a record for every student whose enrollment in that section is active on that date. Students who joined after or left before the date are excluded automatically.
- **R-attendance-4** A student with an approved leave covering the date is pre-filled as `leave`. A teacher who saw the child in class may still mark them present; the leave request is then flagged for the office.
- **R-attendance-5** `late` is chosen by the teacher, or set from a machine punch after first bell plus `late_after_minutes`.
- **R-attendance-6** Session states: `draft → submitted → locked`; `draft, submitted → cancelled` (holiday declared). A submitted session can be edited by its marker until it locks, `attendance.lock_after_hours` after the end of that school day.
- **R-attendance-7** After lock, a change is a correction request, approved by a user with `attendance:approve-correction` who is not the requester. Approval edits the record and audits both.
- **R-attendance-8** Marking for a past date within `attendance.backdate_days` is allowed to the normal marker; older dates need `attendance:mark-any`.
- **R-attendance-9** Machine and QR punches create or update records with their source. They never overwrite a record with `is_manual_override`, and never downgrade `present` to `absent`.
- **R-attendance-10** In period mode, each lesson has its own session. The day's status for a student is: `absent` if absent in every lesson held; `leave` if on leave all day; otherwise `present`, with late and partial detail kept per lesson.
- **R-attendance-11** `attendancePercent = (present + late + half_day × weight [+ leave if the setting says so]) ÷ sessions the student was expected at`. Cancelled sessions and holidays are not counted.
- **R-attendance-12** A guardian is told of an absence once per student per day, at the configured time or on submit. Correcting an absence to present after the message sends a short correction.
- **R-attendance-13** A student absent for `consecutive_absence_alert` working days in a row raises an alert to the class teacher and section head, once per run of absences.
- **R-attendance-14** Leave request states: `pending → approved, rejected`; `pending → cancelled` by the guardian. Approval pre-fills future sessions and updates already-marked `absent` records in its range to `leave`.
- **R-attendance-15** A gate pass exit adds a note to the day's record and never changes `present` to `absent` ([M09](m09-front-office.md)).
- **R-attendance-16** A section still unmarked 30 minutes after first bell appears on the coordinator's "not marked" list and the marker is reminded.
- **R-attendance-17** Attendance in a closed academic year cannot be changed.
- **R-attendance-18** A teacher sees and marks only sections in their scope. A guardian sees only their own children's records.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `attendance:read` | See attendance in scope | ALL_STAFF |
| `attendance:mark` | Mark sections in one's own scope | TEACHERS, section_head, coordinator |
| `attendance:mark-any` | Mark any section in the branch, any past date | ADMINS, section_head, coordinator |
| `attendance:approve-correction` | Approve a change after lock | ADMINS, section_head, coordinator |
| `attendance:export` | Export registers and reports | ADMINS, ACADEMIC |
| `student-leave:read` | See leave requests | ALL_STAFF |
| `student-leave:decide` | Approve or reject leave | ADMINS, section_head, coordinator, class_teacher |
| `student-leave:create` | Record leave for a student at the desk | ADMINS, FRONT, TEACHERS |
| `attendance-settings:update` | Change attendance settings | principal, academic_head |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/attendance/register` | `attendance:read` | The register for a section, date and lesson |
| POST | `/attendance/mark` | `attendance:mark` | Saves or submits a whole section |
| GET | `/attendance/sessions` | `attendance:read` | Lists sessions; filter by date, section, status |
| GET | `/attendance/sessions/[id]` | `attendance:read` | One session with its records |
| PATCH | `/attendance/records/[id]` | `attendance:mark` | Changes one record before lock |
| POST | `/attendance/sessions/[id]/cancel` | `attendance:mark-any` | Cancels a session |
| GET | `/attendance/unmarked` | `attendance:read` | Sections not yet marked today |
| GET | `/attendance/absentees` | `attendance:read` | Absent and late students for a date |
| GET | `/attendance/students/[id]` | `attendance:read` | One student's records and summary for a range |
| GET | `/attendance/sections/[id]/monthly` | `attendance:read` | The month grid: students by days |
| GET | `/attendance/summary` | `attendance:read` | Percentages by branch, grade and section for a range |
| GET | `/attendance/shortage` | `attendance:read` | Students below the minimum percentage |
| GET | `/attendance/export` | `attendance:export` | Exports a register or report |
| POST | `/attendance/import` | `attendance:mark-any` | Imports past attendance through the import pipeline |
| GET | `/attendance/corrections` | `attendance:read` | Lists correction requests |
| POST | `/attendance/corrections` | `attendance:mark` | Asks for a change after lock |
| POST | `/attendance/corrections/[id]/approve` | `attendance:approve-correction` | Approves |
| POST | `/attendance/corrections/[id]/reject` | `attendance:approve-correction` | Rejects |
| GET | `/student-leave-requests` | `student-leave:read` | Lists |
| POST | `/student-leave-requests` | `student-leave:create` | Records leave for a student |
| POST | `/student-leave-requests/[id]/approve` | `student-leave:decide` | Approves |
| POST | `/student-leave-requests/[id]/reject` | `student-leave:decide` | Rejects with a note |
| GET | `/family/children/[id]/attendance` | `signed-in` | A child's month and summary |
| GET | `/family/leave-requests` | `signed-in` | The guardian's requests |
| POST | `/family/leave-requests` | `signed-in` | Asks for leave |
| POST | `/family/leave-requests/[id]/cancel` | `signed-in` | Cancels a pending request |
| GET | `/learn/attendance` | `signed-in` | The student's own attendance |

Idempotent: `POST /attendance/mark`.

## 8 · Client layer

Custom hooks: `useRegister(sectionId, date, lessonNo?)`, `useMarkAttendance` (optimistic; one call for the whole class), `useUnmarkedSections`, `useAbsentees`, `useStudentAttendance`, `useSectionMonth`, `useAttendanceSummary`, `useShortageList`, `useCorrection*`, `useStudentLeave*`, `useChildAttendance`, `useRequestLeave`.

## 9 · Screens

Under `/school/academics/attendance` and in the teacher portal. Built in [Phase 8](../20-phases/phase-08-academics.md) and [Phase 13](../20-phases/phase-13-teacher-portal.md).

| Screen | Pattern | Notes |
|---|---|---|
| Attendance today | Dashboard | Present percentage, absent, late, sections not marked, absence messages sent; a tile per grade |
| Not marked | List | Section, class teacher, "Remind" and "Mark now" |
| Mark attendance | Grid editor | Students in roll order with photo; everyone starts present; tap to cycle absent, late, leave; "All present"; medical alerts visible; Save draft and Submit |
| Absentees | List | Today's absent and late with guardian phone and message status |
| Section month | Grid editor (read-only) | Students down, days across, a letter and colour per cell, totals at the end; print register |
| Student attendance | Detail tab | Calendar heat-map, summary, records |
| Shortage | List | Below the minimum, with percentage and days short |
| Leave requests | List | Pending first; approve or reject |
| Corrections | List | Before and after; approve or reject |
| Reports | Report | By grade, section, weekday and month; trend chart |
| **Teacher:** Mark | Grid editor, phone-first | `/teach/attendance`: one student per row, large toggles, swipe; works offline |
| **Parent:** Attendance | Calendar | `/family/attendance`: month view, summary, "Request leave" |

## 10 · Notifications and jobs

Events: `attendance.absent` (to guardians), `attendance.late` (optional), `attendance.corrected`, `attendance.unmarked` (to the marker), `attendance.consecutive-absence`, `student-leave.requested` (to the class teacher), `student-leave.decided` (to the guardian), `attendance.correction-requested`, `attendance.shortage` (monthly, to guardians of students below the minimum).

Jobs: `attendance.notify-absent`, `attendance.alert-unmarked`, `attendance.lock-sessions` (hourly), `attendance.consecutive-check` (daily), `attendance.monthly-shortage` (1st of each month).

## 11 · Offline

Offline-writable through `teacher.attendance`:

| Table | Operation | Conflict policy |
|---|---|---|
| `attendance_sessions` | create, submit | If a session already exists for that section, date and lesson, the device's records are merged into it |
| `attendance_records` | create, update | Latest write wins per student; refused when the session is locked or cancelled |

The device makes the session and record ids. On sync the server runs the same `mark` service with `source = sync`. Absence messages are sent after sync, and not at all if the day has already locked.

## 12 · AI

- Attendance trend is one input to the at-risk score (S1).
- The assistant answers "who was absent in 8-B this week?" through the read routes.

## 13 · Failure cases

- **F-attendance-1** Two teachers mark the same section at once → one session exists (unique index); the second submit merges per student and the audit shows both.
- **F-attendance-2** The teacher's phone loses signal after tapping Submit → the request is retried with the same idempotency key; in offline mode it is queued.
- **F-attendance-3** A student is added to the section while the register is open → submit is refused with "1 new student has joined this class"; the register reloads with them.
- **F-attendance-4** A holiday is declared after attendance was marked → sessions for that date are cancelled; absence messages already sent are followed by one "school is closed today" message.
- **F-attendance-5** A parent is told their child is absent, but the child was late → the teacher corrects to late; the guardian gets "Ali reached school at 8:25".
- **F-attendance-6** The machine reports a punch for a student marked absent by the teacher → the record becomes `late` or `present` unless the teacher's mark was a manual override made after the punch time.
- **F-attendance-7** A device syncs yesterday's attendance after the day locked → refused per record with "locked"; the teacher sees the list and can raise corrections in one action.
- **F-attendance-8** Leave is approved for dates already marked absent → those records become `leave`.
- **F-attendance-9** A message provider is down → absences are still saved; messages retry; the absentee list shows "not delivered".
- **F-attendance-10** Attendance is marked for the wrong section → the marker cancels the draft, or before lock edits; nothing is sent until submit.

## 14 · Seed data

Daily attendance for every section for every school day of the year so far (about 94% present, with realistic clusters of absence), today's sessions half submitted so the "not marked" list has rows, 30 leave requests in all states, 8 corrections, period-mode sessions for Grades 9 and 10 at Main Campus for the last two weeks.

## 15 · Tests

- **T-attendance-1** A session is refused on a holiday, a weekend, a future date and outside the year.
- **T-attendance-2** Who may mark: class teacher, teacher of section by setting, substitute for the lesson only, `mark-any`.
- **T-attendance-3** Submit needs every enrolled student; joiners and leavers by date.
- **T-attendance-4** Leave pre-fill and the "seen in class" flag.
- **T-attendance-5** Lock timing; edits before; correction flow after; cannot approve own.
- **T-attendance-6** Backdating limits.
- **T-attendance-7** Machine punches: create, upgrade, never overwrite a manual override.
- **T-attendance-8** Period mode daily status.
- **T-attendance-9** `attendancePercent` with each setting combination, including half days and leave.
- **T-attendance-10** One absence message per student per day; correction message.
- **T-attendance-11** Consecutive absence alert fires once per run.
- **T-attendance-12** Offline: merge into an existing session; duplicate upload; locked day refused.
- **T-attendance-13** Teacher scope and guardian scope.
- **T-attendance-14** Marking a section of 40 completes within the performance budget.
- **T-attendance-15** Row-level security and branch scope.

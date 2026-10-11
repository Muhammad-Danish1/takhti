# M17 · Exams and marks

## 1 · Purpose

Running an examination from the date sheet to locked marks: which grades sit which papers and when, who sits where, who invigilates, who may not sit, and marks entered, checked and locked. Turning locked marks into results is [M18](m18-results-report-cards.md).

## 2 · Depends on

[M04](m04-school-setup.md) (years, terms, grading schemes), [M07](m07-students.md), [M11](m11-academic-structure.md), [M13](m13-syllabus-lesson-plans.md) (topics), [M14](m14-student-attendance.md) (shortage), [M26](m26-staff-recruitment.md) (`staff`). Optional: [M19](m19-question-bank-papers.md) (the paper itself), [M21](m21-fees.md) (dues check).

## 3 · Tables

#### `exam_types` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation; "Monthly test", "First term", "Annual" |
| name_ur | text | optional |
| code | text | required; short; unique per organisation |
| kind | enum(class_test, monthly, term, final, pre_board, mock) | required |
| default_weight | numeric(5,2) | default 0; its share in an annual result |
| sort_order | int | default 0 |
| is_active | bool | default true |

#### `exams` · branch

| Column | Type | Rules |
|---|---|---|
| academic_year_id | uuid → academic_years | required |
| term_id | uuid → terms | optional |
| exam_type_id | uuid → exam_types | required |
| name | text | required; "First term 2026" |
| starts_on | date | required |
| ends_on | date | required; ≥ `starts_on` |
| marks_due_on | date | optional; default `ends_on` + `exams.marks_entry_days` |
| grading_scheme_id | uuid → grading_schemes | required |
| status | enum(draft, scheduled, in_progress, marks_entry, under_review, published, cancelled) | default draft |
| datesheet_published_at | timestamptz | optional |
| note | text | optional |

Policy: staff of the branch; a guardian or student may read an exam once its date sheet is published and their child's grade takes it.
Unique: (branch_id, academic_year_id, name) among live rows.

#### `exam_grades` · branch

| Column | Type | Rules |
|---|---|---|
| exam_id | uuid → exams | required |
| grade_id | uuid → grades | required |

Policy: every member of the organisation may read, so that a family can be shown only the exams their child's grade takes; staff of the branch write, by permission.
Unique: (exam_id, grade_id).

#### `exam_papers` · branch
One paper: a subject component for a grade, on a date.

| Column | Type | Rules |
|---|---|---|
| exam_id | uuid → exams | required |
| grade_id | uuid → grades | required |
| grade_subject_id | uuid → grade_subjects | required |
| component | enum(theory, practical, oral, project) | default theory |
| paper_date | date | optional until scheduled; inside the exam's dates |
| start_time | time | optional until scheduled |
| end_time | time | optional; after `start_time` |
| max_marks | numeric(6,2) | required; > 0 |
| pass_marks | numeric(6,2) | required; ≤ `max_marks` |
| question_paper_id | uuid → question_papers | optional |
| syllabus_note | text | optional; what is included, shown to families |
| status | enum(planned, scheduled, conducted, cancelled) | default planned |

Policy: staff of the branch; families read scheduled papers of a published date sheet.
Unique: (exam_id, grade_id, grade_subject_id, component) among live rows.
Index: (org_id, branch_id, paper_date).

#### `exam_paper_sections` · branch
The marking unit: one paper for one section, with one marker.

| Column | Type | Rules |
|---|---|---|
| exam_paper_id | uuid → exam_papers | required |
| section_id | uuid → sections | required |
| marker_staff_id | uuid → staff | optional; defaults to the section subject's teacher |
| status | enum(pending, in_progress, submitted, returned, verified, locked) | default pending |
| submitted_at | timestamptz | optional |
| submitted_by | uuid → profiles | optional |
| verified_at | timestamptz | optional |
| verified_by | uuid → profiles | optional |
| locked_at | timestamptz | optional |
| locked_by | uuid → profiles | optional |
| return_reason | text | optional |

Unique: (exam_paper_id, section_id).
Index: (org_id, marker_staff_id, status).

#### `mark_entries` · branch
Staff only. Families see marks only through published results.

| Column | Type | Rules |
|---|---|---|
| exam_paper_section_id | uuid → exam_paper_sections | required |
| exam_paper_id | uuid → exam_papers | required |
| student_id | uuid → students | required |
| enrollment_id | uuid → enrollments | required |
| status | enum(present, absent, exempt, medical, malpractice) | default present |
| marks | numeric(6,2) | optional; required when `present`; 0 to the paper's `max_marks` |
| remark | text | optional |
| entered_by | uuid → profiles | required |
| entered_at | timestamptz | required |

Unique: (exam_paper_id, student_id).
Index: (org_id, student_id).

#### `mark_question_scores` · branch
Optional marks per question, tagged with a topic. This is what makes "weak chapters" possible.

| Column | Type | Rules |
|---|---|---|
| mark_entry_id | uuid → mark_entries | required |
| question_no | text | required; "Q3", "Q5b" |
| unit_id | uuid → syllabus_units | optional |
| outcome_id | uuid → learning_outcomes | optional |
| max_marks | numeric(5,2) | required; > 0 |
| marks | numeric(5,2) | required; 0 to `max_marks` |

Unique: (mark_entry_id, question_no).

#### `mark_corrections` · branch
A change to a mark after its paper section was locked.

| Column | Type | Rules |
|---|---|---|
| mark_entry_id | uuid → mark_entries | required |
| old_status | text | required |
| old_marks | numeric(6,2) | optional |
| new_status | text | required |
| new_marks | numeric(6,2) | optional |
| reason | text | required; at least 10 characters |
| approval_request_id | uuid → approval_requests | optional |
| status | enum(pending, approved, rejected, applied) | default pending |
| requested_by | uuid → profiles | required |
| applied_at | timestamptz | optional |

#### `exam_seating` · branch +family

| Column | Type | Rules |
|---|---|---|
| exam_id | uuid → exams | required |
| student_id | uuid → students | required |
| room_id | uuid → rooms | required |
| seat_label | text | required; "R3-C2" |
| roll_no | text | required; the examination roll number printed on the admit card |

Unique: (exam_id, student_id); (exam_id, room_id, seat_label); (exam_id, roll_no).

#### `exam_invigilation` · branch

| Column | Type | Rules |
|---|---|---|
| exam_paper_id | uuid → exam_papers | required |
| room_id | uuid → rooms | required |
| staff_id | uuid → staff | required |
| duty | enum(chief, invigilator, reliever) | default invigilator |

Unique: (exam_paper_id, room_id, staff_id).

#### `exam_eligibility` · branch +family
A row exists only for a student who is blocked or has been let through after a block.

| Column | Type | Rules |
|---|---|---|
| exam_id | uuid → exams | required |
| student_id | uuid → students | required |
| status | enum(blocked, allowed) | required |
| reason | enum(attendance_shortage, fee_dues, disciplinary, other) | required |
| detail | text | optional; shown to the guardian |
| decided_by | uuid → profiles | optional; empty when set by the system |
| decided_at | timestamptz | required |

Unique: (exam_id, student_id, reason).

## 4 · Contracts

`packages/contracts/src/modules/exams/`: `exam-types`, `exams`, `exam-papers`, `marks`, `exam-seating`, `exam-eligibility`.

- `Datesheet`: papers of an exam grouped by date, then grade, with clashes listed.
- `MarksSheet`: for one paper section — the paper, the students who take the subject in roll order, each entry, and the section's status.
- `SaveMarks`: `{ items: { studentId, status, marks?, remark?, questions?: { questionNo, marks }[] }[] }`; partial saves are allowed while `in_progress`.
- `MarkingProgress`: per exam — papers by section with status, marker and counts entered.
- `EligibilityCheck`: the students who would be blocked and why, before anything is saved.

Settings: `exams.marks_entry_days` (default 7), `exams.marks_step` (default 0.5; marks must be a multiple), `exams.verification_required` (default true), `exams.block_on_attendance` (default false), `exams.block_on_dues` (default false), `exams.dues_months_to_block` (default 2), `exams.roll_no_pattern` (default `{grade}{section}{roll}`).

## 5 · Rules

- **R-exams-1** Lifecycle: `draft → scheduled` (date sheet published) `→ in_progress` (first paper day) `→ marks_entry` (after the last paper) `→ under_review` (every paper section verified or locked) `→ published` (set by [M18](m18-results-report-cards.md) when its result is published). `cancelled` is allowed until any mark exists.
- **R-exams-2** A date sheet can be published only when every paper has a date, times, maximum and pass marks, and no student has two papers that overlap. Two papers for the same grade may share a slot only when no student takes both (Islamiyat and Ethics; Biology and Computer Science).
- **R-exams-3** A paper cannot fall on a holiday or a non-working day; the planner warns for Friday afternoon slots.
- **R-exams-4** Changing a published date sheet notifies the families and staff affected, once, listing the change.
- **R-exams-5** Publishing a date sheet creates one `exam_paper_sections` row per paper per section of the grade, with the section subject's teacher as marker.
- **R-exams-6** A marks sheet lists exactly the students enrolled in the section on the paper date who take the subject (`subjectsFor`). A student who joined after the paper date is absent from the list, not marked absent.
- **R-exams-7** Marks are between 0 and the paper's maximum and a multiple of `exams.marks_step`. A status other than `present` carries no marks.
- **R-exams-8** Only the marker, a substitute named on the paper section, or a holder of `marks:manage` can enter marks. Entry is possible from the paper's day while the section is `pending`, `in_progress` or `returned`.
- **R-exams-9** Submitting requires an entry for every listed student. Paper section states: `pending → in_progress → submitted → verified → locked`; `submitted → returned → submitted`.
- **R-exams-10** Verification is by someone other than the person who submitted. With `exams.verification_required` off, submitting moves straight to `verified`.
- **R-exams-11** Locking is done by the exam controller, per paper or for the whole exam. A locked mark changes only through an approved `mark_corrections` row; applying it is audited with both values, and if a result was already published the student's result is recomputed ([R-results-9](m18-results-report-cards.md)).
- **R-exams-12** When question scores are entered, their total must equal the entry's marks. With a linked question paper, the question list and topic tags are prefilled from it.
- **R-exams-13** Changing a paper's maximum marks after any mark exists is refused. Cancelling a conducted paper needs `exams:manage` and a reason, and excludes it from results.
- **R-exams-14** Eligibility is checked when the admit cards are prepared: attendance below `attendance.minimum_percent` (when `exams.block_on_attendance`) and dues older than `exams.dues_months_to_block` months (when `exams.block_on_dues`). A blocked student gets no admit card; a leader can allow them with a note. Blocks are suggestions until confirmed by a person.
- **R-exams-15** Seating places students of the same grade apart where capacity allows, alternating grades by column, and never seats more students in a room than its exam capacity.
- **R-exams-16** A teacher is never set to invigilate two rooms at the same time, and the planner avoids, but allows with a warning, a teacher invigilating their own subject's paper.
- **R-exams-17** A student marked `malpractice` gets zero for the paper in results, and a behaviour record is suggested.
- **R-exams-18** A student who moves section during an exam keeps the marks already entered; later papers are marked in the new section.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `exam-types:manage` | Maintain exam types | academic_head, exam_controller |
| `exams:read` | See exams, date sheets and marking progress | ALL_STAFF |
| `exams:manage` | Create exams, plan and publish date sheets, cancel | ADMINS, exam_controller, coordinator |
| `marks:read` | See marks in scope | LEADERS, ACADEMIC, TEACHERS |
| `marks:enter` | Enter and submit marks for one's own paper sections | TEACHERS |
| `marks:manage` | Enter marks for any paper section; reassign markers | exam_controller, coordinator |
| `marks:verify` | Verify or return submitted marks | section_head, coordinator, exam_controller |
| `marks:lock` | Lock and request unlock | exam_controller, principal |
| `marks:correct` | Request a correction to a locked mark | TEACHERS, exam_controller |
| `exam-seating:manage` | Generate and edit seating and invigilation | exam_controller, coordinator |
| `exam-eligibility:manage` | Confirm blocks and allow blocked students | ADMINS, exam_controller |
| `exams:export` | Export date sheets, award lists and marks | ADMINS, ACADEMIC |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/exam-types` | `exams:read` | Lists |
| POST | `/exam-types` | `exam-types:manage` | Creates |
| PATCH | `/exam-types/[id]` | `exam-types:manage` | Edits |
| GET | `/exams` | `exams:read` | Lists; filter by year, term, type, status |
| POST | `/exams` | `exams:manage` | Creates a draft with its grades |
| GET | `/exams/[id]` | `exams:read` | One exam with progress |
| PATCH | `/exams/[id]` | `exams:manage` | Edits |
| POST | `/exams/[id]/cancel` | `exams:manage` | Cancels |
| GET | `/exams/[id]/datesheet` | `exams:read` | The date sheet with clashes |
| PUT | `/exams/[id]/papers` | `exams:manage` | Saves papers in bulk |
| POST | `/exams/[id]/papers/generate` | `exams:manage` | Creates papers from each grade's subjects and components |
| PATCH | `/exam-papers/[id]` | `exams:manage` | Edits one paper |
| POST | `/exam-papers/[id]/cancel` | `exams:manage` | Cancels one paper |
| POST | `/exams/[id]/datesheet/publish` | `exams:manage` | Publishes the date sheet |
| GET | `/exams/[id]/progress` | `exams:read` | Marking progress |
| GET | `/marking/mine` | `marks:enter` | Paper sections waiting for me |
| GET | `/exam-paper-sections/[id]/marks` | `marks:read` | The marks sheet |
| PUT | `/exam-paper-sections/[id]/marks` | `marks:enter` | Saves marks |
| POST | `/exam-paper-sections/[id]/submit` | `marks:enter` | Submits |
| POST | `/exam-paper-sections/[id]/verify` | `marks:verify` | Verifies |
| POST | `/exam-paper-sections/[id]/return` | `marks:verify` | Returns with a reason |
| PATCH | `/exam-paper-sections/[id]` | `marks:manage` | Reassigns the marker |
| POST | `/exams/[id]/lock` | `marks:lock` | Locks every verified paper section |
| POST | `/exam-paper-sections/[id]/lock` | `marks:lock` | Locks one |
| POST | `/exam-paper-sections/[id]/unlock` | `marks:lock` | Unlocks before results are published; needs a reason |
| GET | `/mark-corrections` | `marks:read` | Lists |
| POST | `/mark-corrections` | `marks:correct` | Requests a correction |
| GET | `/exams/[id]/seating` | `exams:read` | The seating plan |
| POST | `/exams/[id]/seating/generate` | `exam-seating:manage` | Generates seats and roll numbers |
| PUT | `/exams/[id]/seating` | `exam-seating:manage` | Edits seats |
| GET | `/exams/[id]/invigilation` | `exams:read` | Duties by paper and room |
| PUT | `/exams/[id]/invigilation` | `exam-seating:manage` | Saves duties |
| POST | `/exams/[id]/eligibility/check` | `exam-eligibility:manage` | Shows who would be blocked |
| PUT | `/exams/[id]/eligibility` | `exam-eligibility:manage` | Confirms blocks or allows students |
| POST | `/exams/[id]/admit-cards` | `exams:manage` | Generates admit cards for eligible students |
| GET | `/exams/[id]/award-list` | `exams:export` | A blank or filled award list per paper section |
| GET | `/exams/export` | `exams:export` | Exports marks |
| GET | `/family/children/[id]/exams` | `signed-in` | A child's upcoming exams, date sheet and admit card |
| GET | `/teach/invigilation` | `signed-in` | My invigilation duties |

Idempotent: `PUT /exam-paper-sections/[id]/marks`, `POST /exam-paper-sections/[id]/submit`, `POST /exams/[id]/datesheet/publish`.

## 8 · Client layer

Custom hooks: `useExam`, `useDatesheet`, `useSaveDatesheet`, `usePublishDatesheet`, `useMarkingQueue`, `useMarksSheet(paperSectionId)`, `useSaveMarks` (autosaves every few seconds and on blur; optimistic), `useSubmitMarks`, `useVerifyMarks`, `useLockExam`, `useMarkingProgress`, `useSeating`, `useEligibilityCheck`, `useChildExams`.

## 9 · Screens

Built in [Phase 8](../20-phases/phase-08-academics.md) and [Phase 13](../20-phases/phase-13-teacher-portal.md).

| Screen | Pattern | Where |
|---|---|---|
| Exams | List | `/school/exams`: status chips; progress bars |
| Exam | Detail | Tabs: Overview, Date sheet, Seating, Invigilation, Eligibility, Marking, Result |
| Date sheet planner | Grid editor | Dates across, grades down; drag a subject into a slot; clashes in red |
| Marking progress | Grid | Papers down, sections across; cell shows status and marker; reminders from here |
| Seating | Grid editor | A room map per room; generate, then swap seats |
| Eligibility | List | Would-be blocked students with reasons; block or allow each |
| **Teacher:** Marking queue | List | `/teach/marks`: papers due, with days left |
| **Teacher:** Marks sheet | Grid editor | Roll order; marks, status and remark per row; Enter moves down; question columns when used; totals and a running class average; Save is automatic; Submit |
| Verify marks | Grid | Read-only sheet with outliers highlighted (zero, full marks, far from the student's average); Verify or Return |
| **Parent:** Exams | Detail | Date sheet as a list with syllabus notes; admit card download |

## 10 · Notifications and jobs

Events: `exam.datesheet-published`, `exam.datesheet-changed`, `exam.tomorrow` (to families, 5 pm the day before a paper), `exam.admit-card-ready`, `exam.eligibility-blocked`, `marks.due` (to markers), `marks.overdue` (to marker and coordinator), `marks.returned`, `marks.submitted` (to verifiers), `marks.correction-requested`, `invigilation.assigned`.

Jobs: `exams.advance-status` (daily 00:30), `exams.marks-reminders` (daily 08:00), `exams.paper-reminders` (daily 17:00).

Documents: date sheet, admit card, seating chart per room, attendance sheet per room, award list, invigilation roster ([document catalogue](../30-reference/document-catalogue.md)).

## 11 · Offline

Offline-writable through `teacher.marks`:

| Table | Operation | Conflict policy |
|---|---|---|
| `mark_entries` | create, update while the paper section is open | **Never overwritten silently.** A different value already on the server for the same student goes to `sync_conflicts` for the teacher to choose |
| `mark_question_scores` | create, update | Follows its entry |

Submitting needs a connection. An upload for a section that was submitted or locked meanwhile is rejected and kept on the device for the teacher to see.

## 12 · AI

- Marking help: suggested marks from a photographed answer sheet against the marking scheme (A8); always a suggestion.
- Board readiness by weak chapter from question scores (S2).
- Outlier hints on the verify screen are plain statistics, not a model.

## 13 · Failure cases

- **F-exams-1** A teacher types 85 for a paper out of 75 → the cell is refused at once with the maximum; nothing is saved for that row.
- **F-exams-2** Two teachers enter marks for the same section (the marker and a coordinator) → the second save gets `STALE` for the rows that changed and sees the other values.
- **F-exams-3** The connection drops mid-entry → entries stay in the browser and the header shows "12 not saved"; they save on reconnect.
- **F-exams-4** A paper is moved to another date after seating was generated → seating stays (it is per exam); invigilation for that paper is cleared and flagged.
- **F-exams-5** A marker leaves the school before submitting → the coordinator reassigns the paper section; entries already made stay.
- **F-exams-6** A student is marked absent by mistake and the section is locked → a mark correction with approval; the audit shows both states.
- **F-exams-7** The exam's dates are edited so a paper falls outside them → refused, naming the paper.
- **F-exams-8** A room is too small for the students assigned → seating generation stops with the shortfall per room rather than overfilling.
- **F-exams-9** A subject is removed from a grade after papers exist → refused in [M11](m11-academic-structure.md) while an exam in the current year uses it.
- **F-exams-10** Lock is pressed while three paper sections are still unverified → only verified ones are locked; the response lists the rest.

## 14 · Seed data

Six exam types. Per branch: monthly tests for two past months (published), a first-term exam fully marked and locked, one exam in `marks_entry` with paper sections in every state (including two returned and one overdue), one scheduled exam next month with a published date sheet, seating and invigilation. Question scores on Grade 9 and 10 papers. Four mark corrections (pending, approved, rejected, applied). Eligibility blocks for six students, two allowed.

## 15 · Tests

- **T-exams-1** Lifecycle transitions and the daily status job.
- **T-exams-2** Date sheet clashes per student, including alternative subjects sharing a slot; holidays refused.
- **T-exams-3** Publishing creates paper sections with the right markers.
- **T-exams-4** The marks sheet lists the right students: subject overrides, late joiners, section movers.
- **T-exams-5** Marks validation: range, step, status without marks, question totals.
- **T-exams-6** Who can enter: marker, named substitute, manager; nobody else.
- **T-exams-7** Submit needs every student; verify by a different person; return and resubmit.
- **T-exams-8** A locked mark changes only through an approved correction; audit holds both values.
- **T-exams-9** Seating never exceeds capacity; unique seats and roll numbers.
- **T-exams-10** Invigilation: no double duty at one time.
- **T-exams-11** Eligibility by attendance and by dues; allow with a note; no admit card when blocked.
- **T-exams-12** Offline marks: applied once; conflicting values raise a conflict; rejected after submit.
- **T-exams-13** Families cannot read `mark_entries` at all.
- **T-exams-14** Row-level security and branch scope.

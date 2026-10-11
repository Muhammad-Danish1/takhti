# M13 · Syllabus and lesson plans

## 1 · Purpose

What must be taught, when it is planned to be taught, what was actually taught, and each teacher's plan for a lesson. It tells a coordinator which classes are behind before the exam does.

## 2 · Depends on

[M04](m04-school-setup.md) (terms, working days), [M11](m11-academic-structure.md), [M12](m12-timetable.md) (real teaching periods). Its topics are used by [M15](m15-homework-diary.md), [M17](m17-exams-marks.md) and [M19](m19-question-bank-papers.md).

## 3 · Tables

#### `syllabus_units` · org
The syllabus as a tree: unit, chapter, topic.

| Column | Type | Rules |
|---|---|---|
| grade_subject_id | uuid → grade_subjects | required |
| parent_id | uuid → syllabus_units | optional; empty for a top-level unit |
| kind | enum(unit, chapter, topic) | required |
| code | text | optional; the board's reference |
| title | text | required |
| title_ur | text | optional |
| description | text | optional |
| estimated_periods | int | default 0 |
| sort_order | int | required |
| source | enum(manual, import, ai) | default manual |
| ai_confidence | numeric(4,2) | optional; 0 to 1 |
| status | enum(draft, active) | default active |

Policy: every member of the organisation may read units that are `active`, because students see the syllabus of their subjects; staff write, by permission.
Index: (org_id, grade_subject_id, parent_id, sort_order). A parent must belong to the same `grade_subject_id`. Depth is at most three.

#### `learning_outcomes` · org
Student learning outcomes (SLOs) under a topic.

| Column | Type | Rules |
|---|---|---|
| unit_id | uuid → syllabus_units | required |
| code | text | optional; `P-09-A-03` |
| statement | text | required |
| statement_ur | text | optional |
| level | enum(remember, understand, apply, analyse, evaluate, create) | optional |
| sort_order | int | default 0 |

Policy: every member of the organisation may read; staff write, by permission.

#### `schemes_of_work` · branch
The term plan for a subject in a grade.

| Column | Type | Rules |
|---|---|---|
| academic_year_id | uuid → academic_years | required |
| term_id | uuid → terms | required |
| grade_subject_id | uuid → grade_subjects | required |
| section_id | uuid → sections | optional; empty means every section of the grade |
| status | enum(draft, submitted, approved, returned, archived) | default draft |
| submitted_by | uuid → profiles | optional |
| approved_by | uuid → profiles | optional |
| approved_at | timestamptz | optional |
| return_note | text | optional |
| drafted_by_ai | bool | default false |

Unique: (branch_id, term_id, grade_subject_id, section_id) among live rows.

#### `scheme_weeks` · branch

| Column | Type | Rules |
|---|---|---|
| scheme_id | uuid → schemes_of_work | required |
| week_no | int | required; > 0 |
| start_date | date | required |
| end_date | date | required |
| unit_ids | uuid[] | default empty; topics planned for the week |
| periods_planned | int | default 0 |
| activities | text | optional |
| assessment | text | optional |
| note | text | optional |

Unique: (scheme_id, week_no).

#### `syllabus_progress` · branch
What a section has actually covered.

| Column | Type | Rules |
|---|---|---|
| section_subject_id | uuid → section_subjects | required |
| unit_id | uuid → syllabus_units | required; a chapter or topic |
| status | enum(not_started, in_progress, completed) | default not_started |
| started_on | date | optional |
| completed_on | date | optional; ≥ `started_on` |
| periods_used | int | default 0 |

Unique: (section_subject_id, unit_id).

#### `lesson_plans` · branch

| Column | Type | Rules |
|---|---|---|
| section_subject_id | uuid → section_subjects | required |
| teacher_id | uuid → staff | required |
| plan_date | date | required |
| lesson_no | int | optional |
| unit_id | uuid → syllabus_units | optional; the topic |
| outcome_ids | uuid[] | default empty |
| title | text | required |
| objectives | text | required |
| activities | jsonb | default `[]`; ordered `{ minutes, teacher, students }` |
| resources | text | optional |
| classwork | text | optional |
| homework | text | optional |
| assessment | text | optional |
| differentiation | text | optional |
| reflection | text | optional; written after the lesson |
| language | enum(en, ur, both) | default en |
| status | enum(draft, submitted, approved, returned, taught) | default draft |
| reviewed_by | uuid → profiles | optional |
| review_note | text | optional |
| drafted_by_ai | bool | default false |
| copied_from_id | uuid → lesson_plans | optional |

Index: (org_id, teacher_id, plan_date); (org_id, section_subject_id, plan_date).

## 4 · Contracts

`packages/contracts/src/modules/syllabus/`: `syllabus-units`, `learning-outcomes`, `schemes-of-work`, `syllabus-progress`, `lesson-plans`, `pace`.

- `SyllabusTree`: units with nested chapters, topics and outcomes for one `gradeSubjectId`.
- `SaveTree`: creates, updates, moves and deletes in one call, with `version` of the root.
- `SetWeeks`: all weeks of a scheme together.
- `Pace`: per section and subject — `{ plannedToDate, completedToDate, variance, status: ahead | on_track | behind | far_behind, projectedFinish: date | "will_not_finish" }`.
- `MarkProgress`: `{ sectionSubjectId, unitId, status, on }`.

Settings: `syllabus.lesson_plan_approval` (`none` or `coordinator`), `syllabus.plan_due_weekday` (default `fri`, for the following week), `syllabus.behind_threshold_percent` (default 10).

## 5 · Rules

- **R-syllabus-1** A unit's children must be of the next kind down: unit → chapter → topic. Moving a node keeps it inside its `grade_subject_id`.
- **R-syllabus-2** A unit, chapter or topic referenced by progress, a lesson plan, homework, a question or a mark cannot be deleted; it can be retired (hidden from new use).
- **R-syllabus-3** A scheme's weeks are generated from the term's dates and the branch's working days, so a week that is all holiday has zero planned periods and is shown as such.
- **R-syllabus-4** `periods_planned` in a week cannot exceed the periods the timetable actually gives that subject that week. The editor shows both.
- **R-syllabus-5** Scheme states: `draft → submitted → approved`; `submitted → returned → submitted`; an approved scheme is revised by a new draft that replaces it on approval.
- **R-syllabus-6** **Pace** compares completed topics with the scheme's own plan to date, both weighted by `estimated_periods`. The projected finish uses the same ratio, so a class exactly on plan is never told it will finish late. Past the end of term the projection reads "will not finish" instead of a date.
- **R-syllabus-7** A section is `behind` when it trails the plan by more than `syllabus.behind_threshold_percent`, and `far_behind` at double that.
- **R-syllabus-8** Marking a chapter completed completes its topics; completing every topic completes the chapter.
- **R-syllabus-9** Lesson plan states: `draft → submitted → approved → taught`; `submitted → returned → submitted`. With approval set to `none`, `draft → taught` is allowed.
- **R-syllabus-10** A teacher writes plans only for their own `section_subjects`. Copying a plan to their other sections of the same grade subject creates independent drafts.
- **R-syllabus-11** Marking a plan `taught` offers to mark its topic in progress or completed and to post its homework to the diary; neither happens without the teacher choosing it.
- **R-syllabus-12** A plan or scheme written by AI stays marked `drafted_by_ai` after edits, and cannot be submitted until the teacher has opened it.
- **R-syllabus-13** A reviewer cannot approve their own plan.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `syllabus:read` | See the syllabus | ALL_STAFF |
| `syllabus:update` | Create and edit the syllabus tree and outcomes | academic_head, coordinator, section_head |
| `schemes:read` | See schemes of work | ALL_STAFF |
| `schemes:update` | Draft and submit a scheme | ACADEMIC, TEACHERS |
| `schemes:approve` | Approve or return a scheme | academic_head, coordinator, section_head, principal |
| `syllabus-progress:read` | See coverage and pace | ALL_STAFF |
| `syllabus-progress:update` | Mark topics covered | TEACHERS, coordinator |
| `lesson-plans:read` | See lesson plans beyond one's own | ACADEMIC, LEADERS |
| `lesson-plans:create` | Write one's own lesson plans | TEACHERS |
| `lesson-plans:approve` | Approve or return lesson plans | academic_head, coordinator, section_head |

A teacher always sees their own plans.

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/syllabus` | `syllabus:read` | The tree for a grade subject |
| PUT | `/syllabus` | `syllabus:update` | Saves changes to the tree |
| POST | `/syllabus/import` | `syllabus:update` | Imports a tree from a spreadsheet |
| POST | `/syllabus/copy` | `syllabus:update` | Copies a tree from another year's grade subject |
| GET | `/learning-outcomes` | `syllabus:read` | Outcomes of a topic |
| PUT | `/learning-outcomes` | `syllabus:update` | Saves a topic's outcomes |
| GET | `/schemes-of-work` | `schemes:read` | Lists schemes |
| POST | `/schemes-of-work` | `schemes:update` | Creates a draft with generated weeks |
| GET | `/schemes-of-work/[id]` | `schemes:read` | One scheme with its weeks |
| PUT | `/schemes-of-work/[id]/weeks` | `schemes:update` | Saves the weeks |
| POST | `/schemes-of-work/[id]/submit` | `schemes:update` | Submits |
| POST | `/schemes-of-work/[id]/approve` | `schemes:approve` | Approves |
| POST | `/schemes-of-work/[id]/return` | `schemes:approve` | Returns with a note |
| DELETE | `/schemes-of-work/[id]` | `schemes:update` | Deletes a draft |
| GET | `/syllabus-progress` | `syllabus-progress:read` | Progress for a section subject |
| POST | `/syllabus-progress` | `syllabus-progress:update` | Marks a topic or chapter |
| GET | `/syllabus-pace` | `syllabus-progress:read` | Pace for a branch, grade, section or teacher |
| GET | `/lesson-plans` | `signed-in` | One's own plans; others' with `lesson-plans:read` |
| POST | `/lesson-plans` | `lesson-plans:create` | Creates |
| GET | `/lesson-plans/[id]` | `signed-in` | One plan the user may see |
| PATCH | `/lesson-plans/[id]` | `lesson-plans:create` | Edits one's own draft or returned plan |
| DELETE | `/lesson-plans/[id]` | `lesson-plans:create` | Deletes one's own draft |
| POST | `/lesson-plans/[id]/copy` | `lesson-plans:create` | Copies to other sections or dates |
| POST | `/lesson-plans/[id]/submit` | `lesson-plans:create` | Submits |
| POST | `/lesson-plans/[id]/approve` | `lesson-plans:approve` | Approves |
| POST | `/lesson-plans/[id]/return` | `lesson-plans:approve` | Returns with a note |
| POST | `/lesson-plans/[id]/taught` | `lesson-plans:create` | Marks taught, with the optional follow-ups |
| GET | `/lesson-plans/submission-status` | `lesson-plans:read` | Who has and has not submitted next week's plans |

## 8 · Client layer

Custom hooks: `useSyllabusTree`, `useSaveSyllabusTree`, `useScheme`, `useSaveSchemeWeeks`, `useSyllabusProgress`, `useMarkProgress` (optimistic), `usePace`, `useMyLessonPlans(week)`, `useLessonPlan`, `useSubmitLessonPlan`, `useReviewLessonPlan`, `useSubmissionStatus`.

## 9 · Screens

Under `/school/academics/syllabus`. Built in [Phase 8](../20-phases/phase-08-academics.md).

| Screen | Pattern | Notes |
|---|---|---|
| Syllabus | Grid editor (tree) | Indent, outdent, drag to reorder, inline titles in English and Urdu, estimated periods; AI-imported nodes show their confidence until accepted |
| Scheme of work | Grid editor | Weeks down, topics as chips, planned against available periods; holidays greyed |
| Pace | Dashboard | A heat grid: sections across, subjects down, coloured with a word in each cell; "Behind" list underneath |
| Coverage | List | One section and subject: topics with status and dates |
| Lesson plan review | List + Detail | Awaiting review first; approve or return with a note |
| Submission status | List | Teachers against next week's days |
| **Teacher:** Plans | Calendar (week) | `/teach/plans`: a card per lesson; create, copy to my other sections |
| **Teacher:** Lesson plan | Form page | Sections for objectives, timed activities, classwork, homework; "Mark taught" |
| **Teacher:** Coverage | List | Tick off topics per section |

## 10 · Notifications and jobs

Events: `scheme.submitted`, `scheme.approved`, `scheme.returned`, `lesson-plan.submitted`, `lesson-plan.approved`, `lesson-plan.returned`, `syllabus.behind` (weekly, to the coordinator and the teacher).

Jobs: `syllabus.plan-reminders` (the day before `plan_due_weekday`), `syllabus.weekly-pace` (Monday 07:00).

## 11 · Offline

Read-only in the teacher streams: the syllabus tree of the teacher's subjects and their own approved plans for the current and next week.

## 12 · AI

- Textbook to syllabus tree (A2): creates `draft` nodes with `source = ai` and a confidence each.
- Scheme of work (A3): drafts `scheme_weeks` from the tree and the real calendar.
- Lesson plans in English and Urdu (A4).
- A weekly pace summary in a sentence per grade.

## 13 · Failure cases

- **F-syllabus-1** A topic is deleted that a question paper uses → refused; "Retire" is offered.
- **F-syllabus-2** The term dates change after a scheme was approved → its weeks are regenerated on next open and marked "dates changed, review".
- **F-syllabus-3** Two people edit the same tree → the second save gets `STALE` and keeps its unsaved edits on screen.
- **F-syllabus-4** A teacher changes mid-term → progress stays with the section subject; the new teacher sees what was covered.
- **F-syllabus-5** An imported spreadsheet has a topic under a missing chapter → that row is invalid in the preview with the reason.
- **F-syllabus-6** A class is two days from the end of term at 60% → the projection reads "will not finish"; no negative or absurd date is shown.
- **F-syllabus-7** The AI provider is unavailable → the "Draft with AI" buttons are hidden; manual editing is unaffected.

## 14 · Seed data

Full trees for Grades 9 and 10 in Physics, Chemistry, Biology, Mathematics and English; shorter trees for every other grade subject. Approved first-term schemes. Progress seeded so that most sections are on track, eight are behind and two are far behind. Two weeks of lesson plans in all states for twelve teachers.

## 15 · Tests

- **T-syllabus-1** Tree rules: kind order, depth, same grade subject, move, retire instead of delete.
- **T-syllabus-2** Week generation over a term with a holiday week and a half-day Friday.
- **T-syllabus-3** Planned periods cannot exceed timetable periods.
- **T-syllabus-4** Pace: exactly on plan projects on time; behind and far-behind thresholds; past end of term.
- **T-syllabus-5** Chapter and topic completion roll up and down.
- **T-syllabus-6** Lesson plan transitions with and without approval; own plans only; cannot approve own.
- **T-syllabus-7** Copy creates independent drafts.
- **T-syllabus-8** "Taught" follow-ups happen only when chosen.
- **T-syllabus-9** A teacher cannot read another teacher's plans without the permission.
- **T-syllabus-10** Row-level security and branch scope.

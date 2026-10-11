# M29 · Appraisal and training

## 1 · Purpose

Helping staff get better and recording that fairly: classroom observations, yearly appraisals with self and manager ratings, goals, and training with attendance and certificates. A teacher's own data from the rest of Takhti (punctuality, syllabus coverage, marks on time, class results) is shown as evidence, never as an automatic score.

## 2 · Depends on

[M26](m26-staff-recruitment.md) (`staff`, reporting lines), [M11](m11-academic-structure.md), [M00](m00-shared-kernel.md) (files, documents). Reads [M13](m13-syllabus-lesson-plans.md), [M14](m14-student-attendance.md), [M15](m15-homework-diary.md), [M17](m17-exams-marks.md), [M18](m18-results-report-cards.md), [M27](m27-staff-attendance-leave.md) for the scorecard.

## 3 · Tables

#### `appraisal_templates` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation |
| staff_type | enum(teaching, non_teaching, leadership) | required |
| scale_max | int | default 5; 3 to 10 |
| scale_labels | jsonb | required; a label per point |
| sections | jsonb | required; `{ key, title, weight, criteria: { key, label, hint? }[] }[]`; weights total 100 |
| rating_bands | jsonb | required; `{ from, label }[]` over the final percentage |
| is_active | bool | default true |

#### `appraisal_cycles` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; "Annual appraisal 2026–27" |
| kind | enum(annual, mid_year, probation) | required |
| period_from | date | required |
| period_to | date | required; after `period_from` |
| self_due_on | date | required |
| manager_due_on | date | required; ≥ `self_due_on` |
| branch_ids | uuid[] | default empty; empty means all |
| status | enum(draft, open, calibration, closed) | default draft |

#### `appraisal_forms` · org
One per staff member per cycle.

| Column | Type | Rules |
|---|---|---|
| cycle_id | uuid → appraisal_cycles | required |
| staff_id | uuid → staff | required |
| template_id | uuid → appraisal_templates | required |
| appraiser_staff_id | uuid → staff | required; defaults to the reporting manager; not the appraisee |
| reviewer_staff_id | uuid → staff | optional; the appraiser's manager |
| status | enum(self_pending, manager_pending, review_pending, shared, acknowledged, closed) | default self_pending |
| self_submitted_at | timestamptz | optional |
| manager_submitted_at | timestamptz | optional |
| final_percent | numeric(5,2) | optional |
| rating_label | text | optional |
| strengths | text | optional |
| improvements | text | optional |
| manager_comment | text | optional |
| staff_comment | text | optional; written on acknowledgement |
| recommendation | enum(none, increment, promotion, confirmation, extend_probation, improvement_plan) | default none |
| shared_at | timestamptz | optional |
| acknowledged_at | timestamptz | optional |

Policy: service-enforced. Readable by the appraisee (manager's part only once `shared`), the appraiser, the reviewer and holders of `appraisals:manage`.
Unique: (cycle_id, staff_id).

#### `appraisal_scores` · org

| Column | Type | Rules |
|---|---|---|
| form_id | uuid → appraisal_forms | required |
| criterion_key | text | required; a key from the template |
| self_score | int | optional; 1 to the template's `scale_max` |
| manager_score | int | optional |
| final_score | int | optional; set at review, defaults to the manager's |
| comment | text | optional |

Unique: (form_id, criterion_key).

#### `staff_goals` · org

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| cycle_id | uuid → appraisal_cycles | optional |
| title | text | required |
| measure | text | optional; how success is judged |
| due_on | date | optional |
| weight | int | default 0 |
| progress_percent | int | default 0; 0 to 100 |
| status | enum(proposed, agreed, achieved, partly_achieved, missed, dropped) | default proposed |
| last_update | text | optional |

Policy: service-enforced: the person, their manager chain and `appraisals:manage`.

#### `observation_rubrics` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation |
| criteria | jsonb | required; `{ key, label, hint? }[]`: planning, subject knowledge, engagement, questioning, classroom management, assessment, use of resources |
| scale_max | int | default 4 |
| is_active | bool | default true |

#### `classroom_observations` · branch

| Column | Type | Rules |
|---|---|---|
| teacher_staff_id | uuid → staff | required |
| observer_staff_id | uuid → staff | required; not the teacher |
| rubric_id | uuid → observation_rubrics | required |
| section_subject_id | uuid → section_subjects | optional |
| observed_on | date | required |
| lesson_no | int | optional |
| topic | text | optional |
| kind | enum(announced, unannounced, peer, walkthrough) | default announced |
| scores | jsonb | default `{}`; criterion key → score |
| overall_percent | numeric(5,2) | optional |
| strengths | text | optional |
| areas_to_improve | text | optional |
| agreed_actions | text | optional |
| follow_up_on | date | optional |
| status | enum(scheduled, done, shared, acknowledged, cancelled) | default scheduled |
| teacher_comment | text | optional |

Policy: service-enforced: the teacher (once `shared`), the observer, the teacher's manager chain and `observations:manage`.
Index: (org_id, teacher_staff_id, observed_on).

#### `training_programs` · org

| Column | Type | Rules |
|---|---|---|
| title | text | required |
| kind | enum(workshop, course, orientation, certification, online, conference) | required |
| provider | text | optional |
| trainer | text | optional |
| branch_id | uuid → branches | optional; where it is held |
| venue | text | optional |
| starts_on | date | required |
| ends_on | date | required; ≥ `starts_on` |
| hours | numeric(5,1) | optional |
| capacity | int | optional |
| cost | paisa | default 0 |
| is_mandatory | bool | default false |
| audience | jsonb | default `{}`; designation categories, branches or departments it is meant for |
| status | enum(planned, open, completed, cancelled) | default planned |

#### `training_attendance` · org

| Column | Type | Rules |
|---|---|---|
| program_id | uuid → training_programs | required |
| staff_id | uuid → staff | required |
| status | enum(nominated, registered, attended, completed, absent, withdrawn) | default nominated |
| hours_credited | numeric(5,1) | optional |
| score | numeric(5,2) | optional |
| certificate_file_id | uuid → files | optional |
| feedback_rating | int | optional; 1 to 5 |
| feedback | text | optional |

Policy: staff with `training:manage`; a staff member may read their own rows and write their own feedback.
Unique: (program_id, staff_id).

## 4 · Contracts

`packages/contracts/src/modules/appraisal/`: `appraisal-templates`, `appraisal-cycles`, `appraisal-forms`, `staff-goals`, `observation-rubrics`, `classroom-observations`, `training-programs`, `training-attendance`.

- `TeacherScorecard` for a period — facts only, each with the figure and what it is compared against: days present and late; lessons planned against timetable; syllabus covered against the scheme; attendance marked on time; homework set per week; marks submitted by the due date; class averages and pass rates by subject against the grade's; observation average; training hours. Each line links to its source.
- `AppraisalFormView`: the template, the scores the caller may see, the scorecard for teaching staff, goals, and the allowed next action.
- `CycleProgress`: forms by status per branch and per appraiser.
- `CalibrationSheet`: final percentages by appraiser and department, with the distribution, for a moderation meeting.
- `TrainingRecord`: a person's programmes and hours for a year.

Settings: `appraisal.self_visible_to_manager_before_submit` (default false), `appraisal.share_needs_review` (default true), `training.required_hours_per_year` (default 0; when above zero, shortfalls are listed).

## 5 · Rules

- **R-appraisal-1** Opening a cycle creates a form for each active staff member in its branches who joined at least 3 months before `period_to` (1 month for a probation cycle), with the template for their staff type and their reporting manager as appraiser. Anyone without a manager is listed for HR to assign.
- **R-appraisal-2** Flow: `self_pending → manager_pending → review_pending → shared → acknowledged → closed`. With `appraisal.share_needs_review` off, the manager's submission shares the form directly.
- **R-appraisal-3** The appraisee sees only their own scores until the form is `shared`. The manager sees the self-assessment once it is submitted (or always, by the setting).
- **R-appraisal-4** Nobody appraises themselves, and the reviewer is not the appraiser.
- **R-appraisal-5** The final percentage is the weighted average of final scores by section weight; the rating label comes from the template's bands. Both are computed, never typed.
- **R-appraisal-6** Every score at the lowest or highest point needs a comment.
- **R-appraisal-7** During `calibration`, `appraisals:manage` may change final scores with a note; each change is audited with the previous value. Closing the cycle freezes every form.
- **R-appraisal-8** Acknowledging means "I have seen this", not "I agree"; the appraisee can add a comment. A form not acknowledged 7 days after sharing is flagged for HR and can be closed as "not acknowledged".
- **R-appraisal-9** A recommendation is only a recommendation. An increment or promotion happens through [M28](m28-payroll.md) and [M26](m26-staff-recruitment.md), which can list recommended staff.
- **R-appraisal-10** The scorecard shows figures and comparisons and nothing else. It does not produce a number that enters the appraisal; the manager reads it and scores.
- **R-appraisal-11** An observation is scored on its rubric; the overall percentage is computed. The teacher sees it when it is shared, should acknowledge within 7 days, and may comment. An unannounced observation needs no advance notice but is shared the same way.
- **R-appraisal-12** A teacher is not formally observed more than `observations.max_per_term` times (default 3) without `observations:manage`; walkthroughs do not count.
- **R-appraisal-13** A training programme's nominations cannot exceed its capacity. Attendance is recorded by the organiser; `completed` needs `attended`. Hours credited default to the programme's hours.
- **R-appraisal-14** A mandatory programme lists everyone in its audience; those who have not completed it by its end date appear on the HR dashboard.
- **R-appraisal-15** A training's cost is recorded as an expense in [M24](m24-expenses-procurement.md) when the school pays for it; this module only stores the figure.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `appraisals:read` | See appraisal forms of one's own reports | LEADERS, section_head, coordinator, HR, finance_head |
| `appraisals:manage` | Run cycles; see and calibrate every form; maintain templates | hr_manager, director |
| `observations:read` | See observations of teachers in one's line | LEADERS, section_head, coordinator, academic_head |
| `observations:create` | Schedule and record observations | LEADERS, section_head, coordinator, academic_head |
| `observations:manage` | See every observation; maintain rubrics | academic_head, principal |
| `scorecards:read` | See teacher scorecards in one's line | LEADERS, section_head, coordinator, academic_head, hr_manager |
| `training:manage` | Create programmes; nominate; record attendance | HR, academic_head |
| `training:read` | See programmes and records in scope | LEADERS, HR, academic_head, section_head |
| `appraisals:export` | Export appraisal and training reports | hr_manager, director |

Every staff member can see their own form (as far as it is shared), goals, observations, scorecard and training record.

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/appraisal-templates` | `appraisals:read` | Lists |
| POST | `/appraisal-templates` | `appraisals:manage` | Creates |
| PATCH | `/appraisal-templates/[id]` | `appraisals:manage` | Edits one not used by an open cycle |
| GET | `/appraisal-cycles` | `appraisals:read` | Lists |
| POST | `/appraisal-cycles` | `appraisals:manage` | Creates |
| PATCH | `/appraisal-cycles/[id]` | `appraisals:manage` | Edits |
| POST | `/appraisal-cycles/[id]/open` | `appraisals:manage` | Opens and creates forms |
| GET | `/appraisal-cycles/[id]/progress` | `appraisals:read` | Progress |
| GET | `/appraisal-cycles/[id]/calibration` | `appraisals:manage` | The calibration sheet |
| POST | `/appraisal-cycles/[id]/calibrate` | `appraisals:manage` | Moves to calibration |
| POST | `/appraisal-cycles/[id]/close` | `appraisals:manage` | Closes |
| GET | `/appraisal-forms` | `appraisals:read` | Forms I appraise or review, or all for a manager of the cycle |
| GET | `/appraisal-forms/[id]` | `signed-in` | One form, as much as the caller may see |
| PATCH | `/appraisal-forms/[id]` | `appraisals:manage` | Reassigns the appraiser or reviewer |
| PUT | `/appraisal-forms/[id]/self` | `signed-in` | Saves or submits the self-assessment |
| PUT | `/appraisal-forms/[id]/manager` | `appraisals:read` | Saves or submits the manager's assessment |
| POST | `/appraisal-forms/[id]/review` | `appraisals:read` | The reviewer approves or returns it |
| PUT | `/appraisal-forms/[id]/final` | `appraisals:manage` | Changes final scores in calibration |
| POST | `/appraisal-forms/[id]/share` | `appraisals:read` | Shares with the appraisee |
| POST | `/appraisal-forms/[id]/acknowledge` | `signed-in` | The appraisee acknowledges |
| GET | `/staff/[id]/scorecard` | `scorecards:read` | A teacher's scorecard for a period |
| GET | `/staff/[id]/goals` | `appraisals:read` | Goals |
| PUT | `/staff/[id]/goals` | `appraisals:read` | Saves goals for a report |
| GET | `/observation-rubrics` | `observations:read` | Lists |
| POST | `/observation-rubrics` | `observations:manage` | Creates |
| PATCH | `/observation-rubrics/[id]` | `observations:manage` | Edits |
| GET | `/classroom-observations` | `observations:read` | Lists |
| POST | `/classroom-observations` | `observations:create` | Schedules |
| GET | `/classroom-observations/[id]` | `signed-in` | One observation, as much as the caller may see |
| PATCH | `/classroom-observations/[id]` | `observations:create` | Records scores and notes |
| POST | `/classroom-observations/[id]/share` | `observations:create` | Shares with the teacher |
| POST | `/classroom-observations/[id]/acknowledge` | `signed-in` | The teacher acknowledges |
| GET | `/training-programs` | `signed-in` | Programmes the caller may see |
| POST | `/training-programs` | `training:manage` | Creates |
| PATCH | `/training-programs/[id]` | `training:manage` | Edits |
| PUT | `/training-programs/[id]/attendance` | `training:manage` | Nominates and records attendance |
| POST | `/training-programs/[id]/register` | `signed-in` | Registers oneself for an open programme |
| POST | `/training-programs/[id]/feedback` | `signed-in` | Gives feedback |
| GET | `/training/records` | `training:read` | Hours by staff member for a year |
| GET | `/me/appraisal` | `signed-in` | My forms, goals, observations, scorecard and training |
| PUT | `/me/goals` | `signed-in` | Proposes or updates my goals |
| GET | `/appraisals/export` | `appraisals:export` | Exports |

## 8 · Client layer

Custom hooks: `useAppraisalCycle`, `useCycleProgress`, `useAppraisalForm` (autosaves a draft), `useSubmitSelf`, `useSubmitManager`, `useCalibrationSheet`, `useTeacherScorecard`, `useGoals`, `useObservation`, `useRecordObservation`, `useTrainingPrograms`, `useTrainingAttendance`, `useMyAppraisal`.

## 9 · Screens

Built in [Phase 10](../20-phases/phase-10-hr.md); the teacher's side in [Phase 13](../20-phases/phase-13-teacher-portal.md).

| Screen | Pattern | Where |
|---|---|---|
| Appraisal cycles | List + Detail | `/school/staff/appraisal`: progress by branch and by appraiser; reminders |
| Appraisal form | Form page | Sections down the page; self and manager columns side by side once visible; the scorecard in a side panel; comments; recommendation |
| Calibration | Grid | Staff down; final percentage and band; distribution chart; edit with a note |
| Templates and rubrics | Settings | A section and criteria builder with weights that must total 100 |
| Observations | List + Form page | Schedule from the timetable; the rubric as rows with a scale; notes; share |
| Teacher scorecard | Dashboard | Fact tiles with comparison and links to the source |
| Training | List + Detail | Calendar of programmes; nominations; attendance sheet; feedback summary |
| Training records | Report | Hours per person against the required hours |
| **Staff:** My growth | Dashboard | My form to complete, goals, observations to acknowledge, training to attend |

## 10 · Notifications and jobs

Events: `appraisal.opened` (to each appraisee), `appraisal.self-due`, `appraisal.manager-due`, `appraisal.returned`, `appraisal.shared`, `appraisal.not-acknowledged` (to HR), `observation.scheduled` (announced ones only), `observation.shared`, `goal.due`, `training.nominated`, `training.reminder` (2 days before), `training.mandatory-missed`.

Jobs: `appraisal.reminders` (daily 09:00), `appraisal.scorecards` (nightly: refreshes the stored figures for the current term), `training.reminders` (daily).

Documents: appraisal form (completed), observation report, training certificate, training record.

## 11 · Offline

An observer can record an observation offline on the teacher app; it is saved to the device and uploaded later. Policy: the latest write wins for the same observation by the same observer.

## 12 · AI

- Turning an observer's rough notes into tidy "strengths" and "areas to improve" paragraphs (A10); the observer edits and saves.
- Summarising the scorecard in two sentences for the appraisal form.
- A model never proposes a score, a rating or a recommendation.

## 13 · Failure cases

- **F-appraisal-1** A manager leaves during the cycle → their pending forms are listed for HR to reassign; submitted parts are kept.
- **F-appraisal-2** A staff member transfers branch mid-cycle → the form stays; the appraiser is the manager at `period_to`, and the earlier manager can add a note.
- **F-appraisal-3** A template is edited while a cycle using it is open → refused; copy it for the next cycle.
- **F-appraisal-4** The appraisee opens the form before it is shared → they see their self-assessment only.
- **F-appraisal-5** A reviewer returns a form → it goes back to `manager_pending` with the note; the appraisee sees nothing of this.
- **F-appraisal-6** The scorecard has no exam data yet this term → those lines show "no data yet", not zero.
- **F-appraisal-7** An observation is scheduled for a lesson that is then cancelled → the observer is told; the observation moves to "to reschedule".
- **F-appraisal-8** A programme with 30 places gets 35 nominations → the last five are refused with the count.
- **F-appraisal-9** An appraisee never acknowledges → after 7 days HR may close the form as not acknowledged; that fact prints on the form.

## 14 · Seed data

Three templates (teaching, non-teaching, leadership) and two observation rubrics. Last year's annual cycle closed with forms for all staff; this year's mid-year cycle open with forms in every status. Goals for about half the staff. Forty observations across kinds and statuses. Ten training programmes (two mandatory, one upcoming, one over capacity) with attendance and feedback. Scorecard figures for every teacher for the last two terms.

## 15 · Tests

- **T-appraisal-1** Opening a cycle creates the right forms; eligibility by joining date; missing managers listed.
- **T-appraisal-2** Visibility at every status for appraisee, appraiser, reviewer, HR and an unrelated manager.
- **T-appraisal-3** No self-appraisal; reviewer differs from appraiser.
- **T-appraisal-4** Final percentage and band from weights; comments required at the extremes.
- **T-appraisal-5** Calibration changes are audited; closing freezes.
- **T-appraisal-6** Acknowledgement and the not-acknowledged path.
- **T-appraisal-7** Scorecard figures equal hand counts on seeded data; "no data" is not zero.
- **T-appraisal-8** Observations: visibility before and after sharing; per-term limit.
- **T-appraisal-9** Training: capacity, attendance states, mandatory shortfall list.
- **T-appraisal-10** A staff member reads only their own records through `/me/appraisal`.
- **T-appraisal-11** Row-level security and branch scope.

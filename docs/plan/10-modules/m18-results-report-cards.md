# M18 · Results and report cards

## 1 · Purpose

Turning locked marks into results: totals, percentages, grades, pass or fail, positions, remarks and a printed report card. It also holds each student's board registration and board result for Grades 5, 8, 9 and 10.

## 2 · Depends on

[M17](m17-exams-marks.md) (locked marks), [M04](m04-school-setup.md) (grading schemes), [M07](m07-students.md), [M11](m11-academic-structure.md), [M14](m14-student-attendance.md) (attendance on the card), [M00](m00-shared-kernel.md) (documents). Feeds [M07](m07-students.md) promotion.

## 3 · Tables

#### `result_policies` · org
How a result is worked out. A school usually has two: primary classes and board classes.

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation |
| grade_ids | uuid[] | required; the grades it applies to |
| pass_rule | enum(every_subject, aggregate, every_subject_and_aggregate) | default every_subject |
| min_aggregate_percent | numeric(5,2) | default 40 |
| components_pass_separately | bool | default true; theory and practical each need their own pass marks |
| compartment_max_subjects | int | default 0; failing up to this many subjects gives `compartment` instead of `fail` |
| grace_marks_total | numeric(5,2) | default 0; the most that can be added across subjects |
| grace_marks_per_subject | numeric(5,2) | default 0 |
| grace_max_subjects | int | default 0 |
| position_method | enum(none, dense, competition) | default dense; dense gives 1, 1, 2; competition gives 1, 1, 3 |
| position_scope | enum(section, grade, both) | default section |
| positions_need_pass | bool | default true |
| percent_decimals | int | default 2; 0 to 2 |
| is_active | bool | default true |

#### `result_sets` · branch
One published thing: the result of an exam, a term or a year for some grades.

| Column | Type | Rules |
|---|---|---|
| academic_year_id | uuid → academic_years | required |
| term_id | uuid → terms | optional |
| kind | enum(exam, term, annual) | required |
| name | text | required; "First term result 2026" |
| exam_id | uuid → exams | optional; required for kind `exam` |
| grade_ids | uuid[] | required |
| policy_id | uuid → result_policies | required |
| grading_scheme_id | uuid → grading_schemes | required |
| frozen_rules | jsonb | optional; the policy and grade bands copied at publish |
| template_id | uuid → report_card_templates | optional |
| status | enum(draft, computed, under_review, published, withdrawn) | default draft |
| computed_at | timestamptz | optional |
| publish_at | timestamptz | optional; scheduled publishing |
| published_at | timestamptz | optional |
| published_by | uuid → profiles | optional |
| show_positions | bool | default true |

Policy: staff of the branch; families read only published sets.
Unique: (branch_id, academic_year_id, name) among live rows.

#### `result_set_components` · branch
For a term or annual result: which exams it combines and with what weight.

| Column | Type | Rules |
|---|---|---|
| result_set_id | uuid → result_sets | required |
| exam_id | uuid → exams | required |
| weight_percent | numeric(5,2) | required; > 0; the set's weights total 100 |

Unique: (result_set_id, exam_id).

#### `results` · branch +family
One student's result in one result set.

| Column | Type | Rules |
|---|---|---|
| result_set_id | uuid → result_sets | required |
| student_id | uuid → students | required |
| enrollment_id | uuid → enrollments | required |
| section_id | uuid → sections | required; the section at computation |
| total_obtained | numeric(8,2) | required |
| total_max | numeric(8,2) | required |
| grace_marks | numeric(5,2) | default 0 |
| percent | numeric(5,2) | required |
| grade_letter | text | optional |
| grade_point | numeric(4,2) | optional |
| outcome | enum(pass, fail, compartment, absent, incomplete) | required |
| failed_subjects | int | default 0 |
| position_section | int | optional |
| position_grade | int | optional |
| days_present | int | optional |
| days_total | int | optional |
| teacher_remark | text | optional |
| teacher_remark_ur | text | optional |
| head_remark | text | optional |
| remark_source | enum(none, written, ai_accepted, ai_edited) | default none |
| is_withheld | bool | default false |
| withheld_reason | enum(fee_dues, disciplinary, incomplete, other) | optional |
| withheld_note | text | optional; shown to the guardian |
| revision | int | default 1; goes up when recomputed after publishing |

Policy: a guardian or student may read their own row only when the set is `published` and the row is not withheld. A withheld row returns only the fact and the note.
Unique: (result_set_id, student_id).
Index: (org_id, student_id); (org_id, result_set_id, section_id, percent).

#### `result_subjects` · branch +family

| Column | Type | Rules |
|---|---|---|
| result_id | uuid → results | required |
| student_id | uuid → students | required |
| grade_subject_id | uuid → grade_subjects | required |
| subject_name | text | required; copied, so a later rename does not change an issued result |
| theory_obtained | numeric(6,2) | optional |
| theory_max | numeric(6,2) | optional |
| practical_obtained | numeric(6,2) | optional |
| practical_max | numeric(6,2) | optional |
| obtained | numeric(6,2) | required |
| max | numeric(6,2) | required |
| grace_marks | numeric(5,2) | default 0 |
| percent | numeric(5,2) | required |
| grade_letter | text | optional |
| grade_point | numeric(4,2) | optional |
| status | enum(pass, fail, absent, exempt) | required |
| position_section | int | optional; highest in subject |

Policy: same as `results`, through its result.
Unique: (result_id, grade_subject_id).

#### `report_card_templates` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation |
| layout | enum(standard, compact, primary_descriptive, board_style, cumulative) | required |
| language | enum(en, ur, both) | default en |
| options | jsonb | default `{}`; show positions, attendance, co-scholastic, bar chart, previous terms, grading key, signature labels |
| grade_ids | uuid[] | default empty; empty means all |
| is_default | bool | default false |
| status | enum(draft, active, archived) | default draft |

#### `report_cards` · branch +family

| Column | Type | Rules |
|---|---|---|
| result_id | uuid → results | required |
| student_id | uuid → students | required |
| template_id | uuid → report_card_templates | required |
| revision | int | required; matches the result's revision |
| document_id | uuid → generated_documents | optional; empty until generated |
| status | enum(pending, generated, failed, superseded) | default pending |
| acknowledged_by | uuid → profiles | optional; the guardian |
| acknowledged_at | timestamptz | optional |

Policy: a guardian may read their child's generated card of a published, not withheld result, and acknowledge it.
Unique: (result_id, revision).

#### `co_scholastic_areas` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation; "Punctuality", "Handwriting", "Sports" |
| name_ur | text | optional |
| scale | enum(a_to_e, stars_5, three_point, text) | default a_to_e |
| grade_ids | uuid[] | default empty; empty means all |
| sort_order | int | default 0 |
| is_active | bool | default true |

Policy: every member of the organisation may read, because the names label a child's scores; staff write, by permission.

#### `co_scholastic_scores` · branch +family

| Column | Type | Rules |
|---|---|---|
| result_set_id | uuid → result_sets | required |
| student_id | uuid → students | required |
| area_id | uuid → co_scholastic_areas | required |
| score | text | required; valid for the area's scale |
| entered_by | uuid → profiles | required |

Policy: families read with the published result.
Unique: (result_set_id, student_id, area_id).

#### `board_registrations` · branch +family

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| board_id | uuid → boards | required |
| level | enum(grade_5, grade_8, ssc_1, ssc_2) | required |
| exam_year | int | required |
| exam_session | enum(annual, supplementary) | default annual |
| subject_group_id | uuid → subject_groups | optional |
| registration_no | text | optional; given by the board |
| board_roll_no | text | optional |
| status | enum(pending, submitted, registered, rejected) | default pending |
| board_fee_paid | bool | default false |
| submitted_on | date | optional |
| note | text | optional |

Unique: (student_id, board_id, level, exam_year, exam_session) among live rows.

#### `board_results` · branch +family

| Column | Type | Rules |
|---|---|---|
| board_registration_id | uuid → board_registrations | required; unique |
| student_id | uuid → students | required |
| total_obtained | numeric(8,2) | optional |
| total_max | numeric(8,2) | optional |
| grade_letter | text | optional |
| grade_point | numeric(4,2) | optional |
| outcome | enum(awaited, pass, fail, compartment, absent, withheld) | default awaited |
| subjects | jsonb | default `[]`; `{ subject, obtained, max, grade }` |
| result_date | date | optional |
| file_id | uuid → files | optional; the scanned result card |

## 4 · Contracts

`packages/contracts/src/modules/results/`: `result-policies`, `result-sets`, `results`, `report-card-templates`, `report-cards`, `co-scholastic`, `board-registrations`, `board-results`.

- `ComputePreview`: per section — counts by outcome, students with missing marks, papers not locked, the top five. Nothing is saved.
- `ResultSheet` (the tabulation sheet): students down, subjects across, totals, percent, grade, position.
- `ResultCard` (family): the child's result with subjects, grade key, attendance, remarks and co-scholastic scores, or `{ withheld: true, note }`.
- `SaveRemarks`: `{ items: { resultId, teacherRemark?, teacherRemarkUr?, source }[] }`.
- `ResultAnalysis`: pass rate, average and grade distribution by section and by subject, compared with the previous result set of the same kind.

Calculation lives in one pure module, `packages/core/src/modules/results/compute.ts`, with no database access, so it is tested with plain inputs.

## 5 · Rules

- **R-results-1** A result set can be computed only when every paper of its exams for its grades is locked or cancelled. The preview lists what is missing.
- **R-results-2** A subject's marks are the sum of its components. With `components_pass_separately`, each component must reach its own pass marks.
- **R-results-3** For a term or annual set, each subject's percentage is the weighted average of its percentage in each component exam. An exam the student was exempt from, or not enrolled for, is left out and the remaining weights are scaled up.
- **R-results-4** A subject the student does not take is absent from the result. An `exempt` or `medical` paper leaves the subject out of the totals. An `absent` paper counts as zero, the subject is `absent`, and the outcome is `absent` when every paper was missed, otherwise it follows the pass rule.
- **R-results-5** Grace marks are added only when they turn a fail into a pass, within the policy's three limits, to the subjects with the smallest shortfall first. They are stored separately and printed only when the template says so.
- **R-results-6** A grade is found by matching the percentage against the scheme's bands on their lower bound, highest first, after rounding to `percent_decimals`.
- **R-results-7** Outcome: `pass` by the policy's rule; `compartment` when failed subjects are within `compartment_max_subjects`; otherwise `fail`. `incomplete` when a required paper has no entry at all.
- **R-results-8** Positions are given by percentage, then by total marks. Ties share a position by the policy's method. Students who are `absent`, `incomplete`, withheld, or (with `positions_need_pass`) not passed get none.
- **R-results-9** Publishing copies the policy and the grade bands into `frozen_rules`. A published result is never recalculated from live settings. A correction to a locked mark recomputes that one student from the frozen rules, raises `revision`, marks the old report card `superseded`, generates a new one and notifies the guardian. Positions of other students are recomputed too, and every change is listed in the audit.
- **R-results-10** A result can be withheld before or after publishing. The family then sees only that it is withheld and why. With `results.withhold_on_dues` on, students with dues older than the configured months are suggested for withholding at publish; a person confirms.
- **R-results-11** Computing again before publishing replaces the previous computation completely, but keeps remarks and co-scholastic scores.
- **R-results-12** Remarks are written by the class teacher for their own section. An AI draft is stored only once the teacher accepts it, with `remark_source` saying whether it was edited.
- **R-results-13** Publishing requires `under_review` sign-off by someone with `results:publish`, and can be scheduled. At publish the exams of an `exam` set become `published`.
- **R-results-14** Withdrawing a published set hides it from families at once and is used only to fix a wide mistake; it needs a reason and is audited.
- **R-results-15** Report cards are generated in a job, a section at a time. A card that fails is marked `failed` and can be retried alone. Families can open a card only after its PDF exists.
- **R-results-16** An annual result with outcome and percentage is what the promotion batch in [M07](m07-students.md) reads to suggest promote, detain or conditional.
- **R-results-17** A board registration needs the student's B-Form number and photo; missing items are listed before submission. The registration number is unique per board.
- **R-results-18** Board results are entered by hand or imported from a file; they never change the school's own results.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `result-policies:manage` | Maintain result policies | academic_head, exam_controller |
| `results:read` | See results in scope, including withheld ones | LEADERS, ACADEMIC, TEACHERS |
| `results:compute` | Create result sets, preview and compute | exam_controller, coordinator |
| `results:publish` | Publish, schedule and withdraw | principal, academic_head, exam_controller |
| `results:withhold` | Withhold and release a student's result | ADMINS, exam_controller, ACCOUNTS |
| `results:remarks` | Write remarks and co-scholastic scores for one's own section | class_teacher, section_head |
| `report-card-templates:manage` | Maintain templates | academic_head, exam_controller |
| `report-cards:generate` | Generate and regenerate report cards | exam_controller, coordinator, class_teacher |
| `board-registrations:manage` | Maintain board registrations and results | exam_controller, branch_admin |
| `results:export` | Export result sheets and analysis | ADMINS, ACADEMIC |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/result-policies` | `results:read` | Lists |
| POST | `/result-policies` | `result-policies:manage` | Creates |
| PATCH | `/result-policies/[id]` | `result-policies:manage` | Edits |
| GET | `/result-sets` | `results:read` | Lists |
| POST | `/result-sets` | `results:compute` | Creates a draft |
| GET | `/result-sets/[id]` | `results:read` | One set with counts |
| PATCH | `/result-sets/[id]` | `results:compute` | Edits a draft |
| PUT | `/result-sets/[id]/components` | `results:compute` | Sets exams and weights |
| GET | `/result-sets/[id]/preview` | `results:compute` | What computing would give |
| POST | `/result-sets/[id]/compute` | `results:compute` | Computes |
| POST | `/result-sets/[id]/submit` | `results:compute` | Sends for review |
| POST | `/result-sets/[id]/publish` | `results:publish` | Publishes now or at `publishAt` |
| POST | `/result-sets/[id]/withdraw` | `results:publish` | Withdraws |
| GET | `/result-sets/[id]/sheet` | `results:read` | The tabulation sheet for a section |
| GET | `/result-sets/[id]/analysis` | `results:read` | Analysis |
| GET | `/results/[id]` | `results:read` | One student's result |
| POST | `/results/[id]/withhold` | `results:withhold` | Withholds |
| POST | `/results/[id]/release` | `results:withhold` | Releases |
| GET | `/result-sets/[id]/remarks` | `results:remarks` | Remarks for my section |
| PUT | `/result-sets/[id]/remarks` | `results:remarks` | Saves remarks |
| GET | `/result-sets/[id]/co-scholastic` | `results:remarks` | Scores for my section |
| PUT | `/result-sets/[id]/co-scholastic` | `results:remarks` | Saves scores |
| GET | `/co-scholastic-areas` | `results:read` | Lists |
| POST | `/co-scholastic-areas` | `result-policies:manage` | Creates |
| PATCH | `/co-scholastic-areas/[id]` | `result-policies:manage` | Edits |
| GET | `/report-card-templates` | `results:read` | Lists |
| POST | `/report-card-templates` | `report-card-templates:manage` | Creates |
| PATCH | `/report-card-templates/[id]` | `report-card-templates:manage` | Edits |
| POST | `/report-card-templates/[id]/preview` | `report-card-templates:manage` | A sample PDF with sample data |
| POST | `/result-sets/[id]/report-cards` | `report-cards:generate` | Queues cards for a section or the whole set |
| POST | `/report-cards/[id]/retry` | `report-cards:generate` | Regenerates one |
| GET | `/students/[id]/results` | `results:read` | A student's results across years |
| GET | `/board-registrations` | `results:read` | Lists; filter by level, year, status |
| POST | `/board-registrations` | `board-registrations:manage` | Creates one or many for a grade |
| PATCH | `/board-registrations/[id]` | `board-registrations:manage` | Edits |
| GET | `/board-registrations/export` | `board-registrations:manage` | The list in the board's column order |
| PUT | `/board-registrations/[id]/result` | `board-registrations:manage` | Records the board result |
| POST | `/board-results/import` | `board-registrations:manage` | Imports results from a file |
| GET | `/results/export` | `results:export` | Exports |
| GET | `/family/children/[id]/results` | `signed-in` | A child's published results |
| GET | `/family/results/[id]` | `signed-in` | One result card |
| POST | `/family/report-cards/[id]/acknowledge` | `signed-in` | Confirms it was seen |

Idempotent: `POST /result-sets/[id]/compute`, `POST /result-sets/[id]/publish`, `POST /result-sets/[id]/report-cards`.

## 8 · Client layer

Custom hooks: `useResultSet`, `useComputePreview`, `useComputeResults` (starts a job and polls), `usePublishResults`, `useResultSheet`, `useResultAnalysis`, `useRemarks`, `useSaveRemarks` (autosave), `useDraftRemarks` (AI, returns drafts to accept), `useGenerateReportCards`, `useReportCardProgress`, `useStudentResults`, `useBoardRegistrations`, `useChildResults`, `useResultCard`.

## 9 · Screens

Built in [Phase 8](../20-phases/phase-08-academics.md), [Phase 13](../20-phases/phase-13-teacher-portal.md), [Phase 14](../20-phases/phase-14-family-portals.md) and [Phase 16](../20-phases/phase-16-documents-and-printing.md).

| Screen | Pattern | Where |
|---|---|---|
| Results | List | `/school/exams/results` |
| Result set | Wizard then Detail | Choose exams and weights, preview, compute, review, publish. Tabs: Sheet, Analysis, Withheld, Report cards |
| Tabulation sheet | Grid | Students down, subjects across; failed cells marked; export and print |
| Result analysis | Report | Pass rate, grade distribution, subject averages, comparison with the last result |
| Report card templates | List + Form page | Live preview beside the options |
| Policies and co-scholastic areas | Settings | `/school/settings/results` |
| Board registrations | List | By level and year; missing B-Form or photo flagged; export for the board |
| **Teacher:** Remarks | Grid editor | One row per student with marks summary beside a remark box; "Draft with AI" fills suggestions to accept, edit or discard |
| **Parent:** Results | List + Detail | The card on screen; download the PDF; acknowledge |
| **Student:** My results | List + Detail | Same card, plus a subject trend chart |

## 10 · Notifications and jobs

Events: `result.published` (to guardians, with the percentage only if `results.show_marks_in_message`), `result.revised`, `result.withheld`, `result.released`, `report-card.ready`, `remarks.due` (to class teachers), `board-registration.missing-items`, `board-result.recorded`.

Jobs: `results.compute` (queued per result set), `results.publish-scheduled` (every 5 minutes), `results.generate-report-cards` (per section), `results.remarks-reminders`.

Documents: report card (five layouts), tabulation sheet, result analysis, board registration list.

## 11 · Offline

None. Published results a guardian has opened are readable offline in the mobile app.

## 12 · AI

- Report-card remarks in English and Urdu from marks, attendance and behaviour (A6). The model sees the student's first name only, and no family details.
- Result analysis in plain words for the principal (A9).

## 13 · Failure cases

- **F-results-1** Compute is pressed twice → the second call returns the running job; one computation happens.
- **F-results-2** A mark is corrected after publishing → one student recomputed from frozen rules; a new revision; the guardian is told the result was revised.
- **F-results-3** The grading scheme is edited after publishing → published results do not change; a new result set uses the new scheme.
- **F-results-4** A student has no marks for any paper (joined last week) → outcome `incomplete`; not ranked; no report card until a person decides.
- **F-results-5** The weights of a term result add to 90 → refused before computing.
- **F-results-6** PDF generation fails for 3 of 240 cards → those three show `failed` with a retry; the rest are issued.
- **F-results-7** Two students tie for first → both get position 1; the next gets 2 or 3 by the policy.
- **F-results-8** A guardian opens a withheld result → they see "Withheld" with the note and, when it is for dues, a link to the fee screen.
- **F-results-9** A class teacher has not written remarks at publish time → publishing warns with the count and may proceed; cards print without a remark.
- **F-results-10** A student changes section between exam and computation → the result is counted and ranked in the current section; the sheet shows a marker.

## 14 · Seed data

Two result policies (primary: aggregate only, no grace; board classes: every subject, theory and practical separate, grace up to 5 marks in 2 subjects, one compartment subject). Eight co-scholastic areas. Three report card templates. Per branch: two published monthly results, one published first-term result with report cards (two withheld for dues, one revised), one computed result waiting for review, an annual result set in draft with weights. Board registrations for Grades 5, 8, 9 and 10, with last year's board results.

## 15 · Tests

- **T-results-1** `compute.ts` table tests: every pass rule, components, exempt, absent, medical, grace limits, rounding.
- **T-results-2** Band matching on fractional percentages at every boundary of both seeded schemes.
- **T-results-3** Weighted term results; missing exam rescales weights.
- **T-results-4** Positions: dense and competition, ties, excluded students, both scopes.
- **T-results-5** Compute refused while a paper is unlocked; recompute keeps remarks.
- **T-results-6** Publish freezes rules; later scheme edits change nothing.
- **T-results-7** Correction after publish: revision, superseded card, recomputed positions, audit.
- **T-results-8** Withheld: the family response contains no marks at all.
- **T-results-9** Families read only published sets; only their own children.
- **T-results-10** Remarks only for one's own section; AI drafts are not stored until accepted.
- **T-results-11** Report card job: partial failure and retry.
- **T-results-12** Board registration uniqueness and missing-item checks.
- **T-results-13** Row-level security and branch scope.

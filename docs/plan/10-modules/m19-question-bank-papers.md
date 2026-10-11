# M19 · Question bank and papers

## 1 · Purpose

A bank of questions tagged by subject, topic, type and difficulty, and a builder that turns them into a printed question paper following a board pattern. Papers stay confidential until the exam.

## 2 · Depends on

[M11](m11-academic-structure.md), [M13](m13-syllabus-lesson-plans.md) (units and outcomes), [M26](m26-staff-recruitment.md) (`staff`), [M00](m00-shared-kernel.md) (files, documents). Used by [M16](m16-lms.md) and [M17](m17-exams-marks.md).

## 3 · Tables

#### `questions` · org

| Column | Type | Rules |
|---|---|---|
| grade_subject_id | uuid → grade_subjects | required |
| unit_id | uuid → syllabus_units | optional |
| outcome_id | uuid → learning_outcomes | optional |
| type | enum(mcq, true_false, fill_blank, match, short, long, numerical) | required |
| text | text | required; rich text; equations as LaTeX |
| text_ur | text | optional |
| options | jsonb | default `[]`; `{ key, text, textUr? }`; required for `mcq` and `match` |
| answer | jsonb | optional; the key or a model answer |
| marking_scheme | text | optional |
| marks | numeric(5,2) | required; > 0 |
| difficulty | enum(easy, medium, hard) | default medium |
| cognitive_level | enum(knowledge, understanding, application) | default understanding |
| source | enum(written, imported, ai, past_paper) | default written |
| source_note | text | optional; "BISE Lahore, Annual 2024" |
| status | enum(draft, pending_review, approved, retired) | default draft |
| reviewed_by | uuid → profiles | optional |
| reviewed_at | timestamptz | optional |
| created_by_staff_id | uuid → staff | optional |
| times_used | int | default 0 |
| last_used_on | date | optional |

Policy: staff only. Never readable by students or guardians.
Index: (org_id, grade_subject_id, unit_id, type, status); full-text on `text`.

#### `paper_blueprints` · org
A paper pattern: sections, question types, counts and marks.

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation |
| grade_subject_id | uuid → grade_subjects | optional; empty for a pattern reusable across subjects |
| board_id | uuid → boards | optional |
| total_marks | numeric(6,2) | required |
| duration_minutes | int | required |
| sections | jsonb | required; `{ title, instructions?, type, count, attempt?, marksEach, difficulty?: { easy, medium, hard } }[]` |
| unit_weights | jsonb | default `[]`; `{ unitId, percent }` |
| is_active | bool | default true |

#### `question_papers` · branch

| Column | Type | Rules |
|---|---|---|
| grade_subject_id | uuid → grade_subjects | required |
| blueprint_id | uuid → paper_blueprints | optional |
| title | text | required |
| set_label | text | optional; "A", "B" |
| total_marks | numeric(6,2) | required |
| duration_minutes | int | required |
| instructions | text | optional |
| language | enum(en, ur, both) | default en |
| status | enum(draft, in_review, approved, printed, used, archived) | default draft |
| is_confidential | bool | default true |
| opens_on | date | optional; the exam date, after which confidentiality ends |
| created_by_staff_id | uuid → staff | required |
| approved_by | uuid → profiles | optional |
| approved_at | timestamptz | optional |
| document_id | uuid → generated_documents | optional; the paper |
| key_document_id | uuid → generated_documents | optional; the answer key |

Policy: while confidential and before `opens_on`, readable only by its creator, the approver and holders of `question-papers:read-all`. After that, staff of the branch.
Index: (org_id, branch_id, grade_subject_id, status).

#### `paper_sections` · branch

| Column | Type | Rules |
|---|---|---|
| question_paper_id | uuid → question_papers | required |
| sort_order | int | required |
| title | text | required; "Section A: Objective" |
| instructions | text | optional; "Attempt any five" |
| attempt_count | int | optional; fewer than the questions in the section |
| marks_each | numeric(5,2) | optional |

Policy: follows its paper.

#### `paper_questions` · branch
A frozen copy of each question as it appears on the paper.

| Column | Type | Rules |
|---|---|---|
| question_paper_id | uuid → question_papers | required |
| paper_section_id | uuid → paper_sections | required |
| question_id | uuid → questions | optional; the bank question it came from |
| sort_order | int | required |
| number_label | text | required; "Q3", "Q5 (b)" |
| type | text | required |
| text | text | required |
| text_ur | text | optional |
| options | jsonb | default `[]` |
| answer | jsonb | optional |
| marks | numeric(5,2) | required |
| unit_id | uuid → syllabus_units | optional |
| outcome_id | uuid → learning_outcomes | optional |
| is_ai_written | bool | default false |
| ai_accepted_by | uuid → profiles | optional |
| ai_accepted_at | timestamptz | optional |

Policy: follows its paper.

## 4 · Contracts

`packages/contracts/src/modules/question-bank/`: `questions`, `paper-blueprints`, `question-papers`.

- `QuestionFilters`: grade subject, unit, outcome, type, difficulty, cognitive level, status, source, not used since a date, text search.
- `BlueprintCoverage`: for a blueprint and grade subject — per section, how many approved questions the bank has against how many are needed, by topic.
- `AutoFillPaper`: `{ blueprintId, unitIds?, excludeUsedSince?, allowAi }` → a draft paper with any gaps listed.
- `PaperCheck`: totals against the blueprint, duplicates, questions used recently, unaccepted AI questions, missing answers.

Settings: `question_bank.reuse_gap_months` (default 12), `question_bank.review_required` (default true), `question_bank.unlock_days_before` (default 0; days before the exam when invigilators may see the paper).

## 5 · Rules

- **R-qbank-1** A teacher adds questions for subjects they teach; they enter the bank as `pending_review` (or `approved` when `question_bank.review_required` is off). Review is by a coordinator, academic head or exam controller, never by the author.
- **R-qbank-2** Only `approved` questions can be placed on a paper or in a quiz. A retired question stays on papers that already used it.
- **R-qbank-3** An approved question that has been used cannot be edited; "Edit" creates a new draft version and retires the old one once the new one is approved.
- **R-qbank-4** An `mcq` needs two to six options and exactly one correct key; `true_false` needs its answer; `match` needs equal lists.
- **R-qbank-5** Questions written by AI enter the bank as `pending_review` with `source = ai`, and on a paper carry `is_ai_written`. A paper cannot be approved while any AI-written question on it is not individually accepted.
- **R-qbank-6** Placing a question copies it to `paper_questions`. Later changes to the bank never alter a paper.
- **R-qbank-7** The paper check must pass before review: the total equals `total_marks`; each section's question count and marks agree with its instructions; no question appears twice.
- **R-qbank-8** A question used for the same grade within `question_bank.reuse_gap_months` gives a warning, not a block.
- **R-qbank-9** Approval is by a different person than the author. Any edit after approval returns the paper to `draft`.
- **R-qbank-10** Every open, download and print of a confidential paper is written to the audit log with the person and time. The PDF carries a faint watermark of who generated it.
- **R-qbank-11** Linking a paper to an exam paper ([M17](m17-exams-marks.md)) sets `opens_on` to the paper date and the paper becomes `used` when that date passes; the questions' `times_used` and `last_used_on` are then updated.
- **R-qbank-12** A paper can have sets (A, B) that share the questions in a different order; each set is its own row with the same blueprint.
- **R-qbank-13** Questions can be imported from a spreadsheet through the import pipeline ([M00](m00-shared-kernel.md)); imported rows are `pending_review`.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `questions:read` | Search the bank | TEACHERS, ACADEMIC |
| `questions:create` | Add questions; edit one's own drafts | TEACHERS, ACADEMIC |
| `questions:review` | Approve, reject and retire | academic_head, coordinator, exam_controller |
| `questions:import` | Import questions | academic_head, coordinator |
| `paper-blueprints:manage` | Maintain blueprints | academic_head, exam_controller |
| `question-papers:create` | Build one's own papers and send for review | TEACHERS, ACADEMIC |
| `question-papers:approve` | Approve or return papers | academic_head, exam_controller, section_head |
| `question-papers:read-all` | See every paper, including confidential ones | exam_controller, principal |
| `question-papers:print` | Generate the PDF and answer key of an approved paper | exam_controller, coordinator |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/questions` | `questions:read` | Searches the bank |
| POST | `/questions` | `questions:create` | Creates |
| GET | `/questions/[id]` | `questions:read` | One question with where it was used |
| PATCH | `/questions/[id]` | `questions:create` | Edits a draft, or starts a new version |
| DELETE | `/questions/[id]` | `questions:create` | Deletes an unused draft |
| POST | `/questions/[id]/submit` | `questions:create` | Sends for review |
| POST | `/questions/review` | `questions:review` | Approves or rejects many |
| POST | `/questions/[id]/retire` | `questions:review` | Retires |
| POST | `/questions/import` | `questions:import` | Starts an import |
| GET | `/questions/coverage` | `questions:read` | Counts by topic, type and difficulty |
| GET | `/paper-blueprints` | `questions:read` | Lists |
| POST | `/paper-blueprints` | `paper-blueprints:manage` | Creates |
| PATCH | `/paper-blueprints/[id]` | `paper-blueprints:manage` | Edits |
| GET | `/paper-blueprints/[id]/coverage` | `questions:read` | Whether the bank can fill it |
| GET | `/question-papers` | `question-papers:create` | Lists the papers I may see |
| POST | `/question-papers` | `question-papers:create` | Creates a draft |
| POST | `/question-papers/auto-fill` | `question-papers:create` | Fills a draft from a blueprint |
| GET | `/question-papers/[id]` | `question-papers:create` | One paper with its sections and questions |
| PATCH | `/question-papers/[id]` | `question-papers:create` | Edits details |
| PUT | `/question-papers/[id]/content` | `question-papers:create` | Saves sections and questions |
| POST | `/question-papers/[id]/accept-ai` | `question-papers:create` | Accepts or rejects AI-written questions one by one |
| GET | `/question-papers/[id]/check` | `question-papers:create` | Runs the paper check |
| POST | `/question-papers/[id]/submit` | `question-papers:create` | Sends for review |
| POST | `/question-papers/[id]/approve` | `question-papers:approve` | Approves |
| POST | `/question-papers/[id]/return` | `question-papers:approve` | Returns with comments |
| POST | `/question-papers/[id]/sets` | `question-papers:create` | Creates a shuffled set |
| POST | `/question-papers/[id]/print` | `question-papers:print` | Generates the paper and the key |
| POST | `/question-papers/[id]/archive` | `question-papers:create` | Archives |

## 8 · Client layer

Custom hooks: `useQuestions(filters)`, `useQuestionEditor`, `useReviewQuestions`, `useQuestionCoverage`, `useBlueprintCoverage`, `usePaper`, `useSavePaperContent` (autosave), `useAutoFillPaper`, `usePaperCheck`, `useAcceptAiQuestions`, `usePrintPaper`.

## 9 · Screens

Built in [Phase 8](../20-phases/phase-08-academics.md) and [Phase 13](../20-phases/phase-13-teacher-portal.md).

| Screen | Pattern | Where |
|---|---|---|
| Question bank | List | `/school/exams/questions` and `/teach/questions`: filters on the left; each row shows the question, type, marks and tags |
| Question editor | Form page | Type first; options and key; English and Urdu side by side; equation and image tools; a live preview as printed |
| Review queue | List | Approve, reject with a note, or edit and approve |
| Coverage | Report | A heat map: topics down, question types across |
| Blueprints | List + Form page | Section builder with a running total against `total_marks` |
| Paper builder | Grid editor | Sections on the left; the bank on the right, filtered to the section's type; drag in; reorder; marks total in the header; AI-written questions marked until accepted |
| Paper preview | Detail | As printed, with header, instructions and, separately, the key |
| Papers | List | Mine and, for the exam controller, all; status and exam date |

## 10 · Notifications and jobs

Events: `question.review-requested`, `question.reviewed`, `question-paper.review-requested`, `question-paper.returned`, `question-paper.approved`, `question-paper.due` (to the teacher, when an exam paper has no question paper 7 and 3 days before).

Jobs: `qbank.mark-used` (daily), `qbank.paper-due-reminders` (daily 08:00).

Documents: question paper (English, Urdu or both; one or two columns), answer key, marking scheme.

## 11 · Offline

None.

## 12 · AI

- Filling a blueprint from the bank and writing new questions only where the bank is thin, saying which ones are new (A5).
- Writing questions for a topic, with a key and marking scheme, into the review queue.
- Tagging imported questions with a likely topic, shown as a suggestion.

## 13 · Failure cases

- **F-qbank-1** The bank has four short questions for a section that needs eight → auto-fill places four and lists the gap; with AI allowed it drafts four more, marked for acceptance.
- **F-qbank-2** A teacher tries to approve their own paper → refused.
- **F-qbank-3** A question on an approved paper is edited in the bank → the paper is unchanged.
- **F-qbank-4** A paper is approved, then a section is reordered → status returns to `draft` and the approver is told.
- **F-qbank-5** Another teacher opens a confidential paper's link → `NOT_FOUND`; the attempt is logged.
- **F-qbank-6** The paper PDF fails to render an equation → generation fails with the question number; nothing is issued.
- **F-qbank-7** An import has 30 rows with no correct option → those rows are rejected with the reason; the others import.
- **F-qbank-8** The exam date moves → `opens_on` follows the exam paper.

## 14 · Seed data

About 1,500 questions across Grades 5 to 10 in five subjects, in every type, difficulty and status, with Urdu text for Urdu and Islamiyat. Six blueprints including board patterns for Grade 9 and 10 Mathematics, Physics and English. Twelve papers in every status, two with A and B sets, one with unaccepted AI-written questions, three linked to the scheduled exam.

## 15 · Tests

- **T-qbank-1** Type validation for every question type.
- **T-qbank-2** Review by another person; only approved questions usable.
- **T-qbank-3** Editing a used question creates a new version.
- **T-qbank-4** The paper snapshot does not change with the bank.
- **T-qbank-5** Paper check: totals, section counts, duplicates.
- **T-qbank-6** A paper with an unaccepted AI question cannot be approved.
- **T-qbank-7** Confidentiality: creator, approver and read-all only before `opens_on`; every access audited.
- **T-qbank-8** Auto-fill respects types, difficulty mix, unit weights and the reuse gap, and reports gaps.
- **T-qbank-9** Students and guardians can read nothing in this module.
- **T-qbank-10** Row-level security and branch scope.

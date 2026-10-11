# M16 · Learning (LMS)

## 1 · Purpose

Study material and online quizzes: notes, files, videos and links organised by subject and topic; quizzes that mark themselves; and links to live classes. It supports classroom teaching; it does not replace it.

## 2 · Depends on

[M07](m07-students.md), [M11](m11-academic-structure.md), [M13](m13-syllabus-lesson-plans.md), [M19](m19-question-bank-papers.md) (`questions`), [M00](m00-shared-kernel.md) (files).

## 3 · Tables

#### `learning_resources` · org
Shared across branches unless limited to sections.

| Column | Type | Rules |
|---|---|---|
| grade_subject_id | uuid → grade_subjects | required |
| unit_id | uuid → syllabus_units | optional |
| title | text | required |
| description | text | optional |
| kind | enum(file, link, video, note) | required |
| url | text | optional; required for `link` and `video`; `https` only |
| body | text | optional; required for `note`; rich text |
| file_id | uuid → files | optional; required for `file` |
| audience | enum(teachers, students) | default students |
| section_ids | uuid[] | default empty; empty means every section of the grade |
| created_by_staff_id | uuid → staff | required |
| status | enum(draft, published, archived) | default draft |
| published_at | timestamptz | optional |

Policy: staff; a student or guardian may read published `students` resources for a grade subject their child takes, in an allowed section.
Index: (org_id, grade_subject_id, unit_id, status).

#### `resource_views` · org +family append-only

| Column | Type | Rules |
|---|---|---|
| resource_id | uuid → learning_resources | required |
| student_id | uuid → students | required |
| viewed_at | timestamptz | required |

Policy: a student or guardian may insert for their own student.
Index: (org_id, resource_id); (org_id, student_id, viewed_at).

#### `quizzes` · branch

| Column | Type | Rules |
|---|---|---|
| grade_subject_id | uuid → grade_subjects | required |
| section_ids | uuid[] | required; at least one |
| created_by_staff_id | uuid → staff | required |
| title | text | required |
| instructions | text | optional |
| unit_id | uuid → syllabus_units | optional |
| opens_at | timestamptz | required |
| closes_at | timestamptz | required; after `opens_at` |
| duration_minutes | int | optional; empty means untimed within the window |
| attempts_allowed | int | default 1; 1 to 5 |
| shuffle_questions | bool | default true |
| shuffle_options | bool | default true |
| show_answers | enum(never, after_submit, after_close) | default after_close |
| pass_percent | numeric(5,2) | default 40 |
| status | enum(draft, published, closed) | default draft |

Policy: staff of the branch; a student or guardian may read published quizzes for their sections.

#### `quiz_questions` · branch
A frozen copy, so later edits to the bank never change a quiz already taken.

| Column | Type | Rules |
|---|---|---|
| quiz_id | uuid → quizzes | required |
| question_id | uuid → questions | optional; the bank question it came from |
| sort_order | int | required |
| type | enum(mcq, true_false, fill_blank, short) | required |
| text | text | required |
| text_ur | text | optional |
| options | jsonb | default `[]`; `{ key, text }` |
| correct | jsonb | required; never sent to students before answers are shown |
| marks | numeric(5,2) | required; > 0 |

Policy: staff only. Students receive questions through the attempt route, which strips `correct`.

#### `quiz_attempts` · branch +family

| Column | Type | Rules |
|---|---|---|
| quiz_id | uuid → quizzes | required |
| student_id | uuid → students | required |
| attempt_no | int | required; 1, 2… |
| started_at | timestamptz | required |
| deadline_at | timestamptz | required; set by the server at start |
| submitted_at | timestamptz | optional |
| status | enum(in_progress, submitted, auto_submitted, graded) | default in_progress |
| question_order | uuid[] | required; this attempt's shuffled order |
| score | numeric(6,2) | optional |
| max_score | numeric(6,2) | required |

Policy: a student or guardian may read the attempts of their own students, start one (status `in_progress`) and hand it in while it is in progress; after that only staff change it.
Unique: (quiz_id, student_id, attempt_no).

#### `quiz_answers` · branch +family

| Column | Type | Rules |
|---|---|---|
| attempt_id | uuid → quiz_attempts | required |
| student_id | uuid → students | required |
| quiz_question_id | uuid → quiz_questions | required |
| answer | jsonb | optional |
| is_correct | bool | optional; empty until graded |
| marks_awarded | numeric(5,2) | optional |
| graded_by | uuid → profiles | optional; short answers |

Policy: a student may insert and update their own answers while the attempt is `in_progress` and before `deadline_at`.
Unique: (attempt_id, quiz_question_id).

#### `live_classes` · branch

| Column | Type | Rules |
|---|---|---|
| section_subject_id | uuid → section_subjects | required |
| title | text | required |
| starts_at | timestamptz | required |
| ends_at | timestamptz | required; after `starts_at` |
| platform | enum(zoom, meet, teams, other) | required |
| join_url | text | required; `https` only |
| recording_url | text | optional |
| status | enum(scheduled, cancelled, completed) | default scheduled |

Policy: staff of the branch; students and guardians of the section may read.

## 4 · Contracts

`packages/contracts/src/modules/lms/`: `learning-resources`, `quizzes`, `quiz-questions`, `quiz-attempts`, `live-classes`.

- `StartAttempt` → `{ attempt, questions: QuestionForStudent[] }` where `QuestionForStudent` has no `correct`.
- `SaveAnswer`: `{ quizQuestionId, answer }` — autosaved as the student moves between questions.
- `QuizResult`: score, pass or fail, and per-question review only when `show_answers` allows it now.
- `QuizAnalysis` (teacher): average, pass rate, hardest questions, students who did not attempt.

## 5 · Rules

- **R-lms-1** A teacher creates resources and quizzes only for grade subjects they teach; a coordinator or academic head for any.
- **R-lms-2** A student sees a resource only if it is published, for students, for a subject they take (`subjectsFor`), and their section is allowed.
- **R-lms-3** A link or video URL must be `https`. Video is embedded only from an allow-list (YouTube, Vimeo, Google Drive); anything else opens as a link.
- **R-lms-4** A quiz can be published only with at least one question and a window in the future or present. Publishing freezes its questions.
- **R-lms-5** A quiz with any attempt cannot have its questions, marks or window start changed. Its close time can be extended.
- **R-lms-6** An attempt can start only inside the window, only by a student of an allowed section who takes the subject, and only while attempts remain.
- **R-lms-7** `deadline_at` is the earlier of `started_at + duration` and the quiz's `closes_at`. It is set by the server. An answer arriving after it (with 15 seconds' grace) is refused.
- **R-lms-8** An attempt still `in_progress` after its deadline is submitted automatically with the answers saved so far.
- **R-lms-9** Objective questions are graded on submit. `fill_blank` compares after trimming and ignoring case, against a list of accepted answers. Short answers wait for the teacher.
- **R-lms-10** The best attempt counts as the student's score.
- **R-lms-11** Correct answers reach a student only as `show_answers` allows: never, straight after they submit, or once the quiz has closed for everyone.
- **R-lms-12** A student who leaves and returns during an attempt resumes it with the same question order and remaining time.
- **R-lms-13** Quiz scores stay in this module. They enter a report card only if the teacher records them against an exam paper in [M17](m17-exams-marks.md).
- **R-lms-14** A live class is a link only. Takhti records that it was scheduled, not who joined.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `learning-resources:read` | See all resources, including teacher-only ones | ALL_STAFF |
| `learning-resources:create` | Add, edit and archive one's own resources | TEACHERS, ACADEMIC |
| `learning-resources:manage` | Edit or archive anyone's resources | academic_head, coordinator |
| `quizzes:read` | See quizzes and results in scope | TEACHERS, ACADEMIC, LEADERS |
| `quizzes:create` | Create, publish, grade and close one's own quizzes | TEACHERS |
| `quizzes:manage` | Edit or close any quiz in the branch | academic_head, coordinator |
| `live-classes:create` | Schedule and cancel live classes | TEACHERS, coordinator |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/learning-resources` | `learning-resources:read` | Lists; filter by grade subject, topic, kind, status |
| POST | `/learning-resources` | `learning-resources:create` | Creates |
| GET | `/learning-resources/[id]` | `learning-resources:read` | One resource with view counts |
| PATCH | `/learning-resources/[id]` | `learning-resources:create` | Edits |
| POST | `/learning-resources/[id]/publish` | `learning-resources:create` | Publishes |
| POST | `/learning-resources/[id]/archive` | `learning-resources:create` | Archives |
| GET | `/quizzes` | `quizzes:read` | Lists |
| POST | `/quizzes` | `quizzes:create` | Creates a draft |
| GET | `/quizzes/[id]` | `quizzes:read` | One quiz with its questions |
| PATCH | `/quizzes/[id]` | `quizzes:create` | Edits |
| PUT | `/quizzes/[id]/questions` | `quizzes:create` | Sets the questions, from the bank or written here |
| POST | `/quizzes/[id]/publish` | `quizzes:create` | Publishes |
| POST | `/quizzes/[id]/extend` | `quizzes:create` | Moves the close time later |
| POST | `/quizzes/[id]/close` | `quizzes:create` | Closes now |
| DELETE | `/quizzes/[id]` | `quizzes:create` | Deletes a draft |
| GET | `/quizzes/[id]/attempts` | `quizzes:read` | Attempts with scores |
| GET | `/quizzes/[id]/analysis` | `quizzes:read` | Class analysis |
| PUT | `/quiz-attempts/[id]/grades` | `quizzes:create` | Grades short answers |
| GET | `/live-classes` | `signed-in` | Upcoming live classes in scope |
| POST | `/live-classes` | `live-classes:create` | Schedules |
| PATCH | `/live-classes/[id]` | `live-classes:create` | Edits or adds the recording link |
| POST | `/live-classes/[id]/cancel` | `live-classes:create` | Cancels |
| GET | `/learn/resources` | `signed-in` | The student's resources by subject and topic |
| POST | `/learn/resources/[id]/viewed` | `signed-in` | Records a view |
| GET | `/learn/quizzes` | `signed-in` | The student's open, upcoming and past quizzes |
| POST | `/learn/quizzes/[id]/start` | `signed-in` | Starts or resumes an attempt |
| PUT | `/learn/quiz-attempts/[id]/answers` | `signed-in` | Saves one answer |
| POST | `/learn/quiz-attempts/[id]/submit` | `signed-in` | Submits |
| GET | `/learn/quiz-attempts/[id]` | `signed-in` | The result, with review when allowed |
| GET | `/family/children/[id]/learning` | `signed-in` | A child's resources viewed and quiz results |

Idempotent: `POST /learn/quizzes/[id]/start`, `POST /learn/quiz-attempts/[id]/submit`.

## 8 · Client layer

Generated CRUD for resources and live classes. Custom hooks: `useQuiz`, `useSetQuizQuestions`, `usePublishQuiz`, `useQuizAnalysis`, `useGradeShortAnswers`, `useMyResources`, `useMarkViewed`, `useMyQuizzes`, `useStartAttempt`, `useSaveAnswer` (debounced, queued when offline for a few seconds), `useSubmitAttempt`, `useAttemptClock` (counts down to the server's `deadlineAt`).

## 9 · Screens

Built in [Phase 8](../20-phases/phase-08-academics.md), [Phase 13](../20-phases/phase-13-teacher-portal.md) and [Phase 14](../20-phases/phase-14-family-portals.md).

| Screen | Pattern | Where |
|---|---|---|
| Library of resources | List | `/school/academics/learning`: by grade subject and topic; views |
| **Teacher:** Resources | List + Form page | `/teach/resources` |
| **Teacher:** Quiz builder | Wizard | Details, pick questions from the bank or write them, preview as a student, publish |
| **Teacher:** Quiz results | Report | Scores, analysis, short answers to grade |
| **Student:** Learn | Dashboard | `/learn`: subjects as tiles; topics; resources; "continue where you left off" |
| **Student:** Take quiz | Wizard | One question per screen on a phone; a clock; a question palette; autosave indicator; confirm before submit |
| **Student:** Quiz result | Detail | Score; review when allowed |
| **Parent:** Learning | List | What the child viewed and scored |

## 10 · Notifications and jobs

Events: `resource.published` (in the diary digest), `quiz.published`, `quiz.closing-soon` (2 hours before close, to students who have not attempted), `quiz.graded`, `live-class.scheduled`, `live-class.cancelled`, `live-class.starting` (15 minutes before).

Jobs: `lms.auto-submit` (every minute), `lms.close-quizzes` (every 5 minutes), `lms.closing-reminders`.

## 11 · Offline

Resources of kind `note` and already-opened files are readable offline in the student app. Quizzes need a connection; a brief drop during an attempt is covered by local answer queuing and the server-side deadline.

## 12 · AI

- Generating quiz questions for a topic into the bank as `pending_review` (A5).
- The student-facing study assistant limited to the school's syllabus ([15](../00-foundation/15-ai-design.md)).

## 13 · Failure cases

- **F-lms-1** A student's connection drops with 4 minutes left → answers already saved are kept; on return they resume; if they do not return, the attempt auto-submits at the deadline.
- **F-lms-2** A student changes their device clock → irrelevant; the deadline is checked on the server.
- **F-lms-3** A student opens the quiz in two tabs → both show the same attempt; the latest saved answer per question wins.
- **F-lms-4** A teacher finds a wrong answer key after 30 students attempted → "Regrade question" changes `correct` for that question and recomputes all attempts; the change is audited and students are told their score changed.
- **F-lms-5** A YouTube link is removed by its owner → the resource shows "video unavailable" with the link; the teacher is notified once.
- **F-lms-6** A file resource fails its type check → it is quarantined and the resource stays in draft.
- **F-lms-7** A quiz is published for a section whose students do not all take the subject → only those who take it can see and attempt it.

## 14 · Seed data

About 200 resources across grades and subjects (notes, files, videos, links), 30 quizzes: 6 open now, 4 upcoming, 20 closed with attempts and analysis; 3 with short answers waiting to be graded; 5 live classes this week.

## 15 · Tests

- **T-lms-1** Resource visibility: subject taken, section allowed, audience, status.
- **T-lms-2** Publish freezes questions; edits refused after an attempt; extend allowed.
- **T-lms-3** Start rules: window, section, subject, attempts left.
- **T-lms-4** Deadline: the earlier of duration and window; late answer refused; auto-submit.
- **T-lms-5** Grading each objective type; fill-blank normalisation; best attempt counts.
- **T-lms-6** `correct` never appears in any student response before it is allowed.
- **T-lms-7** Resume keeps order and time.
- **T-lms-8** Regrade recomputes every attempt.
- **T-lms-9** A student can read and write only their own attempts and answers.
- **T-lms-10** Row-level security and branch scope.

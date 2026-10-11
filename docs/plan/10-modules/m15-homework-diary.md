# M15 · Homework and diary

## 1 · Purpose

The class diary and homework, replacing the paper diary a child carries home. A teacher posts what was done in class and what is due; parents see it the same evening and can confirm they have read it.

## 2 · Depends on

[M07](m07-students.md), [M11](m11-academic-structure.md), [M13](m13-syllabus-lesson-plans.md) (topics), [M00](m00-shared-kernel.md) (files).

## 3 · Tables

#### `homework` · branch

| Column | Type | Rules |
|---|---|---|
| section_subject_id | uuid → section_subjects | required |
| section_id | uuid → sections | required; copied for filtering |
| assigned_by | uuid → staff | required |
| title | text | required |
| instructions | text | optional; rich text |
| assigned_on | date | required |
| due_date | date | required; ≥ `assigned_on` |
| submission | enum(in_notebook, online_text, online_file) | default in_notebook |
| max_marks | numeric(6,2) | optional |
| unit_id | uuid → syllabus_units | optional |
| publish_at | timestamptz | optional; scheduled publishing |
| allow_late | bool | default true |
| status | enum(draft, published, closed) | default draft |

Policy: staff of the branch; a guardian or student may read published homework of sections their children are enrolled in.
Index: (org_id, section_id, due_date); (org_id, assigned_by, assigned_on).

#### `homework_submissions` · branch +family

| Column | Type | Rules |
|---|---|---|
| homework_id | uuid → homework | required |
| student_id | uuid → students | required |
| status | enum(pending, submitted, late, checked, returned, missing, excused) | default pending |
| answer_text | text | optional |
| submitted_at | timestamptz | optional |
| checked_by | uuid → profiles | optional |
| checked_at | timestamptz | optional |
| marks | numeric(6,2) | optional; ≤ the homework's `max_marks` |
| remark | text | optional |

Policy: a guardian or student may insert and update their own row while its status is `pending`, `submitted`, `late` or `returned`. Files are linked through `attachments`.
Unique: (homework_id, student_id).

#### `diary_entries` · branch
What happened in class today, per subject, plus a general note from the class teacher.

| Column | Type | Rules |
|---|---|---|
| section_id | uuid → sections | required |
| entry_date | date | required |
| section_subject_id | uuid → section_subjects | optional; empty for the class teacher's general note |
| body | text | required; rich text |
| posted_by | uuid → staff | required |
| status | enum(draft, published) | default draft |
| published_at | timestamptz | optional |

Policy: staff of the branch; a guardian or student may read published entries of their children's sections.
Unique: (section_id, entry_date, section_subject_id) among live rows.

#### `diary_acknowledgements` · branch +family

| Column | Type | Rules |
|---|---|---|
| section_id | uuid → sections | required |
| entry_date | date | required |
| student_id | uuid → students | required |
| acknowledged_by | uuid → profiles | required; the guardian |
| acknowledged_at | timestamptz | required |

Policy: a guardian may insert for their own child.
Unique: (student_id, entry_date).

## 4 · Contracts

`packages/contracts/src/modules/homework/`: `homework`, `homework-submissions`, `diary-entries`, `diary`.

- `CreateHomework` accepts `sectionSubjectIds[]`, so one piece of homework can go to several of the teacher's sections; one row is created per section.
- `DiaryDay`: for a section and date — the general note, each subject's entry, homework assigned that day and homework due the next working day.
- `SubmitHomework` (family): `{ answerText?, fileIds? }`.
- `CheckSubmissions`: `{ items: { studentId, status, marks?, remark? }[] }` — a whole class in one call.

Settings: `homework.diary_digest_time` (default 15:30), `homework.max_due_per_day` (default 3; a warning, not a block), `homework.parents_can_submit_online` (default false).

## 5 · Rules

- **R-homework-1** A teacher posts homework and diary entries only for their own `section_subjects`. The general note belongs to the class teacher. A substitute may post for the lesson they cover.
- **R-homework-2** A due date that is not a working day warns and suggests the next working day.
- **R-homework-3** When a section already has `homework.max_due_per_day` pieces due on the chosen date, the teacher is warned with the list and may still continue.
- **R-homework-4** Publishing creates a `pending` submission row for every active student of the section who takes that subject.
- **R-homework-5** Guardians are not messaged per entry. One diary digest per section goes out at `homework.diary_digest_time` listing that day's entries and homework. Anything published after the digest is sent at once as an update.
- **R-homework-6** Editing published homework notifies guardians "updated" once, with what changed (due date, instructions). Changing the due date to an earlier date is refused once any student has submitted.
- **R-homework-7** Homework with any submission cannot be deleted; it can be closed.
- **R-homework-8** Submission states: `pending → submitted` (or `late` after the due date when `allow_late`) `→ checked` or `returned → submitted`; `pending → missing` by the daily job after the due date; a teacher may set `excused`.
- **R-homework-9** For `in_notebook` homework, students do not submit online; the teacher marks each as checked, missing or excused in the class grid.
- **R-homework-10** Marks cannot exceed `max_marks`. Homework marks are not part of exam results unless an exam paper is explicitly linked ([M17](m17-exams-marks.md)).
- **R-homework-11** A guardian can acknowledge a day's diary once per child; teachers see who has and has not.
- **R-homework-12** A student joining a section mid-year sees homework due from their joining date on; no `missing` is recorded for earlier work.
- **R-homework-13** A student with approved leave over the due date is not marked `missing` automatically; the row becomes `excused` unless the teacher changes it.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `homework:read` | See homework in scope | ALL_STAFF |
| `homework:create` | Post, edit, close and check one's own homework | TEACHERS |
| `homework:manage` | Edit or close any homework in the branch | ADMINS, section_head, coordinator |
| `diary:read` | See diary entries in scope | ALL_STAFF |
| `diary:create` | Post and edit one's own diary entries | TEACHERS |
| `diary:manage` | Edit any diary entry in the branch | ADMINS, section_head, coordinator |
| `homework:export` | Export completion reports | ADMINS, ACADEMIC |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/homework` | `homework:read` | Lists; filter by section, subject, teacher, due range, status |
| POST | `/homework` | `homework:create` | Creates for one or more sections |
| GET | `/homework/[id]` | `homework:read` | One piece with completion counts |
| PATCH | `/homework/[id]` | `homework:create` | Edits |
| POST | `/homework/[id]/publish` | `homework:create` | Publishes now or at `publishAt` |
| POST | `/homework/[id]/close` | `homework:create` | Closes |
| DELETE | `/homework/[id]` | `homework:create` | Deletes a draft or an untouched piece |
| GET | `/homework/[id]/submissions` | `homework:read` | The class grid |
| PUT | `/homework/[id]/submissions` | `homework:create` | Checks many submissions at once |
| GET | `/homework/load` | `homework:read` | Pieces due per section per day for a date range |
| GET | `/homework/completion` | `homework:read` | Completion rates by section, subject and student |
| GET | `/homework/export` | `homework:export` | Exports the completion report |
| GET | `/diary` | `diary:read` | The diary day for a section and date |
| PUT | `/diary/entries` | `diary:create` | Saves or publishes one's entry for a subject and date |
| DELETE | `/diary/entries/[id]` | `diary:create` | Deletes one's own draft |
| GET | `/diary/acknowledgements` | `diary:read` | Who acknowledged a day |
| GET | `/family/children/[id]/diary` | `signed-in` | A child's diary for a date |
| POST | `/family/children/[id]/diary/acknowledge` | `signed-in` | Confirms it was read |
| GET | `/family/children/[id]/homework` | `signed-in` | A child's homework with status |
| GET | `/family/homework/[id]` | `signed-in` | One piece with the child's submission |
| PUT | `/family/homework/[id]/submission` | `signed-in` | Submits or resubmits online work |
| GET | `/learn/homework` | `signed-in` | The student's own homework |
| PUT | `/learn/homework/[id]/submission` | `signed-in` | The student submits |

## 8 · Client layer

Custom hooks: `useHomeworkList`, `useCreateHomework`, `usePublishHomework`, `useHomeworkSubmissions`, `useCheckSubmissions` (optimistic), `useHomeworkLoad`, `useDiaryDay(sectionId, date)`, `useSaveDiaryEntry` (autosaves a draft), `useChildDiary`, `useAcknowledgeDiary`, `useChildHomework`, `useSubmitHomework`.

## 9 · Screens

Built in [Phase 8](../20-phases/phase-08-academics.md), [Phase 13](../20-phases/phase-13-teacher-portal.md) and [Phase 14](../20-phases/phase-14-family-portals.md).

| Screen | Pattern | Where |
|---|---|---|
| Diary overview | List | `/school/academics/diary`: sections against today, posted or not, acknowledgement rate |
| Homework overview | Report | Load per section per day; completion by subject |
| **Teacher:** Diary | Form page | `/teach/diary`: today's lessons as cards, a text box each; "Add homework" inside the card; one Publish |
| **Teacher:** Homework | List | Mine, by due date, with completion bars |
| **Teacher:** Check homework | Grid editor | Students down; checked, missing, excused toggles; marks and remark; submitted files open in a side sheet |
| **Parent:** Diary | Dashboard | `/family/diary`: the day as a page, like the paper diary; "I have read this" |
| **Parent / Student:** Homework | List + Detail | Due soon first; status per piece; submit when online submission is on |

## 10 · Notifications and jobs

Events: `diary.digest` (to guardians, once per section per day), `diary.updated`, `homework.published` (inside the digest unless late), `homework.updated`, `homework.due-tomorrow` (optional reminder), `homework.missing` (to the guardian), `homework.checked` (when marks or a remark were given).

Jobs: `homework.publish-scheduled` (every 5 minutes), `homework.send-digests` (per branch at the digest time), `homework.mark-missing` (daily 07:00), `homework.due-reminders` (daily 17:00).

## 11 · Offline

Offline-writable through `teacher.homework`:

| Table | Operation | Conflict policy |
|---|---|---|
| `diary_entries` | create, update | Latest write wins per section, date and subject |
| `homework` | create, update | Always added; edits latest wins. Files upload when the device is online |
| `homework_submissions` | update (check, missing, excused, marks) | Latest write wins per student |

Guardians read the last loaded diary and homework offline.

## 12 · AI

- A lesson plan's homework field can prefill a homework draft (A4).
- Translating a diary entry into Urdu (A10), shown as a draft for the teacher to accept.

## 13 · Failure cases

- **F-homework-1** A teacher publishes at 9 pm → saved and visible at once in the app; the message waits for the end of quiet hours.
- **F-homework-2** An attachment fails to upload → the homework is saved; the card shows "1 file not uploaded, retry".
- **F-homework-3** A student moves section after homework was assigned → their pending row stays with the old section's homework and is hidden; they get rows for the new section's work from the move date.
- **F-homework-4** A parent submits a 40 MB video → refused before upload with the limit.
- **F-homework-5** A teacher deletes homework that three students already submitted → refused; "Close" is offered.
- **F-homework-6** The digest job runs twice → the dedupe key (section and date) sends one digest.
- **F-homework-7** A section has no diary entries by the digest time → no digest is sent, and the section appears as "not posted" on the overview.
- **F-homework-8** Two teachers post for the same subject and date (a substitute and the regular teacher) → the second save gets `STALE` and sees the first entry.

## 14 · Seed data

Three weeks of diary entries for every section (about 85% of days posted), homework at a realistic rate with a mix of submission kinds, submissions in every status, acknowledgement on about six days in ten by the families that can sign in (four until guardians sign in by phone in Phase 5, then about 60% of all families), two sections with a heavy day so the load warning shows.

## 15 · Tests

- **T-homework-1** Only own section subjects; general note only by the class teacher; substitute for the covered lesson.
- **T-homework-2** Publish creates submission rows for exactly the students who take the subject.
- **T-homework-3** Due-date warnings: non-working day, load limit.
- **T-homework-4** One digest per section per day; a late publish sends an update.
- **T-homework-5** Edit rules after submissions exist.
- **T-homework-6** Submission transitions including late, returned and resubmitted; marks limit.
- **T-homework-7** Missing job skips students on approved leave and students who joined later.
- **T-homework-8** A guardian reads only their child's section; submits only for their child; acknowledges once.
- **T-homework-9** Offline diary and checking: applied once; latest wins.
- **T-homework-10** Row-level security and branch scope.

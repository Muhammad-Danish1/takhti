# M40 · Complaints and surveys

## 1 · Purpose

Listening. A parent, student or staff member can raise a complaint or a suggestion and watch it being dealt with against a time limit, with sensitive matters reaching only the people who should see them. And surveys: the school asks structured questions, anonymously when it should be, and sees the answers by class, branch and term.

## 2 · Depends on

[M07](m07-students.md), [M26](m26-staff-recruitment.md) (`staff`), [M37](m37-messaging-hub.md), [M39](m39-notices-events-calendar.md) (the audience picker), [M00](m00-shared-kernel.md) (files, sequences).

## 3 · Tables

#### `complaint_categories` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation; "Teaching", "Fees", "Transport", "Bullying", "Staff conduct", "Suggestion" |
| name_ur | text | optional |
| kind | enum(complaint, suggestion, appreciation) | default complaint |
| owner_role | text | required; the role that receives it at a branch |
| is_sensitive | bool | default false; goes to the principal only |
| acknowledge_hours | int | default 24 |
| resolve_hours | int | default 120 |
| is_active | bool | default true |

#### `complaints` · branch +self(raised_by)

| Column | Type | Rules |
|---|---|---|
| complaint_no | text | required; from the `complaint` sequence |
| category_id | uuid → complaint_categories | required |
| subject | text | required |
| description | text | required |
| raised_by | uuid → profiles | optional; empty when taken by phone or in person from someone with no login |
| raiser_kind | enum(guardian, student, staff, other) | required |
| raiser_name | text | optional; for a complaint with no login |
| raiser_phone | text | optional |
| is_anonymous | bool | default false; the raiser's name is hidden from everyone handling it |
| student_id | uuid → students | optional; the child concerned |
| about_staff_id | uuid → staff | optional |
| channel | enum(portal, phone, in_person, letter, website, whatsapp) | default portal |
| priority | enum(normal, high, urgent) | default normal |
| is_sensitive | bool | default false; copied from the category, may be raised |
| status | enum(open, acknowledged, in_progress, resolved, closed, reopened, rejected) | default open |
| owner_staff_id | uuid → staff | optional |
| escalation_level | int | default 0 |
| acknowledge_by | timestamptz | required |
| resolve_by | timestamptz | required |
| acknowledged_at | timestamptz | optional |
| resolved_at | timestamptz | optional |
| resolution | text | optional; what the raiser is told |
| satisfaction | int | optional; 1 to 5 |
| recorded_by | uuid → profiles | optional; the staff member who took it on someone's behalf |

Policy: the raiser may read their own row. Staff access is by the service: owner, escalation chain and `complaints:manage`; a sensitive complaint only by the principal, the director and its owner.
Index: (org_id, branch_id, status, resolve_by); (org_id, raised_by).

#### `complaint_updates` · branch append-only

| Column | Type | Rules |
|---|---|---|
| complaint_id | uuid → complaints | required |
| body | text | optional |
| author_id | uuid → profiles | required |
| is_internal | bool | default true; an internal note is never shown to the raiser |
| status_from | text | optional |
| status_to | text | optional |

Policy: the raiser may read updates that are not internal, and insert their own replies.

#### `surveys` · org

| Column | Type | Rules |
|---|---|---|
| title | text | required |
| title_ur | text | optional |
| intro | text | optional |
| kind | enum(parent_satisfaction, student_voice, staff_pulse, teacher_feedback, event_feedback, exit, custom) | required |
| audience | jsonb | required; the same shape as a notice's |
| branch_ids | uuid[] | required |
| is_anonymous | bool | default true |
| one_response_per | enum(person, student) | default person; `student` lets a guardian answer once for each child |
| opens_at | timestamptz | required |
| closes_at | timestamptz | required; after `opens_at` |
| min_group_size | int | default 5; results for a group smaller than this are hidden |
| status | enum(draft, open, closed, archived) | default draft |
| created_by | uuid → profiles | required |

#### `survey_questions` · org

| Column | Type | Rules |
|---|---|---|
| survey_id | uuid → surveys | required |
| sort_order | int | required |
| section_title | text | optional |
| type | enum(rating_5, score_10, yes_no, single_choice, multi_choice, short_text, long_text) | required |
| text | text | required |
| text_ur | text | optional |
| options | jsonb | default `[]`; `{ key, label, labelUr? }[]` for choice questions |
| is_required | bool | default true |
| about | enum(none, class_teacher, each_subject_teacher) | default none; repeats the question for each teacher of the respondent's child |

#### `survey_invitations` · org +self
Who may answer. Created when the survey opens.

| Column | Type | Rules |
|---|---|---|
| survey_id | uuid → surveys | required |
| user_id | uuid → profiles | required |
| student_id | uuid → students | optional; set when answering per child |
| answered_at | timestamptz | optional; only the fact, never linked to a response when anonymous |

Unique: (survey_id, user_id, student_id).

#### `survey_responses` · org

| Column | Type | Rules |
|---|---|---|
| survey_id | uuid → surveys | required |
| respondent_id | uuid → profiles | optional; always empty when the survey is anonymous |
| branch_id | uuid → branches | required |
| grade_id | uuid → grades | optional; kept for grouping results |
| section_id | uuid → sections | optional |
| respondent_kind | enum(guardian, student, staff) | required |
| submitted_at | timestamptz | required; rounded to the hour when anonymous |

Policy: staff with `surveys:results` through the service only. No policy lets a family user read responses.

#### `survey_answers` · org

| Column | Type | Rules |
|---|---|---|
| response_id | uuid → survey_responses | required |
| question_id | uuid → survey_questions | required |
| about_staff_id | uuid → staff | optional; for teacher feedback |
| value_number | numeric(4,1) | optional |
| value_options | text[] | optional |
| value_text | text | optional |

Policy: as for `survey_responses`: read through the service only, which counts answers and never names who gave them.
Unique: (response_id, question_id, about_staff_id).

## 4 · Contracts

`packages/contracts/src/modules/feedback/`: `complaint-categories`, `complaints`, `surveys`, `survey-questions`, `survey-responses`.

- `RaiseComplaint`: `{ categoryId, subject, description, studentId?, aboutStaffId?, isAnonymous?, fileIds? }`.
- `ComplaintView`: for the raiser — status, time limits, the resolution and the updates meant for them; for staff — everything they are allowed, with the raiser's identity removed when anonymous.
- `ComplaintSummary`: open by category and age, overdue, time to resolve, satisfaction, repeat subjects (the same staff member or route named three times in a term).
- `SurveyForm`: questions in order, expanded per teacher where `about` asks for it.
- `SubmitSurvey`: `{ answers: { questionId, aboutStaffId?, value }[] }`.
- `SurveyResults`: response rate; for each question a distribution, an average and comments; breakdowns by branch, grade and section, with any group below `min_group_size` shown as "too few responses"; trend against the previous survey of the same kind.
- `TeacherFeedback`: averages per teacher per question, visible to the teacher's line managers and, in summary, to the teacher.

Settings: `complaints.allow_anonymous` (default true), `complaints.students_can_raise` (default true), `complaints.auto_close_days` (default 5 after resolution), `complaints.escalate_to` (default: owner, then principal, then director), `surveys.reminder_days` (default `[3, 1]` before closing).

## 5 · Rules

**Complaints**

- **R-feedback-1** A guardian, a student (when allowed) or a staff member can raise a complaint. Staff can record one on behalf of someone who phoned or came in.
- **R-feedback-2** A new complaint goes to a holder of its category's owner role at the branch (the one with fewest open complaints). A sensitive category goes to the principal alone.
- **R-feedback-3** A complaint about a named staff member is never routed to that person, and they cannot see it, whatever their role. If they are the usual owner, it goes one level up.
- **R-feedback-4** With `is_anonymous`, the raiser's name, phone and student are hidden from every handler. The system still knows who to notify. Staff are told plainly that an anonymous complaint cannot be traced; the raiser is told that anonymity limits what can be investigated.
- **R-feedback-5** States: `open → acknowledged → in_progress → resolved → closed`; `resolved → reopened → in_progress`; `open → rejected` (not a matter for the school; needs a reason shown to the raiser). The raiser hears at each step.
- **R-feedback-6** Not acknowledged by `acknowledge_by`: the owner is reminded, then the next level is told. Not resolved by `resolve_by`: it escalates one level in `complaints.escalate_to`, and the level is recorded. `urgent` halves both limits.
- **R-feedback-7** Resolving needs a resolution written for the raiser. The raiser can reopen within `complaints.auto_close_days` and is asked for a satisfaction rating; then it closes.
- **R-feedback-8** Internal notes and the names of staff involved in the investigation are never shown to the raiser.
- **R-feedback-9** A complaint that reveals a risk to a child (the category is flagged, or a handler marks it) alerts the principal at once and suggests a counselling referral ([M20](m20-behaviour-houses.md)).
- **R-feedback-10** Complaints are never deleted. A raiser can withdraw one that is not yet resolved; it closes as withdrawn and stays on record.
- **R-feedback-11** An appreciation is routed like a complaint, needs no resolution, and can be shared with the staff member it praises.

**Surveys**

- **R-feedback-12** A survey can be opened only with at least one question and an audience. Opening it creates invitations for the audience and sends the invitation message; its questions are then frozen.
- **R-feedback-13** A person answers once (or once per child). The invitation row records only that they answered.
- **R-feedback-14** **Anonymity is structural.** For an anonymous survey the response row has no respondent, the time is rounded to the hour, and the response and the invitation are written in the same transaction with no link between them. There is no way, in the database or the application, to connect them afterwards.
- **R-feedback-15** Results for any group with fewer than `min_group_size` responses are not shown, and neither are free-text comments from such a group. A breakdown that would let one group be worked out by subtraction is hidden too.
- **R-feedback-16** Free-text answers are shown without any identity, in random order.
- **R-feedback-17** Teacher feedback (`about` a teacher) is visible to the teacher's line managers; the teacher sees their own averages and comments only when the survey's owner releases them, and never another teacher's.
- **R-feedback-18** A survey closes at `closes_at`. Reminders go only to those who have not answered. Closing early or extending is possible; reopening a closed survey is not.
- **R-feedback-19** Student surveys are shown in simple language, in the student portal, and never ask for identifying details.
- **R-feedback-20** A survey's results can be shared back with its audience as a summary notice ([M39](m39-notices-events-calendar.md)), written by a person.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `complaints:handle` | Work on complaints one owns | LEADERS, section_head, coordinator, FRONT, ACCOUNTS, transport_manager, hr_manager |
| `complaints:record` | Record a complaint on someone's behalf | FRONT, LEADERS, class_teacher |
| `complaints:manage` | See all non-sensitive complaints of the branch; reassign; maintain categories | ADMINS, vice_principal |
| `complaints:sensitive` | See and handle sensitive complaints | principal, director |
| `complaints:reports` | See complaint summaries | LEADERS |
| `surveys:manage` | Create, open, close and share surveys | ADMINS, vice_principal, academic_head, hr_manager |
| `surveys:results` | See survey results for one's branches | LEADERS, academic_head, hr_manager |
| `surveys:teacher-feedback` | See feedback about teachers in one's line | principal, vice_principal, academic_head, section_head |

Everyone can raise a complaint and answer a survey they are invited to.

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/complaint-categories` | `signed-in` | Lists active categories |
| POST | `/complaint-categories` | `complaints:manage` | Creates |
| PATCH | `/complaint-categories/[id]` | `complaints:manage` | Edits |
| POST | `/my-complaints` | `signed-in` | Raises a complaint |
| GET | `/my-complaints` | `signed-in` | Complaints I raised |
| GET | `/my-complaints/[id]` | `signed-in` | One of mine |
| POST | `/my-complaints/[id]/reply` | `signed-in` | Adds a reply |
| POST | `/my-complaints/[id]/reopen` | `signed-in` | Reopens |
| POST | `/my-complaints/[id]/rate` | `signed-in` | Rates the outcome |
| POST | `/my-complaints/[id]/withdraw` | `signed-in` | Withdraws |
| GET | `/complaints` | `complaints:handle` | Complaints I may handle; filter by status, category, overdue |
| POST | `/complaints` | `complaints:record` | Records one on someone's behalf |
| GET | `/complaints/[id]` | `complaints:handle` | One complaint, as far as the caller is allowed |
| POST | `/complaints/[id]/acknowledge` | `complaints:handle` | Acknowledges |
| POST | `/complaints/[id]/updates` | `complaints:handle` | Adds an internal note or a message to the raiser |
| POST | `/complaints/[id]/assign` | `complaints:manage` | Reassigns |
| POST | `/complaints/[id]/escalate` | `complaints:handle` | Escalates one level |
| POST | `/complaints/[id]/resolve` | `complaints:handle` | Resolves with a resolution |
| POST | `/complaints/[id]/reject` | `complaints:handle` | Rejects with a reason |
| GET | `/complaints/summary` | `complaints:reports` | The summary |
| GET | `/surveys` | `surveys:manage` | Lists |
| POST | `/surveys` | `surveys:manage` | Creates a draft, optionally from a built-in template |
| GET | `/surveys/[id]` | `surveys:manage` | One survey with its questions |
| PATCH | `/surveys/[id]` | `surveys:manage` | Edits a draft; extends the closing time |
| PUT | `/surveys/[id]/questions` | `surveys:manage` | Saves questions |
| POST | `/surveys/[id]/open` | `surveys:manage` | Opens and invites |
| POST | `/surveys/[id]/close` | `surveys:manage` | Closes early |
| POST | `/surveys/[id]/remind` | `surveys:manage` | Reminds those who have not answered |
| GET | `/surveys/[id]/results` | `surveys:results` | Results with breakdowns |
| GET | `/surveys/[id]/teacher-feedback` | `surveys:teacher-feedback` | Feedback per teacher |
| POST | `/surveys/[id]/release-to-teachers` | `surveys:manage` | Lets teachers see their own feedback |
| GET | `/surveys/[id]/export` | `surveys:results` | Exports aggregated results |
| GET | `/my-surveys` | `signed-in` | Surveys waiting for me |
| GET | `/my-surveys/[id]` | `signed-in` | The form |
| POST | `/my-surveys/[id]/submit` | `signed-in` | Submits my answers |
| GET | `/me/teacher-feedback` | `signed-in` | A teacher's own released feedback |

Idempotent: `POST /my-complaints`, `POST /my-surveys/[id]/submit`.

## 8 · Client layer

Custom hooks: `useRaiseComplaint`, `useMyComplaints`, `useComplaint`, `useComplaintQueue`, `useAddComplaintUpdate`, `useComplaintSummary`, `useSurveyBuilder` (autosave), `useOpenSurvey`, `useSurveyResults`, `useMySurveys`, `useSurveyForm` (keeps answers on the device until submitted), `useSubmitSurvey`.

## 9 · Screens

Built in [Phase 12](../20-phases/phase-12-communication.md) and [Phase 14](../20-phases/phase-14-family-portals.md).

| Screen | Pattern | Where |
|---|---|---|
| **Raise a concern** | Form page | Every portal: category tiles, the child it concerns, what happened, optional file, "Send anonymously" with a plain explanation of what that means |
| My concerns | List + Detail | Status as steps; the school's replies; reply, reopen, rate |
| Complaints | List | `/school/communication/complaints`: mine first; time left; overdue in red with a label |
| Complaint | Detail | Two columns: the conversation with the raiser, and internal notes; reassign, escalate, resolve |
| Complaint summary | Report | By category, age, branch; satisfaction; repeat subjects |
| Surveys | List | Status and response rate |
| Survey builder | Form page | Questions as cards to reorder; type picker; English and Urdu; a preview as the respondent sees it; built-in templates |
| Survey results | Report | A chart per question; breakdown tabs; comments; "too few responses" where hidden; compare with last time |
| Teacher feedback | Report | Per teacher averages; release to teachers |
| **Respondent:** Survey | Wizard | One section per screen on a phone; large touch targets; a progress bar; "Your answers are anonymous" when they are |

## 10 · Notifications and jobs

Events: `complaint.received` (to the owner), `complaint.acknowledged` (to the raiser), `complaint.update` (to the raiser, for non-internal updates), `complaint.resolved`, `complaint.reopened`, `complaint.overdue`, `complaint.escalated`, `complaint.safeguarding` (urgent, to the principal), `survey.invitation`, `survey.reminder`, `survey.closed` (to its owner with the response rate), `survey.feedback-released` (to teachers).

Jobs: `feedback.complaint-deadlines` (every 30 minutes), `feedback.complaint-auto-close` (daily), `feedback.survey-open` (creates invitations), `feedback.survey-reminders` (daily 10:00), `feedback.survey-close` (every 15 minutes).

Documents: complaint record, survey results report.

## 11 · Offline

A survey can be filled in offline once its form has loaded; answers stay on the device and are submitted on reconnect. A complaint needs a connection, so that the raiser gets its number.

## 12 · AI

- Drafting a reply to a complaint in English or Urdu for the handler to edit (A10).
- Grouping free-text survey comments into themes with counts, with a few example comments under each. Comments are sent without any identity; a group below the minimum size is not sent.
- Suggesting a category for a complaint from its text.

## 13 · Failure cases

- **F-feedback-1** A parent complains about the class teacher, who is also the category's owner → routed to the section head; the teacher cannot see it.
- **F-feedback-2** An anonymous complaint needs more detail → the handler replies through the system; the raiser is notified without the handler learning who they are.
- **F-feedback-3** A complaint is not acknowledged in time → reminder, then the principal is told; the delay shows in the summary.
- **F-feedback-4** A handler tries to close a complaint without a resolution → refused.
- **F-feedback-5** A parent raises the same complaint three times → handlers see "2 earlier complaints from this raiser on this subject" (hidden for anonymous ones) and can link them.
- **F-feedback-6** A survey has 3 responses from one section → that section's breakdown shows "too few responses"; its answers still count in the grade and branch totals.
- **F-feedback-7** A survey's question is found to be wrong after opening → it cannot be edited; close the survey and open a corrected one, or exclude the question from results.
- **F-feedback-8** A respondent submits twice from two devices → the second is refused: already answered.
- **F-feedback-9** Someone with database access looks for who gave a low rating → there is no column or log that links a response to a person.
- **F-feedback-10** A staff pulse survey has only four staff in a small branch → the whole branch's results are hidden; they count only in the group total.

## 14 · Seed data

Ten categories (two sensitive). About 60 complaints over a term in every status, across channels, some anonymous, some overdue and escalated, one safeguarding. A closed parent satisfaction survey with about 55% response and results; a closed student voice survey; an open staff pulse; a teacher feedback survey released to teachers; built-in templates for each kind.

## 15 · Tests

- **T-feedback-1** Routing by category and load; a sensitive category reaches the principal only.
- **T-feedback-2** A complaint about a staff member is invisible to that person at every level, including by direct query through the service.
- **T-feedback-3** Anonymous: no response to any handler contains the raiser's identity; the raiser is still notified.
- **T-feedback-4** State transitions; resolution required; reopen window; auto-close.
- **T-feedback-5** Deadlines, reminders and escalation levels; urgent halves limits.
- **T-feedback-6** The raiser sees only non-internal updates.
- **T-feedback-7** Survey opening freezes questions and creates invitations.
- **T-feedback-8** One response per person or per child.
- **T-feedback-9** Anonymous responses carry no respondent, and no table or log joins a response to an invitation.
- **T-feedback-10** Minimum group size hides small groups and subtraction leaks.
- **T-feedback-11** Teacher feedback visibility: line managers; the teacher only after release; never another teacher's.
- **T-feedback-12** Row-level security and branch scope.

# M38 · Chat and parent–teacher meetings

## 1 · Purpose

Two-way conversation between home and school, kept inside the school's own system instead of teachers' personal WhatsApp: a parent messages their child's teacher, the office answers questions, a teacher posts to the class's parents. And the parent–teacher meeting: the school publishes slots, parents book them, and what was discussed is recorded.

## 2 · Depends on

[M07](m07-students.md), [M11](m11-academic-structure.md), [M26](m26-staff-recruitment.md) (`staff`), [M37](m37-messaging-hub.md) (alerts), [M00](m00-shared-kernel.md) (files).

## 3 · Tables

#### `chat_threads` · branch

| Column | Type | Rules |
|---|---|---|
| kind | enum(parent_teacher, parent_office, class_broadcast, staff_group, staff_direct) | required |
| student_id | uuid → students | optional; required for `parent_teacher`; the child the conversation is about |
| section_id | uuid → sections | optional; required for `class_broadcast` |
| teacher_staff_id | uuid → staff | optional; required for `parent_teacher` |
| title | text | optional; for groups |
| replies | enum(open, private_to_sender, off) | default open; for a broadcast, replies go privately to the teacher or are switched off |
| status | enum(open, closed) | default open |
| last_message_at | timestamptz | optional |
| last_message_preview | text | optional |
| created_by | uuid → profiles | required |

Policy: a row is readable only by its participants (a policy checking `chat_participants` for `app.user_id()`), and by staff holding oversight through the service.
Unique: (student_id, teacher_staff_id) for open `parent_teacher` threads; (section_id) for `class_broadcast`.
Index: (org_id, branch_id, last_message_at).

#### `chat_participants` · branch +self

| Column | Type | Rules |
|---|---|---|
| thread_id | uuid → chat_threads | required |
| user_id | uuid → profiles | required |
| role | enum(guardian, student, teacher, office, leader) | required |
| can_post | bool | default true |
| last_read_at | timestamptz | optional |
| is_muted | bool | default false |
| left_at | timestamptz | optional |

Policy: a participant reads their own row and nothing more. Being in a thread is what lets a person read it, so nobody, staff included, adds or changes a participant except through the service.
Unique: (thread_id, user_id).
Index: (user_id, left_at).

#### `chat_messages` · branch

| Column | Type | Rules |
|---|---|---|
| thread_id | uuid → chat_threads | required |
| sender_id | uuid → profiles | required; a participant who can post |
| kind | enum(text, image, file, voice, system) | default text |
| body | text | optional; required for `text`; at most 4,000 characters |
| reply_to_id | uuid → chat_messages | optional |
| private_to_user_id | uuid → profiles | optional; a private reply to a broadcast |
| sent_at | timestamptz | required |
| client_id | uuid | required; made on the device, so a resend is recognised |
| removed_at | timestamptz | optional; the sender or a moderator removed it |
| removed_by | uuid → profiles | optional |
| is_flagged | bool | default false |

Policy: readable by participants of its thread (and only by sender and target when `private_to_user_id` is set); insertable by a participant with `can_post`. Family users write through this explicit policy.
Unique: (thread_id, client_id).
Index: (thread_id, sent_at).

#### `chat_reports` · branch

| Column | Type | Rules |
|---|---|---|
| message_id | uuid → chat_messages | required |
| reported_by | uuid → profiles | required |
| reason | enum(abusive, inappropriate, spam, safety, other) | required |
| note | text | optional |
| status | enum(open, upheld, dismissed) | default open |
| handled_by | uuid → profiles | optional |
| handled_note | text | optional |

Policy: a participant may insert a report about a message they can read.

#### `chat_blocks` · branch
A person stopped from starting or posting in chats, after abuse.

| Column | Type | Rules |
|---|---|---|
| user_id | uuid → profiles | required |
| reason | text | required |
| until | date | optional; empty means until lifted |
| blocked_by | uuid → profiles | required |
| lifted_at | timestamptz | optional |

#### `ptm_events` · branch

| Column | Type | Rules |
|---|---|---|
| title | text | required; "Parent–teacher meeting, first term" |
| held_on | date | required |
| start_time | time | required |
| end_time | time | required; after `start_time` |
| mode | enum(in_person, online, both) | default in_person |
| slot_minutes | int | default 10; 5 to 30 |
| break_minutes | int | default 0 |
| grade_ids | uuid[] | required |
| booking_opens_at | timestamptz | required |
| booking_closes_at | timestamptz | required; after `booking_opens_at`, before the meeting |
| who_is_booked | enum(class_teacher_only, all_teachers) | default class_teacher_only |
| instructions | text | optional |
| status | enum(draft, published, completed, cancelled) | default draft |

Policy: staff of the branch; guardians of students in its grades may read a published event.

#### `ptm_slots` · branch

| Column | Type | Rules |
|---|---|---|
| event_id | uuid → ptm_events | required |
| teacher_staff_id | uuid → staff | required |
| starts_at | timestamptz | required |
| ends_at | timestamptz | required |
| room_id | uuid → rooms | optional |
| meeting_url | text | optional; `https` only; for online |
| status | enum(open, booked, blocked) | default open |

Policy: staff of the branch; guardians may read slots of a published event for teachers who teach their children.
Unique: (event_id, teacher_staff_id, starts_at).

#### `ptm_bookings` · branch +family

| Column | Type | Rules |
|---|---|---|
| event_id | uuid → ptm_events | required |
| slot_id | uuid → ptm_slots | required |
| student_id | uuid → students | required |
| guardian_id | uuid → guardians | required |
| teacher_staff_id | uuid → staff | required; copied from the slot |
| mode | enum(in_person, online) | required |
| topic | text | optional; what the parent wants to discuss |
| status | enum(booked, cancelled, attended, no_show) | default booked |
| booked_by | uuid → profiles | required |
| cancelled_reason | text | optional |

Policy: a guardian may insert for their own child, read their own, and cancel their own before the event.
Unique: one `booked` or `attended` row per slot; one per (event_id, student_id, teacher_staff_id).

#### `ptm_notes` · branch +family

| Column | Type | Rules |
|---|---|---|
| booking_id | uuid → ptm_bookings | required; unique |
| student_id | uuid → students | required |
| discussed | text | optional |
| agreed_actions | text | optional |
| follow_up_on | date | optional |
| share_with_family | bool | default true |
| private_note | text | optional; never shown to the family |
| written_by | uuid → profiles | required |
| parent_rating | int | optional; 1 to 5 |
| parent_comment | text | optional |

Policy: a guardian may read their own child's shared note without `private_note`, and write the rating and comment.

## 4 · Contracts

`packages/contracts/src/modules/chat/`: `chat-threads`, `chat-messages`, `chat-reports`, `ptm-events`, `ptm-slots`, `ptm-bookings`, `ptm-notes`.

- `Inbox`: my threads, newest first, each with the other party's name, the child's name and class, a preview, and my unread count.
- `ThreadView`: a page of messages (cursor paging, newest first), participants, whether I can post, and a banner text when it is outside chat hours.
- `SendMessage`: `{ threadId, clientId, kind, body?, fileId?, replyToId? }`.
- `StartThread` (family): `{ studentId, teacherStaffId }` or `{ office: true }`; returns the existing open thread if there is one.
- `PtmBookingPage` (family): for each child and each bookable teacher — free slots; the family's bookings so far; clashes between children's bookings.
- `PtmSchedule` (teacher): my slots in order with the booked child, parent and topic.
- `PtmSummary`: bookings, attendance and ratings by class.

Settings: `chat.enabled_for_parents` (default true), `chat.enabled_for_students` (default false), `chat.hours_from` / `chat.hours_to` (default 08:00–17:00 on working days), `chat.out_of_hours` (`deliver_silently` | `hold`, default deliver_silently), `chat.parents_can_start` (default true), `chat.remove_window_minutes` (default 10), `chat.attachment_max_mb` (default 10), `chat.oversight_notice` (the line shown in every thread: "School management can view this conversation").

## 5 · Rules

**Chat**

- **R-chat-1** A parent can start a thread only with a teacher who currently teaches their child (class teacher or subject teacher), or with the office. Each child–teacher pair has one open thread.
- **R-chat-2** A thread is visible to its participants only. Leaders holding `chat:oversee` can open any thread of their branch; every such opening is written to the audit log, and every thread carries the oversight notice so nobody is surprised.
- **R-chat-3** A class broadcast is posted by the section's teachers. Guardians of enrolled students are participants automatically, kept in step when students join or leave. A guardian's reply goes privately to the teacher who posted, or is not possible, by the thread's setting; guardians never see each other's replies or phone numbers.
- **R-chat-4** Outside chat hours a message to a teacher is delivered without an alert and the sender sees "Teachers reply during school hours". Messages to the office follow the same hours. Staff are never expected to answer at night.
- **R-chat-5** Sending is idempotent on the device's `client_id`. Messages are ordered by server time.
- **R-chat-6** A sender can remove their own message within `chat.remove_window_minutes`; it then shows "Message removed". A moderator can remove any message. Removed text is kept for oversight and deleted with the thread's retention.
- **R-chat-7** Attachments are images, PDFs and voice notes up to `chat.attachment_max_mb`, scanned like every upload. Links are shown as text.
- **R-chat-8** Any participant can report a message. A report goes to the branch's moderators; upholding it can remove the message and block the sender.
- **R-chat-9** A blocked person cannot start threads or post. The office can still message them.
- **R-chat-10** When a teacher stops teaching a section, their parent threads for that section close with a system message and stay readable. When a student leaves the school, their threads close.
- **R-chat-11** An unread message raises one alert through the messaging hub (`chat.message`), bundled: at most one alert per thread per 10 minutes, none while the person has the thread open.
- **R-chat-12** A teacher does not see a parent's phone number in chat, and a parent does not see a teacher's.
- **R-chat-13** Student chat, when enabled, is limited to class broadcasts and to threads with their own teachers; a student–teacher thread always includes the student's guardians as readers.
- **R-chat-14** An inbound WhatsApp message from a guardian, when the chatbot is off, becomes a message in that family's office thread ([R-messaging-21](m37-messaging-hub.md)); the office's reply goes back on WhatsApp inside the 24-hour window, and in-app otherwise.

**Parent–teacher meetings**

- **R-chat-15** Publishing an event creates slots for each teacher who will be booked, from the start time to the end time in steps of `slot_minutes` plus the break. A teacher can block slots they cannot attend.
- **R-chat-16** A guardian books during the booking window, for their own child, one slot per teacher per event. Booking is first come, first served; the database refuses a second booking of a slot.
- **R-chat-17** The booking page warns when two bookings of the same family overlap or are too close to walk between.
- **R-chat-18** A guardian can cancel or change a booking until booking closes; after that, only staff.
- **R-chat-19** Staff can book on behalf of a parent without the app, and can add a walk-in on the day.
- **R-chat-20** On the day the teacher marks each booking `attended` or `no_show` and writes notes. A shared note is visible to the family at once; a follow-up date creates a reminder for the teacher.
- **R-chat-21** Families with no booking when the window closes are listed for the class teacher to call.
- **R-chat-22** Cancelling an event cancels its bookings and tells everyone.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `chat:use` | Take part in chats one belongs to; teachers message parents of their own sections | ALL_STAFF |
| `chat:office` | Answer the office's threads | FRONT, branch_admin |
| `chat:broadcast` | Post to class broadcasts of one's own sections | TEACHERS, section_head |
| `chat:oversee` | Open any thread of the branch | principal, vice_principal |
| `chat:moderate` | Handle reports; remove messages; block and unblock people | ADMINS, vice_principal |
| `ptm:manage` | Create, publish and cancel meetings; book on a parent's behalf | ADMINS, vice_principal, section_head, coordinator |
| `ptm:conduct` | See one's own schedule; block slots; mark attendance; write notes | TEACHERS |
| `ptm:read` | See all bookings and summaries | LEADERS, section_head, coordinator |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/chat/inbox` | `signed-in` | My threads |
| GET | `/chat/unread-count` | `signed-in` | My unread total |
| POST | `/chat/threads` | `signed-in` | Starts or returns a thread |
| GET | `/chat/contacts` | `signed-in` | Who I may start a thread with |
| GET | `/chat/threads/[id]` | `signed-in` | The thread view |
| GET | `/chat/threads/[id]/messages` | `signed-in` | A page of messages |
| POST | `/chat/threads/[id]/messages` | `signed-in` | Sends a message |
| POST | `/chat/threads/[id]/read` | `signed-in` | Marks the thread read up to a time |
| PATCH | `/chat/threads/[id]` | `signed-in` | Mutes for me; a teacher changes the reply mode of their broadcast |
| DELETE | `/chat/messages/[id]` | `signed-in` | Removes my own message inside the window |
| POST | `/chat/messages/[id]/report` | `signed-in` | Reports a message |
| GET | `/chat/office` | `chat:office` | The office's threads; unanswered first |
| POST | `/chat/threads/[id]/close` | `chat:office` | Closes an office thread |
| GET | `/chat/oversight` | `chat:oversee` | Threads of the branch; filter by teacher, class, flagged |
| GET | `/chat/reports` | `chat:moderate` | Lists reports |
| POST | `/chat/reports/[id]/handle` | `chat:moderate` | Upholds or dismisses |
| POST | `/chat/messages/[id]/remove` | `chat:moderate` | Removes any message |
| GET | `/chat-blocks` | `chat:moderate` | Lists |
| POST | `/chat-blocks` | `chat:moderate` | Blocks a person |
| POST | `/chat-blocks/[id]/lift` | `chat:moderate` | Lifts a block |
| GET | `/ptm-events` | `ptm:read` | Lists |
| POST | `/ptm-events` | `ptm:manage` | Creates a draft |
| GET | `/ptm-events/[id]` | `ptm:read` | One event with the summary |
| PATCH | `/ptm-events/[id]` | `ptm:manage` | Edits |
| POST | `/ptm-events/[id]/publish` | `ptm:manage` | Publishes and creates slots |
| POST | `/ptm-events/[id]/cancel` | `ptm:manage` | Cancels |
| GET | `/ptm-events/[id]/bookings` | `ptm:read` | All bookings; families not yet booked |
| POST | `/ptm-events/[id]/bookings` | `ptm:manage` | Books on a parent's behalf |
| GET | `/ptm/my-schedule` | `ptm:conduct` | My slots for an event |
| PUT | `/ptm/my-slots` | `ptm:conduct` | Blocks or reopens my slots |
| POST | `/ptm-bookings/[id]/attendance` | `ptm:conduct` | Marks attended or no-show |
| PUT | `/ptm-bookings/[id]/note` | `ptm:conduct` | Writes the note |
| GET | `/family/ptm` | `signed-in` | Open events with the booking page |
| POST | `/family/ptm/bookings` | `signed-in` | Books a slot |
| POST | `/family/ptm/bookings/[id]/cancel` | `signed-in` | Cancels |
| GET | `/family/ptm/bookings` | `signed-in` | My bookings and shared notes |
| PUT | `/family/ptm/bookings/[id]/feedback` | `signed-in` | Rates the meeting |

Idempotent: `POST /chat/threads`, `POST /chat/threads/[id]/messages` (by `clientId`), `POST /family/ptm/bookings`.

## 8 · Client layer

Custom hooks: `useInbox`, `useChatUnread`, `useThread(id)`, `useMessages(id)` (cursor paging, with Supabase Realtime for new messages in the open thread and a 15-second poll as fallback), `useSendMessage` (optimistic with the `clientId`; shows "sending", then "sent" or "failed, tap to retry"), `useMarkThreadRead`, `useStartThread`, `useOfficeQueue`, `usePtmBookingPage`, `useBookSlot`, `usePtmSchedule`, `useSavePtmNote` (autosave).

## 9 · Screens

Built in [Phase 12](../20-phases/phase-12-communication.md), [Phase 13](../20-phases/phase-13-teacher-portal.md) and [Phase 14](../20-phases/phase-14-family-portals.md).

| Screen | Pattern | Where |
|---|---|---|
| Messages | Split view | Every portal: threads on the left, the conversation on the right; one column on a phone. Child's name and class under each thread. The oversight notice at the top of every conversation |
| Conversation | Chat | Bubbles with time and state; reply to a message; attach a photo, file or voice note; report; "Teachers reply during school hours" banner outside hours |
| New message | Form in a sheet | **Parent:** pick a child, then one of their teachers or the office |
| Class broadcast | Chat | **Teacher:** post to all parents of a section; private replies listed beneath each post |
| Office inbox | List + Chat | `/school/communication/inbox`: unanswered first; assign to oneself; close |
| Oversight | List + Chat | Read-only view for leaders; each opening audited |
| Reports and blocks | List | Moderation queue |
| PTM events | List + Wizard | Date, grades, slot length, who is booked, booking window; publish |
| PTM bookings | Grid | Teachers across, times down; who has booked; families not booked |
| **Teacher:** My PTM | List | Slots in order; tap a booking to mark attendance and write notes |
| **Parent:** Book a meeting | Wizard | Per child: teachers and free slots as chips; clashes flagged; confirmation with time and room |

## 10 · Notifications and jobs

Events: `chat.message` (bundled alert), `chat.office-new` (to office staff), `chat.unanswered` (an office thread unanswered for 4 working hours, to the branch admin), `chat.reported` (to moderators), `chat.blocked` (to the person), `ptm.published` (to guardians of its grades), `ptm.booking-confirmed`, `ptm.booking-cancelled`, `ptm.reminder` (the evening before and an hour before), `ptm.not-booked` (to guardians, two days before booking closes), `ptm.note-shared`, `ptm.follow-up-due` (to the teacher).

Jobs: `chat.sync-broadcast-members` (when enrolments or teaching assignments change), `chat.unanswered-check` (hourly in working hours), `chat.close-threads` (daily: teachers who no longer teach a section; students who left), `ptm.reminders` (every 15 minutes around events), `ptm.complete` (daily: marks past events completed).

Documents: PTM schedule per teacher, PTM appointment slip, PTM summary.

## 11 · Offline

Threads and their last messages are cached. A message typed offline waits in an outbox on the device and is sent on reconnect with its `client_id`; the server orders it by arrival. PTM booking needs a connection.

## 12 · AI

- Translating a message between Urdu and English on request, shown beneath the original (A10).
- Suggesting a reply for the office from the school's own published information; the staff member edits and sends.
- Flagging possibly abusive messages for the moderators' attention; a person decides.

## 13 · Failure cases

- **F-chat-1** A message is sent twice because the first response was lost → the `client_id` returns the first; one bubble.
- **F-chat-2** A parent tries to message a teacher who does not teach their child → the teacher is not in their contacts; a direct request returns `FORBIDDEN`.
- **F-chat-3** The live connection drops → the open thread polls every 15 seconds and shows a small "reconnecting" mark; nothing is lost.
- **F-chat-4** A parent sends 30 messages in a minute → rate-limited; the composer shows when they can send again.
- **F-chat-5** A teacher leaves mid-year → their threads close with "This teacher no longer teaches this class. Please message the new teacher or the office", and remain readable.
- **F-chat-6** Two parents book the same slot at the same moment → the second is refused and offered the nearest free slots.
- **F-chat-7** A teacher is absent on the PTM day → staff block their remaining slots; booked parents are told and offered another time or a chat.
- **F-chat-8** A parent has three children and books three teachers at the same time → warned at the second booking; they may continue.
- **F-chat-9** An attachment fails its scan → the message is not sent; the sender is told the file was refused.
- **F-chat-10** A leader opens a thread through oversight → it opens read-only and an audit entry is written with their name and the thread.

## 14 · Seed data

A class broadcast for every section with a few posts. About 300 parent–teacher threads with realistic exchanges in English, Urdu and Roman Urdu, some unread, some out of hours. Twenty office threads, three unanswered. Four reports (one upheld with a block). One completed PTM with bookings, attendance, notes and ratings; one published PTM with booking open and about half the families booked.

## 15 · Tests

- **T-chat-1** Who can start a thread with whom; one open thread per child–teacher pair.
- **T-chat-2** Only participants read a thread and its messages, by direct query and over Realtime; private replies are visible to two people only.
- **T-chat-3** Oversight needs the permission and writes an audit entry.
- **T-chat-4** Broadcast membership follows enrolment; guardians cannot see each other.
- **T-chat-5** Idempotent send; ordering by server time.
- **T-chat-6** Remove window; moderator removal.
- **T-chat-7** Out-of-hours behaviour and alert bundling.
- **T-chat-8** Blocks and rate limits.
- **T-chat-9** Threads close when teaching or enrolment ends.
- **T-chat-10** Phone numbers never appear in any chat response.
- **T-chat-11** PTM slot generation from times, length and breaks.
- **T-chat-12** Booking: window, own child, one per teacher, double booking refused under concurrency.
- **T-chat-13** Notes: shared part visible to the family; private note never.
- **T-chat-14** Row-level security and branch scope.

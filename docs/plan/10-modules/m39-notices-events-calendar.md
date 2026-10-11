# M39 · Notices, events and calendar

## 1 · Purpose

What the school announces and what is happening when. A notice board that reaches exactly the people it is meant for and records who has seen it; events with sign-up, consent and fees; and one calendar that gathers holidays, exams, meetings, events and due dates for each person.

## 2 · Depends on

[M04](m04-school-setup.md) (years, terms, holidays), [M07](m07-students.md), [M11](m11-academic-structure.md), [M37](m37-messaging-hub.md) (delivery), [M00](m00-shared-kernel.md) (files, approvals). Reads [M17](m17-exams-marks.md), [M38](m38-chat-ptm.md) and [M21](m21-fees.md) for the calendar.

## 3 · Tables

#### `notices` · org

| Column | Type | Rules |
|---|---|---|
| title | text | required |
| title_ur | text | optional |
| body | text | required; rich text |
| body_ur | text | optional |
| category | enum(general, academic, exam, fee, holiday, event, circular, emergency) | default general |
| audience | jsonb | required; `{ kinds: (guardians \| students \| staff)[], branchIds: [], gradeIds?: [], sectionIds?: [], roleKeys?: [] }` |
| branch_ids | uuid[] | required; copied from the audience, for scoping |
| publish_at | timestamptz | optional; empty means on approval |
| expires_at | timestamptz | optional |
| is_pinned | bool | default false |
| needs_acknowledgement | bool | default false |
| also_message | bool | default true; send through the messaging hub as well as the board |
| status | enum(draft, pending_approval, scheduled, published, withdrawn, expired) | default draft |
| published_at | timestamptz | optional |
| approval_request_id | uuid → approval_requests | optional |
| created_by | uuid → profiles | required |

Policy: staff of the organisation, limited in the service to notices whose branches they can access. Family users reach notices only through `notice_recipients`.
Index: (org_id, status, published_at).

#### `notice_recipients` · org +self
Created when a notice is published: one row per person it is for.

| Column | Type | Rules |
|---|---|---|
| notice_id | uuid → notices | required |
| user_id | uuid → profiles | required |
| student_id | uuid → students | optional; the child it concerns, for a guardian |
| read_at | timestamptz | optional |
| acknowledged_at | timestamptz | optional |

Unique: (notice_id, user_id).
Index: (user_id, read_at).

#### `events` · org

| Column | Type | Rules |
|---|---|---|
| title | text | required |
| title_ur | text | optional |
| description | text | optional; rich text |
| kind | enum(academic, sports, cultural, religious, trip, competition, ceremony, meeting, workshop, other) | required |
| starts_at | timestamptz | required |
| ends_at | timestamptz | required; ≥ `starts_at` |
| is_all_day | bool | default false |
| branch_ids | uuid[] | required |
| venue | text | optional |
| room_id | uuid → rooms | optional |
| audience | jsonb | required; the same shape as a notice's |
| organiser_staff_id | uuid → staff | optional |
| needs_registration | bool | default false |
| needs_consent | bool | default false; a guardian must agree, as for a trip |
| capacity | int | optional |
| fee | paisa | default 0 |
| fee_head_id | uuid → fee_heads | optional; required when `fee` is above zero |
| registration_closes_at | timestamptz | optional |
| show_on_website | bool | default false |
| status | enum(draft, published, cancelled, completed) | default draft |

Policy: staff as for notices; family users read published events whose audience includes them, through the service.
Index: (org_id, starts_at).

#### `event_registrations` · branch +family

| Column | Type | Rules |
|---|---|---|
| event_id | uuid → events | required |
| student_id | uuid → students | required |
| status | enum(registered, waitlisted, cancelled, attended, absent) | default registered |
| consent | enum(not_needed, pending, given, refused) | default not_needed |
| consent_by | uuid → profiles | optional |
| consent_at | timestamptz | optional |
| fee_voucher_id | uuid → fee_vouchers | optional |
| emergency_phone | text | optional; for a trip |
| note | text | optional |
| registered_by | uuid → profiles | required |

Policy: a guardian may insert for their own child, give or refuse consent, and cancel before registration closes.
Unique: (event_id, student_id).

#### `event_staff` · branch

| Column | Type | Rules |
|---|---|---|
| event_id | uuid → events | required |
| staff_id | uuid → staff | required |
| duty | text | optional; "Bus 2 supervisor" |

Unique: (event_id, staff_id).

#### `calendar_feeds` · org +self
A private link that lets a person's own calendar app subscribe.

| Column | Type | Rules |
|---|---|---|
| user_id | uuid → profiles | required |
| token_hash | text | required; unique |
| last_used_at | timestamptz | optional |
| revoked_at | timestamptz | optional |

## 4 · Contracts

`packages/contracts/src/modules/notices/`: `notices`, `events`, `event-registrations`, `calendar`.

- `NoticeBoard`: my notices, pinned first, unread marked, with attachments.
- `ReadReceipts`: for a notice — reached, read and acknowledged counts by class, and the people who have not acknowledged.
- `AudienceCount`: how many people an audience resolves to, by kind.
- `EventView`: the event with places left, and for a guardian each child's registration and consent.
- `EventRoster`: registered students by class with consent, fee status and emergency phone.
- `CalendarRange`: `{ from, to }` → entries from every source, each `{ source, kind, title, start, end, allDay, link, studentId? }`.

**The calendar is a read model, not a table.** `CalendarService.range(ctx, from, to)` gathers, for what the caller may see: holidays and term dates ([M04](m04-school-setup.md)); exam papers of a published date sheet ([M17](m17-exams-marks.md)); parent–teacher meetings and the caller's bookings ([M38](m38-chat-ptm.md)); events; fee due dates for a guardian ([M21](m21-fees.md)); homework due dates for a student or guardian ([M15](m15-homework-diary.md)); for staff, their approved leave, training, facility bookings and invigilation duties. Each module exposes a `calendarEntries(ctx, range)` function; the service calls them and merges.

Settings: `notices.approval_required` (default true for notices to guardians; false for staff notices), `notices.default_expiry_days` (default 30), `events.reminder_days` (default `[3, 1]`).

## 5 · Rules

**Notices**

- **R-notices-1** A notice's branches must all be ones its author can access. A teacher may send a notice only to the guardians and students of sections they teach.
- **R-notices-2** With `notices.approval_required`, a notice to guardians or students is approved by a leader other than its author before it is published. An `emergency` notice needs `notices:emergency` instead and goes out at once.
- **R-notices-3** Publishing resolves the audience and creates `notice_recipients` in a job. For a guardian of several children in the audience, one row is created, naming the eldest child concerned. People who join the audience later (a new admission) receive pinned and unexpired notices published in the last 14 days.
- **R-notices-4** With `also_message`, publishing emits `notice.published`, and the messaging hub sends it by its rules; an emergency notice is urgent.
- **R-notices-5** A notice shows as read when opened. With `needs_acknowledgement`, the person must press "I have read this"; those who have not are reminded after 2 days and listed for the class teacher.
- **R-notices-6** A published notice's text cannot be changed. A correction is a new notice, or the notice is withdrawn with a reason; a withdrawn notice disappears from boards and its recipients are told once.
- **R-notices-7** A notice expires at `expires_at`, or `notices.default_expiry_days` after publishing when none is set; expired notices leave the board and stay in the archive.
- **R-notices-8** Attachments follow the upload rules and open through signed links that expire.

**Events**

- **R-notices-9** An event's audience and branch rules are the same as a notice's. Publishing puts it on the calendar of everyone in the audience and, when chosen, on the school website.
- **R-notices-10** Registration is open from publishing until `registration_closes_at`. A guardian registers their own child; staff can register anyone in the audience. When capacity is reached, further registrations are `waitlisted` in order and promoted automatically when a place frees up.
- **R-notices-11** With `needs_consent`, a registration counts only once a guardian with custody has given consent. Consent recorded by staff from a signed paper form notes who recorded it.
- **R-notices-12** An event fee is charged as an on-demand fee voucher through [M21](m21-fees.md) when the registration is confirmed. Cancelling before registration closes cancels an unpaid voucher or raises a refund request for a paid one; after that the school's policy decides.
- **R-notices-13** A trip (`kind = trip`) cannot be marked ready unless every registered student has consent, an emergency phone and, when the fee is compulsory, a paid voucher; the roster flags what is missing, along with each child's medical alert.
- **R-notices-14** Cancelling an event tells everyone registered, cancels unpaid vouchers and lists paid ones for refund.
- **R-notices-15** Attendance at an event can be marked from the roster; it does not change school attendance.
- **R-notices-16** An event that changes the school day (a sports day, a half day) is recorded in [M04](m04-school-setup.md) as a special day; this module only announces it.

**Calendar**

- **R-notices-17** The calendar shows a person only what they could already see in its source module. A guardian sees entries for their own children, each marked with the child's name.
- **R-notices-18** A calendar feed link is secret, shows the same entries, can be revoked, and exposes no more than titles, times and places.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `notices:read` | See all notices of one's branches, with read receipts | ALL_STAFF |
| `notices:create` | Draft notices and submit them | LEADERS, ACADEMIC, TEACHERS, FRONT, ACCOUNTS, HR |
| `notices:publish` | Publish without approval; approve others'; withdraw | ADMINS, vice_principal |
| `notices:emergency` | Publish an emergency notice | principal, director |
| `events:read` | See all events of one's branches with rosters | ALL_STAFF |
| `events:manage` | Create, publish and cancel events; manage rosters and consent | ADMINS, vice_principal, section_head, coordinator |
| `events:register` | Register students of one's own sections | TEACHERS |
| `events:export` | Export rosters | ADMINS, coordinator |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/notices` | `notices:read` | Lists for management; filter by status, category, branch |
| POST | `/notices` | `notices:create` | Creates a draft |
| GET | `/notices/[id]` | `notices:read` | One notice |
| PATCH | `/notices/[id]` | `notices:create` | Edits a draft |
| POST | `/notices/audience-count` | `notices:create` | Counts an audience |
| POST | `/notices/[id]/submit` | `notices:create` | Publishes, schedules, or sends for approval |
| POST | `/notices/[id]/withdraw` | `notices:publish` | Withdraws with a reason |
| POST | `/notices/[id]/pin` | `notices:publish` | Pins or unpins |
| POST | `/notices/emergency` | `notices:emergency` | Publishes an emergency notice at once |
| GET | `/notices/[id]/receipts` | `notices:read` | Read receipts |
| POST | `/notices/[id]/remind` | `notices:publish` | Reminds those who have not acknowledged |
| GET | `/notice-board` | `signed-in` | My notices |
| GET | `/notice-board/[id]` | `signed-in` | One of my notices; marks it read |
| POST | `/notice-board/[id]/acknowledge` | `signed-in` | Acknowledges |
| GET | `/events` | `events:read` | Lists for management |
| POST | `/events` | `events:manage` | Creates a draft |
| GET | `/events/[id]` | `events:read` | One event with counts |
| PATCH | `/events/[id]` | `events:manage` | Edits |
| POST | `/events/[id]/publish` | `events:manage` | Publishes |
| POST | `/events/[id]/cancel` | `events:manage` | Cancels |
| GET | `/events/[id]/roster` | `events:read` | The roster |
| POST | `/events/[id]/registrations` | `events:register` | Registers students |
| PATCH | `/event-registrations/[id]` | `events:manage` | Records paper consent; marks attendance; cancels |
| PUT | `/events/[id]/staff` | `events:manage` | Sets staff on duty |
| GET | `/events/[id]/export` | `events:export` | Exports the roster |
| GET | `/my-events` | `signed-in` | Events for me or my children |
| GET | `/my-events/[id]` | `signed-in` | One event as I see it |
| POST | `/family/events/[id]/register` | `signed-in` | Registers my child, with consent when needed |
| POST | `/family/event-registrations/[id]/consent` | `signed-in` | Gives or refuses consent |
| POST | `/family/event-registrations/[id]/cancel` | `signed-in` | Cancels |
| GET | `/calendar` | `signed-in` | My calendar for a date range |
| GET | `/calendar/feed` | `signed-in` | My feed link status |
| POST | `/calendar/feed` | `signed-in` | Creates or replaces my feed link |
| DELETE | `/calendar/feed` | `signed-in` | Revokes it |
| GET | `/public/calendar-feed/[token]` | `public` | The calendar in iCalendar format for a valid token |
| GET | `/public/[school]/events` | `public` | Events marked for the website |

Idempotent: `POST /notices/[id]/submit`, `POST /notices/emergency`, `POST /family/events/[id]/register`.

## 8 · Client layer

Custom hooks: `useNoticeBoard`, `useNotice`, `useAcknowledgeNotice`, `useNoticeDraft` (autosave), `useAudienceCount` (debounced), `useReadReceipts`, `useEvents`, `useEventRoster`, `useRegisterForEvent`, `useGiveEventConsent`, `useCalendar(from, to)`, `useCalendarFeed`.

A shared `<AudiencePicker />` (kinds, branches, grades, sections, roles, with a live count) is used here and by the message composer ([M37](m37-messaging-hub.md)) and surveys ([M40](m40-complaints-surveys.md)).

## 9 · Screens

Built in [Phase 12](../20-phases/phase-12-communication.md), [Phase 13](../20-phases/phase-13-teacher-portal.md) and [Phase 14](../20-phases/phase-14-family-portals.md).

| Screen | Pattern | Where |
|---|---|---|
| Notice board | List + Detail | Every portal: pinned first; unread marked; category chips; attachments; "I have read this" when required |
| Notices (manage) | List | `/school/communication/notices`: status; reach and read counts |
| Compose notice | Form page | English and Urdu side by side; audience picker with count; schedule; a preview as a parent will see it |
| Read receipts | Report | By class; who has not acknowledged; remind |
| Events | List + Calendar | Upcoming; registration status |
| Event (manage) | Detail | Tabs: Details, Roster, Consent, Fees, Staff on duty; "Trip readiness" checklist |
| Calendar | Calendar | Every portal: month, week and agenda views; colour by source with a legend and labels; a guardian can filter by child |
| **Parent:** Event | Detail | What, when, where, cost; register a child; give consent; pay |
| **Teacher:** Class events | List | Register students of my section |

## 10 · Notifications and jobs

Events: `notice.published`, `notice.emergency` (urgent), `notice.withdrawn`, `notice.acknowledge-reminder`, `notice.approval-requested`, `event.published`, `event.reminder`, `event.registration-confirmed`, `event.waitlist-promoted`, `event.consent-needed`, `event.cancelled`, `event.changed` (time or place).

Jobs: `notices.publish` (fans out recipients; per notice), `notices.publish-scheduled` (every 5 minutes), `notices.expire` (daily), `notices.acknowledge-reminders` (daily 10:00), `notices.late-joiners` (daily: recent notices for new members of an audience), `events.reminders` (daily 17:00 and hourly on the day), `events.complete` (daily).

Documents: notice as a printable circular, event roster, consent form to print, trip sheet (students, emergency phones, medical alerts, staff on duty).

## 11 · Offline

The notice board and the calendar are cached and readable offline. Acknowledging is queued. Registration needs a connection.

## 12 · AI

- Drafting a circular from a few bullet points, and translating it into Urdu (A10); always edited and approved by a person.
- Summarising a long notice into two lines for the message that accompanies it.

## 13 · Failure cases

- **F-notices-1** A notice to 4,000 people is published → the notice is `published` at once; recipients are created by a job in batches; the board shows "sending to 4,000 (1,200 done)".
- **F-notices-2** A mistake is found in a published notice → withdraw it and publish a corrected one; recipients see the new one and a line that the earlier one was withdrawn.
- **F-notices-3** A teacher tries to send a notice to the whole grade → the audience is cut to their own sections.
- **F-notices-4** A scheduled notice's author leaves the school before the time → it is still published; it was approved.
- **F-notices-5** A trip has 40 places and 46 register → six are waitlisted in order; when one cancels, the first is promoted and told.
- **F-notices-6** A guardian registers a child for a trip but does not consent → the place is held as pending; reminders go out; at closing an unconsented registration is released.
- **F-notices-7** An event with paid fees is cancelled → vouchers that are unpaid are cancelled; paid ones appear as refund requests for the accountant.
- **F-notices-8** A calendar source fails (the exams service errors) → the calendar still shows the other sources, with a small note that exams could not be loaded.
- **F-notices-9** A calendar feed link is shared by mistake → the user revokes it and creates a new one; the old link stops at once.
- **F-notices-10** An emergency closure is announced at 6 am → it bypasses quiet hours, goes on every channel, and is pinned to the top of every board.

## 14 · Seed data

About 40 notices over three months in every category and status, in English and Urdu, some pinned, some needing acknowledgement (with partial acknowledgement), two waiting for approval, one withdrawn. Fifteen events: past with attendance, an upcoming sports day, a paid trip with a waitlist and pending consents, a cancelled event. A calendar feed for two users.

## 15 · Tests

- **T-notices-1** Audience resolution for every combination of kinds, branches, grades, sections and roles.
- **T-notices-2** Branch and section limits on who can send to whom.
- **T-notices-3** Approval rule; the emergency path.
- **T-notices-4** Fan-out creates each recipient once; one row per guardian with several children; late joiners.
- **T-notices-5** A family user reads only notices addressed to them, by direct query too.
- **T-notices-6** Read and acknowledge; reminders only to those who have not.
- **T-notices-7** A published notice cannot be edited; withdraw and expiry.
- **T-notices-8** Event capacity, waitlist order and promotion under concurrency.
- **T-notices-9** Consent rules; paper consent recorded by staff.
- **T-notices-10** Fee voucher created on confirmation; cancelled or refunded on cancellation.
- **T-notices-11** Trip readiness flags each missing item.
- **T-notices-12** The calendar shows only what each role may see; a failing source does not break it.
- **T-notices-13** Feed token: valid, revoked, unknown.
- **T-notices-14** Row-level security and branch scope.

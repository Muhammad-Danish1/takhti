# Phase 12 · Communication

**Goal.** The school talks to its people, and listens, through one system: every notification with real wording in English and Urdu, bulk messages, chat with the office, notices, events, the calendar, parent–teacher meetings, complaints and surveys.

**Depends on.** [Phase 8](phase-08-academics.md) and [Phase 9](phase-09-finance.md), because most messages are about attendance, results and fees.

**Portal.** `/school`: the Communication group and its settings.

**Modules.** [M37](../10-modules/m37-messaging-hub.md), [M38](../10-modules/m38-chat-ptm.md), [M39](../10-modules/m39-notices-events-calendar.md), [M40](../10-modules/m40-complaints-surveys.md).

## Read first

[13 · Jobs, notifications, files and documents](../00-foundation/13-notifications-jobs-and-files.md) (section 2), each module in full, and the [notification catalogue](../30-reference/notification-catalogue.md).

Everything is delivered by the local stand-ins and read in `/dev/outbox`. Real WhatsApp, SMS and email are connected in [Phase 18](phase-18-integrations.md) with no change to these screens.

## Work packages

### 12.1 · The wording of every notification

Until now each event had a placeholder template. This work package writes the real ones.

- [ ] For every event in the [notification catalogue](../30-reference/notification-catalogue.md): the in-app title and body, and the WhatsApp, SMS and email texts where the rule uses those channels, **in English and Urdu**.
- [ ] Rules of wording: the school's name first on outside channels; the child's name before the news; amounts as `Rs 8,500`; dates as `12 Oct`; one message, one purpose; a link only where it helps and always one that needs sign-in for anything personal; never a password, a full identity number or a medical detail.
- [ ] SMS texts fit one part in English where possible; the Urdu part count is checked.
- [ ] Each template renders with sample data in a test; an unknown variable fails the build.
- [ ] A review by a native Urdu reader of every Urdu template before the phase closes. Record who reviewed and when in the catalogue file.

### 12.2 · Messaging hub screens — [M37](../10-modules/m37-messaging-hub.md)

| Screen | Path | Pattern |
|---|---|---|
| Notifications (every shell; the bell exists from Phase 4) | `/…/notifications` | List |
| My preferences | in My account | Settings |
| **Compose message** | `/school/communication/messages/new` | Wizard |
| Campaigns | `/school/communication/messages` | List + Detail |
| Delivery log | `/school/communication/deliveries` | List |
| A person's messages | a sheet from a guardian or staff record | Detail in a sheet |
| Notification settings | `/school/settings/notifications` | Settings |
| WhatsApp templates | `…/notifications/whatsapp` | List + Form in a sheet |
| Channels and credit | `…/notifications/channels` | Settings |
| Emergency broadcast | `/school/communication/messages/emergency` | Form page |

The composer shows a live audience count with "no number" warnings, a phone preview in both languages, the SMS part count and the cost against credit before sending.

### 12.3 · Chat — [M38](../10-modules/m38-chat-ptm.md)

Messages (split view) in `/school`; the office inbox with unanswered first; oversight (read-only, each opening audited); reports and blocks. Realtime for the open thread with polling as the fallback; the oversight notice at the top of every conversation.

### 12.4 · Notices, events and calendar — [M39](../10-modules/m39-notices-events-calendar.md)

Notice board (every shell); manage notices; compose with the shared `AudiencePicker`; read receipts; events list and calendar; event detail with roster, consent, fees and trip readiness; the **Calendar** in every shell with month, week and agenda views, gathering every module's `calendarEntries`.

### 12.5 · Parent–teacher meetings — [M38](../10-modules/m38-chat-ptm.md)

PTM events (wizard); the bookings grid (teachers across, times down); families not booked; booking on a parent's behalf.

### 12.6 · Complaints and surveys — [M40](../10-modules/m40-complaints-surveys.md)

Complaints queue and detail (the conversation with the raiser on one side, internal notes on the other); summary; **Raise a concern** for staff; survey builder with a respondent preview and built-in templates; results with breakdowns and "too few responses"; teacher feedback.

### 12.7 · Dashboard and reports

Widgets: unanswered office messages, notices awaiting approval, notices not acknowledged, events this week, open and overdue complaints, surveys open with response rate, message credit. Reports: delivery statistics, complaint summary, read receipts.

## Journeys to automate

| Journey | Role | Steps |
|---|---|---|
| A notice | Coordinator, principal, guardian | Write in English and Urdu → audience Grade 6 guardians (count shown) → approval → published → the guardian's board shows it and the message is in the outbox → acknowledge → receipts update |
| Quiet hours | Coordinator | Publish at 10 pm with the clock set → in-app at once, the outside message held until 8 am |
| An emergency | Principal | Emergency broadcast → every channel at once, quiet hours ignored, pinned on every board |
| A bulk reminder | Accountant | Compose to defaulters → 12 without a number flagged → estimate → send → cancel midway → counts are exact |
| Low credit | Accountant | A campaign larger than the credit is refused until the choice "send what the credit allows" is made |
| No duplicates | System | Three children absent in one family → one message naming all three; dispatch run twice → still one |
| Opt out | Guardian | Reply STOP (simulated inbound) → non-compulsory messages stop on that channel; a fee receipt still arrives |
| Chat | Guardian, teacher, principal | The guardian messages their child's teacher at 9 pm → delivered silently with the hours banner → the teacher replies in the morning → the principal opens the thread through oversight and an audit entry is written |
| Chat limits | Guardian | Cannot start a thread with a teacher who does not teach their child |
| A trip | Coordinator, guardian | Paid trip with 40 places → 46 register → 6 waitlisted → consent pending blocks readiness → a cancellation promotes the first on the list |
| PTM | Coordinator, guardian, teacher | Publish → a guardian books two teachers; a clash is warned → two guardians race for one slot; one gets it → attendance and a shared note |
| A complaint | Guardian, section head, principal | Complaint about the class teacher → routed past that teacher → acknowledged → not resolved in time → escalated → resolved → reopened → closed with a rating |
| Anonymous survey | Guardian, principal | Answer an anonymous survey → results show; a class with three responses shows "too few"; no screen or export connects an answer to a person |

## Exit checks

1. Every screen meets "Done when".
2. All thirteen journeys pass in the browser.
3. Every event in the catalogue has real templates in both languages; the template test passes; the Urdu review is recorded.
4. A test emits every event in the catalogue with sample data and finds, for each, the expected rows in `notifications` and `message_deliveries` and nothing extra.
5. A guardian's account receives, over Realtime and over the API, only its own notifications and threads.
6. `pnpm check`, `pnpm test:db`, `pnpm test:e2e`.

## Left for later, on purpose

- Teachers' and families' chat, notices and booking screens on their phones: [Phase 13](phase-13-teacher-portal.md), [Phase 14](phase-14-family-portals.md).
- Real providers and WhatsApp template approval: [Phase 18](phase-18-integrations.md).
- The parent chatbot: [Phase 19](phase-19-ai.md).

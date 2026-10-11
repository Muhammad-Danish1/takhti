# Notification catalogue

How every message the product sends is decided and worded. The mechanism is in [13 · Jobs, notifications, files and documents](../00-foundation/13-notifications-jobs-and-files.md); the tables and screens are in [M37](../10-modules/m37-messaging-hub.md); the complete list of events, each with the note from its module spec about who is told and when, is generated in the [events index](events-index.md).

The source of truth in code is `packages/contracts/src/catalogue.ts`, gathered from each module's `<module>.events.ts`. This document is the rule book those files follow.

## Categories

Every event belongs to one category. A person mutes by category, and the bell groups by it.

| Category | Event prefixes |
|---|---|
| `fees` | `fee`, `payment`, `cash-session`, `settlement`, `bank-statement`, `reconciliation`, `wallet`, `shop`, `canteen` |
| `attendance` | `attendance`, `student-leave`, `gate-pass`, `visitor`, `transport`, `hostel`, `mess` |
| `academics` | `timetable`, `substitution`, `syllabus`, `scheme`, `lesson-plan`, `diary`, `homework`, `resource`, `quiz`, `live-class`, `exam`, `marks`, `invigilation`, `result`, `report-card`, `remarks`, `board-registration`, `board-result`, `question`, `question-paper`, `behaviour`, `concern`, `suspension`, `house`, `counselling`, `library`, `risk` |
| `health` | `clinic`, `medication`, `screening`, `health`, `incident` |
| `messages` | `chat`, `ptm`, `notice`, `event`, `complaint`, `survey`, `appointment`, `campaign` |
| `admissions` | `enquiry`, `application`, `student`, `promotion`, `section`, `profile-change`, `certificate`, `id-card`, `alumni` |
| `people` | `staff`, `staff-attendance`, `leave`, `payroll`, `payslip`, `loan`, `appraisal`, `observation`, `goal`, `training`, `applicant` |
| `money-office` | `expense`, `petty-cash`, `budget`, `purchase-request`, `purchase-order`, `goods`, `vendor-bill`, `vendor-payment`, `journal`, `period`, `posting`, `recurring-entry`, `structure`, `tax-rule`, `tax-certificate`, `filing`, `filer-status`, `compliance`, `stock`, `asset`, `depreciation` |
| `approvals` | `approval` |
| `system` | `auth`, `invitation`, `membership`, `org`, `branch`, `academic-year`, `holiday`, `grading-scheme`, `teacher-assignment`, `import`, `export`, `job`, `integrity`, `integration`, `biometric-device`, `webhook-endpoint`, `subscription`, `support-session`, `plan`, `messaging`, `report`, `schedule`, `hq`, `activity`, `ai`, `knowledge`, `website`, `ticket`, `booking` |

## Audiences

An event's rule names one or more audiences. Each is resolved by a function in `packages/core/src/modules/messaging/audiences.ts`.

| Audience | Who |
|---|---|
| `guardians-of-student` | Guardians linked to the student who receive messages; the primary contact when none is marked |
| `guardians-of-family` | The same, for a family as a whole |
| `guardians-of-section` | Guardians of every active student of a section |
| `student` | The student's own login, when they have one |
| `class-teacher-of-section`, `teachers-of-section` | From the teaching assignments |
| `staff` | One named staff member |
| `manager-of-staff` | The person they report to |
| `role-at-branch` | Everyone holding a role at a branch, for example accountants of Main Campus |
| `role-in-org` | Everyone holding a role in the organisation |
| `requester`, `approvers-of-request` | For approvals |
| `owner-of-record` | Whoever is assigned: a ticket's assignee, a complaint's owner, an enquiry's officer |
| `user` | One named login |
| `platform-staff` | Takhti's own staff |

## Default channels

Unless an event says otherwise, its channels follow its audience. An organisation can change the order per event.

| Audience kind | Channels, in order of preference | Always |
|---|---|---|
| Guardians | WhatsApp, then SMS | In-app (and push, once the apps exist) |
| Students | — | In-app |
| Staff | — for most events; email for documents and weekly digests | In-app |
| Staff, urgent | SMS | In-app |
| Platform staff | Email | In-app |

Staff are not sent WhatsApp or SMS for routine work; they have the app open. Parents get WhatsApp first because that is what they read.

## Urgent events

These ignore quiet hours and mutes, and go on every enabled channel for their audience at once.

`notice.emergency`, `attendance.absent` (the first-bell absence message), `transport.not-dropped`, `transport.trip-overdue`, `hostel.absent-at-night`, `hostel.overdue-return`, `clinic.emergency`, `clinic.sent-home`, `incident.serious`, `complaint.safeguarding`, `counselling.urgent`, `ticket.safety-hazard`, `behaviour.serious`, `hq.alert-critical`, `auth.locked`, `auth.new-device`.

One-time sign-in codes are sent by the sign-in system and are always immediate.

## Compulsory events

A person cannot mute these, because they are receipts, security notices or safety messages: every urgent event above, plus `fee.payment-received`, `fee.payment-reversed`, `fee.cheque-bounced`, `fee.refund-paid`, `wallet.topped-up`, `invitation.created`, `auth.password-changed`, `membership.suspended`, `result.published`, `suspension.approved`, `payslip.published`.

## Events merged per family

When several children of one family are affected in the same dispatch, the guardian gets one message naming them all: `attendance.absent`, `attendance.late`, `fee.voucher-issued`, `fee.reminder`, `fee.overdue`, `fee.fine-added`, `diary.digest`, `behaviour.digest`, `result.published`, `notice.published`, `event.published`, `ptm.published`, `exam.datesheet-published`, `campaign.consent-requested`.

## Digests

These are collected and sent once a day (or week) rather than one by one: `diary.digest`, `behaviour.digest`, `stock.low`, `messaging.contact-invalid`, `hq.alert-digest`, `hq.weekly-digest`, `library.due-soon`, `reconciliation.unmatched`, and `activity.flag-raised` below high severity.

## Wording rules

Every template is written in English and Urdu and reviewed by a native Urdu reader ([Phase 12](../20-phases/phase-12-communication.md)).

1. **The school's name first** on WhatsApp and SMS, so the parent knows who is writing: "Roshan Public School:".
2. **The child's name before the news.** "Hassan was marked absent today", not "Absence notification".
3. **One message, one purpose**, in one or two sentences. An SMS fits one part in English wherever possible.
4. **Plain words.** "Fees due", "Paid", "Late". No codes, no internal terms, no capitals for emphasis.
5. **Amounts** as `Rs 8,500`. **Dates** as `12 Oct`, with the weekday when it helps. **Times** as `8:15 am`.
6. **What to do next**, when there is something to do, and a link only then.
7. **Nothing private in the text.** No passwords, no full identity numbers, no medical details, no salary figures, no marks unless the school has switched that on. A link that shows anything personal requires sign-in.
8. **Polite, never threatening.** A fee reminder reminds; it does not warn.
9. **Urdu is written as Urdu**, not translated word for word, in Nastaliq, with numbers and amounts kept left-to-right.
10. **The same facts in both languages.** A template pair is tested to use the same variables.

Variables are named in camel case and listed per event in code: `{{schoolName}}`, `{{studentName}}`, `{{studentNames}}`, `{{className}}`, `{{guardianName}}`, `{{amount}}`, `{{dueDate}}`, `{{date}}`, `{{time}}`, `{{receiptNo}}`, `{{voucherNo}}`, `{{link}}`, `{{staffName}}`, `{{subject}}`, `{{examName}}`, `{{reason}}`.

## Sample templates

The pattern for the most-sent messages. The full set is written in [Phase 12](../20-phases/phase-12-communication.md).

### `attendance.absent` — to guardians, urgent, merged per family

| | English | Urdu |
|---|---|---|
| WhatsApp / SMS | {{schoolName}}: {{studentNames}} was marked absent today, {{date}}. If this is a mistake or your child is unwell, please tell the class teacher. | {{schoolName}}: {{studentNames}} آج {{date}} کو غیر حاضر رہے۔ اگر یہ درست نہیں یا بچہ بیمار ہے تو براہِ کرم کلاس ٹیچر کو اطلاع دیں۔ |
| In-app | **Absent today** — {{studentNames}}, {{date}} | **آج غیر حاضر** — {{studentNames}}، {{date}} |

### `fee.voucher-issued` — to guardians, merged per family

| | English | Urdu |
|---|---|---|
| WhatsApp / SMS | {{schoolName}}: The fee voucher for {{period}} is ready for {{studentNames}}. Amount Rs {{amount}}, due {{dueDate}}. View or pay: {{link}} | {{schoolName}}: {{studentNames}} کا {{period}} کا فیس واؤچر تیار ہے۔ رقم Rs {{amount}}، آخری تاریخ {{dueDate}}۔ دیکھیں یا ادا کریں: {{link}} |

### `fee.reminder` — to guardians, merged per family

| | English | Urdu |
|---|---|---|
| WhatsApp / SMS | {{schoolName}}: A reminder that fees of Rs {{amount}} for {{studentNames}} are due on {{dueDate}}. Pay here: {{link}} | {{schoolName}}: یاد دہانی — {{studentNames}} کی فیس Rs {{amount}} کی آخری تاریخ {{dueDate}} ہے۔ یہاں ادا کریں: {{link}} |

### `fee.payment-received` — to guardians, compulsory

| | English | Urdu |
|---|---|---|
| WhatsApp / SMS | {{schoolName}}: We received Rs {{amount}} for {{studentNames}}. Receipt {{receiptNo}}. Thank you. {{link}} | {{schoolName}}: {{studentNames}} کے لیے Rs {{amount}} وصول ہو گئے۔ رسید نمبر {{receiptNo}}۔ شکریہ۔ {{link}} |

### `result.published` — to guardians, compulsory, merged per family

| | English | Urdu |
|---|---|---|
| WhatsApp / SMS | {{schoolName}}: The {{examName}} result for {{studentNames}} is ready. See the report card: {{link}} | {{schoolName}}: {{studentNames}} کا {{examName}} کا نتیجہ تیار ہے۔ رپورٹ کارڈ دیکھیں: {{link}} |

### `diary.digest` — to guardians, daily

| | English | Urdu |
|---|---|---|
| WhatsApp | {{schoolName}}: Today's diary for {{studentName}} ({{className}}) is ready, with {{homeworkCount}} homework item(s). Read it here: {{link}} | {{schoolName}}: {{studentName}} ({{className}}) کی آج کی ڈائری تیار ہے، ہوم ورک: {{homeworkCount}}۔ یہاں پڑھیں: {{link}} |

### `notice.emergency` — to everyone in the audience, urgent

| | English | Urdu |
|---|---|---|
| WhatsApp / SMS | {{schoolName}} — IMPORTANT: {{title}}. {{summary}} | {{schoolName}} — اہم اطلاع: {{title}}۔ {{summary}} |

### `transport.dropped` — to guardians

| | English | Urdu |
|---|---|---|
| WhatsApp | {{schoolName}}: {{studentName}} got off the bus at {{stopName}} at {{time}}. | {{schoolName}}: {{studentName}} {{time}} پر {{stopName}} پر بس سے اتر گئے۔ |

### `leave.approved` — to a staff member, in-app

| | English | Urdu |
|---|---|---|
| In-app | **Leave approved** — {{days}} day(s) from {{fromDate}} to {{toDate}} | **چھٹی منظور** — {{fromDate}} سے {{toDate}} تک {{days}} دن |

The Urdu above is a starting draft written with this plan. It must be read and corrected by a native Urdu reader before any school sees it; record the reviewer and date here when that is done.

| Reviewed by | Date | Scope |
|---|---|---|
| — | — | Not yet reviewed |

## WhatsApp templates

WhatsApp allows a business to start a conversation only with a template it has approved. For each message kind that uses WhatsApp, one template per language is registered ([M37](../10-modules/m37-messaging-hub.md) `whatsapp_templates`), in the `utility` category for receipts, reminders and school information, and `authentication` for sign-in codes. Until a template is approved, that message kind falls back to SMS. The mapping from event to template name is part of the catalogue in code; submitting the set for approval is a task of [Phase 18](../20-phases/phase-18-integrations.md).

## Adding an event

1. Declare it in the module's `<module>.events.ts` with its payload schema, category, variables, default rule and templates in both languages.
2. Call `emit` at the right point in the service, inside the transaction.
3. Add it to the module spec's section 10 with a note on who is told.
4. Run `pnpm plan:check`; the events index is regenerated.
5. A test emits it with sample data and checks the notifications and deliveries it produces.

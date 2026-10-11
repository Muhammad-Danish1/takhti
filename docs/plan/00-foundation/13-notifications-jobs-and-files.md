# 13 · Jobs, notifications, files and documents

Four shared services every module uses. Their tables are in [M00](../10-modules/m00-shared-kernel.md) and [M37](../10-modules/m37-messaging-hub.md).

## 1 · Background jobs

### Why a queue inside Postgres

A job row is inserted in the same transaction as the change that needs it. If the change rolls back, the job does not exist. If it commits, the job cannot be lost. Nothing outside Docker is required.

### Defining and queueing

```ts
// packages/core/src/modules/fees/fees.jobs.ts
export const generateVouchersJob = defineJob({
  name: 'fees.generate-vouchers',
  payload: z.object({ branchId: Id, period: Period, runId: Id }),
  retries: 3,
  timeoutSeconds: 300,
  concurrencyKey: (p) => `fees.generate:${p.branchId}:${p.period}`,   // one at a time per branch and month
  handler: async (ctx, payload) => { … },                             // runs inside runAsSystem(orgId)
});

await enqueue(ctx, generateVouchersJob, payload, { dedupeKey: `…` });
```

### The worker (`packages/worker`)

1. **Claim**: every second, take up to N queued jobs whose time has come, with `for update skip locked`, so several workers never take the same job.
2. **Run**: call the handler inside `runAsSystem` for the job's organisation, with the job's timeout. The database cancels any single statement that runs past the limit, so the handler's transaction rolls back cleanly; the worker's own clock covers time spent outside the database. (A limit on the whole transaction is not used: it ends the connection, which the driver does not survive gracefully.)
3. **Finish**: mark `succeeded`, or on failure requeue with exponential backoff and jitter until the retry limit, then mark `failed`.
4. **Reap**: a job still `running` long after its timeout is requeued (the worker that held it crashed).
5. **Schedule**: once a minute, read `job_schedules` (cron expressions, in Pakistan time) and queue anything due. A schedule can never queue the same run twice (dedupe key = schedule name + due time). After an outage a schedule runs once for its latest due time, not once per missed time; a schedule that is new waits for its next due time. Schedules are defined in code with `defineSchedule` and written to the table when the worker starts.
6. **Fairness**: at most a set number of jobs per organisation at once, so one large school cannot starve the others.
7. **Shutdown**: on a stop signal the worker stops claiming, lets running jobs finish, then exits.

### Rules for handlers

- Idempotent: running twice equals running once.
- Short: a job that loops over many records queues one child job per record or per small batch.
- Honest state: the business record shows the truth ("3 of 800 reminders failed"), never "sent" when it was only queued.
- No direct calls to outside services from request handlers. They always go through a job.

### Scheduled jobs (seeded)

Every module names its jobs in section 10 of its spec; the complete list with times is generated in the [jobs index](../30-reference/jobs-index.md). The ones that shape a school's day:

| Schedule | Job | Time (Pakistan) |
|---|---|---|
| Add late fines to overdue vouchers | `fees.assess-fines` | 01:00 daily |
| Fee reminders (before, on and after the due date) | `fees.reminders` | 10:00 daily |
| Ask providers about pending online payments | `payments.inquire-pending` | every 2 minutes |
| Attendance not marked alert | `attendance.alert-unmarked` | per branch, 30 minutes after the first bell |
| Absent-today messages to parents | `attendance.notify-absent` | per branch, 45 minutes after the first bell |
| Turn biometric punches into staff attendance | `staff-attendance.build-days` | every 5 minutes on working days |
| Library due and overdue reminders | `library.reminders` | 15:00 daily |
| Leave accrual | `leave.monthly-accrual` | 1st of each month |
| Document expiry reminders (registration, contracts, vehicle papers) | `shared.expiry-reminders` | 08:30 daily |
| KPI snapshots for dashboards, then alert rules | `reports.snapshot-kpis`, `hq.evaluate-alerts` | 23:30 and 00:30 daily |
| Integrity checks: `shared.integrity` runs every module's own check (`fees.integrity`, `accounting.integrity`, `payroll.integrity`, …) | `shared.integrity` | 02:00 daily |
| Purge expired idempotency keys, rate limits and old positions | `shared.cleanup` | 03:00 daily |
| Subscription invoices, renewals and trial expiry | `platform.billing` | 06:00 daily |

### Watching the queue

A staff screen (permission `jobs:read`) lists running, queued and failed jobs for the organisation with their errors, and lets a permitted user retry or cancel one. Platform staff see all organisations.

## 2 · Events and notifications

### Flow

```
service: emit(ctx, 'fee.payment-received', payload)
   └─ row in domain_events (same transaction)
   └─ job notify.dispatch
        ├─ find rules subscribed to the event (organisation rules, else system defaults)
        ├─ resolve the audience → users and contact points
        ├─ apply each recipient's preferences and quiet hours
        ├─ render the template in the recipient's language
        ├─ always: create the in-app notification
        └─ queue one delivery job per recipient per outside channel
              └─ provider adapter → sent | failed → fallback to the next channel
```

### Channels

| Channel | Used for | Local stand-in |
|---|---|---|
| In-app | Everything; the bell in every portal | Real |
| Push | Mobile apps (Phase 23) | Logged |
| WhatsApp | Parents: fees, attendance, results, notices | Logged to the delivery table and shown in the developer outbox |
| SMS | One-time codes; parents without WhatsApp; fallback | Logged |
| Email | Staff: invitations, payslips, reports | Supabase's local mail catcher |

The order of preference and fallback is a setting per organisation and per kind of message. Default for parents: WhatsApp, then SMS, then in-app only.

### Audiences

Resolvers turn an event into recipients: `guardians-of(student)`, `class-teacher-of(section)`, `teachers-of(section)`, `role(accountant, branch)`, `user(id)`, `staff(id)`, `requester`, `approvers-of(request)`.

For a guardian, the primary contact is used unless `student_guardians.receives_messages` says otherwise. One message is sent per family when several children are affected by the same event (one fee reminder listing all three children, not three messages).

### Templates

- Default templates live in code, in English and Urdu, with named variables: `{{studentName}}`, `{{amount}}`, `{{dueDate}}`, `{{payLink}}`.
- An organisation can edit the wording. A template is validated: every variable it uses must exist for that event, and it must render with sample data before it can be saved.
- WhatsApp templates must be approved by Meta before use. Each message kind maps to an approved template name; an unapproved kind falls back to SMS.
- Length is checked for SMS, with the number of parts shown, because cost depends on it. Urdu SMS uses a different encoding and fits fewer characters per part.

### Rules

1. Quiet hours (default 9 pm to 8 am) delay non-urgent messages. Urgent kinds (emergency closure, child absent, one-time codes) ignore quiet hours.
2. A user can mute a kind of message per channel, except those marked compulsory (security, one-time codes, fee receipts).
3. The same event to the same person is sent once (dedupe key: event id + recipient + channel).
4. Bulk sends are throttled to the provider's rate.
5. SMS and WhatsApp spend is recorded per organisation in a credit ledger. When credit runs out, messages fall back to in-app and the owner is told.
6. Every delivery records the provider's message id and final status (`queued`, `sent`, `delivered`, `read`, `failed`) from the provider's callback.

The full list of events and their default messages is in the [notification catalogue](../30-reference/notification-catalogue.md).

## 3 · Files

### Buckets (all private except one)

| Bucket | Holds |
|---|---|
| `photos` | Student, staff and guardian photos |
| `documents` | Uploaded documents: B-Forms, certificates, contracts, proof of payment |
| `learning` | Homework files, learning resources, submissions |
| `imports` | Uploaded spreadsheets, deleted after 7 days |
| `exports` | Generated exports, deleted after 7 days |
| `generated` | PDFs: challans, receipts, report cards, certificates, payslips |
| `knowledge` | Textbooks and policies for AI |
| `site` | **Public**: images for the school website |

Path: `{org_id}/{purpose}/{yyyy}/{file_id}.{ext}`.

### Access

Clients never talk to Storage with their own rights. The API checks access in a service, then issues a signed upload or download link with the service key. Storage policies deny everything else. This keeps one place where "who may see this file" is decided.

### Limits

| Purpose | Types | Max size |
|---|---|---|
| Photo | JPEG, PNG, WebP | 2 MB; resized to 600px and a 96px thumbnail |
| Document | PDF, JPEG, PNG | 10 MB |
| Learning resource | PDF, DOCX, PPTX, XLSX, images, MP4 | 100 MB |
| Import | CSV, XLSX | 20 MB |
| Proof of payment | JPEG, PNG, PDF | 5 MB |
| Textbook for AI | PDF | 50 MB |
| Website image | JPEG, PNG, WebP | 4 MB |

### Lifecycle

`pending` (link issued) → `ready` (confirmed and checked) → `deleted`. A `pending` file never confirmed is removed after 24 hours. A file is linked to its record through `attachments` or a direct `…_file_id` column; an integrity job reports files with no owner.

## 4 · Documents and printing

### One pipeline for every printed document

```
renderDocument(ctx, kind, params)
  1. the service gathers the data and checks access
  2. a print page renders it as HTML:  /print/<kind>?token=<short-lived>
  3. headless Chromium turns the page into a PDF (A4, embedded fonts)
  4. the PDF is stored in `generated`, recorded in `generated_documents`
  5. the caller gets a file id
```

- The print pages are React components in `apps/web/app/print/`, using the same theme with print CSS. What is on screen in the print view is exactly what is in the PDF.
- Fonts (Lexend, IBM Plex Sans, IBM Plex Mono, Noto Nastaliq Urdu) are bundled with the app, so rendering never depends on a font service.
- A single document renders inside the request (a few seconds at most). A batch is a job that renders in groups of 25 and merges the result.
- If the PDF worker is unavailable, the user is offered the print view in the browser, which produces the same page.
- Every generated document has a number, a content hash and, where it matters, a QR code leading to a public page that confirms it is genuine.

### Templates

Each school can set its letterhead (logo, name in English and Urdu, address, registration numbers), signature images, and choose between layout variants of each document. The catalogue of documents with their data and layouts is in the [document catalogue](../30-reference/document-catalogue.md).

## 5 · Imports and exports

### Import (always two steps)

1. **Upload and check.** The file is parsed into `import_rows`. Every row is validated with the same contract and rules as the normal create path. The user sees a preview: how many rows are valid, and for each invalid row which cell is wrong and why.
2. **Commit.** Only on confirmation, valid rows are written in batches through the normal service (so permissions, rules, audit and events all apply). The result lists what was created and what was skipped. A downloadable file contains the failed rows with an error column, ready to fix and re-upload.

- Templates with the right columns can be downloaded for each import, with one example row.
- Re-uploading the same file does not create duplicates: each import states its natural key (admission number, B-Form, employee number).
- Imports available: students with guardians, staff, opening fee balances, fee structures, marks, attendance history, library books, inventory items, chart of accounts, opening balances, holidays, question bank.

### Export

Any list can be exported with its current filters as CSV or XLSX. Columns follow the screen. Exports that include phone or identity numbers are audited with the row count. Large exports are jobs.

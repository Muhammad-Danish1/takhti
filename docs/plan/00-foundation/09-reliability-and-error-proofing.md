# 09 · Reliability and error-proofing

The standard every feature is held to. "Error-proof" here means: wrong input is refused with a clear message, a failure never leaves data half-written, anything can be retried safely, and every outside dependency has a fallback.

## 1 · Five lines of defence for every write

| # | Where | What it stops |
|---|---|---|
| 1 | The form (Zod contract in the browser) | Typing mistakes, before a request is sent |
| 2 | The route (same contract on the server) | Anything a modified client or a script sends |
| 3 | The service (permissions, rules, state machine) | Actions that are not allowed now, or by this person |
| 4 | The database (not-null, checks, unique, foreign keys, row-level security) | Bugs in our own code |
| 5 | Nightly integrity jobs | Anything that slipped through, found within a day |

No line trusts the one before it.

## 2 · Rules for writes

1. **All or nothing.** One request is one transaction. The audit entry and queued jobs commit with the data.
2. **Safe to repeat.** Money and other irreversible actions require an idempotency key. Jobs are written so that running one twice has the same result as running it once.
3. **No silent overwrite.** Updates carry `version`. A stale edit is refused and the user keeps what they typed.
4. **Lock before read-then-write.** Collecting a fee, issuing a library book, moving stock and running payroll lock the rows they depend on (`select … for update`) so two people cannot both spend the same balance.
5. **One run at a time.** Voucher generation, payroll, promotion and result publishing take a Postgres advisory lock per branch and period. A second start is refused with "already running, started by X at 10:42".
6. **Status changes go through a state machine.** An impossible jump is refused by name.
7. **Numbers are issued inside the transaction.** A failed save never consumes a receipt number.
8. **Totals are recomputed on the server.** The client's arithmetic is never stored.

## 3 · Money rules

1. Integers only, in paisa. Rounding is half up, and happens in exactly one named function per calculation.
2. Splitting an amount (a sibling discount across children, a payment across voucher lines) uses `allocate()`, which guarantees the parts sum to the whole.
3. A posted receipt or journal entry is never edited or deleted. It is reversed by a new, linked entry with a reason and an approver.
4. Every journal entry balances: a database check refuses an entry whose debits and credits differ.
5. A fiscal period that is closed accepts no entries. Reopening it needs a permission and is audited.
6. Cash handling is by session: a cashier opens a session, every cash receipt belongs to it, and closing it compares counted cash with expected cash and records the difference.

## 4 · Dates and time

1. "Today", "this month" and "overdue" are always computed in Pakistan time on the server.
2. Calendar dates are strings end to end. No date passes through a JavaScript `Date`.
3. Every date range is inclusive at both ends and says so in its label.
4. Academic year, term and fiscal year boundaries are data, not code.
5. Tests freeze time. Each time-based rule has a test at the boundary: the last second of the due date, month end, 29 February, the hour before midnight UTC.

## 5 · When something outside fails

Every outside dependency sits behind an adapter with a stated fallback.

| Dependency | If it is down or slow | The user sees |
|---|---|---|
| Internet (staff device) | Offline-capable screens keep working and queue changes (Phase 17). Other screens show an offline state and keep the last loaded data readable | A banner: "You are offline. 3 changes will sync when the internet returns." |
| Database | The request fails fast (5 s statement timeout, 10 s request timeout) | "We could not save. Nothing was changed. Try again." |
| Supabase Auth | Existing sessions keep working until their token expires. Sign-in shows a clear message | "Sign-in is temporarily unavailable." |
| Storage | The record saves without the attachment; the upload can be retried | "The file did not upload. Your changes are saved. Retry upload." |
| WhatsApp | The message falls back to SMS, then to in-app only | Staff see the channel actually used in the delivery log |
| SMS provider | Retries with backoff for 24 hours, then marks failed; a second provider can be configured | A "not delivered" badge and a "resend" action |
| Payment gateway | Online payment is hidden; the voucher still shows bank and cash instructions | "Online payment is unavailable right now. You can pay at the school or by bank challan." |
| Gateway callback lost | A reconciliation job asks the gateway for the status of every pending payment every 15 minutes | Payment moves from "pending" to "paid" without anyone acting |
| PDF worker | The same document opens as a print-ready web page | "Open print view" instead of "Download PDF" |
| AI | The feature shows as unavailable; the manual path is always present | "The assistant is unavailable. You can continue manually." |
| Realtime | Screens fall back to refetching every 30 seconds | Nothing; it just updates a little later |
| Worker process | Jobs wait in the queue; an alert fires if the oldest waiting job is older than 5 minutes | Staff see "queued" on the item |

**Rule:** no screen may depend on a job, a message or an outside call succeeding in order to finish the user's own action. The action is saved first; the side effects follow.

## 6 · Jobs

1. A job is saved in the same transaction as the change that needs it (the outbox pattern), so a job cannot exist without its data or the data without its job.
2. Retries: up to 5, with exponential backoff and jitter. After that the job goes to a failed list that staff with the right permission can inspect and retry.
3. Every handler is idempotent and has a timeout.
4. A job that fans out (reminders to 800 parents) creates one child job per recipient, so one bad number does not block the rest.
5. Queue depth, oldest waiting age and failure rate are measured and alerted on.

## 7 · Integrity jobs (nightly)

Each check writes any finding to `integrity_findings` and alerts. None of them fixes data automatically.

| Check | Rule |
|---|---|
| Voucher totals | A voucher's total equals the sum of its lines; paid equals the sum of its allocations |
| Payments | Every payment is fully allocated or sits as family credit |
| Ledger | Every journal entry balances; the trial balance nets to zero |
| Fees and books | Fee receipts for the day equal the day's postings to cash and bank accounts |
| Attendance | One record per student per session; no record for a student not enrolled that day |
| Enrolment | Each active student has exactly one active enrolment in the active year |
| Stock | Stock on hand equals the sum of movements; no negative stock |
| Library | Copies on loan equal open loans |
| Payroll | A payslip's net equals earnings minus deductions; a loan's balance equals principal minus installments |
| Sequences | No duplicate human-facing number within its scope |
| Orphans | No file without an owner record older than 24 hours; no membership without a person record |

## 8 · What every screen must handle

| State | Requirement |
|---|---|
| Loading | A skeleton with the final layout's shape. No layout jump when data arrives |
| Empty | Says what belongs here and offers the first action |
| Error | Says what failed, offers "Try again", shows the request id for support |
| Forbidden | Says the person lacks access and who can grant it |
| Not found | Says the record does not exist or was removed, with a way back |
| Offline | Keeps the last data readable, disables actions that need the network, labels them |
| Stale | "This record was changed by someone else", with Reload, keeping typed values |
| Saving | The submit control is disabled and shows progress; a second click cannot send twice |
| Saved | A confirmation that names what was saved |
| Partial success (bulk) | Counts of succeeded and failed, with the failed rows listed and downloadable |
| Session expired | Sign-in opens over the page; after signing in the user continues where they were, with the form intact |

Forms also: warn before leaving with unsaved changes; keep a local draft of long forms (admission, staff, lesson plan) and offer to restore it; show errors under the field and move focus to the first one.

## 9 · The "what if" list

Each line is a real situation with its required behaviour. Module specs add their own under **Failure cases**.

| What if… | Required behaviour |
|---|---|
| The user double-clicks Save | One record. The button disables; the idempotency key protects the server |
| The network drops after Save is pressed | The client retries with the same idempotency key; the result is one record |
| The same record is open in two tabs | The second save gets `STALE` |
| Two cashiers collect the same voucher at once | The second sees "already paid by X at 10:42" and no second receipt exists |
| The user presses Back after paying | The page shows the paid state; nothing is charged again |
| The session expires mid-form | Sign in again; the form's values are still there |
| A role is removed while the user is working | Their next request is refused within a minute |
| A branch is deactivated | It becomes read-only; nothing is deleted |
| A CSV has 10,000 rows and 37 are wrong | The preview shows the 37 with reasons; the user imports the 9,963 or fixes the file |
| A student is entered twice | A duplicate warning appears at admission (same B-Form, or same name, father's name and date of birth); merging is a guided, audited action |
| A date of birth is in the future, or the child would be 2 or 25 years old | Refused, or warned and confirmed, by rule |
| A parent's phone number changes | Old sessions are ended; the new number must be verified before it can sign in |
| A teacher marks attendance for the wrong date | Editable until the day is locked; after that a correction request goes to the coordinator |
| Marks exceed the paper's total | Refused at entry, in bulk paste and in import |
| A fee structure changes mid-year | Existing vouchers do not change; new vouchers use the new structure; a re-price action is explicit and previewed |
| A student leaves mid-month | Final settlement computes dues and refunds by the school's policy; the leaving certificate is blocked while a balance remains unless waived by permission |
| The server's clock or a device's clock is wrong | The server time is the only time that counts; a device timestamp is kept only as information |
| Storage is full or a quota is hit | Uploads fail with a clear message; nothing else is affected; platform staff are alerted before the limit |
| A job fails five times | It is listed for staff with its error; the business record shows the true state ("reminder not sent") |
| A migration fails halfway | Migrations are transactional; the deploy stops and the previous version keeps running |

## 10 · Backups and recovery

| Item | Standard |
|---|---|
| Local development | `pnpm db:backup` and `pnpm db:restore` scripts using `pg_dump` |
| Production database | Daily backups and point-in-time recovery, 7 days at minimum (Phase 21) |
| Storage | Bucket versioning or a nightly copy to a second location |
| Restore drill | A full restore to a scratch project is rehearsed before launch and every quarter |
| Tenant export | An owner can request a full export of their organisation's data and files |
| Accidental delete | Soft deletes can be undone from a "Recently deleted" screen for 30 days |

Targets: at most 5 minutes of data lost and at most 4 hours to restore, for the production service.

## 11 · Seeing problems

- **Logs**: structured, one line per request with route, status, duration, organisation, user and request id. No personal data.
- **Errors**: every `INTERNAL` error is captured with its stack and request id (Sentry or equivalent in Phase 21; the log file locally).
- **Metrics**: request rate, error rate and latency per route; database connections; job queue depth and age; message delivery rate; sign-in failures.
- **Alerts**: error rate above 2% for 5 minutes; p95 latency above 1.5 s; oldest job older than 5 minutes; an integrity finding; backup failure; disk above 80%.
- **Audit log**: who did what, when, from where, on which record, with before and after. Visible to the school; never editable.
- **Status for support**: a request id on every error message lets support find the exact request.

## 12 · Performance budgets

Measured on seed data of 5,000 students and two academic years (see [seed data](../30-reference/seed-data.md)).

| Action | Budget |
|---|---|
| Any list page, API time | under 300 ms at p95 |
| Any single read | under 150 ms |
| Any ordinary write | under 400 ms |
| Marking attendance for a section of 40 | under 500 ms |
| Generating vouchers for one grade (about 150 students) | under 3 s, in the request |
| Generating vouchers for a branch of 2,000 | a job; under 60 s |
| First load of an app page on a mid-range phone on 3G | under 3 s to interactive |

A list query that needs more than one index scan per table, or any query without a matching index, fails review.

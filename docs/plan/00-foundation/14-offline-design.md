# 14 · Offline design

Built in [Phase 17](../20-phases/phase-17-offline.md). This document exists now because the database and the services must be ready for it from Phase 1.

## What works without internet

| Portal | Works offline | Needs internet |
|---|---|---|
| Teacher | Today's timetable, class lists, marking attendance, entering marks, posting homework and diary text, logging behaviour, reading lesson plans | Messaging, file uploads (queued), reports |
| Cashier (fee counter) | Finding a student, seeing open vouchers, taking **cash** and printing a receipt | Online payments, refunds, voucher generation |
| Front desk | Visitor log, gate passes | Enquiry follow-ups by message |
| Driver and attendant | Marking who boarded and who got off; location is buffered | Live map |
| Shop and canteen | Cash sales from the product list | Wallet sales, charge to fees, voids, returns |
| Hostel warden | Roll-call | Check-out and check-in |
| Store keeper | Scanning for a stock count or an asset audit | Posting the count |
| Parent, student | Reading what was loaded last time | Everything else |

Everything else (accounts, payroll, settings, reports, AI) is online only. Those screens show a clear offline state and keep their last data readable.

## The model

1. **The server is the authority.** A device holds a copy of a slice of the data and a queue of changes.
2. **A device gets only what its user needs.** A teacher's device holds their sections; a cashier's holds their branch's open vouchers.
3. **Offline writes are requests, not facts.** They become facts when the server accepts them through the same service that an online request would call.
4. **Nothing is silently lost.** A change the server refuses is shown to the user with the reason and stays visible until they deal with it.

## Technology

- **PowerSync** keeps a SQLite database on the device in step with Postgres. It reads Postgres through logical replication and sends each device the rows its *sync streams* allow.
- **Web**: the PowerSync web SDK (SQLite compiled to WebAssembly, stored in the browser's private file system). **Mobile** (Phase 23): the React Native SDK with an encrypted database.
- **App shell**: a service worker (Serwist) caches the pages and scripts of the offline-capable screens, so the app opens with no network.
- Offline-capable screens are rendered in the browser. A page rendered on the server cannot load without the server.
- Locally the PowerSync service runs as one more Docker container beside Supabase.

## Sync streams

Defined on the PowerSync service, mirroring row-level security. Parameters come from the user's token.

| Stream | Rows | For |
|---|---|---|
| `me` | Own profile, membership, permissions, branch settings | Everyone |
| `teacher.sections` | Sections taught, their subjects and enrolled students (name, roll number, photo thumbnail id) | Teachers |
| `teacher.timetable` | Own timetable entries and substitutions for the current term | Teachers |
| `teacher.attendance` | Sessions and records for own sections, last 14 days | Teachers |
| `teacher.marks` | Papers assigned for marking and their mark entries, while the paper is open | Teachers |
| `teacher.homework` | Homework and diary for own sections, last 30 days | Teachers |
| `cashier.students` | Branch students: id, name, father's name, class, family | Cashiers |
| `cashier.vouchers` | Open vouchers and lines for the branch; fee heads; own cash session and its payments | Cashiers |
| `frontdesk.today` | Today's visitors, gate passes and appointments | Front desk |
| `transport.trips` | Today's own trips, their riders and stops | Drivers and attendants |
| `shop.pos` | The outlet's products and prices; own open session | Shop and canteen cashiers |
| `hostel.rollcall` | Boarders of own hostel with room, today's leave and clinic status | Wardens |
| `store.counts` | The items of an open stock count or asset audit | Store keepers |
| `family.children` | Children's attendance (60 days), open vouchers, published results, notices | Guardians (read-only) |

A stream is subscribed when its screen is first opened and kept warm afterwards, so a teacher's first online visit prepares the device.

## The write path

```
screen writes to local SQLite  →  shown at once
        │
        ▼
upload queue on the device (survives restart)
        │   when online
        ▼
POST /api/v1/sync/upload   { deviceId, ops: [ { opId, table, op, id, data, baseVersion } ] }
        │
        ▼
for each op, in order:
   registry maps (table, op) → a service command
   the command runs in its own savepoint as the signed-in user, source = 'sync'
        │
        ├─ accepted  → the change replicates back to every device
        ├─ duplicate → acknowledged (the opId was already applied)
        └─ refused   → recorded in sync_rejections with a reason the user can read
        ▼
response 200 with a result per op
```

- The route always answers `200` with per-operation results. A validation failure must not block the queue behind it.
- `opId` makes every operation idempotent: a retried upload is harmless.
- A temporary server error answers `5xx`, and the device retries the whole batch later.
- The same contract validates the operation, the same service applies it, the same audit entry is written with `source = sync` and the device id.

## Conflicts

The policy is chosen by what the record *is*, and is fixed per table in a registry.

| Record | Nature | Policy |
|---|---|---|
| Attendance record | An observation | Latest write wins, per student. Refused if the day is locked |
| Homework, diary, behaviour entry | New information | Always added. Edits: latest wins |
| Mark entry | A judgement | If the server row changed since the device last saw it, the server value stays and the device value goes to `sync_conflicts` for the teacher or exam controller to resolve |
| Fee payment | Money | Never overwritten. If the voucher was meanwhile settled another way, the offline payment is kept as family credit and flagged for the accountant |
| Visitor, gate pass, trip event, count or audit scan | A log | Always added; a repeat is merged |
| Hostel roll-call | An observation | Latest write wins, per boarder and roll-call |
| Shop cash sale | Money | Always accepted. If stock runs short on sync, the sale stands and a stock discrepancy is raised |
| Anything else | — | Not writable offline |

**Outbox-only writes.** A few forms need no local data at all: reporting a problem, recording a classroom observation, answering a survey. They are kept in a small outbox on the device and posted to their normal route, with their idempotency key, when the device is online. They are not part of sync.

A device clock is never trusted to order events. The server's receive order decides, and the device's own timestamp is kept only as information.

## Offline cash collection

Money is the riskiest thing to do offline, so it is bounded:

1. Only **cash**, only against vouchers already on the device, only by a cashier with an open cash session.
2. The receipt number carries the device's code, `R-2610-K3-0042`, so it can never collide with another counter's numbers.
3. The printed receipt is marked "issued offline" until it syncs.
4. A setting caps the total a device may collect offline (default Rs 500,000) before it must sync.
5. On sync, each payment goes through the normal collect service. A voucher that was paid elsewhere in the meantime turns the payment into family credit and raises a review item; the parent is never charged twice silently.
6. The cash session cannot be closed while the device has unsynced payments.

## Devices

`sync_devices` records each device that has turned offline mode on: user, device name, code, app version, last sync time and the number of changes still waiting (reported by the device).

- Offline mode is switched on **per device**, by the user, with a warning that data will be stored on it. It should not be enabled on a shared computer.
- Signing out wipes the local database.
- An administrator sees every device with unsynced work and how old it is, and can revoke a device. A revoked device wipes itself at its next contact.
- If a membership is suspended, the device is told at its next sync and wipes.

## Sign-in while offline

- A user must sign in online at least once on a device.
- When the access token expires offline, the app keeps working on local data behind an app PIN, and syncing resumes after the token refreshes online.
- A device that has not synced for 14 days stops accepting new offline work and asks the user to connect.

## What the backend must already have (Phases 1 to 3)

| Requirement | Where |
|---|---|
| Ids can be supplied by the client on create | Every contract's create schema has optional `id` |
| Rows are soft-deleted | `deleted_at` everywhere |
| Every row has `version` | `baseColumns` |
| Services accept `source = 'sync'` and record the device id in audit | Kernel |
| A registry of offline-writable tables with their command and conflict policy | `kernel/sync.ts`, filled in by each module spec's **Offline** section |
| `sync_ops` (applied operation ids), `sync_rejections`, `sync_conflicts`, `sync_devices` tables | [M00](../10-modules/m00-shared-kernel.md) |
| `POST /sync/upload` with tests that replay recorded operation batches | Phase 2 |
| A Postgres publication listing the synced tables | Phase 17 migration |

## Testing

| Scenario | Expectation |
|---|---|
| Mark attendance offline, reconnect | Records appear on the server; parents are notified once |
| The same batch uploaded twice | No duplicates |
| Two teachers mark the same section offline | Latest wins per student; both are in the audit log |
| Marks edited on the server while a device was offline | The server value stays; a conflict item appears for the teacher |
| A fee collected offline for a voucher paid online meanwhile | Family credit plus a review item; one receipt each; no double charge |
| Two days offline, 300 queued changes | All upload in batches; the screen shows progress |
| The app is updated while changes are queued | The queue survives and uploads |
| The browser clears site data | The user is warned at the next open that unsynced work may be lost; devices with pending work are visible to the administrator before that happens |
| Device clock is 3 hours fast | Server order is used; the entry is flagged if its claimed time is implausible |
| Membership suspended while offline | The device wipes at next contact; queued changes are refused and logged |

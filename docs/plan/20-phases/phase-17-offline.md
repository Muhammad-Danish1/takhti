# Phase 17 · Offline

**Goal.** The screens used at the classroom door, the fee counter, the gate, the bus and the canteen keep working when the internet or the power fails, and everything done offline reaches the server exactly once when the connection returns. Nothing is silently lost, and no parent is ever charged twice.

**Depends on.** Phases [9](phase-09-finance.md), [11](phase-11-front-office-and-operations.md) and [13](phase-13-teacher-portal.md): the screens exist and already write through `useOfflineMutation`; the upload route and its handlers exist from [Phase 2](phase-02-services-and-routes.md).

**Produces.** The PowerSync service in the local Docker setup, the local database on each device, the installable web app, and the conflict and device screens.

## Read first

[14 · Offline design](../00-foundation/14-offline-design.md) is the specification for this phase. Then the **Offline** section (11) of [M14](../10-modules/m14-student-attendance.md), [M15](../10-modules/m15-homework-diary.md), [M17](../10-modules/m17-exams-marks.md), [M20](../10-modules/m20-behaviour-houses.md), [M21](../10-modules/m21-fees.md), [M09](../10-modules/m09-front-office.md), [M30](../10-modules/m30-transport.md), [M33](../10-modules/m33-shop-canteen.md), [M35](../10-modules/m35-hostel.md), [M32](../10-modules/m32-inventory-assets.md), and the `sync_*` tables in [M00](../10-modules/m00-shared-kernel.md).

Before writing code, read PowerSync's current documentation for the self-hosted service, sync streams, the web SDK and Supabase integration, and pin the versions in [02](../00-foundation/02-decisions-and-stack.md). The design in [14](../00-foundation/14-offline-design.md) is fixed; the SDK's exact calls are taken from its documentation at the time.

## What is in scope

| Who | Works offline |
|---|---|
| Teacher | Today, class lists, marking attendance, entering marks, diary and homework text, checking homework, recording behaviour |
| Cashier | Finding a family, seeing open vouchers, taking **cash**, printing a receipt |
| Front desk and gate | Visitor log, gate pass exit with the code |
| Driver and attendant | Boarding and drop-off, buffered positions |
| Shop and canteen | Cash sales |
| Hostel warden | Roll-call |
| Store keeper | Scanning for a stock count or asset audit |
| Parent and student | Reading what was loaded last time |

Everything else stays online-only and shows the offline state with its last data readable.

## Work packages

### 17.1 · The sync service

- [ ] PowerSync as one more container in the local Docker setup; `pnpm sync:start` and `pnpm sync:stop`; its address in `.env.example`.
- [ ] A migration creating the Postgres publication that lists exactly the synced tables, and a replication role with rights to those tables only.
- [ ] Token: PowerSync verifies the Supabase token; the claims added by the access token hook are the stream parameters.
- [ ] **Sync streams** as defined in [14](../00-foundation/14-offline-design.md): `me`, `teacher.sections`, `teacher.timetable`, `teacher.attendance`, `teacher.marks`, `teacher.homework`, `cashier.students`, `cashier.vouchers`, `frontdesk.today`, `transport.trips`, `shop.pos`, `hostel.rollcall`, `store.counts`, `family.children`. Each mirrors row-level security and sends only the columns the screen needs.
- [ ] **Stream security tests**: for each stream, a device signed in as each kind of user receives exactly the rows the API would give, and none of another branch, another teacher's section or another family.

### 17.2 · The device database — `packages/sync`

- [ ] The client schema (the synced tables and columns), generated from the table registry so it cannot drift.
- [ ] The connector: fetches credentials, and uploads the queue to `POST /api/v1/sync/upload` in batches of 100, in order, with the device id.
- [ ] Handling of the per-operation results: accepted, duplicate, refused (shown to the user), conflict (shown to the user).
- [ ] Local stores are per user and per organisation, and are wiped on sign-out, on device revocation and on membership suspension.

### 17.3 · Hooks switch to the device

`useOfflineMutation` and the read hooks of the offline-capable screens gain a second path:

- [ ] When offline mode is on for this device: reads come from the local database (live queries); writes go to the local database and the upload queue.
- [ ] When it is off: exactly what they did before, through the API.
- [ ] The hooks' signatures do not change. No screen file is edited in this phase except to add the sync status and the conflict entry points.

A test runs each offline-capable screen's browser test twice, once in each mode, with the same assertions.

### 17.4 · The app shell

- [ ] A service worker (Serwist) that precaches the shells and the pages of the offline-capable screens, their scripts, fonts and icons; a network-first strategy for everything else; an "update available" prompt that never discards a queue.
- [ ] Web app manifest, icons from the Takhti mark, "Add to home screen" guidance for Android and desktop.
- [ ] The offline-capable pages render entirely in the browser.

### 17.5 · What the user sees

- [ ] **Turning it on**: per device, from My account, with a plain warning that school data will be stored on this device and that it should not be a shared computer; an app PIN is set.
- [ ] **Sync status** in the top bar of offline-capable shells: "Up to date", "3 changes waiting", "Offline — 12 changes waiting", "2 need your attention"; tapping it opens the list.
- [ ] **Each record's state**: a small mark on rows that are saved on the device but not yet on the server.
- [ ] **Needs attention**: rejections with the reason in plain words and what to do; conflicts (marks) showing both values to choose from.
- [ ] **Offline receipts** at the fee counter and the shop: the device receipt code, "issued offline" on the print, and the server number added after sync.
- [ ] **Devices** (`/school/settings/devices`): every device with offline mode on, its user, last sync, changes waiting and their age; revoke.
- [ ] **Review items** for accountants: offline cash that became family credit.
- [ ] After 14 days without sync a device stops accepting new offline work and asks to connect; the cash limit per session stops further offline collection when reached.

### 17.6 · The hard cases

Each row of the "Testing" table in [14](../00-foundation/14-offline-design.md) becomes an automated test that drives a real browser with the network switched off and on (Playwright's offline mode), plus:

- [ ] The same teacher signed in on two devices marks the same class offline.
- [ ] A cashier's device loses power mid-payment: on restart the payment is either fully in the queue or absent, never half.
- [ ] 1,000 queued operations upload in order without blocking the screen.
- [ ] An upload batch in which operation 7 is refused: operations 8 to 100 are still applied.
- [ ] The server is down for an hour: devices keep working and retry with growing gaps.
- [ ] A schema change is deployed while devices hold queued work: the queue still applies (operations carry only fields, validated by the current contract; a field no longer accepted produces a readable rejection, not a crash).

## Journeys to automate

| Journey | Steps |
|---|---|
| The classroom | Open Today online → network off → mark attendance for two classes → write the diary → network on → both sessions are on the server, guardians notified once |
| Marks conflict | Enter marks offline; meanwhile the coordinator changes one mark online → on sync that row becomes a conflict; the teacher chooses; the audit shows both |
| The counter in a power cut | Open a session online → offline → collect cash from three families, print receipts with device codes → online → three payments with server numbers, the ledger correct |
| Paid twice | Offline cash for a voucher that is paid online meanwhile → on sync: family credit, a review item, one receipt each |
| The bus | Start the trip offline → board and drop → online → events on the server with their real times |
| A stolen phone | Revoke the device → at its next contact it wipes; its queued changes are refused and logged |

## Exit checks

1. Every scenario in the "Testing" table of [14](../00-foundation/14-offline-design.md) and in work package 17.6 passes automatically.
2. The stream security tests pass for every stream.
3. Each offline-capable screen passes its browser test in both modes with no change to the screen's code.
4. With the network off, the teacher portal and the fee counter open from a cold start in under 3 seconds on a mid-range phone and laptop.
5. After the full offline suite, the integrity job reports no finding, and the count of payments, attendance records and trip events equals the count made offline — none lost, none doubled.
6. A person who was not on the project turns offline mode on, uses the teacher portal in flight mode for ten minutes, reconnects, and finds everything on the server.
7. `pnpm check`, `pnpm test:db`, `pnpm test:e2e`.

## Left for later, on purpose

- Encrypted local databases and background sync on phones: the native apps of [Phase 23](phase-23-mobile-apps.md).
- Offline for anything not in the scope table. Adding a screen later means adding its tables to a stream, an operation handler and a conflict policy; nothing else.

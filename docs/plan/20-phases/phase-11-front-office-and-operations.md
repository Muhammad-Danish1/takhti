# Phase 11 · Front office and operations

**Goal.** Everything that happens around the classroom is on screen: the front desk and the gate, transport, the library, the store and the asset register, the shop and canteen with student wallets, the clinic, the hostel, and the helpdesk.

**Depends on.** [Phase 9](phase-09-finance.md) (operations post to the ledger and charge fees). It can be built alongside [Phase 10](phase-10-hr.md).

**Portal.** `/school`: the Operations group; three phone-first pages inside it (`/school/gate`, `/school/trips`, the hostel roll-call).

**Modules.** [M09](../10-modules/m09-front-office.md), [M30](../10-modules/m30-transport.md), [M31](../10-modules/m31-library.md), [M32](../10-modules/m32-inventory-assets.md), [M33](../10-modules/m33-shop-canteen.md), [M34](../10-modules/m34-health-clinic.md), [M35](../10-modules/m35-hostel.md), [M36](../10-modules/m36-maintenance-helpdesk.md).

Each module is independent of the others here, so the work packages can be done in any order or in parallel. Schools switch these modules on one by one; every screen must behave when its neighbours are off.

## Read first

Sections 5, 9 and 13 of each module; the `CounterPage` and `ChecklistPage` patterns; `useBarcodeInput`.

## Work packages

### 11.1 · Front office and gate — [M09](../10-modules/m09-front-office.md)

Front desk dashboard; visitors with one-tap check-out; gate passes (requested, approved today, exited); new gate pass with the authorised guardians' photos; calls; post; appointments. Under `/school/front-office`. **Gate view** at `/school/gate`: today's approved passes on a phone, tap, enter the guardian's code, confirm exit.

### 11.2 · Transport — [M30](../10-modules/m30-transport.md)

Fleet with document expiry chips; routes with riders against seats and stops in order; riders and requests; **Today** with each trip's status and a map of running trips; trip detail; costs. Under `/school/transport`. **My trips** and the **manifest** at `/school/trips` for drivers and attendants: stops in order, one tap to board, one to drop, a banner until every boarded child is dropped.

The map uses an open map library with OpenStreetMap tiles; positions come from the driver's phone now and from trackers in [Phase 18](phase-18-integrations.md).

### 11.3 · Library — [M31](../10-modules/m31-library.md)

**Circulation desk** at `/school/library/desk` (scan a member, scan a book; a Return tab that needs only the book); catalogue with ISBN lookup and label printing; loans; overdue; reservations; fines; stock check; reports; settings.

### 11.4 · Inventory and assets — [M32](../10-modules/m32-inventory-assets.md)

Stock on hand; item with its stock card; issue requests; transfers; stock count (a grid with scan-to-jump); reorder; consumption. Asset register; add assets; asset audit by phone camera; depreciation run. Under `/school/inventory` and `/school/assets`. **My items** for every staff member.

### 11.5 · Shop and canteen — [M33](../10-modules/m33-shop-canteen.md)

**Point of sale** at `/school/shop/sell`: tiles and cart; scan a barcode; scan a student card to attach the customer with photo, balance and limits; Cash, Wallet or Fees. Sessions; products; sales with void and return; wallets with top-up; canteen menu; sales reports.

### 11.6 · Clinic — [M34](../10-modules/m34-health-clinic.md)

Clinic board; visit form with the alert and allergies pinned; student health record (behind the `health` capability); campaigns with consent progress and class-by-class entry; health summary without names; incidents. Under `/school/clinic` and `/school/incidents`. The **Health** tab on a student is visible only to those with the capability.

### 11.7 · Hostel — [M35](../10-modules/m35-hostel.md)

Hostel dashboard; the hostel map with beds as cells; boarders and the boarder card; **roll-call** as a phone checklist; leave with identity-checked check-out; visits; mess; setup.

### 11.8 · Helpdesk — [M36](../10-modules/m36-maintenance-helpdesk.md)

**Report a problem** as a sheet available from every staff shell; the helpdesk board; ticket detail; My work; My reports; summary; routine schedules; room bookings on a calendar with timetable lessons shown behind. Under `/school/helpdesk` and `/school/bookings`.

### 11.9 · Student tabs, dashboard and reports

Tabs on the student: Transport, Library, Health (restricted), Hostel, Wallet. Widgets: visitors inside now, gate passes waiting, trips running, library overdue, stock to reorder, clinic today, boarders out, tickets overdue. Role layouts for receptionist, transport manager, librarian, store keeper, nurse, hostel warden, security guard. Operations reports registered in the library.

## Journeys to automate

| Journey | Role | Steps |
|---|---|---|
| Early pickup | Receptionist, class teacher, guard | Create a pass → the teacher approves → the guard enters the code at the gate → exit recorded; a wrong code is refused |
| A bus run | Transport manager, attendant | Assign a rider (the 31st on a 30-seat van is refused) → the fee item appears → start the afternoon trip → board, drop → completing with one child undropped is refused |
| A library hour | Librarian | Scan a card and a book → issued with a due date past the holiday → a fourth book is refused at the limit → return late → a fine is created → billed to fees |
| The store | Teacher, head, store keeper | Request reams → approve → issue part → stock and consumption update → a count finds a difference → post with a reason |
| An asset | IT admin | Create ten laptops → print tags → assign to staff → audit by scanning; one is found in the wrong room and corrected |
| Canteen | Cashier, guardian | Open a session → sell to a student by card with the wallet → a blocked item is refused → split wallet and cash → void a sale → close the session |
| Sick child | Nurse, guard | Open a visit → fever → sent home → a medical gate pass exists → the guardian is told → exit at the gate; a medicine the child is allergic to is refused |
| Hostel night | Warden | Roll-call with two on leave prefilled → one absent raises the alert → a boarder checks out only with an authorised person |
| A broken fan | Teacher, technician | Report with a photo → assigned by rule → a second teacher's report offers the same ticket → resolved → the reporter confirms |
| Module off | Principal | With Hostel off, no menu item, tab or widget for it appears anywhere and its pages return "not part of your plan" |

## Exit checks

1. Every screen meets "Done when".
2. All ten journeys pass in the browser.
3. The three counters (fees from Phase 9, library desk, point of sale) can each complete their main task with the keyboard and a barcode scanner alone; a test drives them with simulated scanner input.
4. The phone-first pages pass at 360 px with touch targets of at least 40 px.
5. Health screens: a browser test as a teacher, an accountant and a principal without `health:read` finds no route that returns a health record.
6. Each of the eight modules can be switched off for the seeded organisation with no broken page elsewhere; a test toggles each in turn and crawls the navigation.
7. After the suite, the integrity job reports no finding for stock, wallets or assets.
8. `pnpm check`, `pnpm test:db`, `pnpm test:e2e`.

## Left for later, on purpose

- Parents' and students' views of transport, library, wallet, health and hostel: [Phase 14](phase-14-family-portals.md).
- Offline for the gate, trips, roll-call and point of sale: [Phase 17](phase-17-offline.md).
- Vehicle trackers and biometric machines: [Phase 18](phase-18-integrations.md).
- Printed labels, tags, passes and receipts: [Phase 16](phase-16-documents-and-printing.md).

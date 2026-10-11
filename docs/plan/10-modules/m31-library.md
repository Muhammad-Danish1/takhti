# M31 · Library

## 1 · Purpose

The school library: a catalogue of titles, the physical copies on the shelves, who has borrowed what, reservations, fines and the yearly stock check. Issue and return are done by scanning a barcode in seconds.

## 2 · Depends on

[M07](m07-students.md), [M26](m26-staff-recruitment.md) (`staff`), [M04](m04-school-setup.md) (holidays), [M21](m21-fees.md) (billing a fine), [M00](m00-shared-kernel.md) (files, imports, sequences).

## 3 · Tables

#### `library_categories` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation |
| name_ur | text | optional |
| parent_id | uuid → library_categories | optional |
| sort_order | int | default 0 |

#### `library_items` · org
A title. Shared by all branches.

| Column | Type | Rules |
|---|---|---|
| title | text | required |
| title_ur | text | optional |
| subtitle | text | optional |
| authors | text[] | default empty |
| publisher | text | optional |
| edition | text | optional |
| publish_year | int | optional |
| isbn | text | optional; a valid ISBN-10 or ISBN-13 |
| language | enum(en, ur, ar, other) | default en |
| kind | enum(book, textbook, reference, magazine, newspaper, audio_visual, digital) | default book |
| category_id | uuid → library_categories | optional |
| call_number | text | optional; shelf classification |
| grade_from | int | optional |
| grade_to | int | optional |
| keywords | text[] | default empty |
| summary | text | optional |
| cover_file_id | uuid → files | optional |
| digital_file_id | uuid → files | optional; for `digital` |
| is_reference_only | bool | default false; cannot be borrowed |
| price | paisa | optional; the replacement price |

Policy: staff; students and guardians may read the catalogue.
Index: (org_id, isbn); full-text on `title`, `authors`, `keywords`.

#### `library_copies` · branch
One physical copy.

| Column | Type | Rules |
|---|---|---|
| item_id | uuid → library_items | required |
| accession_no | text | required; from the `library_accession` sequence; unique per branch |
| barcode | text | required; unique per organisation; defaults to the accession number |
| shelf | text | optional; "A-3" |
| condition | enum(new, good, worn, damaged) | default good |
| status | enum(available, on_loan, on_hold, in_repair, lost, withdrawn) | default available |
| acquired_on | date | optional |
| source | enum(purchase, donation, transfer) | default purchase |
| price | paisa | optional |
| withdrawn_reason | text | optional |

Policy: staff of the branch; students and guardians may read status only through the catalogue route.
Index: (org_id, item_id, status).

#### `library_policies` · org
Borrowing limits for a kind of member.

| Column | Type | Rules |
|---|---|---|
| member_kind | enum(student, staff) | required |
| grade_ids | uuid[] | default empty; for students: empty means every grade without its own |
| max_items | int | required; ≥ 1 |
| loan_days | int | required; ≥ 1 |
| renewals_max | int | default 1 |
| fine_per_day | paisa | default 0 |
| fine_cap | paisa | optional |
| grace_days | int | default 0 |

#### `library_members` · branch +family
Exists only to hold a block or a card number; every active student and staff member can borrow without a row.

| Column | Type | Rules |
|---|---|---|
| member_kind | enum(student, staff) | required |
| student_id | uuid → students | optional; required for a student |
| staff_id | uuid → staff | optional; required for staff |
| card_no | text | optional |
| is_blocked | bool | default false |
| blocked_reason | text | optional; required when blocked |

Unique: (branch_id, student_id), (branch_id, staff_id) where set.

#### `library_loans` · branch +family

| Column | Type | Rules |
|---|---|---|
| copy_id | uuid → library_copies | required |
| item_id | uuid → library_items | required; copied |
| member_kind | enum(student, staff) | required |
| student_id | uuid → students | optional |
| staff_id | uuid → staff | optional |
| issued_on | date | required |
| due_on | date | required |
| returned_on | date | optional |
| renewals | int | default 0 |
| status | enum(on_loan, returned, lost) | default on_loan; "overdue" is derived |
| issued_by | uuid → profiles | required |
| returned_to | uuid → profiles | optional |
| return_condition | enum(good, worn, damaged) | optional |
| note | text | optional |

Policy: a staff member may also read their own loans.
Unique: one `on_loan` row per copy.
Index: (org_id, student_id, status); (org_id, staff_id, status); (org_id, branch_id, due_on) for loans not returned.

#### `library_reservations` · branch +family

| Column | Type | Rules |
|---|---|---|
| item_id | uuid → library_items | required |
| member_kind | enum(student, staff) | required |
| student_id | uuid → students | optional |
| staff_id | uuid → staff | optional |
| reserved_at | timestamptz | required |
| status | enum(waiting, ready, collected, cancelled, expired) | default waiting |
| copy_id | uuid → library_copies | optional; the copy held when ready |
| ready_until | date | optional |

Policy: a student or guardian may insert for their own student and cancel their own waiting reservation; staff likewise for themselves.

#### `library_fines` · branch +family

| Column | Type | Rules |
|---|---|---|
| loan_id | uuid → library_loans | required |
| student_id | uuid → students | optional |
| staff_id | uuid → staff | optional |
| kind | enum(overdue, lost, damage) | required |
| amount | paisa | required; > 0 |
| status | enum(due, paid, billed, waived) | default due |
| fee_voucher_id | uuid → fee_vouchers | optional; set when billed through fees |
| paid_on | date | optional |
| received_by | uuid → profiles | optional |
| waived_by | uuid → profiles | optional |
| waive_reason | text | optional |

#### `library_stock_checks` · branch

| Column | Type | Rules |
|---|---|---|
| name | text | required; "Annual stock check 2026" |
| started_on | date | required |
| finished_on | date | optional |
| status | enum(open, review, closed) | default open |
| copies_expected | int | default 0 |
| copies_found | int | default 0 |

#### `library_stock_check_scans` · branch

| Column | Type | Rules |
|---|---|---|
| stock_check_id | uuid → library_stock_checks | required |
| copy_id | uuid → library_copies | required |
| scanned_at | timestamptz | required |
| scanned_by | uuid → profiles | required |
| shelf_found | text | optional |

Unique: (stock_check_id, copy_id).

## 4 · Contracts

`packages/contracts/src/modules/library/`: `library-items`, `library-copies`, `library-policies`, `library-loans`, `library-reservations`, `library-fines`, `library-stock-checks`.

- `CatalogueResult`: a title with copies available at the caller's branch, total copies, and whether the caller can reserve it.
- `MemberCard`: for a scanned or searched member — photo, class, loans with due dates, fines due, limit used, and whether they can borrow now and why not.
- `IssueResult` / `ReturnResult`: the loan, the due date, any fine created, and the next reservation the copy now serves.
- `OverdueList`: loans past due, by class and days overdue, with guardian phone.
- `StockCheckResult`: copies not scanned (by status: on loan, missing), copies found on the wrong shelf.

Settings: `library.block_with_overdue` (default true), `library.fines_through_fees` (default true), `library.lost_price_factor` (default 1.0), `library.hold_days` (default 3), `library.reminder_days` (default `[-1, 1, 7]` relative to the due date), `library.student_self_reserve` (default true).

## 5 · Rules

- **R-library-1** A title is catalogued once; each branch adds its own copies. A copy's barcode is unique across the organisation.
- **R-library-2** A member can borrow when: they are an active student or staff member of the branch, not blocked, below their policy's `max_items`, and (with `library.block_with_overdue`) hold no overdue loan. The member card says which condition fails.
- **R-library-3** A copy can be issued only when `available`, or `on_hold` for that same member. A reference-only title is never issued.
- **R-library-4** The due date is the issue date plus the policy's loan days, moved forward to the next working day when it lands on a holiday or non-working day.
- **R-library-5** Issue and return are single transactions that change the copy's status and the loan together. A copy never has two open loans; the database refuses it.
- **R-library-6** A loan can be renewed up to `renewals_max` times, from today, unless someone is waiting for the title or the loan is already overdue.
- **R-library-7** On return, an overdue fine is created when the working days late exceed the grace days: days × `fine_per_day`, up to the cap. A copy returned `damaged` prompts a damage fine, typed by the librarian.
- **R-library-8** Marking a loan `lost` creates a fine of the copy's price (or the title's) × `library.lost_price_factor`, sets the copy `lost`, and closes the loan. If the book is later found, returning it reverses an unpaid fine and restores the copy.
- **R-library-9** A fine is paid in one of two ways: in cash to the librarian, recorded here and handed to the cashier as an "other income" payment; or, with `library.fines_through_fees`, billed onto an on-demand fee voucher through [M21](m21-fees.md). A waiver needs `library-fines:waive` and a reason.
- **R-library-10** Reservations are served first come, first served. When a copy of the title is returned, it is put `on_hold` for the first person waiting, who is told and has `library.hold_days` to collect it; after that it passes to the next.
- **R-library-11** A copy with an open loan cannot be withdrawn. A title cannot be deleted while it has copies.
- **R-library-12** A student who is leaving, or a staff member who is exiting, is cleared only when they have no open loans and no unpaid fines ([M07](m07-students.md), [M26](m26-staff-recruitment.md)).
- **R-library-13** A stock check: scan every copy on the shelves; at review, copies not scanned and not on loan are listed as missing; closing it marks the ones the librarian confirms as `lost`, with the list kept.
- **R-library-14** A person's borrowing history is visible to librarians, to the person, and to a student's guardians; teachers see only what their class currently has on loan.
- **R-library-15** A whole class can be issued books in one go during a library period: scan the student's card, then the book, repeatedly, without leaving the screen.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `library:read` | Search the catalogue with copy details; see loans and members | librarian, LEADERS, TEACHERS |
| `library-catalogue:manage` | Add and edit titles, copies and categories; import | librarian |
| `library:circulate` | Issue, return, renew, reserve on someone's behalf, mark lost | librarian |
| `library-fines:collect` | Record a fine as paid or bill it | librarian |
| `library-fines:waive` | Waive a fine | librarian, branch_admin |
| `library-setup:manage` | Maintain borrowing policies; block and unblock members | librarian, branch_admin |
| `library-stock:manage` | Run stock checks; withdraw copies | librarian |
| `library:export` | Export library reports | librarian, LEADERS |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/library/catalogue` | `signed-in` | Searches titles; what the caller may see |
| GET | `/library-items` | `library:read` | Lists titles for management |
| POST | `/library-items` | `library-catalogue:manage` | Creates a title, optionally with copies |
| GET | `/library-items/[id]` | `library:read` | One title with copies, loans and waiting list |
| PATCH | `/library-items/[id]` | `library-catalogue:manage` | Edits |
| DELETE | `/library-items/[id]` | `library-catalogue:manage` | Deletes a title with no copies |
| GET | `/library-items/lookup` | `library-catalogue:manage` | Fills title details from an ISBN |
| POST | `/library-items/import` | `library-catalogue:manage` | Imports titles and copies |
| POST | `/library-items/[id]/copies` | `library-catalogue:manage` | Adds copies |
| PATCH | `/library-copies/[id]` | `library-catalogue:manage` | Edits shelf, condition or status |
| POST | `/library-copies/[id]/withdraw` | `library-stock:manage` | Withdraws |
| POST | `/library-copies/labels` | `library-catalogue:manage` | Queues barcode and spine labels |
| GET | `/library-categories` | `signed-in` | Lists |
| POST | `/library-categories` | `library-catalogue:manage` | Creates |
| PATCH | `/library-categories/[id]` | `library-catalogue:manage` | Edits |
| GET | `/library/member` | `library:circulate` | The member card, by card scan or search |
| POST | `/library/issue` | `library:circulate` | Issues a copy to a member |
| POST | `/library/return` | `library:circulate` | Returns a copy by barcode |
| POST | `/library-loans/[id]/renew` | `library:circulate` | Renews |
| POST | `/library-loans/[id]/lost` | `library:circulate` | Marks lost |
| GET | `/library-loans` | `library:read` | Lists; filter by status, class, overdue |
| GET | `/library/overdue` | `library:read` | The overdue list |
| GET | `/library-reservations` | `library:read` | Lists |
| POST | `/library-reservations` | `library:circulate` | Reserves for a member |
| POST | `/library-reservations/[id]/cancel` | `library:circulate` | Cancels |
| GET | `/library-fines` | `library:read` | Lists |
| POST | `/library-fines/[id]/pay` | `library-fines:collect` | Records cash, or bills through fees |
| POST | `/library-fines/[id]/waive` | `library-fines:waive` | Waives |
| GET | `/library-policies` | `library:read` | Lists |
| PUT | `/library-policies` | `library-setup:manage` | Saves |
| PUT | `/library-members` | `library-setup:manage` | Blocks, unblocks or sets a card number |
| GET | `/library-stock-checks` | `library:read` | Lists |
| POST | `/library-stock-checks` | `library-stock:manage` | Starts |
| POST | `/library-stock-checks/[id]/scans` | `library-stock:manage` | Adds scans |
| GET | `/library-stock-checks/[id]/result` | `library:read` | The result |
| POST | `/library-stock-checks/[id]/close` | `library-stock:manage` | Closes and marks confirmed losses |
| GET | `/library/reports/[report]` | `library:read` | Runs a named report |
| GET | `/library/export` | `library:export` | Exports |
| GET | `/me/library` | `signed-in` | My loans, reservations and fines |
| POST | `/me/library/reservations` | `signed-in` | Reserves a title for myself |
| GET | `/family/children/[id]/library` | `signed-in` | A child's loans, history and fines |

Idempotent: `POST /library/issue`, `POST /library/return`, `POST /library-fines/[id]/pay`.

Named reports: `most-borrowed`, `never-borrowed`, `borrowing-by-class`, `overdue-aging`, `fines`, `stock-by-category`, `reading-by-student`.

## 8 · Client layer

Custom hooks: `useCatalogue(query)`, `useLibraryItem`, `useIsbnLookup`, `useMemberCard(code)`, `useIssue`, `useReturn`, `useRenew`, `useOverdue`, `useReservations`, `usePayFine`, `useStockCheck`, `useAddScans` (batches scans every second), `useMyLibrary`, `useChildLibrary`. A `useBarcodeInput` hook in `@takhti/hooks` listens for a scanner's fast keystrokes ending in Enter, and is reused by the shop and inventory.

## 9 · Screens

Built in [Phase 11](../20-phases/phase-11-front-office-and-operations.md) and [Phase 14](../20-phases/phase-14-family-portals.md).

| Screen | Pattern | Where |
|---|---|---|
| **Circulation desk** | Counter | `/school/library/desk`: scan a member card or search; the member card with loans and limits; scan a book to issue; a Return tab that needs only the book's barcode; a running list of what was just done |
| Catalogue | List + Detail | Covers, availability; add a title by ISBN lookup; copies tab; print labels |
| Loans | List | On loan, overdue, returned |
| Overdue | List | By class; bulk reminder |
| Reservations | List | Waiting and ready |
| Fines | List | Collect, bill or waive |
| Stock check | Detail | A scan box, a counter of found against expected, the missing list |
| Reports | Report | The named reports |
| Settings | Settings | Policies, categories, blocked members |
| **Student / Staff:** Library | List | Search the catalogue, reserve; my books with due dates |
| **Parent:** Library | List | A child's books, due dates, fines, reading history |

## 10 · Notifications and jobs

Events: `library.issued` (optional, to the guardian for young grades), `library.due-soon`, `library.overdue`, `library.fine-created`, `library.reservation-ready`, `library.reservation-expired`, `library.lost-marked`.

Jobs: `library.reminders` (daily 15:00), `library.expire-holds` (daily), `library.class-digest` (weekly to class teachers: overdue books in their class).

Documents: barcode and spine labels, library card, overdue notice, stock check report, accession register.

## 11 · Offline

None in the first release. The desk needs a connection; if it drops, scans queue for up to a minute before the screen asks the librarian to wait.

## 12 · AI

- Suggesting keywords and a reading level for a new title from its summary, to accept or edit.
- "Books like this" on the student's screen, from category and borrowing patterns of the same grade; plain counts, no personal data leaves the system.

## 13 · Failure cases

- **F-library-1** A book is scanned that is already on loan to someone else → the screen shows who has it and offers "return first, then issue".
- **F-library-2** A student at their limit tries to borrow → refused with "3 of 3 books"; the librarian can return one first.
- **F-library-3** A returned book has a reservation → it is put on hold, not back to available; the screen says "Hold for Ayesha, 7-B".
- **F-library-4** The barcode is unreadable → search by accession number or title.
- **F-library-5** The same return is posted twice → the second finds no open loan and reports the copy is already in.
- **F-library-6** A lost book is found after the fine was billed and paid → the copy is restored; the librarian is offered a refund request through fees.
- **F-library-7** A student transfers branch with a book → the loan stays with the old branch and appears in their clearance.
- **F-library-8** An ISBN lookup returns nothing or the service is down → the form stays empty for manual entry.
- **F-library-9** A due date falls in the summer vacation → it moves to the first working day after it.

## 14 · Seed data

Twenty categories. About 1,200 titles (English and Urdu, with covers for 100) and 2,500 copies across branches. Policies for students by grade band and for staff. Four months of loans: most returned, about 60 open, 15 overdue, three lost. Reservations waiting and ready. Fines in every status. One closed stock check with eight missing copies, and one open.

## 15 · Tests

- **T-library-1** Borrowing eligibility: each failing condition and its message.
- **T-library-2** Issue and return are atomic; two simultaneous issues of one copy give one loan.
- **T-library-3** Due date moves past holidays.
- **T-library-4** Renewal limits; blocked by a waiting reservation.
- **T-library-5** Fine arithmetic: grace, working days, cap; lost and damage fines.
- **T-library-6** Found-after-lost reverses an unpaid fine.
- **T-library-7** Reservation queue and hold expiry.
- **T-library-8** Fine paid in cash and billed through fees.
- **T-library-9** Clearance blocks on open loans and fines.
- **T-library-10** Stock check: missing list excludes copies on loan; close marks losses.
- **T-library-11** A guardian reads only their own child's loans; a teacher only their class's current loans.
- **T-library-12** Row-level security and branch scope.

# Phase 9 · Finance

**Goal.** The school's money runs on screen, from the fee structure to the balance sheet: vouchers, the fee counter, online payments with the local stand-in provider, bank reconciliation, the ledger, expenses and purchasing, and tax.

**Depends on.** [Phase 8](phase-08-academics.md) (only for the order of work; technically it needs [Phase 7](phase-07-school-setup-and-people.md)).

**Portal.** `/school`: the groups Fees and Finance, and their settings.

**Modules.** [M21](../10-modules/m21-fees.md), [M22](../10-modules/m22-online-payments-reconciliation.md), [M23](../10-modules/m23-accounting.md), [M24](../10-modules/m24-expenses-procurement.md), [M25](../10-modules/m25-tax-compliance.md).

## Read first

Each module in full, especially the Rules and Failure cases of [M21](../10-modules/m21-fees.md); the posting map in [M23](../10-modules/m23-accounting.md); [09 · Reliability and error-proofing](../00-foundation/09-reliability-and-error-proofing.md) ("Money"); the `CounterPage` pattern in the gallery.

## Rules for every finance screen

1. **No optimistic updates.** A screen shows a payment, a posting or a reversal only after the server confirms it.
2. **One idempotency key per intent**, created when the form opens (`useIdempotencyKey`), reused by any retry, renewed after success.
3. **The button that takes money is disabled from the click until the answer**, and shows what is happening.
4. **Show the consequence before the commit**: the allocation before saving a payment, the journal lines before posting, the withholding before paying a vendor, the totals before approving payroll.
5. **Every amount is traceable**: from any figure the person can click through to the rows behind it, down to the document that caused it.
6. **Nothing financial has an Edit or Delete button.** It has Reverse, Void, Cancel or Adjust, each asking for a reason.

## Work packages

### 9.1 · Fee setup — [M21](../10-modules/m21-fees.md)

Fee heads, discount types, fine rules and billing settings (`/school/settings/fees`); fee structures as a grade-by-head grid with "copy from last year with a percentage" (`/school/fees/structures`); the student's fee plan tab with next month's breakdown; discounts with approvals (`/school/fees/discounts`).

### 9.2 · Vouchers

Generate vouchers (wizard: month and grades, preview with skipped students and reasons, run with progress, print); vouchers list with bulk print; voucher detail with lines, allocations, adjustments and history; family statement. Under `/school/fees/vouchers`.

### 9.3 · The fee counter

| Screen | Path | Pattern |
|---|---|---|
| **Collect fees** | `/school/fees/collect` | Counter |
| Cash session (open, running totals, close with a denomination count) | `/school/fees/sessions` | Detail |
| Payments | `/school/fees/payments` | List + Detail |

The counter is built for a cashier who serves a queue: focus starts in the search box; typing a name, father's name, admission number, voucher or challan number finds the family; the family's children and open vouchers appear with the fine as of today; the amount is prefilled with the total and can be changed; the allocation is shown before saving; `F9` saves and prints; focus returns to search. A banner shows the cashier's open session and its running cash total. Without an open session, cash is not offered.

### 9.4 · After the counter

Defaulters with age bands, follow-ups and promises (`/school/fees/defaulters`); adjustments, refunds and instalment plans with approval status (`/school/fees/adjustments`); payment proofs with the screenshot beside the form (`/school/fees/proofs`); the named fee reports (`/school/fees/reports`); opening balances import.

### 9.5 · Online payments and reconciliation — [M22](../10-modules/m22-online-payments-reconciliation.md)

| Screen | Path | Pattern |
|---|---|---|
| Online payments (intents, transactions, Review tab) | `/school/finance/online` | List |
| Settlements | `/school/finance/online/settlements` | List + Detail |
| Bank statements; import | `/school/finance/bank` | List, Wizard |
| **Reconcile** | `/school/finance/bank/reconcile` | Split view |
| Create payments from a collection report | on an import | Wizard |
| Bank reconciliation | `/school/finance/bank/reconciliations` | Detail |
| Rules | `/school/finance/bank/rules` | Settings |

Everything runs against the `fake` payment provider and sample bank files in `tests/fixtures/bank/` (a generic CSV and three bank-style layouts). Real providers are connected in [Phase 18](phase-18-integrations.md) without changing these screens.

### 9.6 · Accounting — [M23](../10-modules/m23-accounting.md)

Chart of accounts (tree with balances); account mappings (each key with a plain description); journal entries (list, the entry editor with a running difference, reverse); transfers; recurring entries; periods with the closing checklist; bank accounts; financial reports with drill-down from a figure to the ledger, to the entry, to its source. Under `/school/finance/accounts`, `/school/finance/journal`, `/school/finance/reports`.

### 9.7 · Expenses and purchasing — [M24](../10-modules/m24-expenses-procurement.md)

Expenses with a receipt photo and the budget shown under the amount; petty cash; budgets (grid) and budget against actual; vendors; purchase requests with quotes; purchase orders; receive goods; vendor bills with the three-way match shown line by line; pay vendors (wizard with withholding shown); payables aging.

### 9.8 · Tax and compliance — [M25](../10-modules/m25-tax-compliance.md)

Tax rules with the slab editor and the calculator beside it, each draft carrying the banner "Not in use until confirmed"; tax collected; filings calendar; certificates; filer status; the compliance calendar (`/school/settings/compliance`).

**Before this phase closes**, the product owner obtains from a qualified tax adviser the figures marked **(confirm)** in [12 · Pakistan domain rules](../00-foundation/12-pakistan-domain-rules.md), for use in demonstrations. The product itself still ships with no confirmed rules; each school confirms its own.

### 9.9 · Dashboard and student tabs

Widgets: fee collection this month against billed, cash position, top defaulters, cash sessions awaiting approval, payment proofs waiting, online payments in review, bills due, filings due. Role layouts for finance head, accountant and cashier. The **Fees** tab on the student and on the family.

## Journeys to automate

| Journey | Role | Steps |
|---|---|---|
| A month of fees | Accountant | Activate a structure (missing amount caught) → preview generation (two students skipped with reasons) → run → vouchers exist once → run again → nothing new |
| At the counter | Cashier | Open a session → find a family by father's name → collect a part payment → receipt → collect the rest and more → the surplus shows as credit → close the session Rs 100 short with a note |
| Double click | Cashier | Press Save twice quickly → one payment |
| Two cashiers | Two cashiers | Collect for the same family at the same moment → no rupee is allocated twice |
| A mistake | Cashier, accountant | Reverse own payment in the same session → vouchers reopen; next day the cashier cannot, the accountant can with approval |
| Fines | System, accountant | Move the clock past the due date → the fine job adds a line once → a waiver is requested and approved → the line is offset |
| A parent pays online | Guardian, system | Start a payment → complete it on the fake provider → the receipt arrives → dues show zero; repeat with the callback delayed, then with the browser closed |
| A bank deposit | Accountant | Import a collection report → preview the three groups → create payments → import the bank statement → matches are suggested → confirm → complete the reconciliation at zero difference |
| Proof of transfer | Guardian, accountant | Upload a screenshot → no payment yet → verify against the bank line → payment recorded once |
| Books | Accountant, finance head | Trial balance nets to zero → open fee receivable → drill to a voucher → post a manual entry (unbalanced is refused) → close the period (checklist blocks until the session is approved) → a payment dated in the closed period is refused |
| Purchasing | Store keeper, accountant, finance head | Request → three quotes → order approved → receive part → bill for more than received is refused → pay with withholding shown |
| Budget | Accountant | An expense over a blocked budget line is refused; the finance head overrides with a reason |

## Exit checks

1. Every screen meets "Done when", and each of the six rules above is checked on every finance screen (a review checklist kept in the phase's pull requests).
2. All twelve journeys pass in the browser.
3. After the whole browser suite has run, the nightly integrity job reports no finding.
4. Fifty parallel counter payments driven through the UI layer's API calls leave vouchers, allocations, credit and ledger in agreement.
5. Every figure on the income statement and the fee reports can be clicked down to its source documents.
6. An accountant of City Campus sees no figure, family or entry of Main Campus on any screen.
7. `pnpm check`, `pnpm test:db`, `pnpm test:e2e`.

## Left for later, on purpose

- The printed challan, receipts and statements: [Phase 16](phase-16-documents-and-printing.md).
- The offline fee counter: [Phase 17](phase-17-offline.md).
- Real JazzCash, Easypaisa and 1BILL: [Phase 18](phase-18-integrations.md).
- Payroll postings on screen: [Phase 10](phase-10-hr.md).

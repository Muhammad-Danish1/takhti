# M24 · Expenses and procurement

## 1 · Purpose

Money going out, other than salaries: day-to-day expenses and petty cash, and proper purchasing for larger items — request, quotations, purchase order, goods received, vendor bill, payment — all against a budget.

## 2 · Depends on

[M23](m23-accounting.md) (accounts, cost centers, bank accounts, posting), [M25](m25-tax-compliance.md) (withholding on vendor payments), [M26](m26-staff-recruitment.md) (`staff`), [M00](m00-shared-kernel.md) (approvals, sequences, files). Works with [M32](m32-inventory-assets.md) (items, stores, stock in).

## 3 · Tables

#### `vendors` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required |
| code | text | required; from the `vendor` sequence |
| kind | enum(company, individual) | default company |
| contact_person | text | optional |
| phone | text | optional; normalised |
| email | text | optional |
| address | text | optional |
| city | text | optional |
| ntn | text | optional |
| strn | text | optional; sales tax registration |
| cnic | text | optional; for an individual |
| filer_status | enum(filer, non_filer, unknown) | default unknown |
| supply_kind | enum(goods, services, both) | default goods |
| payment_terms_days | int | default 0 |
| bank_title | text | optional |
| bank_iban | text | optional |
| status | enum(active, blocked) | default active |
| note | text | optional |

Unique: (org_id, code); (org_id, ntn) when present.
Index: trigram on `name`.

#### `expense_categories` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation; "Electricity", "Stationery", "Repairs" |
| name_ur | text | optional |
| account_id | uuid → accounts | required; an expense account |
| needs_receipt | bool | default true |
| is_active | bool | default true |

#### `expenses` · branch
A direct expense: paid on the spot from cash, petty cash or the bank, with no purchase order.

| Column | Type | Rules |
|---|---|---|
| expense_no | text | required; from the `expense` sequence |
| expense_date | date | required; not in the future |
| category_id | uuid → expense_categories | required |
| description | text | required |
| amount | paisa | required; > 0 |
| vendor_id | uuid → vendors | optional |
| payee | text | optional; when there is no vendor record |
| bill_reference | text | optional |
| paid_from | enum(petty_cash, cash, bank) | required |
| petty_cash_fund_id | uuid → petty_cash_funds | optional; required for `petty_cash` |
| bank_account_id | uuid → bank_accounts | optional; required for `bank` |
| payment_reference | text | optional; cheque or transfer number |
| cost_center_id | uuid → cost_centers | optional |
| requested_by_staff_id | uuid → staff | optional |
| status | enum(draft, pending, approved, paid, rejected, void) | default draft |
| approval_request_id | uuid → approval_requests | optional |
| paid_at | timestamptz | optional |
| void_reason | text | optional |

Index: (org_id, branch_id, expense_date); (org_id, category_id, expense_date).

#### `petty_cash_funds` · branch
An imprest: a fixed float topped back up to its limit.

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per branch |
| custodian_staff_id | uuid → staff | required |
| float_amount | paisa | required; > 0 |
| balance | paisa | default 0; maintained with every transaction |
| per_expense_limit | paisa | optional; the most one expense may be |
| account_id | uuid → accounts | required; subtype `cash` |
| is_active | bool | default true |

#### `petty_cash_transactions` · branch append-only

| Column | Type | Rules |
|---|---|---|
| fund_id | uuid → petty_cash_funds | required |
| kind | enum(top_up, expense, return, count_adjustment) | required |
| amount | paisa | required; signed: money in is positive |
| balance_after | paisa | required |
| expense_id | uuid → expenses | optional |
| txn_date | date | required |
| note | text | optional |

#### `budgets` · org

| Column | Type | Rules |
|---|---|---|
| fiscal_year_id | uuid → fiscal_years | required |
| branch_id | uuid → branches | optional; empty for a group-level budget |
| name | text | required |
| status | enum(draft, approved, closed) | default draft |
| approval_request_id | uuid → approval_requests | optional |
| check_mode | enum(none, warn, block) | default warn |

Unique: (fiscal_year_id, branch_id) among approved budgets.

#### `budget_lines` · org

| Column | Type | Rules |
|---|---|---|
| budget_id | uuid → budgets | required |
| account_id | uuid → accounts | required; an income or expense account |
| cost_center_id | uuid → cost_centers | optional |
| monthly | paisa[] | required; twelve amounts, one per fiscal period |
| annual | paisa | generated: the sum of `monthly` |
| note | text | optional |

Unique: (budget_id, account_id, cost_center_id).

#### `purchase_requests` · branch

| Column | Type | Rules |
|---|---|---|
| request_no | text | required; from the `purchase_request` sequence |
| requested_by_staff_id | uuid → staff | required |
| needed_by | date | optional |
| reason | text | required |
| estimated_total | paisa | default 0 |
| cost_center_id | uuid → cost_centers | optional |
| status | enum(draft, pending, approved, rejected, ordered, cancelled) | default draft |
| approval_request_id | uuid → approval_requests | optional |

#### `purchase_request_lines` · branch

| Column | Type | Rules |
|---|---|---|
| request_id | uuid → purchase_requests | required |
| item_id | uuid → inventory_items | optional |
| description | text | required |
| quantity | numeric(12,3) | required; > 0 |
| unit | text | required |
| estimated_price | paisa | optional |

#### `purchase_quotes` · branch

| Column | Type | Rules |
|---|---|---|
| request_id | uuid → purchase_requests | required |
| vendor_id | uuid → vendors | required |
| amount | paisa | required |
| delivery_days | int | optional |
| file_id | uuid → files | optional |
| is_selected | bool | default false |
| selection_reason | text | optional; required when the selected quote is not the lowest |

Unique: (request_id, vendor_id).

#### `purchase_orders` · branch

| Column | Type | Rules |
|---|---|---|
| po_no | text | required; from the `purchase_order` sequence |
| vendor_id | uuid → vendors | required |
| request_id | uuid → purchase_requests | optional |
| order_date | date | required |
| expected_on | date | optional |
| subtotal | paisa | required |
| tax | paisa | default 0 |
| total | paisa | required |
| terms | text | optional |
| status | enum(draft, pending, approved, sent, partly_received, received, closed, cancelled) | default draft |
| approval_request_id | uuid → approval_requests | optional |
| document_id | uuid → generated_documents | optional |

#### `po_lines` · branch

| Column | Type | Rules |
|---|---|---|
| po_id | uuid → purchase_orders | required |
| item_id | uuid → inventory_items | optional |
| description | text | required |
| quantity | numeric(12,3) | required; > 0 |
| unit | text | required |
| unit_price | paisa | required; ≥ 0 |
| tax_percent | numeric(5,2) | default 0 |
| account_id | uuid → accounts | optional; for a line that is not a stock item |
| received_qty | numeric(12,3) | default 0 |
| billed_qty | numeric(12,3) | default 0 |

#### `goods_receipts` · branch

| Column | Type | Rules |
|---|---|---|
| grn_no | text | required; from the `goods_receipt` sequence |
| po_id | uuid → purchase_orders | required |
| received_on | date | required |
| received_by | uuid → profiles | required |
| warehouse_id | uuid → warehouses | optional; required when any line is a stock item |
| delivery_note_no | text | optional |
| status | enum(draft, posted, cancelled) | default draft |

#### `grn_lines` · branch

| Column | Type | Rules |
|---|---|---|
| grn_id | uuid → goods_receipts | required |
| po_line_id | uuid → po_lines | required |
| quantity_received | numeric(12,3) | required; ≥ 0 |
| quantity_rejected | numeric(12,3) | default 0 |
| note | text | optional |

#### `vendor_bills` · branch

| Column | Type | Rules |
|---|---|---|
| bill_no | text | required; the vendor's own invoice number |
| vendor_id | uuid → vendors | required |
| po_id | uuid → purchase_orders | optional |
| bill_date | date | required |
| due_date | date | required; default `bill_date` + the vendor's terms |
| subtotal | paisa | required |
| tax | paisa | default 0 |
| total | paisa | required |
| paid | paisa | default 0 |
| balance | paisa | generated: `total - paid` |
| status | enum(draft, pending, approved, partly_paid, paid, void) | default draft |
| approval_request_id | uuid → approval_requests | optional |
| file_id | uuid → files | optional; the scanned bill |

Unique: (org_id, vendor_id, bill_no) among live rows that are not void.

#### `vendor_bill_lines` · branch

| Column | Type | Rules |
|---|---|---|
| bill_id | uuid → vendor_bills | required |
| po_line_id | uuid → po_lines | optional |
| description | text | required |
| account_id | uuid → accounts | required |
| cost_center_id | uuid → cost_centers | optional |
| quantity | numeric(12,3) | default 1 |
| amount | paisa | required |

#### `vendor_payments` · branch

| Column | Type | Rules |
|---|---|---|
| payment_no | text | required; from the `vendor_payment` sequence |
| vendor_id | uuid → vendors | required |
| paid_on | date | required |
| gross | paisa | required; what is settled against bills |
| withholding | paisa | default 0; tax deducted |
| net | paisa | required; `gross - withholding`; what the vendor receives |
| method | enum(cash, cheque, bank_transfer) | required |
| bank_account_id | uuid → bank_accounts | optional |
| reference | text | optional |
| status | enum(pending, approved, paid, void) | default pending |
| approval_request_id | uuid → approval_requests | optional |
| void_reason | text | optional |

#### `vendor_payment_allocations` · branch

| Column | Type | Rules |
|---|---|---|
| payment_id | uuid → vendor_payments | required |
| bill_id | uuid → vendor_bills | required |
| amount | paisa | required; > 0 |

Unique: (payment_id, bill_id).

## 4 · Contracts

`packages/contracts/src/modules/procurement/`: `vendors`, `expense-categories`, `expenses`, `petty-cash`, `budgets`, `purchase-requests`, `purchase-orders`, `goods-receipts`, `vendor-bills`, `vendor-payments`.

- `BudgetCheck`: `{ accountId, costCenterId?, amount, date }` → budget for the period, spent, committed (approved purchase orders not yet billed), available, and `ok | warn | block`.
- `ThreeWayMatch`: per bill line — ordered, received, billed and the differences.
- `VendorStatement`: bills, payments, withholding and balance for a period.
- `PayablesAging`: open bills by age band per vendor.
- `BudgetVsActual`: per account per month — budget, actual, commitment, variance.

Settings: `procurement.quotes_required_above` (default Rs 50,000), `procurement.quotes_required_count` (default 3), `procurement.po_required_above` (default Rs 25,000; a bill above this needs a purchase order), `procurement.match_tolerance_percent` (default 2), `expenses.receipt_required_above` (default Rs 1,000).

## 5 · Rules

**Expenses and petty cash**

- **R-proc-1** An expense needs a receipt attached when its category says so and its amount is above `expenses.receipt_required_above`.
- **R-proc-2** An expense is approved according to the approval policy for its amount ([M00](m00-shared-kernel.md)); the person who entered it cannot approve it. Paying it posts the ledger entry and, for petty cash, reduces the fund's balance, in one transaction.
- **R-proc-3** A petty cash expense cannot exceed the fund's balance or its per-expense limit. A top-up brings the balance back to the float and is a transfer from cash or bank.
- **R-proc-4** A petty cash count records the cash found; a difference is a `count_adjustment` posted to `cash.over_short` with a note.
- **R-proc-5** A paid expense is never edited. It is voided with a reason, which posts the opposite entry and, for petty cash, returns the money to the fund.

**Budget**

- **R-proc-6** One approved budget per fiscal year per branch. A budget check runs when an expense, purchase request, purchase order or bill is submitted. According to the budget's `check_mode` it does nothing, warns, or blocks until someone with `budgets:override` continues with a reason.
- **R-proc-7** Available = budget to date − actual posted − commitments. A commitment is the unbilled part of an approved purchase order.

**Purchasing**

- **R-proc-8** A purchase request above `procurement.quotes_required_above` needs the configured number of quotes before it can be approved. Choosing a quote that is not the lowest needs a reason.
- **R-proc-9** A purchase order is approved by amount, then sent to the vendor as a PDF. An approved order's lines are not edited; a change is a cancellation and a new order.
- **R-proc-10** Goods received are recorded against order lines. Receiving more than was ordered is refused beyond the tolerance. Posting a receipt of stock items creates stock movements in the chosen store ([M32](m32-inventory-assets.md)).
- **R-proc-11** A vendor bill's number is unique per vendor. A bill above `procurement.po_required_above` must name a purchase order.
- **R-proc-12** **Three-way match.** A bill line linked to an order line can be approved only when the quantity billed does not exceed the quantity received, and the price is within `procurement.match_tolerance_percent` of the order. Outside that, it needs `vendor-bills:override` and a reason.
- **R-proc-13** A blocked vendor cannot receive a new order or payment.

**Paying vendors**

- **R-proc-14** A vendor payment settles one or more approved bills of one vendor. Withholding tax is calculated by [M25](m25-tax-compliance.md) from the vendor's kind, supply kind and filer status, shown before saving, and recorded there.
- **R-proc-15** A payment needs approval by amount and is then marked paid with its reference; that posts the entry and updates each bill's `paid`.
- **R-proc-16** A payment cannot exceed the bills' balances. Paying in advance of a bill is recorded as a vendor advance (`ap.advances_to_vendors`) and applied to a later bill.
- **R-proc-17** A paid vendor payment is voided, never edited; voiding reopens the bills and posts the opposite entry.
- **R-proc-18** Nothing here posts into a closed fiscal period.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `vendors:read` | See vendors | FINANCE, LEADERS, store_keeper |
| `vendors:manage` | Add, edit and block vendors | ACCOUNTS |
| `expenses:read` | See expenses | FINANCE, LEADERS |
| `expenses:create` | Enter expenses and submit them | FINANCE, branch_admin, store_keeper |
| `expenses:pay` | Pay approved expenses; void | ACCOUNTS |
| `petty-cash:manage` | Run a petty cash fund: spend, count, request top-up | accountant, cashier, branch_admin |
| `budgets:read` | See budgets and budget against actual | FINANCE, LEADERS |
| `budgets:manage` | Prepare and submit budgets | ACCOUNTS |
| `budgets:override` | Continue past a blocked budget check | finance_head, director |
| `purchase-requests:create` | Raise purchase requests | ALL_STAFF |
| `purchase-requests:manage` | Add quotes; convert to orders | ACCOUNTS, store_keeper, branch_admin |
| `purchase-orders:read` | See purchase orders | FINANCE, LEADERS, store_keeper |
| `purchase-orders:manage` | Create, send and cancel orders | ACCOUNTS, branch_admin |
| `goods-receipts:create` | Record goods received | store_keeper, branch_admin |
| `vendor-bills:manage` | Enter and submit vendor bills | ACCOUNTS |
| `vendor-bills:override` | Approve a bill outside the match tolerance | finance_head |
| `vendor-payments:manage` | Prepare, pay and void vendor payments | ACCOUNTS |
| `procurement:export` | Export purchasing and expense data | ACCOUNTS, LEADERS |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/vendors` | `vendors:read` | Lists |
| POST | `/vendors` | `vendors:manage` | Creates |
| GET | `/vendors/[id]` | `vendors:read` | One vendor with balance |
| PATCH | `/vendors/[id]` | `vendors:manage` | Edits |
| GET | `/vendors/[id]/statement` | `vendors:read` | The vendor statement |
| GET | `/expense-categories` | `expenses:read` | Lists |
| POST | `/expense-categories` | `vendors:manage` | Creates |
| PATCH | `/expense-categories/[id]` | `vendors:manage` | Edits |
| GET | `/expenses` | `expenses:read` | Lists; filter by dates, category, status, paid from |
| POST | `/expenses` | `expenses:create` | Creates a draft |
| GET | `/expenses/[id]` | `expenses:read` | One expense |
| PATCH | `/expenses/[id]` | `expenses:create` | Edits a draft |
| POST | `/expenses/[id]/submit` | `expenses:create` | Sends for approval |
| POST | `/expenses/[id]/pay` | `expenses:pay` | Pays |
| POST | `/expenses/[id]/void` | `expenses:pay` | Voids with a reason |
| GET | `/petty-cash-funds` | `expenses:read` | Lists with balances |
| POST | `/petty-cash-funds` | `expenses:pay` | Creates |
| PATCH | `/petty-cash-funds/[id]` | `expenses:pay` | Edits |
| GET | `/petty-cash-funds/[id]/transactions` | `expenses:read` | The fund's book |
| POST | `/petty-cash-funds/[id]/top-up` | `expenses:pay` | Tops up to the float |
| POST | `/petty-cash-funds/[id]/count` | `petty-cash:manage` | Records a count |
| GET | `/budgets` | `budgets:read` | Lists |
| POST | `/budgets` | `budgets:manage` | Creates, optionally from last year's actuals |
| GET | `/budgets/[id]` | `budgets:read` | One budget as a grid |
| PUT | `/budgets/[id]/lines` | `budgets:manage` | Saves the grid |
| POST | `/budgets/[id]/submit` | `budgets:manage` | Sends for approval |
| POST | `/budgets/check` | `expenses:create` | Runs a budget check |
| GET | `/budgets/[id]/actuals` | `budgets:read` | Budget against actual |
| GET | `/purchase-requests` | `purchase-requests:create` | Lists the requests I may see |
| POST | `/purchase-requests` | `purchase-requests:create` | Creates |
| GET | `/purchase-requests/[id]` | `purchase-requests:create` | One request with quotes |
| PATCH | `/purchase-requests/[id]` | `purchase-requests:create` | Edits a draft |
| POST | `/purchase-requests/[id]/submit` | `purchase-requests:create` | Sends for approval |
| PUT | `/purchase-requests/[id]/quotes` | `purchase-requests:manage` | Saves quotes and the selection |
| POST | `/purchase-requests/[id]/order` | `purchase-requests:manage` | Creates a purchase order from it |
| GET | `/purchase-orders` | `purchase-orders:read` | Lists |
| POST | `/purchase-orders` | `purchase-orders:manage` | Creates |
| GET | `/purchase-orders/[id]` | `purchase-orders:read` | One order with receipts and bills |
| PATCH | `/purchase-orders/[id]` | `purchase-orders:manage` | Edits a draft |
| POST | `/purchase-orders/[id]/submit` | `purchase-orders:manage` | Sends for approval |
| POST | `/purchase-orders/[id]/send` | `purchase-orders:manage` | Generates the PDF and marks it sent |
| POST | `/purchase-orders/[id]/close` | `purchase-orders:manage` | Closes a part-received order |
| POST | `/purchase-orders/[id]/cancel` | `purchase-orders:manage` | Cancels |
| GET | `/goods-receipts` | `purchase-orders:read` | Lists |
| POST | `/goods-receipts` | `goods-receipts:create` | Records a receipt |
| POST | `/goods-receipts/[id]/post` | `goods-receipts:create` | Posts it and moves stock |
| GET | `/vendor-bills` | `purchase-orders:read` | Lists; filter by vendor, status, due |
| POST | `/vendor-bills` | `vendor-bills:manage` | Creates |
| GET | `/vendor-bills/[id]` | `purchase-orders:read` | One bill with its match |
| PATCH | `/vendor-bills/[id]` | `vendor-bills:manage` | Edits a draft |
| POST | `/vendor-bills/[id]/submit` | `vendor-bills:manage` | Sends for approval |
| POST | `/vendor-bills/[id]/void` | `vendor-bills:manage` | Voids an unpaid bill |
| GET | `/vendor-payments` | `purchase-orders:read` | Lists |
| POST | `/vendor-payments` | `vendor-payments:manage` | Prepares a payment with withholding shown |
| POST | `/vendor-payments/[id]/pay` | `vendor-payments:manage` | Marks paid and posts |
| POST | `/vendor-payments/[id]/void` | `vendor-payments:manage` | Voids |
| GET | `/payables/aging` | `expenses:read` | Payables by age |
| GET | `/procurement/export` | `procurement:export` | Exports |

Idempotent: `POST /expenses/[id]/pay`, `POST /vendor-payments/[id]/pay`, `POST /goods-receipts/[id]/post`, `POST /petty-cash-funds/[id]/top-up`.

## 8 · Client layer

Generated CRUD for vendors and categories. Custom hooks: `useExpenses`, `useSubmitExpense`, `usePayExpense`, `usePettyCashBook`, `useBudgetGrid`, `useBudgetCheck` (debounced, shown inline on forms), `useBudgetActuals`, `usePurchaseRequest`, `useSaveQuotes`, `usePurchaseOrder`, `usePostGoodsReceipt`, `useVendorBillMatch`, `usePrepareVendorPayment`, `usePayablesAging`.

## 9 · Screens

Built in [Phase 9](../20-phases/phase-09-finance.md).

| Screen | Pattern | Where |
|---|---|---|
| Expenses | List + Form in a sheet | `/school/finance/expenses`: receipt photo from the phone camera; budget shown under the amount |
| Petty cash | Detail | Balance against float; the book; spend, count, top-up |
| Budgets | Grid editor | Accounts down, months across; spread an annual figure evenly or by last year's pattern |
| Budget against actual | Report | Bars per account; variance in colour with a label |
| Vendors | List + Detail | Tabs: Details, Orders, Bills, Payments, Statement |
| Purchase requests | List + Form page | Lines; quotes table with the lowest marked |
| Purchase orders | List + Detail | Lines with ordered, received, billed; send as PDF |
| Receive goods | Form page | Order lines with a quantity box each; reject with a note |
| Vendor bills | List + Form page | The scanned bill beside the form; three-way match shown line by line |
| Pay vendors | Wizard | Pick vendor and bills, see withholding and net, method, approve, pay |
| Payables aging | Report | By vendor and age band |

## 10 · Notifications and jobs

Events: `expense.approval-requested`, `expense.approved`, `expense.rejected`, `petty-cash.low` (below 20% of the float), `budget.threshold` (80% and 100% of a line), `purchase-request.approved`, `purchase-order.sent`, `goods.received` (to the requester), `vendor-bill.due` (3 days before), `vendor-bill.overdue`, `vendor-payment.approval-requested`.

Jobs: `procurement.bill-reminders` (daily 09:00), `procurement.budget-thresholds` (daily), `procurement.integrity` (nightly: bill `paid` equals allocations; `ap.payable` equals open bills; fund balance equals its transactions).

Documents: purchase order, goods received note, payment voucher, expense voucher, vendor statement, comparative statement of quotes.

## 11 · Offline

None.

## 12 · AI

- Reading a photographed bill into vendor, date, number, lines and total, shown beside the image for checking (A7).
- Unusual activity: split purchases just under an approval limit, the same bill number from two vendors, one person requesting and receiving (S5).

## 13 · Failure cases

- **F-proc-1** A bill is entered twice → the second is refused: this vendor already has that bill number.
- **F-proc-2** A bill is for 100 units but only 80 were received → approval is refused for that line; record the remaining receipt or override with a reason.
- **F-proc-3** An expense would take a budget line over its limit in `block` mode → refused until overridden; the override and its reason are audited.
- **F-proc-4** Petty cash has Rs 800 and the expense is Rs 1,200 → refused with the balance; top up first.
- **F-proc-5** A purchase order is cancelled after part was received → refused; close it instead, which releases the remaining commitment.
- **F-proc-6** A vendor payment is approved and the bank transfer then fails → it stays `approved`, not `paid`; nothing is posted until it is marked paid.
- **F-proc-7** The vendor's filer status changes between preparing and paying → withholding is recalculated at payment and the difference is shown before confirming.
- **F-proc-8** A goods receipt is posted to the wrong store → cancel it, which reverses the stock movements if the stock is still there; otherwise transfer between stores.
- **F-proc-9** A purchase of Rs 60,000 is split into two requests of Rs 30,000 to avoid quotes → not blocked, but flagged in unusual activity.
- **F-proc-10** An approver is the person who raised the request → refused; it goes to the next approver in the policy.

## 14 · Seed data

Twenty-five vendors (two blocked, mixed filer status). Eighteen expense categories. A petty cash fund per branch with two months of transactions and one count difference. An approved budget per branch for the current year with some lines over 80%. Three months of expenses in every status. Twelve purchase requests (four with quotes), ten purchase orders in every status, receipts including a partial one, fifteen vendor bills (two overdue, one outside tolerance waiting for override), eight vendor payments with withholding.

## 15 · Tests

- **T-proc-1** Expense flow: receipt rule, approval by amount, cannot self-approve, pay posts once, void reverses.
- **T-proc-2** Petty cash: balance and limit checks; top-up to float; count difference.
- **T-proc-3** Budget check arithmetic including commitments; warn and block modes; override.
- **T-proc-4** Quotes rule and the lowest-quote reason.
- **T-proc-5** Purchase order lifecycle; edits refused after approval.
- **T-proc-6** Receiving: over-receipt refused; stock movements created once.
- **T-proc-7** Three-way match inside and outside tolerance.
- **T-proc-8** Duplicate bill number per vendor.
- **T-proc-9** Vendor payment: withholding from the tax module; allocations; cannot overpay; advances.
- **T-proc-10** Every posting matches the map in [M23](m23-accounting.md).
- **T-proc-11** Closed period refused.
- **T-proc-12** Row-level security and branch scope.

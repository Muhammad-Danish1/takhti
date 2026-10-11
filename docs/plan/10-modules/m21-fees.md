# M21 · Fees

## 1 · Purpose

Everything about what families owe and pay: fee structures, discounts, monthly vouchers, the three-copy bank challan, collection at the counter, part and advance payments, fines, refunds and the defaulter list. Every rupee is traceable from the receipt to the ledger.

This is the module where a mistake costs real money. It follows three fixed principles:

1. **Nothing financial is edited or deleted.** A voucher is changed by an adjustment, a payment by a reversal.
2. **Every operation is one database transaction** that includes its ledger entry ([M23](m23-accounting.md)).
3. **Every write is idempotent**, so a double click or a retried sync never takes money twice.

## 2 · Depends on

[M04](m04-school-setup.md), [M07](m07-students.md), [M11](m11-academic-structure.md), [M23](m23-accounting.md) (`accounts`, `bank_accounts`, posting), [M25](m25-tax-compliance.md) (advance tax), [M00](m00-shared-kernel.md) (sequences, approvals, documents). Fed by [M06](m06-admissions.md) (admission voucher), [M30](m30-transport.md) and [M35](m35-hostel.md) (optional charges), [M22](m22-online-payments-reconciliation.md) (online and bank payments).

## 3 · Tables

#### `fee_heads` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation; "Tuition fee" |
| name_ur | text | optional |
| code | text | required; unique per organisation |
| kind | enum(tuition, admission, security_deposit, annual, exam, transport, hostel, lab, books, uniform, fine, tax, rounding, other) | required |
| frequency | enum(monthly, once, yearly, per_term, on_demand) | required |
| is_refundable | bool | default false; true for the security deposit |
| counts_for_advance_tax | bool | default true |
| priority | int | default 100; lower is paid first inside a voucher |
| income_account_id | uuid → accounts | optional; falls back to the account mapping |
| is_system | bool | default false; `fine`, `tax` and `rounding` heads cannot be deleted |
| is_active | bool | default true |

#### `fee_structures` · org

| Column | Type | Rules |
|---|---|---|
| academic_year_id | uuid → academic_years | required |
| branch_id | uuid → branches | optional; empty means every branch without its own |
| name | text | required |
| effective_from | date | required; first day of a month |
| status | enum(draft, active, archived) | default draft |
| increase_percent | numeric(5,2) | optional; computed against last year's at activation |
| increase_reason | text | optional; required when above the configured cap |
| activated_by | uuid → profiles | optional |

Unique: (academic_year_id, branch_id, effective_from) among live rows.

#### `fee_structure_items` · org

| Column | Type | Rules |
|---|---|---|
| fee_structure_id | uuid → fee_structures | required |
| grade_id | uuid → grades | required |
| fee_head_id | uuid → fee_heads | required |
| amount | paisa | required; ≥ 0 |
| charge_months | int[] | default empty; for `yearly` and `per_term` heads, the calendar months in which it is charged |
| is_optional | bool | default false; charged only to students who have it as a fee item |

Unique: (fee_structure_id, grade_id, fee_head_id).

#### `student_fee_plans` · branch +family
One per student per academic year.

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| family_id | uuid → families | required |
| academic_year_id | uuid → academic_years | required |
| fee_structure_id | uuid → fee_structures | required |
| billing_from | date | required; first day of the first month charged |
| billing_to | date | optional; last month charged; set when the student leaves |
| status | enum(active, paused, ended) | default active |
| note | text | optional |

Unique: (student_id, academic_year_id) among live rows.

#### `student_fee_items` · branch +family
A charge for one student beyond, or instead of, the structure: transport by stop, hostel, an agreed special fee.

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| fee_head_id | uuid → fee_heads | required |
| amount | paisa | required; ≥ 0 |
| mode | enum(add, replace) | default add; `replace` overrides the structure's amount for that head |
| from_month | date | required |
| to_month | date | optional |
| source | enum(manual, transport, hostel, admission) | default manual |
| reason | text | optional; required for `replace` |

Index: (org_id, student_id, from_month).

#### `discount_types` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation |
| name_ur | text | optional |
| kind | enum(sibling, staff_child, merit, need_based, orphan, hafiz, custom) | required |
| calc | enum(percent, fixed) | required |
| value | numeric(12,2) | required; a percentage (0–100) or an amount in rupees |
| fee_head_ids | uuid[] | required; the heads it reduces, usually tuition only |
| sibling_position | int | optional; for `sibling`: 2 for the second child, 3 for the third and later |
| needs_approval | bool | default true |
| is_active | bool | default true |

#### `student_discounts` · branch +family

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| discount_type_id | uuid → discount_types | required |
| calc | enum(percent, fixed) | required; copied, may be changed for this student |
| value | numeric(12,2) | required |
| fee_head_ids | uuid[] | required |
| from_month | date | required |
| to_month | date | required; an end date is compulsory |
| reason | text | required |
| staff_id | uuid → staff | optional; required for `staff_child` |
| status | enum(pending, approved, rejected, ended) | default pending |
| approval_request_id | uuid → approval_requests | optional |
| is_automatic | bool | default false; a sibling discount applied by rule |

Index: (org_id, student_id, status).

#### `fine_rules` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required |
| branch_id | uuid → branches | optional; empty means every branch without its own |
| calc | enum(fixed, per_day, percent) | required |
| value | numeric(12,2) | required |
| grace_days | int | default 0; days after the due date before the fine starts |
| cap | paisa | optional; the most a single voucher can be fined |
| effective_from | date | required |
| is_active | bool | default true |

#### `fee_generation_runs` · branch

| Column | Type | Rules |
|---|---|---|
| billing_month | date | required; first day of the month |
| months_covered | int | default 1; 1 to 4 |
| grade_ids | uuid[] | default empty; empty means all |
| issue_date | date | required |
| due_date | date | required; ≥ `issue_date` |
| status | enum(previewed, running, completed, completed_with_errors, failed) | required |
| vouchers_created | int | default 0 |
| amount_total | paisa | default 0 |
| skipped | jsonb | default `[]`; `{ studentId, reason }` |
| started_by | uuid → profiles | required |

#### `fee_vouchers` · branch +household

| Column | Type | Rules |
|---|---|---|
| voucher_no | text | required; from the `fee_voucher` sequence; unique per organisation |
| challan_no | text | required; equals `voucher_no`, or is shared by a family's vouchers of one run when billing by family |
| kind | enum(regular, admission, on_demand, opening) | default regular; `opening` carries a balance brought from the previous system |
| student_id | uuid → students | required |
| family_id | uuid → families | required |
| enrollment_id | uuid → enrollments | optional |
| academic_year_id | uuid → academic_years | required |
| billing_month | date | required; first day of the first month covered |
| months_covered | int | default 1 |
| period_label | text | required; "October 2026", "June – August 2026" |
| issue_date | date | required |
| due_date | date | required |
| total | paisa | required; the sum of its lines |
| paid | paisa | default 0; the sum of its allocations |
| balance | paisa | generated: `total - paid` |
| status | enum(unpaid, partial, paid, cancelled) | default unpaid; "overdue" is derived from `balance > 0` and `due_date < today` |
| run_id | uuid → fee_generation_runs | optional |
| cancelled_reason | text | optional |
| printed_count | int | default 0 |

Unique: (student_id, billing_month, kind) among live rows that are not cancelled and have kind `regular`.
Index: (org_id, branch_id, status, due_date); (org_id, family_id, status); (org_id, challan_no).

#### `fee_voucher_lines` · branch +household append-only

| Column | Type | Rules |
|---|---|---|
| voucher_id | uuid → fee_vouchers | required |
| family_id | uuid → families | required |
| fee_head_id | uuid → fee_heads | required; a discount line carries the head it reduces |
| kind | enum(charge, discount, fine, tax, adjustment, rounding) | required |
| description | text | required |
| period_month | date | optional; the month this line is for |
| amount | paisa | required; negative for a discount or a credit adjustment |
| student_discount_id | uuid → student_discounts | optional |
| adjustment_id | uuid → fee_adjustments | optional |
| fine_date | date | optional; makes fine assessment idempotent |

Unique: (voucher_id, kind, fine_date) for fine lines.
Lines are only ever inserted.

#### `cash_sessions` · branch
A cashier's shift at the counter.

| Column | Type | Rules |
|---|---|---|
| cashier_id | uuid → profiles | required |
| opened_at | timestamptz | required |
| opening_float | paisa | default 0 |
| closed_at | timestamptz | optional |
| expected_cash | paisa | optional; float + cash received − cash refunded |
| counted_cash | paisa | optional |
| difference | paisa | optional; `counted_cash - expected_cash` |
| difference_note | text | optional; required when the difference is not zero |
| deposit_reference | text | optional; the bank deposit slip |
| status | enum(open, closed, approved) | default open |
| approved_by | uuid → profiles | optional |
| device_id | uuid → sync_devices | optional |

Unique: (cashier_id) among sessions with status `open`.

#### `fee_payments` · branch +household

| Column | Type | Rules |
|---|---|---|
| receipt_no | text | required; from the `receipt` sequence; unique per organisation |
| device_receipt_code | text | optional; the number printed on a receipt issued offline |
| family_id | uuid → families | required |
| student_id | uuid → students | optional; the child named by the payer |
| amount | paisa | required; > 0 |
| allocated | paisa | default 0 |
| refunded | paisa | default 0 |
| unallocated | paisa | generated: `amount - allocated - refunded`; this is the family's credit |
| paid_on | date | required; not in the future |
| received_at | timestamptz | required |
| method | enum(cash, bank_deposit, bank_transfer, cheque, online) | required |
| channel | text | optional; `onebill`, `jazzcash`, `easypaisa`, `card` |
| reference | text | optional; required for every method except cash |
| bank_account_id | uuid → bank_accounts | optional; required for bank methods |
| cash_session_id | uuid → cash_sessions | optional; required for cash |
| collected_by | uuid → profiles | optional; empty for online |
| source | enum(counter, online, bank_file, proof, import, offline) | required |
| status | enum(recorded, pending_clearance, bounced, reversed) | default recorded |
| reversed_at | timestamptz | optional |
| reversed_by | uuid → profiles | optional |
| reversal_reason | text | optional |
| note | text | optional |

Unique: (org_id, channel, reference) among live `online` payments; (org_id, device_receipt_code).
Index: (org_id, branch_id, paid_on); (org_id, family_id); (org_id, cash_session_id).

#### `fee_payment_allocations` · branch +household append-only

| Column | Type | Rules |
|---|---|---|
| payment_id | uuid → fee_payments | required |
| voucher_id | uuid → fee_vouchers | required |
| fee_head_id | uuid → fee_heads | required |
| family_id | uuid → families | required |
| amount | paisa | required; positive, or negative for a release |
| allocated_on | date | required |

Index: (org_id, voucher_id); (org_id, payment_id).
Rows are only ever inserted; releasing an allocation adds a negative row.

#### `fee_adjustments` · branch

| Column | Type | Rules |
|---|---|---|
| voucher_id | uuid → fee_vouchers | required |
| kind | enum(waiver, fine_waiver, extra_charge, correction, write_off) | required |
| fee_head_id | uuid → fee_heads | required |
| amount | paisa | required; > 0; the sign follows the kind |
| reason | text | required; at least 10 characters |
| status | enum(pending, approved, rejected, applied) | default pending |
| approval_request_id | uuid → approval_requests | optional |
| requested_by | uuid → profiles | required |
| applied_at | timestamptz | optional |

#### `fee_refunds` · branch +household

| Column | Type | Rules |
|---|---|---|
| refund_no | text | required; from the `refund` sequence |
| family_id | uuid → families | required |
| student_id | uuid → students | optional |
| kind | enum(security_deposit, credit, fee) | required |
| amount | paisa | required; > 0 |
| deductions | paisa | default 0; dues taken from a security deposit |
| method | enum(cash, bank_transfer, cheque) | required |
| reference | text | optional |
| reason | text | required |
| withdrawal_id | uuid → student_withdrawals | optional |
| status | enum(pending, approved, paid, rejected, cancelled) | default pending |
| approval_request_id | uuid → approval_requests | optional |
| paid_on | date | optional |
| paid_by | uuid → profiles | optional |
| cash_session_id | uuid → cash_sessions | optional |

#### `fee_installment_plans` · branch +household

| Column | Type | Rules |
|---|---|---|
| family_id | uuid → families | required |
| student_id | uuid → students | optional |
| voucher_ids | uuid[] | required; the vouchers it covers |
| total | paisa | required; their balance when agreed |
| status | enum(pending, active, completed, defaulted, cancelled) | default pending |
| approval_request_id | uuid → approval_requests | optional |
| note | text | optional |

#### `fee_installments` · branch +household

| Column | Type | Rules |
|---|---|---|
| plan_id | uuid → fee_installment_plans | required |
| family_id | uuid → families | required |
| due_date | date | required |
| amount | paisa | required; > 0; the plan's instalments total its `total` |
| status | enum(due, paid, missed) | default due |

#### `payment_proofs` · branch +household
A parent's screenshot of a bank transfer, waiting to be checked.

| Column | Type | Rules |
|---|---|---|
| family_id | uuid → families | required |
| challan_no | text | optional |
| amount | paisa | required; > 0 |
| paid_on | date | required; not in the future |
| reference | text | optional; the bank's transaction id |
| file_id | uuid → files | required |
| submitted_by | uuid → profiles | required |
| status | enum(submitted, verified, rejected) | default submitted |
| verified_by | uuid → profiles | optional |
| verified_at | timestamptz | optional |
| reject_reason | text | optional |
| payment_id | uuid → fee_payments | optional; set when verified |

Policy: a guardian may insert for their own family and read their own rows.

#### `fee_followups` · branch
What was said when the school chased a family for dues.

| Column | Type | Rules |
|---|---|---|
| family_id | uuid → families | required |
| channel | enum(call, message, meeting, letter) | required |
| outcome | enum(promised, no_answer, disputed, hardship, paid, other) | required |
| promised_date | date | optional; required for `promised` |
| promised_amount | paisa | optional |
| note | text | optional |
| done_by | uuid → profiles | required |
| done_at | timestamptz | required |

## 4 · Contracts

`packages/contracts/src/modules/fees/`: `fee-heads`, `fee-structures`, `fee-plans`, `discounts`, `fine-rules`, `fee-vouchers`, `fee-payments`, `cash-sessions`, `fee-adjustments`, `fee-refunds`, `fee-installments`, `payment-proofs`, `fee-reports`.

- `FamilyDues`: the family's children, each with open vouchers (lines, balance, days overdue), the fine that would be added today, the family's credit, and one total. This is what the counter and the parent app both show.
- `CollectPayment`: `{ familyId, amount, method, reference?, bankAccountId?, paidOn?, voucherIds?, studentId?, note? }`. With no `voucherIds` the server allocates.
- `PaymentResult`: the payment, its allocations, the credit left, the receipt document id.
- `GenerationPreview`: per grade — students, amount, discounts, students skipped with reasons; nothing saved.
- `ChargeBreakdown`: what one student is charged for a month, line by line with where each came from. Pure calculation in `packages/core/src/modules/fees/charges.ts`.
- `AllocationPlan`: pure function in `allocate.ts` — given open vouchers and an amount, the allocation rows and the remainder.

Settings: `fees.bill_by` (`student` | `family`, default student), `fees.voucher_day` (default 1), `fees.due_day` (default 10), `fees.round_to_rupee` (default true), `fees.min_part_payment` (default Rs 500), `fees.advance_months_max` (default 12), `fees.auto_apply_credit` (default true), `fees.discount_stacking` (`highest` | `add`, default highest), `fees.max_discount_percent` (default 100), `fees.increase_cap_percent` (default 5), `fees.proration` (`none` | `half_month` | `by_days`, default none), `fees.backdate_days` (default 3), `fees.reminder_days` (default `[-3, 0, 3, 7, 15]` relative to the due date), `fees.cheque_bounce_charge` (default 0), `fees.receipt_format` (`a5` | `thermal_80`), `fees.cashier_reverse_window` (`session` | `none`, default session).

## 5 · Rules

**Structures and charges**

- **R-fees-1** Money is in paisa. With `fees.round_to_rupee`, a voucher's total is rounded to a whole rupee by a `rounding` line.
- **R-fees-2** A structure can be activated only when every active grade has a tuition amount. If the average tuition rises more than `fees.increase_cap_percent` over last year's active structure, a reason is required and the activation needs approval.
- **R-fees-3** An active structure's amounts are not edited. A change mid-year is a new structure with a later `effective_from`.
- **R-fees-4** What a student is charged for a month is: the structure's items for their grade that fall in that month (monthly every month; yearly and per-term in their `charge_months`; `once` on the admission voucher only), plus their fee items (`add`), with `replace` items substituted, minus discounts in force that month.
- **R-fees-5** A discount reduces only its listed heads, never below zero. With several discounts on one head, `fees.discount_stacking` decides: the highest only, or added up to `fees.max_discount_percent`.
- **R-fees-6** A sibling discount is applied automatically: active students of a family are ordered by admission date, and the child at `sibling_position` or later gets it. It is recalculated when a sibling joins or leaves, from the next voucher.
- **R-fees-7** A `staff_child` discount is linked to the staff record and ends on that person's last working day.
- **R-fees-8** Every discount has an end date and, unless automatic, an approval. Thirty days before it ends, the accountant is reminded.

**Vouchers**

- **R-fees-9** A generation run is previewed first. Running it is a job, and it is safe to repeat: a student who already has a regular voucher for that month is skipped.
- **R-fees-10** A voucher is created for each student who is active on the issue date and has an active fee plan covering the month. Students with no plan, no section or a paused plan are listed in `skipped` with the reason.
- **R-fees-11** A student admitted during a month is charged for that month according to `fees.proration`. The admission voucher carries the `once` heads and the first month.
- **R-fees-12** A multi-month voucher has one line per head per month and one due date. It is the normal way to bill the summer vacation.
- **R-fees-13** **Arrears are never copied onto a new voucher.** Each voucher holds only its own charges. The challan and every screen show "previous balance" as the sum of the student's older open vouchers, computed when shown. This keeps receivables from being counted twice.
- **R-fees-14** When billing by family, the vouchers of one family in one run share a `challan_no`; the printed challan lists each child and one total.
- **R-fees-15** An issued voucher is never edited. It can be cancelled only while nothing is allocated to it, with a reason; its number is not reused. Any other change is an adjustment.
- **R-fees-16** An adjustment needs approval according to its amount ([M00](m00-shared-kernel.md) approval policy), and applying it inserts one voucher line. A credit adjustment that takes the total below the amount already paid releases the excess back to the payment, where it becomes family credit.
- **R-fees-17** A daily job adds the late fine as a line on each overdue voucher according to the fine rule in force: once for `fixed`, each day for `per_day`, once for `percent` of the balance. It never exceeds the cap, never fines a fine, and skips vouchers under an active instalment plan.
- **R-fees-18** With advance tax switched on ([M25](m25-tax-compliance.md)), the tax is its own line under the `tax` head, computed by that module's rule.

**Payments**

- **R-fees-19** A payment can be any amount from `fees.min_part_payment` up, or less when it clears the whole balance. Paying more than is owed is allowed up to `fees.advance_months_max` months of fees; the surplus stays on the payment as family credit.
- **R-fees-20** Allocation is automatic unless vouchers are chosen: the family's open vouchers oldest due date first; inside a voucher, heads in `priority` order. The payment, its allocations, the voucher totals and the ledger entry are written in one transaction, with the family's open vouchers locked for its duration.
- **R-fees-21** With `fees.auto_apply_credit`, family credit is allocated to new vouchers when they are generated, and the guardian is told.
- **R-fees-22** A cash payment needs the cashier's open cash session. A cashier has at most one open session. Closing it records the counted cash; a difference needs a note and the session waits for the accountant's approval.
- **R-fees-23** A payment is never edited or deleted. Reversing it releases its allocations, reopens the vouchers and posts the opposite ledger entry. A cashier may reverse their own payment inside the same open session; anything else needs `fee-payments:reverse` and approval. A payment whose credit has already been used elsewhere cannot be reversed until that use is released.
- **R-fees-24** A cheque is recorded as `pending_clearance` and allocated at once. If it bounces, the payment is reversed as `bounced` and, when configured, a bounce charge is added to the oldest open voucher.
- **R-fees-25** A second payment for the same family with the same amount, method and reference within two minutes asks for confirmation. An online payment with a reference already recorded returns the first payment.
- **R-fees-26** `paid_on` may be up to `fees.backdate_days` before today and never inside a closed fiscal period. Fines dated after `paid_on` on vouchers that payment fully clears are reversed automatically by adjustment.
- **R-fees-27** A receipt is generated for every payment. A reprint is marked "Duplicate". An offline receipt prints the device receipt code; the server's receipt number is added when it syncs and both are searchable.
- **R-fees-28** A proof of transfer creates no payment. The accountant verifies it against the bank statement and only then is a `bank_transfer` payment recorded and linked. A proof whose reference matches an existing payment is flagged as a likely duplicate.

**Refunds, instalments and leaving**

- **R-fees-29** A refund needs approval, and is paid from a cash session or a bank account. A security deposit refund first deducts the student's open dues; what is deducted is allocated to those vouchers.
- **R-fees-30** An instalment plan needs approval, covers named vouchers, and its instalments total their balance. While it is active those vouchers are not fined and reminders follow the plan's dates. An instalment more than 7 days late marks the plan `defaulted` and fines resume.
- **R-fees-31** When a student leaves, their plan gets `billing_to` and no further vouchers are generated. Open vouchers stay, and the leaving certificate rule in [M08](m08-certificates-id-cards.md) reads their balance.
- **R-fees-32** When a student transfers branch, open vouchers stay with the branch that issued them. The new branch bills from the transfer month under its own structure.
- **R-fees-33** The promotion batch creates next year's fee plan for each promoted student against the new grade.
- **R-fees-34** Nothing in this module posts into a closed fiscal period ([M23](m23-accounting.md)).
- **R-fees-35** Balances owed when a school starts using Takhti are imported as one `opening` voucher per student, dated the day before go-live, with a single "Opening balance" line. They are not posted one by one: their total must equal the opening balance of `fees.receivable` entered in [M23](m23-accounting.md), and the import refuses a mismatch. A family that had paid in advance is imported as a payment with no allocation.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `fee-setup:manage` | Maintain fee heads, discount types and fine rules | ACCOUNTS |
| `fee-structures:read` | See fee structures | FINANCE, LEADERS, FRONT |
| `fee-structures:manage` | Create and edit draft structures | ACCOUNTS |
| `fee-structures:activate` | Activate a structure | finance_head |
| `fee-plans:manage` | Maintain student fee plans and fee items | ACCOUNTS |
| `discounts:read` | See student discounts | FINANCE, LEADERS |
| `discounts:create` | Request, edit and end student discounts | ACCOUNTS, ADMINS |
| `fee-vouchers:read` | See vouchers and family dues | FINANCE, LEADERS, FRONT, class_teacher |
| `fee-vouchers:generate` | Preview and run voucher generation; issue single vouchers | ACCOUNTS |
| `fee-vouchers:cancel` | Cancel an unpaid voucher | ACCOUNTS |
| `fee-payments:read` | See payments and receipts | FINANCE, LEADERS |
| `fee-payments:collect` | Record payments; open and close one's own cash session | FINANCE |
| `fee-payments:reverse` | Reverse any payment | ACCOUNTS |
| `cash-sessions:approve` | Approve closed cash sessions | ACCOUNTS |
| `fee-adjustments:create` | Request waivers, corrections and write-offs | ACCOUNTS, ADMINS |
| `fee-refunds:create` | Request refunds | ACCOUNTS |
| `fee-refunds:pay` | Pay an approved refund | FINANCE |
| `fee-installments:manage` | Agree instalment plans | ACCOUNTS, ADMINS |
| `payment-proofs:verify` | Verify or reject proofs of transfer | ACCOUNTS |
| `fee-followups:create` | Log follow-ups with families | FINANCE, FRONT, class_teacher |
| `fees:reports` | Run fee reports | FINANCE, LEADERS |
| `fees:export` | Export fee data | ACCOUNTS, LEADERS |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/fee-heads` | `fee-structures:read` | Lists |
| POST | `/fee-heads` | `fee-setup:manage` | Creates |
| PATCH | `/fee-heads/[id]` | `fee-setup:manage` | Edits |
| GET | `/discount-types` | `discounts:read` | Lists |
| POST | `/discount-types` | `fee-setup:manage` | Creates |
| PATCH | `/discount-types/[id]` | `fee-setup:manage` | Edits |
| GET | `/fine-rules` | `fee-structures:read` | Lists |
| POST | `/fine-rules` | `fee-setup:manage` | Creates |
| PATCH | `/fine-rules/[id]` | `fee-setup:manage` | Edits |
| GET | `/fee-structures` | `fee-structures:read` | Lists |
| POST | `/fee-structures` | `fee-structures:manage` | Creates a draft, optionally copied from another with a percentage increase |
| GET | `/fee-structures/[id]` | `fee-structures:read` | One structure as a grade-by-head grid |
| PATCH | `/fee-structures/[id]` | `fee-structures:manage` | Edits a draft |
| PUT | `/fee-structures/[id]/items` | `fee-structures:manage` | Saves the grid |
| POST | `/fee-structures/[id]/activate` | `fee-structures:activate` | Activates |
| GET | `/students/[id]/fee-plan` | `fee-vouchers:read` | Plan, fee items, discounts and next month's breakdown |
| PUT | `/students/[id]/fee-plan` | `fee-plans:manage` | Saves the plan |
| POST | `/students/[id]/fee-items` | `fee-plans:manage` | Adds a fee item |
| PATCH | `/student-fee-items/[id]` | `fee-plans:manage` | Edits or ends one |
| GET | `/student-discounts` | `discounts:read` | Lists; filter by type, status, ending soon |
| POST | `/student-discounts` | `discounts:create` | Requests a discount |
| PATCH | `/student-discounts/[id]` | `discounts:create` | Edits a pending one |
| POST | `/student-discounts/[id]/end` | `discounts:create` | Ends from a month |
| POST | `/fee-vouchers/generate/preview` | `fee-vouchers:generate` | Previews a run |
| POST | `/fee-vouchers/generate` | `fee-vouchers:generate` | Starts a run |
| GET | `/fee-generation-runs` | `fee-vouchers:read` | Lists runs |
| GET | `/fee-generation-runs/[id]` | `fee-vouchers:read` | One run with skipped students |
| GET | `/fee-vouchers` | `fee-vouchers:read` | Lists; filter by month, status, grade, section, overdue |
| POST | `/fee-vouchers` | `fee-vouchers:generate` | Issues one voucher on demand |
| GET | `/fee-vouchers/[id]` | `fee-vouchers:read` | One voucher with lines and allocations |
| POST | `/fee-vouchers/[id]/cancel` | `fee-vouchers:cancel` | Cancels |
| POST | `/fee-vouchers/import-opening` | `fee-vouchers:generate` | Imports opening balances from a file, with a preview |
| POST | `/fee-vouchers/print` | `fee-vouchers:read` | Queues challans for a set of vouchers |
| GET | `/families/[id]/dues` | `fee-vouchers:read` | Family dues |
| GET | `/families/[id]/statement` | `fee-vouchers:read` | The ledger of vouchers, payments, adjustments and refunds |
| GET | `/fees/search` | `fee-vouchers:read` | Finds a family by student name, father's name, admission, voucher or challan number |
| POST | `/fee-payments` | `fee-payments:collect` | Records a payment |
| GET | `/fee-payments` | `fee-payments:read` | Lists |
| GET | `/fee-payments/[id]` | `fee-payments:read` | One payment with allocations |
| POST | `/fee-payments/[id]/reverse` | `fee-payments:collect` | Reverses |
| POST | `/fee-payments/[id]/clear` | `fee-payments:reverse` | Marks a cheque cleared or bounced |
| POST | `/fee-payments/[id]/receipt` | `fee-payments:read` | Reprints the receipt |
| POST | `/families/[id]/apply-credit` | `fee-payments:collect` | Allocates family credit to open vouchers |
| GET | `/cash-sessions` | `fee-payments:read` | Lists |
| GET | `/cash-sessions/current` | `fee-payments:collect` | My open session with totals |
| POST | `/cash-sessions` | `fee-payments:collect` | Opens |
| POST | `/cash-sessions/[id]/close` | `fee-payments:collect` | Closes with the counted cash |
| POST | `/cash-sessions/[id]/approve` | `cash-sessions:approve` | Approves |
| GET | `/fee-adjustments` | `fee-vouchers:read` | Lists |
| POST | `/fee-adjustments` | `fee-adjustments:create` | Requests |
| GET | `/fee-refunds` | `fee-payments:read` | Lists |
| POST | `/fee-refunds` | `fee-refunds:create` | Requests |
| POST | `/fee-refunds/[id]/pay` | `fee-refunds:pay` | Pays an approved refund |
| POST | `/fee-refunds/[id]/cancel` | `fee-refunds:create` | Cancels before payment |
| GET | `/fee-installment-plans` | `fee-vouchers:read` | Lists |
| POST | `/fee-installment-plans` | `fee-installments:manage` | Proposes a plan |
| POST | `/fee-installment-plans/[id]/cancel` | `fee-installments:manage` | Cancels |
| GET | `/payment-proofs` | `payment-proofs:verify` | Lists; submitted first |
| POST | `/payment-proofs/[id]/verify` | `payment-proofs:verify` | Verifies and records the payment |
| POST | `/payment-proofs/[id]/reject` | `payment-proofs:verify` | Rejects with a reason |
| GET | `/fee-followups` | `fee-vouchers:read` | Lists |
| POST | `/fee-followups` | `fee-followups:create` | Logs one |
| GET | `/fees/defaulters` | `fees:reports` | Families with overdue balances, by age band |
| GET | `/fees/reports/[report]` | `fees:reports` | Runs a named report |
| GET | `/fees/export` | `fees:export` | Exports |
| GET | `/family/dues` | `signed-in` | The guardian's family dues |
| GET | `/family/vouchers/[id]` | `signed-in` | One voucher; `?download=challan` |
| GET | `/family/payments` | `signed-in` | Payment history with receipts |
| POST | `/family/payment-proofs` | `signed-in` | Submits a proof of transfer |
| GET | `/family/statement` | `signed-in` | The family's statement |

Idempotent (key required): `POST /fee-payments`, `POST /fee-payments/[id]/reverse`, `POST /fee-vouchers/generate`, `POST /fee-vouchers`, `POST /fee-refunds/[id]/pay`, `POST /payment-proofs/[id]/verify`, `POST /families/[id]/apply-credit`, `POST /cash-sessions/[id]/close`, `POST /family/payment-proofs`.

Named reports: `daily-collection`, `collection-by-head`, `collection-by-method`, `cashier-summary`, `fee-register`, `outstanding-by-class`, `aging`, `discounts`, `fines`, `reversals`, `expected-vs-collected`, `security-deposits`, `advance-credit`.

## 8 · Client layer

Custom hooks: `useFamilyDues(familyId)`, `useFeeSearch`, `useCollectPayment` (never optimistic; disables the button until the server answers; sends an idempotency key made when the form opens), `useReversePayment`, `useCurrentCashSession`, `useCloseCashSession`, `useGenerationPreview`, `useRunGeneration` (polls the run), `useFeeStructureGrid`, `useStudentFeePlan`, `useChargeBreakdown`, `useDefaulters`, `useFeeReport(name, filters)`, `useMyDues`, `useSubmitPaymentProof`.

## 9 · Screens

Built in [Phase 9](../20-phases/phase-09-finance.md), [Phase 14](../20-phases/phase-14-family-portals.md) and [Phase 16](../20-phases/phase-16-documents-and-printing.md).

| Screen | Pattern | Where |
|---|---|---|
| **Collect fees** | Counter | `/school/fees/collect`: one search box; the family's children and open vouchers; amount box prefilled with the total; method; the allocation shown before saving; Save and print. Keyboard only: `/` search, `Enter` next, `F9` save |
| Cash session | Detail | Open, running totals by method, close with a denomination counter |
| Vouchers | List | Filters; bulk print; status chips |
| Generate vouchers | Wizard | Month and grades, preview with skipped students, run, progress, print |
| Voucher | Detail | Lines, allocations, adjustments, history; print challan |
| Family statement | Detail | A running ledger; export |
| Fee structures | Grid editor | Grades down, heads across; copy from last year with a percentage |
| Student fee plan | Detail tab on the student | Plan, items, discounts, next month's breakdown |
| Discounts | List | Pending approvals; ending soon |
| Defaulters | List | Age bands; last follow-up; promise date; bulk reminder; call log in a side sheet |
| Payment proofs | List + Detail | The screenshot beside the matching bank line; Verify or Reject |
| Refunds, Adjustments, Instalments | List + Form in a sheet | With approval status |
| Fee reports | Report | The named reports with filters, totals, export and print |
| Fee settings | Settings | Heads, discount types, fine rules, billing settings, bank details for the challan |
| **Parent:** Fees | Dashboard | Total due with a Pay button; each child's vouchers; history; download challan and receipts; upload proof |

## 10 · Notifications and jobs

Events: `fee.voucher-issued`, `fee.reminder` (by `fees.reminder_days`), `fee.overdue`, `fee.fine-added`, `fee.payment-received` (with the receipt), `fee.payment-reversed`, `fee.cheque-bounced`, `fee.credit-applied`, `fee.proof-submitted` (to accountants), `fee.proof-verified`, `fee.proof-rejected`, `fee.discount-ending`, `fee.refund-paid`, `fee.instalment-due`, `fee.instalment-missed`, `cash-session.difference` (to the accountant), `fee.promise-due` (to the follow-up owner).

Jobs: `fees.generate` (queued per run; also scheduled monthly per branch on `fees.voucher_day` when `fees.auto_generate` is on, creating a preview for a person to confirm), `fees.assess-fines` (daily 01:00), `fees.reminders` (daily 10:00), `fees.end-discounts` (daily), `fees.instalment-check` (daily), `fees.integrity` (nightly: voucher totals equal their lines, `paid` equals allocations, payments equal allocations plus unallocated plus refunded, receivable in the ledger equals open balances; differences go to `integrity_findings`).

Documents: three-copy challan, family challan, receipt (A5 and 80 mm thermal), family statement, defaulter notice, fee-paid certificate, refund voucher, cash session summary.

## 11 · Offline

Offline-writable through `cashier.students` and `cashier.vouchers`:

| Table | Operation | Conflict policy |
|---|---|---|
| `fee_payments` | create, **cash only**, inside a cash session opened while online | **The money was taken, so the payment is always accepted.** The server allocates it again from the current state. If the vouchers were paid meanwhile, the amount becomes family credit and a review item is raised for the accountant |

Limits while offline: no reversals, no cheques or bank methods, no refunds, at most `offline.max_cash_per_session` (default Rs 500,000) per session. The device prints a receipt with its own code. Sessions cannot be closed offline.

## 12 · AI

- Fee-defaulter prediction with a suggested next step (S3).
- Cash-flow forecast from open vouchers and past payment timing (S4).
- Unusual activity: discounts above the norm, reversals near closing, fines waived by the same person repeatedly (S5).
- Drafting a polite reminder in English or Urdu (A10).

## 13 · Failure cases

- **F-fees-1** The cashier double-clicks Save → one payment; the second call returns the first by idempotency key.
- **F-fees-2** Two cashiers take payment for the same family at once → the second transaction waits for the lock, then allocates against what is left; any surplus is credit. Nobody is charged twice and no voucher goes below zero.
- **F-fees-3** The receipt printer fails → the payment stands; the receipt can be reprinted, unmarked, until it has printed once.
- **F-fees-4** Generation stops halfway (server restart) → the run resumes from where it stopped; vouchers already created are skipped.
- **F-fees-5** A discount is approved after the month's voucher was issued → the voucher is not changed; the accountant is offered a credit adjustment for the difference.
- **F-fees-6** A parent pays Rs 5,000 against a Rs 4,500 balance → Rs 500 is credit; the receipt says so; next month's voucher uses it.
- **F-fees-7** A payment is reversed after its credit paid another voucher → refused, naming the voucher, until that allocation is released.
- **F-fees-8** A voucher was generated for a student who left last week → cancel it with a reason; if generation is run again the student is skipped because the plan has ended.
- **F-fees-9** A fee structure is missing an amount for Grade 6 → activation refused, naming the grade and head.
- **F-fees-10** The fine job runs twice in a day → the unique fine date prevents a second line.
- **F-fees-11** A payment is dated into a closed period → refused with the period's name.
- **F-fees-12** An offline cashier collects for a voucher that was paid by bank the same morning → on sync the cash becomes family credit and the accountant gets a review item with a "refund" shortcut.
- **F-fees-13** A cash session is left open overnight → at 23:30 the cashier and accountant are reminded; the next morning it must be closed before a new one can be opened.
- **F-fees-14** A cheque bounces after the family's result was released on the strength of it → the reversal reopens the dues; the withholding suggestion appears again.
- **F-fees-15** A proof is verified twice by two accountants → the second gets `STALE`; one payment exists.
- **F-fees-16** The family's children are in two branches → the dues screen shows both, each branch's cashier can collect only for their own branch's vouchers, and credit is shared.
- **F-fees-17** A student's grade changes mid-year (correction) → the plan is unchanged until the accountant confirms the new structure; a banner on the student says so.
- **F-fees-18** The nightly integrity check finds a voucher whose `paid` differs from its allocations → an `integrity_findings` row and an alert to the finance head; nothing is corrected automatically.

## 14 · Seed data

Fourteen fee heads. Five discount types. One fine rule per organisation (Rs 50 a day after 5 days, capped at Rs 1,000). An active structure per branch for the current year and an archived one for last year. A plan for every student; transport and hostel fee items for those who use them. Discounts: sibling (automatic), staff child, merit, need-based, including two pending and three ending within 30 days.

Six months of vouchers and payments per branch with realistic behaviour: about 70% paid on time, 15% late with fines, 8% part paid, 7% unpaid; a summer three-month voucher; payments by every method; credit balances on twelve families; five reversals; two bounced cheques; closed and approved cash sessions for every working day, three with differences; one open session; four refunds in different states; six instalment plans (one defaulted); eight payment proofs (three waiting); follow-ups with promises.

## 15 · Tests

- **T-fees-1** `charges.ts` table tests: frequency, charge months, optional heads, add and replace items, proration modes.
- **T-fees-2** Discounts: per head, never below zero, stacking modes, sibling order, staff-child end, end dates.
- **T-fees-3** `allocate.ts`: oldest first, head priority, chosen vouchers, exact, part and over payment.
- **T-fees-4** Generation: preview saves nothing; run creates each voucher once; rerun skips; resume after a stop; skipped reasons.
- **T-fees-5** Multi-month and family challans.
- **T-fees-6** Arrears are never copied; "previous balance" is computed.
- **T-fees-7** Fines: each rule type, grace days, cap, idempotent, skipped under an instalment plan.
- **T-fees-8** Payment in one transaction: voucher totals, allocations, credit and ledger all agree; a forced failure at each step leaves nothing behind.
- **T-fees-9** Idempotency: the same key returns the same payment; the same online reference returns the first.
- **T-fees-10** Concurrency: fifty simultaneous payments against one family never over-allocate.
- **T-fees-11** Reversal: releases allocations, reopens vouchers, posts the opposite entry; refused when credit was used; cashier window.
- **T-fees-12** Cheque clearance and bounce with charge.
- **T-fees-13** Cash session: one open per cashier; expected cash; difference needs a note; approval.
- **T-fees-14** Adjustments: approval thresholds; credit adjustment releases excess to credit.
- **T-fees-15** Refunds: security deposit deducts dues; cannot exceed what is held.
- **T-fees-16** Instalment plans: totals, fines stop, default resumes fines.
- **T-fees-17** Proof flow: no payment until verified; duplicate reference flagged.
- **T-fees-18** Backdating limits and automatic fine reversal; closed period refused.
- **T-fees-19** Offline cash: accepted once; becomes credit when the voucher is already paid; review item raised.
- **T-fees-20** A guardian reads only their own family's vouchers and payments; cannot see another family's by guessing an id.
- **T-fees-21** The integrity job detects each kind of planted inconsistency.
- **T-fees-22** Every report's totals equal the sum of the underlying rows for the seeded data.
- **T-fees-23** Row-level security and branch scope, including a family with children in two branches.
- **T-fees-24** Opening balances: one voucher per student; total must equal the ledger's opening receivable; no posting per voucher.

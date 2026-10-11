# M28 · Payroll

## 1 · Purpose

Paying staff correctly every month: salary structures, attendance-based deductions, income tax, EOBI and social security, loans and advances, the payslip, the bank transfer file, and the final settlement when someone leaves.

Salary information is the most sensitive data in the school after children's records. Every table here is behind the `payroll` capability.

## 2 · Depends on

[M26](m26-staff-recruitment.md) (`staff`, bank accounts, exits), [M27](m27-staff-attendance-leave.md) (`PayrollAttendance`), [M25](m25-tax-compliance.md) (tax and contribution rules), [M23](m23-accounting.md) (posting), [M00](m00-shared-kernel.md) (approvals, sequences, documents).

## 3 · Tables

#### `salary_components` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation; "Basic pay", "House rent allowance" |
| name_ur | text | optional |
| code | text | required; unique per organisation |
| kind | enum(earning, deduction, employer_contribution) | required |
| calc | enum(fixed, percent_of_basic, system) | required; `system` components are computed by a rule, never typed |
| system_key | enum(income_tax, eobi_employee, eobi_employer, social_security_employer, pf_employee, pf_employer, loan, advance, absence, late, leave_encashment, arrears) | optional; required for `system` |
| is_taxable | bool | default true; for earnings |
| in_gross | bool | default true; for earnings |
| prorate | bool | default true; reduced for days not worked |
| sort_order | int | default 0 |
| expense_account_id | uuid → accounts | optional; falls back to the mapping |
| is_active | bool | default true |

#### `salary_structures` · org +cap(payroll)
What one person is paid from a date.

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| effective_from | date | required; first day of a month |
| effective_to | date | optional |
| basic | paisa | required; > 0 |
| gross | paisa | required; computed from its items |
| reason | enum(joining, increment, promotion, correction, restructure) | required |
| status | enum(draft, pending, active, superseded) | default draft |
| approval_request_id | uuid → approval_requests | optional |
| increment_id | uuid → increments | optional |

Unique: no two active structures of one staff member overlap.

#### `salary_structure_items` · org +cap(payroll)

| Column | Type | Rules |
|---|---|---|
| structure_id | uuid → salary_structures | required |
| staff_id | uuid → staff | required |
| component_id | uuid → salary_components | required; a `fixed` or `percent_of_basic` component |
| amount | paisa | optional; for `fixed` |
| percent | numeric(6,3) | optional; for `percent_of_basic` |

Unique: (structure_id, component_id).

#### `increments` · org +cap(payroll)

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| kind | enum(annual, promotion, special, market_adjustment) | required |
| effective_from | date | required; first day of a month |
| old_gross | paisa | required |
| new_gross | paisa | required; > 0 |
| percent | numeric(6,2) | generated |
| batch_ref | text | optional; groups a yearly round |
| status | enum(proposed, approved, applied, rejected) | default proposed |
| approval_request_id | uuid → approval_requests | optional |
| note | text | optional |

#### `payroll_runs` · branch +cap(payroll)

| Column | Type | Rules |
|---|---|---|
| run_no | text | required; from the `payroll_run` sequence |
| kind | enum(regular, off_cycle, final_settlement) | default regular |
| pay_month | date | required; first day of the month |
| period_from | date | required; the attendance period |
| period_to | date | required |
| pay_date | date | required |
| status | enum(draft, calculating, calculated, under_review, approved, paid, closed, cancelled) | default draft |
| staff_count | int | default 0 |
| gross_total | paisa | default 0 |
| deductions_total | paisa | default 0 |
| net_total | paisa | default 0 |
| employer_cost_total | paisa | default 0 |
| warnings | jsonb | default `[]` |
| calculated_at | timestamptz | optional |
| approval_request_id | uuid → approval_requests | optional |
| approved_at | timestamptz | optional |

Unique: (branch_id, pay_month) among live `regular` runs that are not cancelled.

#### `payslips` · branch +cap(payroll)

| Column | Type | Rules |
|---|---|---|
| run_id | uuid → payroll_runs | required |
| staff_id | uuid → staff | required |
| pay_month | date | required |
| structure_id | uuid → salary_structures | optional; empty for a settlement-only slip |
| days_in_period | numeric(5,1) | required |
| paid_days | numeric(5,1) | required |
| absent_days | numeric(5,1) | default 0 |
| unpaid_leave_days | numeric(5,1) | default 0 |
| late_half_days | numeric(5,1) | default 0 |
| earnings | paisa | required |
| deductions | paisa | required |
| net | paisa | required; `earnings - deductions`; never negative |
| employer_contributions | paisa | default 0 |
| taxable_this_month | paisa | default 0 |
| taxable_to_date | paisa | default 0; tax year to date, including this slip |
| tax_to_date | paisa | default 0 |
| pay_method | enum(bank, cash, cheque) | required |
| bank_title | text | optional; copied when calculated |
| bank_iban | text | optional |
| status | enum(draft, approved, held, paid, reversed) | default draft |
| hold_reason | text | optional |
| paid_on | date | optional |
| payment_reference | text | optional |
| is_published | bool | default false; visible to the staff member |
| document_id | uuid → generated_documents | optional |

Unique: (run_id, staff_id).
Index: (org_id, staff_id, pay_month).

#### `payslip_lines` · branch +cap(payroll)

| Column | Type | Rules |
|---|---|---|
| payslip_id | uuid → payslips | required |
| staff_id | uuid → staff | required |
| component_id | uuid → salary_components | required |
| kind | enum(earning, deduction, employer_contribution) | required |
| description | text | required |
| amount | paisa | required; ≥ 0 |
| basis | jsonb | default `{}`; how it was worked out: rate, days, rule id |
| loan_installment_id | uuid → loan_installments | optional |
| adjustment_id | uuid → payroll_adjustments | optional |

#### `staff_loans` · org +cap(payroll)
A loan repaid over several months, or an advance recovered from the next salary.

| Column | Type | Rules |
|---|---|---|
| loan_no | text | required; from the `staff_loan` sequence |
| staff_id | uuid → staff | required |
| kind | enum(loan, advance) | required |
| principal | paisa | required; > 0 |
| reason | text | required |
| instalment_count | int | required; 1 for an advance |
| first_deduction_month | date | required |
| outstanding | paisa | required; maintained with each instalment |
| status | enum(requested, approved, disbursed, repaying, settled, rejected, cancelled) | default requested |
| approval_request_id | uuid → approval_requests | optional |
| disbursed_on | date | optional |
| disbursed_from | enum(cash, bank) | optional |
| bank_account_id | uuid → bank_accounts | optional |
| requested_by | uuid → profiles | required |

#### `loan_installments` · org +cap(payroll)

| Column | Type | Rules |
|---|---|---|
| loan_id | uuid → staff_loans | required |
| staff_id | uuid → staff | required |
| due_month | date | required |
| amount | paisa | required; > 0; the loan's instalments total its principal |
| status | enum(due, deducted, deferred, paid_directly, waived) | default due |
| payslip_id | uuid → payslips | optional |

Unique: (loan_id, due_month).

#### `payroll_adjustments` · org +cap(payroll)
A one-off earning or deduction for a month: arrears, bonus, exam duty pay, a fine, a correction.

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| pay_month | date | required |
| component_id | uuid → salary_components | required |
| kind | enum(earning, deduction) | required |
| amount | paisa | required; > 0 |
| is_taxable | bool | default true |
| reason | text | required |
| source | enum(manual, attendance_correction, substitution, exam_duty, leave_encashment, settlement) | default manual |
| status | enum(pending, approved, applied, cancelled) | default pending |
| approval_request_id | uuid → approval_requests | optional |

#### `bank_transfer_files` · branch +cap(payroll)

| Column | Type | Rules |
|---|---|---|
| run_id | uuid → payroll_runs | required |
| bank_account_id | uuid → bank_accounts | required; the account salaries are paid from |
| layout | text | required; a saved bank layout |
| file_id | uuid → files | required |
| payslip_count | int | required |
| total | paisa | required |
| status | enum(generated, sent, confirmed, replaced) | default generated |
| generated_by | uuid → profiles | required |

#### `provident_fund_entries` · org +cap(payroll) append-only

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| pay_month | date | required |
| kind | enum(contribution, withdrawal, profit, settlement) | required |
| employee_amount | paisa | default 0 |
| employer_amount | paisa | default 0 |
| payslip_id | uuid → payslips | optional |
| note | text | optional |

#### `final_settlements` · org +cap(payroll)

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| exit_id | uuid → staff_exits | required; unique |
| last_working_day | date | required |
| lines | jsonb | required; `{ key, label, kind, amount, basis }[]`: salary to the last day, leave encashment, gratuity, notice pay, loans and advances outstanding, provident fund, other |
| payable | paisa | required; may be zero; a negative result is recorded as recoverable |
| recoverable | paisa | default 0 |
| status | enum(draft, pending, approved, paid, cancelled) | default draft |
| approval_request_id | uuid → approval_requests | optional |
| payslip_id | uuid → payslips | optional |
| document_id | uuid → generated_documents | optional |

## 4 · Contracts

`packages/contracts/src/modules/payroll/`: `salary-components`, `salary-structures`, `increments`, `payroll-runs`, `payslips`, `staff-loans`, `payroll-adjustments`, `final-settlements`.

- `RunPreview`: who is included, who is left out and why (no structure, on hold, joined after the period), expected totals.
- `RunReview`: payslips with last month's net beside this month's, and a reason for every change over 10% (increment, days, loan, adjustment).
- `PayslipView`: earnings, deductions, employer contributions, days, year-to-date figures and how each line was computed.
- `MyPayslips` (staff): published payslips only.
- `CostReport`: payroll cost by branch, department, designation and month.

The calculation is one pure module, `packages/core/src/modules/payroll/calculate.ts`:

```ts
calculatePayslip({ staff, structure, attendance, adjustments, instalments, taxState, rules, settings })
  → { lines, totals, warnings }
```

It reads nothing from the database, so every rule can be tested with plain inputs.

Settings: `payroll.pay_day` (default the last working day), `payroll.period` (`calendar_month` | `cutoff`, with `payroll.cutoff_day` default 25), `payroll.day_basis` (`calendar_days` | `fixed_30` | `working_days`, default calendar_days), `payroll.deduct_absence` (default true), `payroll.publish` (`on_paid` | `on_approved`), `payroll.max_loan_months` (default 12), `payroll.max_deduction_percent` (default 50; loan and advance recovery cannot take more than this share of net), `payroll.gratuity` (`none` | `one_month_per_year`, with `payroll.gratuity_min_years`).

## 5 · Rules

**Structures**

- **R-payroll-1** A person has at most one active structure on any date. A new one supersedes the old from its `effective_from`, which is always the first of a month.
- **R-payroll-2** A structure needs approval before it is active. The person who drafts it cannot approve it.
- **R-payroll-3** An increment, once approved, creates the new structure. A yearly round proposes increments for many staff at once by percentage or amount, editable per person, and is approved as a batch.
- **R-payroll-4** A gross below the minimum wage rule in force ([M25](m25-tax-compliance.md)) gives a warning on the structure and on every run.

**The run**

- **R-payroll-5** Lifecycle: `draft → calculating → calculated → under_review → approved → paid → closed`. A run can be recalculated any number of times before approval; each calculation replaces its payslips completely.
- **R-payroll-6** Included: every staff member whose home branch on `period_to` is this branch, who was employed on at least one day of the period and has an active structure. Anyone left out is listed with the reason.
- **R-payroll-7** One regular run per branch per month. Something missed afterwards is paid by an off-cycle run or by an adjustment next month.
- **R-payroll-8** Paid days = days in the period (by `payroll.day_basis`) − days before joining − days after leaving − absent days − unpaid leave days − late half days × 0.5. Prorated components are multiplied by paid days over days in the period.
- **R-payroll-9** Attendance figures come only from `PayrollAttendance` ([M27](m27-staff-attendance-leave.md)), read at calculation. Approving the run locks that month's attendance.
- **R-payroll-10** Order of calculation: earnings from the structure (prorated), approved adjustments, taxable total, income tax by projection ([R-tax-5](m25-tax-compliance.md)), EOBI, social security and provident fund from their rules, loan and advance instalments, other deductions.
- **R-payroll-11** Loan and advance recovery is limited to `payroll.max_deduction_percent` of net before recovery. What cannot be taken is `deferred` to the following month and the payroll officer is warned.
- **R-payroll-12** Net pay is never negative. If the deductions exceed the earnings, recovery is deferred first; if it is still negative the payslip is flagged and the run cannot be approved until it is resolved.
- **R-payroll-13** The review lists every payslip whose net differs from last month's by more than 10% with the reason, new joiners, leavers, held salaries, and warnings. Approval follows the approval policy and is by someone other than the person who calculated.
- **R-payroll-14** Approval, in one transaction: payslips become `approved` and unchangeable; adjustments become `applied`; instalments become `deducted` and loan balances fall; tax deductions and provident fund entries are written; the "Payroll approved" entry is posted; attendance is locked.
- **R-payroll-15** A payslip can be put on hold before approval (absconded, dispute). A held payslip is in the run's totals and the ledger as payable, but is left out of the bank file until released.
- **R-payroll-16** Paying: a bank transfer file is generated in the bank's layout for payslips paid by bank; its count and total must equal those payslips. Marking the run paid records the reference and posts "Salaries paid" per method. Cash salaries are paid from a cash account and signed for.
- **R-payroll-17** A bank file can be regenerated before it is confirmed; the old one is marked `replaced`. Bank details on the file are those copied to the payslip at calculation.
- **R-payroll-18** An approved payslip is corrected only by reversal: a reversing payslip in an off-cycle run undoes every effect (ledger, tax, loan balances), then a correct one is issued. A paid payslip is corrected by an adjustment next month instead.
- **R-payroll-19** Payslips become visible to staff according to `payroll.publish`. A staff member sees only their own, and only published ones.

**Loans, advances and settlement**

- **R-payroll-20** A staff member can request a loan or an advance; it needs approval, then disbursement, which posts the entry and creates the instalments. A person may have one active loan and one active advance.
- **R-payroll-21** An instalment can be deferred by the payroll officer with a reason, which adds a month to the end. A loan can be settled early by direct payment.
- **R-payroll-22** A final settlement is built from: salary to the last working day, encashable leave balance, gratuity by the school's policy, notice pay either way, the whole outstanding of loans and advances, provident fund balance, and anything owed back. It can be approved only when exit clearance is complete ([R-staff-7](m26-staff-recruitment.md)), and is paid through a `final_settlement` run.
- **R-payroll-23** Nothing here posts into a closed fiscal period.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `salary-components:manage` | Maintain salary components | hr_manager, payroll_officer |
| `salary-structures:read` | See salary structures | HR, finance_head, director |
| `salary-structures:manage` | Draft structures and increments | HR |
| `payroll:read` | See payroll runs and payslips | HR, finance_head, director |
| `payroll:run` | Create, calculate and submit runs; hold payslips; adjustments | payroll_officer |
| `payroll:pay` | Generate bank files; mark runs paid | payroll_officer, finance_head |
| `payroll:reverse` | Reverse an approved payslip | hr_manager, finance_head |
| `staff-loans:manage` | Disburse, defer and settle loans and advances | payroll_officer |
| `final-settlements:manage` | Prepare final settlements | HR |
| `payroll:reports` | Run payroll reports | HR, finance_head, director |
| `payroll:export` | Export payroll data | payroll_officer, finance_head |

Approvals (structures, runs, loans, settlements) are routed by the approval policies in [M00](m00-shared-kernel.md); the seeded policy sends runs to the finance head, then the director.

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/salary-components` | `payroll:read` | Lists |
| POST | `/salary-components` | `salary-components:manage` | Creates |
| PATCH | `/salary-components/[id]` | `salary-components:manage` | Edits |
| GET | `/staff/[id]/salary` | `salary-structures:read` | Current and past structures, loans, year-to-date pay |
| POST | `/staff/[id]/salary-structures` | `salary-structures:manage` | Drafts a structure |
| PATCH | `/salary-structures/[id]` | `salary-structures:manage` | Edits a draft |
| POST | `/salary-structures/[id]/submit` | `salary-structures:manage` | Sends for approval |
| GET | `/increments` | `salary-structures:read` | Lists; filter by batch and status |
| POST | `/increments/propose` | `salary-structures:manage` | Proposes a round for many staff |
| PUT | `/increments/batch/[ref]` | `salary-structures:manage` | Edits a proposed round |
| POST | `/increments/batch/[ref]/submit` | `salary-structures:manage` | Sends the round for approval |
| GET | `/payroll-runs` | `payroll:read` | Lists |
| POST | `/payroll-runs/preview` | `payroll:run` | Shows who would be included |
| POST | `/payroll-runs` | `payroll:run` | Creates a run |
| GET | `/payroll-runs/[id]` | `payroll:read` | One run with totals and warnings |
| POST | `/payroll-runs/[id]/calculate` | `payroll:run` | Calculates or recalculates |
| GET | `/payroll-runs/[id]/review` | `payroll:read` | The review |
| POST | `/payroll-runs/[id]/submit` | `payroll:run` | Sends for approval |
| POST | `/payroll-runs/[id]/cancel` | `payroll:run` | Cancels before approval |
| POST | `/payroll-runs/[id]/bank-file` | `payroll:pay` | Generates the bank transfer file |
| POST | `/payroll-runs/[id]/pay` | `payroll:pay` | Marks paid, wholly or by method |
| POST | `/payroll-runs/[id]/close` | `payroll:pay` | Closes |
| POST | `/payroll-runs/[id]/payslips/publish` | `payroll:run` | Generates the PDFs and publishes |
| GET | `/payslips` | `payroll:read` | Lists; filter by run, staff, status |
| GET | `/payslips/[id]` | `payroll:read` | One payslip with its basis |
| POST | `/payslips/[id]/hold` | `payroll:run` | Holds with a reason |
| POST | `/payslips/[id]/release` | `payroll:run` | Releases |
| POST | `/payslips/[id]/reverse` | `payroll:reverse` | Reverses |
| GET | `/payroll-adjustments` | `payroll:read` | Lists |
| POST | `/payroll-adjustments` | `payroll:run` | Creates one or many |
| POST | `/payroll-adjustments/[id]/cancel` | `payroll:run` | Cancels a pending one |
| GET | `/staff-loans` | `payroll:read` | Lists |
| GET | `/staff-loans/[id]` | `payroll:read` | One loan with instalments |
| POST | `/staff-loans/[id]/disburse` | `staff-loans:manage` | Disburses and posts |
| POST | `/loan-installments/[id]/defer` | `staff-loans:manage` | Defers |
| POST | `/staff-loans/[id]/settle` | `staff-loans:manage` | Records an early settlement |
| GET | `/final-settlements` | `payroll:read` | Lists |
| POST | `/final-settlements` | `final-settlements:manage` | Builds one from an exit |
| PATCH | `/final-settlements/[id]` | `final-settlements:manage` | Edits a draft |
| POST | `/final-settlements/[id]/submit` | `final-settlements:manage` | Sends for approval |
| GET | `/payroll/reports/[report]` | `payroll:reports` | Runs a named report |
| GET | `/payroll/export` | `payroll:export` | Exports |
| GET | `/me/payslips` | `signed-in` | My published payslips |
| GET | `/me/payslips/[id]` | `signed-in` | One of my payslips; `?download=pdf` |
| GET | `/me/loans` | `signed-in` | My loans and advances |
| POST | `/me/loans` | `signed-in` | Requests a loan or an advance |

Idempotent: `POST /payroll-runs`, `POST /payroll-runs/[id]/calculate`, `POST /payroll-runs/[id]/pay`, `POST /payslips/[id]/reverse`, `POST /staff-loans/[id]/disburse`.

Named reports: `salary-register`, `bank-advice`, `cash-salary-sheet`, `deductions`, `tax-schedule`, `eobi-schedule`, `social-security-schedule`, `provident-fund`, `loans-outstanding`, `cost-by-department`, `month-comparison`, `increments`.

## 8 · Client layer

Custom hooks: `useStaffSalary`, `useSalaryStructureDraft`, `useProposeIncrements`, `usePayrollRun`, `useCalculateRun` (starts a job and follows its progress), `useRunReview`, `useSubmitRun`, `useGenerateBankFile`, `usePayRun`, `usePayslip`, `useStaffLoans`, `useFinalSettlement`, `usePayrollReport`, `useMyPayslips`, `useRequestLoan`.

## 9 · Screens

Built in [Phase 10](../20-phases/phase-10-hr.md).

| Screen | Pattern | Where |
|---|---|---|
| Payroll | List | `/school/payroll`: one row per month and branch with status and totals |
| Run payroll | Wizard | Month and dates, preview of who is included, calculate with progress, review, submit |
| Review | Grid | Staff down; last month, this month, difference and reason; filters for changes, warnings and held; open a payslip in a side sheet |
| Payslip | Detail | Earnings and deductions side by side; "How was this worked out" under each line |
| Pay | Detail | Bank file, cash sheet, mark paid by method |
| Salary structure | Form page | Components with amounts or percentages; gross, estimated tax and net update as typed |
| Increments | Grid editor | Staff down; current gross, percent, new gross; apply a percentage to all then adjust |
| Loans and advances | List + Detail | Instalment schedule with status |
| Adjustments | List + Form in a sheet | Bulk entry for exam duty or a bonus |
| Final settlement | Form page | Lines prefilled; clearance status beside it |
| Payroll reports | Report | The named reports |
| Components | Settings | `/school/settings/payroll` |
| **Staff:** My salary | List + Detail | Payslips to view and download; loan balance; request an advance |

## 10 · Notifications and jobs

Events: `payroll.approval-requested`, `payroll.approved`, `payroll.paid`, `payslip.published` (to each staff member, no amounts in the message), `payslip.held`, `loan.requested`, `loan.approved`, `loan.rejected`, `loan.instalment-deferred`, `settlement.ready`, `payroll.due` (to the payroll officer, 5 days before pay day when no run exists), `structure.approval-requested`.

Jobs: `payroll.calculate` (queued per run), `payroll.generate-payslips` (per run), `payroll.reminders` (daily), `payroll.integrity` (nightly: every approved payslip's lines sum to its totals; run totals equal their payslips; `payroll.salaries_payable` equals approved unpaid payslips; loan outstanding equals principal less deducted instalments).

Documents: payslip (English, Urdu or both), salary register, bank advice letter, cash salary sheet with signature column, salary certificate, loan agreement, final settlement statement.

## 11 · Offline

None. Published payslips already opened are readable offline in the mobile app.

## 12 · AI

- Unusual activity: a structure changed and reverted, the same bank account on two staff, a person on the payroll with no attendance for the month (S5).
- Payroll figures are never sent to a model for calculation or explanation; "How was this worked out" comes from the stored `basis`.

## 13 · Failure cases

- **F-payroll-1** Calculation stops halfway (server restart) → the run returns to `draft` with no payslips; calculate again.
- **F-payroll-2** No confirmed salary tax rule covers the pay month → calculation fails with the message from [M25](m25-tax-compliance.md); nothing is saved.
- **F-payroll-3** A staff member has no bank account and is set to bank → listed as a warning; the run cannot be approved until they are switched to cash or the account is added.
- **F-payroll-4** A loan instalment would take net pay below zero → deferred automatically with a warning.
- **F-payroll-5** Two payroll officers calculate the same run at once → the second gets `CONFLICT`: a calculation is already running.
- **F-payroll-6** Attendance is corrected after approval → the row is locked; the correction becomes an adjustment next month.
- **F-payroll-7** The bank rejects three accounts in the transfer file → those payslips are marked unpaid again with the bank's reason and paid by a second file or by cash; the ledger shows them still payable.
- **F-payroll-8** An approved payslip has the wrong structure → reverse it in an off-cycle run and issue a correct one; tax to date and loan balances follow.
- **F-payroll-9** A teacher is transferred on the 15th → paid in full by the branch that is their home on the period's last day; the cost report can split by days.
- **F-payroll-10** A mapping account was deactivated → approval fails naming the mapping key; nothing is half-posted.
- **F-payroll-11** The approver tries to approve a run they calculated → refused; it goes to the next approver.
- **F-payroll-12** A person leaves mid-month with a loan outstanding → the regular run takes that month's instalment; the final settlement takes the rest.

## 14 · Seed data

Sixteen salary components. An active structure for every staff member, with history for those who had increments. Last year's increment round (applied) and a proposed round waiting. Six months of payroll per branch: five closed, the latest `under_review` with two held payslips and several warnings. Bank files for paid runs. Eight loans and advances in every status. Adjustments including exam duty pay. One final settlement approved and one in draft. Provident fund entries for staff who have it.

## 15 · Tests

- **T-payroll-1** `calculate.ts` table tests: full month, joiner, leaver, unpaid leave, absence, late half days, each day basis, proration on and off.
- **T-payroll-2** Tax by projection over a year equals the annual liability to the rupee, including a mid-year increment ([T-tax-1](m25-tax-compliance.md)).
- **T-payroll-3** Contributions from each rule; missing rule stops the run.
- **T-payroll-4** Loan recovery cap, deferral, and never-negative net.
- **T-payroll-5** Recalculation replaces payslips and leaves no orphans.
- **T-payroll-6** Approval in one transaction: a forced failure at any step leaves the run `under_review` with nothing posted.
- **T-payroll-7** Postings match the map in [M23](m23-accounting.md) and balance per branch.
- **T-payroll-8** Bank file totals equal bank payslips; held payslips excluded.
- **T-payroll-9** Reversal undoes ledger, tax, loan and provident fund effects.
- **T-payroll-10** A user without the `payroll` capability reads no row of any payroll table except their own published payslips, even by direct query.
- **T-payroll-11** A staff member cannot see an unpublished payslip of their own.
- **T-payroll-12** Structure overlap refused; self-approval refused.
- **T-payroll-13** Final settlement lines and the clearance gate.
- **T-payroll-14** The integrity job catches each planted difference.
- **T-payroll-15** Closed fiscal period refused.
- **T-payroll-16** Row-level security and branch scope.

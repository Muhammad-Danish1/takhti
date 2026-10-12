# M23 · Accounting

## 1 · Purpose

A double-entry general ledger for the school group. Fees, payroll, purchases and the shop post to it automatically, so the accountant does not re-key anything, and the owner gets a trial balance, income statement and balance sheet per branch and for the whole group.

## 2 · Depends on

[M02](m02-organisation-branches.md) (branches), [M00](m00-shared-kernel.md) (sequences, approvals, imports, documents). Every money module posts into it: [M21](m21-fees.md), [M22](m22-online-payments-reconciliation.md), [M24](m24-expenses-procurement.md), [M25](m25-tax-compliance.md), [M28](m28-payroll.md), [M32](m32-inventory-assets.md), [M33](m33-shop-canteen.md).

## 3 · Tables

#### `accounts` · org
The chart of accounts. Shared by all branches; the branch is a dimension on each journal line.

| Column | Type | Rules |
|---|---|---|
| code | text | required; unique per organisation; digits, e.g. `1110` |
| name | text | required |
| name_ur | text | optional |
| type | enum(asset, liability, equity, income, expense) | required |
| subtype | enum(cash, bank, receivable, payable, clearing, inventory, fixed_asset, depreciation, advance, deposit_held, tax, equity, retained_earnings, income, contra_income, cost_of_sales, expense, other) | required |
| parent_id | uuid → accounts | optional; the same type as its parent |
| is_group | bool | default false; a group account has children and takes no postings |
| is_control | bool | default false; a control account is posted only by the system (fee receivable, salaries payable) |
| is_active | bool | default true |
| description | text | optional |

Index: (org_id, type, code).

#### `fiscal_years` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation; "FY 2026–27" |
| starts_on | date | required |
| ends_on | date | required; twelve months after `starts_on`, less a day |
| status | enum(open, closed) | default open |
| closing_entry_id | uuid → journal_entries | optional |

Unique: no two years of an organisation overlap.

#### `fiscal_periods` · org

| Column | Type | Rules |
|---|---|---|
| fiscal_year_id | uuid → fiscal_years | required |
| period_no | int | required; 1 to 12 |
| name | text | required; "July 2026" |
| starts_on | date | required |
| ends_on | date | required |
| status | enum(open, closed) | default open |
| closed_at | timestamptz | optional |
| closed_by | uuid → profiles | optional |

Unique: (fiscal_year_id, period_no).

#### `journals` · org

| Column | Type | Rules |
|---|---|---|
| code | text | required; unique per organisation; `GJ`, `FEE`, `CASH`, `BANK`, `PAY`, `PUR`, `INV`, `OPEN`, `CLOSE` |
| name | text | required |
| kind | enum(general, fees, cash, bank, payroll, purchases, inventory, opening, closing) | required |
| is_system | bool | default false |

#### `journal_entries` · org

| Column | Type | Rules |
|---|---|---|
| entry_no | text | required; from a sequence per journal per fiscal year: `FEE-2627-000123` |
| journal_id | uuid → journals | required |
| branch_id | uuid → branches | optional; the branch that raised it |
| entry_date | date | required |
| fiscal_period_id | uuid → fiscal_periods | required; the period containing `entry_date` |
| memo | text | required |
| source_type | text | required; `manual`, `fee_generation_run`, `fee_voucher`, `fee_payment`, `fee_adjustment`, `fee_refund`, `cash_session`, `settlement`, `payroll_run`, `salary_payment`, `expense`, `vendor_bill`, `vendor_payment`, `stock_movement`, `shop_sale`, `wallet`, `transfer`, `depreciation`, `opening`, `closing`, `bank_line` |
| source_id | uuid | optional; empty for `manual` |
| purpose | text | default `post`; `post` or `reverse`, so each source posts at most once per purpose |
| status | enum(draft, posted, reversed) | default draft |
| total | paisa | required; the sum of its debits |
| reverses_entry_id | uuid → journal_entries | optional |
| reversed_by_entry_id | uuid → journal_entries | optional |
| approval_request_id | uuid → approval_requests | optional |
| posted_at | timestamptz | optional |
| posted_by | uuid → profiles | optional |

Unique: (org_id, entry_no); (org_id, source_type, source_id, purpose) where `source_id` is not empty.
Index: (org_id, entry_date); (org_id, journal_id, entry_date).

#### `journal_lines` · org

| Column | Type | Rules |
|---|---|---|
| entry_id | uuid → journal_entries | required |
| line_no | int | required |
| account_id | uuid → accounts | required; not a group account |
| branch_id | uuid → branches | required |
| debit | paisa | default 0; ≥ 0 |
| credit | paisa | default 0; ≥ 0; exactly one of debit and credit is above zero |
| description | text | optional |
| cost_center_id | uuid → cost_centers | optional |
| party_type | enum(none, family, student, staff, vendor) | default none |
| party_id | uuid | optional |
| entry_date | date | required; copied from the entry |
| is_posted | bool | default false; set with the entry |

Policy: staff with a finance permission; lines of other branches are hidden by the branch rule unless the user has all branches.
Index: (org_id, account_id, entry_date); (org_id, branch_id, account_id, entry_date); (org_id, party_type, party_id).

A posted line is never changed or removed: a trigger refuses it. A line of a draft entry can be changed until the entry is posted.

A deferred constraint trigger refuses to commit a posted entry whose debits and credits differ, or whose lines do not balance within each branch.

#### `account_mappings` · org
Which account each automatic posting uses.

| Column | Type | Rules |
|---|---|---|
| key | text | required; from the fixed list in §4 |
| branch_id | uuid → branches | optional; a branch-specific override |
| account_id | uuid → accounts | required |

Unique: (org_id, key, branch_id).

#### `bank_accounts` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation; "HBL Collection — Main Campus" |
| bank_name | text | required |
| bank_branch | text | optional |
| account_title | text | required |
| account_no | text | required; shown masked except to finance roles |
| iban | text | optional; a valid Pakistani IBAN |
| kind | enum(current, savings, wallet) | default current |
| account_id | uuid → accounts | required; its ledger account, subtype `bank`; unique |
| branch_id | uuid → branches | optional; the campus it belongs to |
| is_collection | bool | default false; printed on challans |
| onebill_prefix | text | optional |
| is_active | bool | default true |

#### `cost_centers` · org

| Column | Type | Rules |
|---|---|---|
| code | text | required; unique per organisation |
| name | text | required; "Transport", "Hostel", "Canteen" |
| parent_id | uuid → cost_centers | optional |
| is_active | bool | default true |

#### `recurring_entries` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; "Monthly rent — City Campus" |
| journal_id | uuid → journals | required |
| branch_id | uuid → branches | required |
| lines | jsonb | required; `{ accountId, debit, credit, costCenterId?, description? }[]`, balanced |
| frequency | enum(monthly, quarterly, yearly) | required |
| next_run_on | date | required |
| ends_on | date | optional |
| auto_post | bool | default false; otherwise a draft is created for review |
| is_active | bool | default true |

## 4 · Contracts

`packages/contracts/src/modules/accounting/`: `accounts`, `fiscal`, `journals`, `journal-entries`, `account-mappings`, `bank-accounts`, `cost-centers`, `recurring-entries`, `financial-reports`.

**The posting service** — `packages/core/src/modules/accounting/ledger.ts`. Every other module calls it; none writes journal tables itself.

```ts
ledger.post(ctx, {
  journal: 'FEE', date, branchId, memo,
  source: { type: 'fee_payment', id },
  lines: [{ account: { key: 'cash.counter' }, branchId, debit }, { account: { key: 'fees.receivable' }, branchId, credit, party }],
});
ledger.reverse(ctx, { source: { type: 'fee_payment', id }, date, reason });
```

It resolves mapping keys to accounts (branch override first), checks that the entry balances overall and per branch, that the period is open, that every account is active and not a group, numbers the entry, and writes entry and lines in the caller's transaction. Calling it again for the same source and purpose returns the existing entry.

A line whose amount is zero is left out, so a caller may list every part of a posting (a discount of nothing, a tax of nothing) without testing each. `ledger.reverseEntry(ctx, entryId, { date, reason })` reverses an entry that has no source, a manual one. The calculations that need no database (what balances, the inter-branch lines, the exchange of debits and credits) are in `ledger.rules.ts`.

**What a new school starts with.** Provisioning an organisation ([M01](m01-platform-console.md)) writes the default chart of accounts, the nine journals (one for each code above), an account for every mapping key, and the fiscal year that contains the day the school is created, with its twelve periods open. So the first fee can be collected and posted without anyone setting up accounting first. The chart is in `packages/db/src/provision/accounting.ts`; a school changes it afterwards like any other data.

**Mapping keys** (seeded with a default chart): `cash.counter`, `cash.petty`, `fees.receivable`, `fees.income` (fallback when a head has no account), `fees.discounts`, `fees.fine_income`, `fees.advance` (family credit), `fees.security_deposit`, `fees.bad_debts`, `fees.rounding`, `cash.over_short`, `gateway.clearing`, `gateway.charges`, `tax.fee_advance_payable`, `tax.salary_payable`, `tax.vendor_withholding_payable`, `payroll.salary_expense`, `payroll.employer_contributions`, `payroll.salaries_payable`, `payroll.eobi_payable`, `payroll.social_security_payable`, `payroll.provident_fund_payable`, `payroll.loans`, `payroll.advances`, `ap.payable`, `ap.advances_to_vendors`, `inventory.asset`, `inventory.consumed`, `inventory.adjustment`, `assets.fixed`, `assets.depreciation_expense`, `assets.accumulated_depreciation`, `shop.sales`, `shop.cost_of_sales`, `shop.wallets`, `bank.charges`, `interbranch.due`, `equity.opening_balance`, `equity.retained_earnings`.

**The posting map**

| Event | Debit | Credit |
|---|---|---|
| Vouchers issued | `fees.receivable` (net) · `fees.discounts` (discounts) | Income by head (gross) · `fees.security_deposit` · `tax.fee_advance_payable` |
| Late fine added | `fees.receivable` | `fees.fine_income` |
| Fee payment | `cash.counter`, a bank account, or `gateway.clearing` | `fees.receivable` (allocated) · `fees.advance` (unallocated) |
| Family credit applied | `fees.advance` | `fees.receivable` |
| Waiver or credit adjustment | `fees.discounts` | `fees.receivable` |
| Write-off | `fees.bad_debts` | `fees.receivable` |
| Refund paid | `fees.advance` or `fees.security_deposit` | Cash or bank |
| Cash session difference | `cash.over_short` | `cash.counter` (or the reverse) |
| Gateway settlement | Bank (net) · `gateway.charges` | `gateway.clearing` (gross) |
| Payroll approved | `payroll.salary_expense` · `payroll.employer_contributions` | `payroll.salaries_payable` · tax and contribution payables · `payroll.loans` · `payroll.advances` |
| Salaries paid | `payroll.salaries_payable` | Bank or cash |
| Expense paid | The category's expense account | Cash, petty cash or bank |
| Vendor bill approved | Expense, `inventory.asset` or `assets.fixed` | `ap.payable` |
| Vendor payment | `ap.payable` | Bank or cash · `tax.vendor_withholding_payable` |
| Stock issued for use | `inventory.consumed` | `inventory.asset` |
| Shop sale | Cash or `shop.wallets` · `shop.cost_of_sales` | `shop.sales` · `inventory.asset` |
| Wallet top-up | Cash | `shop.wallets` |
| Depreciation | `assets.depreciation_expense` | `assets.accumulated_depreciation` |
| Transfer between cash and bank | The receiving account | The paying account |
| Year-end close | Income accounts | Expense accounts · `equity.retained_earnings` |

Every reversal is the same entry with debits and credits exchanged, dated in an open period.

**Reports** (`FinancialReportRequest`: `{ report, from, to, branchIds?, costCenterId?, compare?: 'previous_period' | 'previous_year', columns?: 'total' | 'monthly' | 'branch' }`): `trial-balance`, `general-ledger`, `account-statement`, `day-book`, `cash-book`, `bank-book`, `income-statement`, `balance-sheet`, `cash-movement`, `party-ledger`, `cost-center-statement`.

Settings: `accounting.fiscal_year_start_month` (default 7), `accounting.manual_entry_approval_above` (default Rs 100,000), `accounting.lock_days` (default 0; when above zero, entries dated more than this many days back need `journal-entries:post-back-dated`).

## 5 · Rules

- **R-acct-1** Every posted entry balances: total debits equal total credits. This is checked in the service and again by the database trigger.
- **R-acct-2** Every posted entry also balances within each branch. When a transaction truly spans branches (head office pays a campus's bill), the service adds `interbranch.due` lines so that each branch balances; these net to zero across the group.
- **R-acct-3** A posted entry is never edited or deleted. It is corrected by reversal and a new entry. A draft may be edited or deleted.
- **R-acct-4** An entry's date must fall in an open period of an open fiscal year. An automatic posting for a date in a closed period is refused, and the operation that caused it fails with a clear message.
- **R-acct-5** Postings go only to active, non-group accounts. A control account accepts postings only from the system; a manual entry to one is refused.
- **R-acct-6** An account's type cannot change once it has postings. An account with postings or a mapping cannot be deleted, only deactivated, and only when its balance is zero.
- **R-acct-7** A manual entry above `accounting.manual_entry_approval_above` needs approval before posting, by someone other than its author.
- **R-acct-8** Each source posts once per purpose. A second attempt returns the first entry.
- **R-acct-9** Closing a period requires: no draft entries dated in it, every cash session of the period approved, and no automatic posting in the failed-postings list for it. The checklist is shown with what is outstanding. Reopening needs `fiscal-periods:reopen` and a reason, and is audited.
- **R-acct-10** Closing a fiscal year requires all twelve periods closed. It posts one closing entry that moves every income and expense balance to `equity.retained_earnings`, per branch, and opens the next year if it does not exist.
- **R-acct-11** Opening balances are one entry in the `OPEN` journal dated the day before go-live, balanced against `equity.opening_balance`, entered by hand or imported. Opening fee balances per student come through [M21](m21-fees.md) as opening vouchers and must equal the opening balance of `fees.receivable`; the import refuses a mismatch.
- **R-acct-12** A missing mapping stops the posting with the key's name; it never falls back silently to another account.
- **R-acct-13** A bank account's ledger account belongs to it alone. Its ledger balance is what bank reconciliation compares with the statement ([M22](m22-online-payments-reconciliation.md)).
- **R-acct-14** Reports are computed from posted lines only. A consolidated report across branches removes `interbranch.due`. A user sees only the branches they are assigned to.
- **R-acct-15** A recurring entry creates a draft on its date, or posts when `auto_post` is on and its period is open; if the period is closed it stays as a draft and its owner is told.
- **R-acct-16** A transfer between the school's own cash and bank accounts (banking the day's cash, topping up petty cash) is one balanced entry made through the transfer form, with the deposit slip attached.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `accounts:read` | See the chart of accounts and balances | FINANCE, LEADERS |
| `accounts:manage` | Add, edit and deactivate accounts; cost centers | ACCOUNTS |
| `account-mappings:manage` | Change which accounts automatic postings use | finance_head |
| `journal-entries:read` | See journal entries and ledgers | ACCOUNTS, LEADERS |
| `journal-entries:create` | Draft manual entries and transfers | ACCOUNTS |
| `journal-entries:post` | Post and reverse manual entries | ACCOUNTS |
| `journal-entries:post-back-dated` | Post entries older than the lock days | finance_head |
| `recurring-entries:manage` | Maintain recurring entries | ACCOUNTS |
| `fiscal-periods:manage` | Create years; close periods and years | finance_head |
| `fiscal-periods:reopen` | Reopen a closed period | finance_head |
| `bank-accounts:read` | See bank accounts | FINANCE, LEADERS |
| `bank-accounts:manage` | Add and edit bank accounts | finance_head |
| `financial-reports:read` | Run financial reports | ACCOUNTS, LEADERS |
| `financial-reports:export` | Export and print financial reports | ACCOUNTS, LEADERS |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/accounts` | `accounts:read` | The chart as a tree, optionally with balances at a date |
| POST | `/accounts` | `accounts:manage` | Creates |
| GET | `/accounts/[id]` | `accounts:read` | One account |
| PATCH | `/accounts/[id]` | `accounts:manage` | Edits |
| POST | `/accounts/[id]/deactivate` | `accounts:manage` | Deactivates |
| POST | `/accounts/import` | `accounts:manage` | Imports a chart of accounts |
| GET | `/account-mappings` | `accounts:read` | Lists every key with its account |
| PUT | `/account-mappings` | `account-mappings:manage` | Saves mappings |
| GET | `/cost-centers` | `accounts:read` | Lists |
| POST | `/cost-centers` | `accounts:manage` | Creates |
| PATCH | `/cost-centers/[id]` | `accounts:manage` | Edits |
| GET | `/bank-accounts` | `bank-accounts:read` | Lists |
| POST | `/bank-accounts` | `bank-accounts:manage` | Creates, with its ledger account |
| PATCH | `/bank-accounts/[id]` | `bank-accounts:manage` | Edits |
| GET | `/fiscal-years` | `accounts:read` | Years with their periods |
| POST | `/fiscal-years` | `fiscal-periods:manage` | Creates a year and its twelve periods |
| GET | `/fiscal-periods/[id]/checklist` | `fiscal-periods:manage` | What stands in the way of closing |
| POST | `/fiscal-periods/[id]/close` | `fiscal-periods:manage` | Closes |
| POST | `/fiscal-periods/[id]/reopen` | `fiscal-periods:reopen` | Reopens with a reason |
| POST | `/fiscal-years/[id]/close` | `fiscal-periods:manage` | Year-end close |
| GET | `/journal-entries` | `journal-entries:read` | Lists; filter by journal, dates, source, status, account |
| POST | `/journal-entries` | `journal-entries:create` | Creates a draft |
| GET | `/journal-entries/[id]` | `journal-entries:read` | One entry with its lines and a link to its source |
| PATCH | `/journal-entries/[id]` | `journal-entries:create` | Edits a draft |
| DELETE | `/journal-entries/[id]` | `journal-entries:create` | Deletes a draft |
| POST | `/journal-entries/[id]/post` | `journal-entries:post` | Posts |
| POST | `/journal-entries/[id]/reverse` | `journal-entries:post` | Reverses a manual entry |
| POST | `/journal-entries/opening` | `fiscal-periods:manage` | Enters or imports opening balances |
| POST | `/cash-transfers` | `journal-entries:create` | Moves money between cash and bank accounts |
| GET | `/recurring-entries` | `journal-entries:read` | Lists |
| POST | `/recurring-entries` | `recurring-entries:manage` | Creates |
| PATCH | `/recurring-entries/[id]` | `recurring-entries:manage` | Edits |
| GET | `/accounting/failed-postings` | `journal-entries:read` | Operations whose posting was refused, with the reason |
| POST | `/accounting/reports` | `financial-reports:read` | Runs a financial report |
| POST | `/accounting/reports/export` | `financial-reports:export` | Exports or prints one |

Idempotent: `POST /journal-entries/[id]/post`, `POST /journal-entries/[id]/reverse`, `POST /cash-transfers`, `POST /fiscal-periods/[id]/close`, `POST /fiscal-years/[id]/close`.

## 8 · Client layer

Generated CRUD for accounts, cost centers, bank accounts and recurring entries. Custom hooks: `useChartOfAccounts`, `useAccountMappings`, `useJournalEntry`, `useSaveJournalDraft`, `usePostEntry`, `useReverseEntry`, `usePeriodChecklist`, `useClosePeriod`, `useFinancialReport(request)`, `useCreateTransfer`, `useFailedPostings`.

## 9 · Screens

Built in [Phase 9](../20-phases/phase-09-finance.md) and [Phase 15](../20-phases/phase-15-head-office-and-reports.md).

| Screen | Pattern | Where |
|---|---|---|
| Chart of accounts | Tree list | `/school/finance/accounts`: codes, names, balances; add under a parent |
| Journal entries | List | Filters; each row links to what caused it |
| Journal entry | Grid editor | Lines with account search by code or name, branch, debit, credit; a running difference that must be zero to post |
| Transfer | Form in a sheet | From, to, amount, date, slip |
| Periods | List | Open and closed; the closing checklist |
| Account mappings | Settings | Each key with a plain description of when it is used |
| Bank accounts | List + Form in a sheet | Masked numbers |
| Financial reports | Report | A report picker; branch, dates and comparison controls; drill from any figure to the ledger, from a ledger line to the entry, from the entry to its source |
| **Head office:** Consolidated statements | Report | `/hq/finance`: branches as columns |

## 10 · Notifications and jobs

Events: `journal.approval-requested`, `period.closing-soon` (5 days after month end with the checklist count), `period.closed`, `period.reopened` (to the owner), `posting.failed` (to the finance head), `recurring-entry.drafted`.

Jobs: `accounting.recurring` (daily 02:00), `accounting.integrity` (nightly: every posted entry balances; the trial balance nets to zero; `fees.receivable` equals open voucher balances per branch; `fees.advance` equals unallocated payments; `payroll.salaries_payable` equals unpaid payslips; `ap.payable` equals open bills; `inventory.asset` equals stock value; each difference goes to `integrity_findings`), `accounting.period-reminders` (daily).

Documents: journal voucher, trial balance, income statement, balance sheet, general ledger, cash book, bank book.

## 11 · Offline

None.

## 12 · AI

- "Ask your data" over the report service: "How does this term's income compare with last year's for City Campus?" becomes a `FinancialReportRequest`, shown with the answer (A9).
- Unusual activity: entries posted at odd hours, round-figure manual entries, repeated reversals (S5).

## 13 · Failure cases

- **F-acct-1** A fee payment is dated in a closed period → the payment is refused before anything is written, naming the period.
- **F-acct-2** A mapping is missing when payroll is approved → approval fails with "No account is set for `payroll.eobi_payable`" and a link to the mappings screen.
- **F-acct-3** A manual entry's debits and credits differ by one rupee → Post is disabled; the difference is shown.
- **F-acct-4** An accountant tries to post a manual line to `fees.receivable` → refused: control account.
- **F-acct-5** The same source is posted twice by a retried job → the existing entry is returned.
- **F-acct-6** A period is reopened, an entry added, and it is closed again → both actions are in the audit log and the owner is notified.
- **F-acct-7** An account with a balance is deactivated → refused with the balance.
- **F-acct-8** Head office pays City Campus's electricity bill from its own bank → the entry gains `interbranch.due` lines; each branch balances; the consolidated report shows no inter-branch amounts.
- **F-acct-9** The integrity check finds `fees.receivable` Rs 2,000 above open voucher balances → a finding with both figures and the entries of the day; nothing is auto-corrected.
- **F-acct-10** Opening balances do not balance → refused with the difference.

## 14 · Seed data

A default chart of about 120 accounts in five groups, written for a Pakistani school. Journals. Every mapping key set. Fiscal years for last year (closed) and this year, with periods closed up to two months ago. Two bank accounts and a petty cash account per branch. Five cost centers. Opening balances. All entries produced by the other modules' seed data, plus about 40 manual entries (rent, utilities, an accrual and its reversal), two waiting for approval, and four recurring entries.

## 15 · Tests

- **T-acct-1** The database refuses an unbalanced posted entry and one that does not balance per branch.
- **T-acct-2** `ledger.post` validation: closed period, inactive account, group account, control account from a manual entry, missing mapping.
- **T-acct-3** Idempotency per source and purpose.
- **T-acct-4** Reversal exchanges debits and credits and links both entries.
- **T-acct-5** Inter-branch lines are added and net to zero across the group.
- **T-acct-6** Each row of the posting map: the entry produced by the real service of the owning module matches the map.
- **T-acct-7** Period close checklist; reopen needs the permission and is audited.
- **T-acct-8** Year-end close zeroes income and expense and moves the result to retained earnings per branch.
- **T-acct-9** Reports: the trial balance nets to zero; the income statement's result equals the change in equity; the balance sheet balances; consolidated equals the sum of branches less inter-branch.
- **T-acct-10** Branch scope: a campus accountant sees only their branch's lines and report figures.
- **T-acct-11** The integrity job catches each planted difference.
- **T-acct-12** Manual entry approval above the threshold; author cannot approve.
- **T-acct-13** Row-level security.

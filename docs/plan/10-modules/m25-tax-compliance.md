# M25 · Tax and compliance

## 1 · Purpose

The rules a government sets and changes: income tax on salaries, advance tax collected on fees, tax withheld from vendors, EOBI and social security contributions, and the deadlines that go with them. Every rate and threshold is **data with an effective date**, entered and confirmed by the school's own adviser, never written into code.

Takhti calculates, records and reports. It does not file returns with the tax authority.

## 2 · Depends on

[M23](m23-accounting.md) (posting), [M00](m00-shared-kernel.md) (documents, files). Called by [M21](m21-fees.md), [M24](m24-expenses-procurement.md) and [M28](m28-payroll.md).

## 3 · Tables

#### `tax_profile` · org
One row per organisation.

| Column | Type | Rules |
|---|---|---|
| legal_name | text | required |
| ntn | text | optional; printed on receipts and certificates |
| strn | text | optional |
| tax_office | text | optional |
| tax_year_start_month | int | default 7 |
| withholding_agent | bool | default true |
| eobi_registration_no | text | optional |
| social_security_no | text | optional |
| adviser_name | text | optional |
| adviser_phone | text | optional |

Unique: (org_id).

#### `tax_rules` · org
A rule in force for a span of dates.

| Column | Type | Rules |
|---|---|---|
| kind | enum(salary_tax, fee_advance_tax, vendor_withholding, eobi, social_security, provident_fund, minimum_wage) | required |
| name | text | required; "Salary tax slabs, tax year 2027" |
| province | text | optional; for provincial rules |
| effective_from | date | required |
| effective_to | date | optional |
| params | jsonb | required; its shape depends on `kind`, see §4 |
| source_note | text | required; where the figures came from: the notification or Finance Act section |
| status | enum(draft, confirmed, retired) | default draft |
| confirmed_by | uuid → profiles | optional |
| confirmed_at | timestamptz | optional |

Unique: no two confirmed rules of one kind and province overlap in dates.

#### `tax_party_profiles` · org +self
Tax details of someone the school deals with.

| Column | Type | Rules |
|---|---|---|
| party_type | enum(guardian, staff, vendor) | required |
| party_id | uuid | required |
| user_id | uuid → profiles | optional; the person's own login, so they can read it |
| ntn | text | optional |
| cnic | text | optional |
| filer_status | enum(filer, non_filer, unknown) | default unknown |
| status_checked_on | date | optional; when someone last checked the active taxpayer list |
| exemption_file_id | uuid → files | optional; an exemption certificate |
| exemption_valid_to | date | optional |

Unique: (party_type, party_id).

#### `tax_deductions` · org append-only
Every amount of tax collected or withheld, whatever its source.

| Column | Type | Rules |
|---|---|---|
| kind | enum(salary_tax, fee_advance_tax, vendor_withholding) | required |
| branch_id | uuid → branches | required |
| party_type | enum(guardian, staff, vendor) | required |
| party_id | uuid | required |
| tax_period | date | required; first day of the month |
| base_amount | paisa | required |
| tax_amount | paisa | required; negative for a reversal |
| rate_percent | numeric(6,3) | optional |
| rule_id | uuid → tax_rules | required; the rule used |
| source_type | text | required; `payslip`, `fee_voucher_line`, `vendor_payment` |
| source_id | uuid | required |
| filing_id | uuid → statutory_filings | optional; set when it is included in a deposit |

Unique: (source_type, source_id, kind) for positive rows.
Index: (org_id, kind, tax_period); (org_id, party_type, party_id, tax_period).

#### `statutory_filings` · org
A deposit or statement that is due.

| Column | Type | Rules |
|---|---|---|
| kind | enum(salary_tax_deposit, fee_advance_tax_deposit, vendor_withholding_deposit, withholding_statement, eobi_contribution, social_security_contribution, annual_salary_statement) | required |
| branch_id | uuid → branches | optional |
| period_from | date | required |
| period_to | date | required |
| due_date | date | required |
| amount | paisa | default 0; computed from deductions or payroll when prepared |
| status | enum(upcoming, prepared, paid, filed, overdue) | default upcoming |
| payment_reference | text | optional; the CPR or challan number |
| paid_on | date | optional |
| bank_account_id | uuid → bank_accounts | optional |
| file_id | uuid → files | optional; the paid challan or acknowledgement |
| working_document_id | uuid → generated_documents | optional; the schedule Takhti produced |
| prepared_by | uuid → profiles | optional |

Unique: (org_id, kind, branch_id, period_from).

#### `withholding_certificates` · org +self

| Column | Type | Rules |
|---|---|---|
| certificate_no | text | required; from the `tax_certificate` sequence |
| kind | enum(salary_tax, fee_advance_tax, vendor_withholding) | required |
| party_type | enum(guardian, staff, vendor) | required |
| party_id | uuid | required |
| user_id | uuid → profiles | optional |
| tax_year | int | required; the year in which the tax year ends |
| base_total | paisa | required |
| tax_total | paisa | required |
| document_id | uuid → generated_documents | optional |
| issued_on | date | required |
| issued_by | uuid → profiles | required |

Unique: (kind, party_type, party_id, tax_year) among live rows.

#### `compliance_items` · org
Anything with a legal deadline that is not a tax deposit: registration and affiliation renewals, building and fire certificates, vehicle fitness, audit.

| Column | Type | Rules |
|---|---|---|
| title | text | required |
| category | enum(registration, affiliation, safety, vehicle, labour, audit, other) | required |
| branch_id | uuid → branches | optional |
| authority | text | optional |
| reference_no | text | optional |
| due_date | date | required |
| repeats | enum(never, monthly, quarterly, yearly) | default never |
| owner_id | uuid → profiles | required |
| remind_days | int[] | default `{30, 7, 1}` |
| status | enum(upcoming, done, overdue) | default upcoming |
| done_on | date | optional |
| file_id | uuid → files | optional |

## 4 · Contracts

`packages/contracts/src/modules/tax/`: `tax-profile`, `tax-rules`, `tax-party-profiles`, `tax-deductions`, `statutory-filings`, `withholding-certificates`, `compliance-items`.

**Rule shapes** (each validated by its own Zod schema):

| Kind | `params` |
|---|---|
| `salary_tax` | `{ slabs: { upTo: number \| null, fixed: number, percentOverLower: number, lower: number }[], surcharge?: { above: number, percent: number }, teacherRebatePercent?: number }` in rupees per tax year |
| `fee_advance_tax` | `{ enabled: boolean, annualThreshold: number, percent: number, appliesTo: 'all' \| 'non_filers', countHeads: 'flagged' }` |
| `vendor_withholding` | `{ rows: { vendorKind: 'company' \| 'individual', supply: 'goods' \| 'services', filer: boolean, percent: number, minimumPayment?: number }[] }` |
| `eobi` | `{ wageBase: number, employeePercent: number, employerPercent: number }` |
| `social_security` | `{ wageCeiling: number, employerPercent: number, aboveCeiling: 'not_covered' \| 'capped' }` |
| `provident_fund` | `{ employeePercent: number, employerPercent: number, onComponents: string[] }` |
| `minimum_wage` | `{ monthly: number }` |

**Calculators** — pure functions in `packages/core/src/modules/tax/calc/`, each taking the rule and returning the amount with a breakdown:

- `salaryTaxForMonth({ rule, taxableToDate, taxPaidToDate, taxableThisMonth, monthsLeft, teacher? })` — projects the year's income, applies the slabs, and spreads what is still owed over the remaining months, so a mid-year raise or joining corrects itself.
- `feeAdvanceTax({ rule, annualFees, filer, alreadyCollected, thisVoucherBase })`.
- `vendorWithholding({ rule, vendorKind, supply, filer, gross, exempt })`.
- `eobi({ rule })`, `socialSecurity({ rule, wage })`, `providentFund({ rule, components })`.

Figures in a rule are whole rupees and percentages; the calculators take and return paisa. They hold no figure of their own: every rate, slab, threshold and ceiling comes from the rule they are given.

**How each calculator reads its rule** **(confirm with the school's tax adviser before a rule is confirmed; the "try" route exists for exactly this)**

| Calculator | Reading |
|---|---|
| Salary tax | Projected income for the year is `taxableToDate + taxableThisMonth × (monthsLeft + 1)`. The slab whose range holds it gives `fixed + percentOverLower %` of the income above `lower`. When `teacher` is true and the rule has `teacherRebatePercent`, that percentage of the slab tax is taken off. When the projected income is above `surcharge.above`, `surcharge.percent` of the tax after the rebate is added. The year's tax is rounded to the rupee. This month's share is what is still owed (`year's tax − taxPaidToDate`) divided by `monthsLeft + 1`, rounded to the rupee, never below zero; in the last month (`monthsLeft` 0) it is everything still owed, so the months add up to the year's tax exactly. For someone leaving, payroll passes `monthsLeft` 0 in their last month |
| Advance tax on fees | Nothing when the rule is not `enabled`, when it applies to `non_filers` and the guardian is a filer, or while `annualFees` is not above `annualThreshold`. Otherwise `percent` of `thisVoucherBase`, rounded to the rupee, and never more than `percent` of `annualFees` less `alreadyCollected`. A status of `unknown` is read as non-filer. Vouchers issued before the family's annual figure crossed the threshold are not charged afterwards |
| Vendor withholding | The row matching the vendor's kind, the kind of supply and the filer status gives `percent` of `gross`, rounded to the rupee. Nothing when `exempt`, or when the row has a `minimumPayment` and `gross` is below it. A table with no matching row refuses the calculation; it never assumes zero |
| EOBI | `employeePercent` and `employerPercent` of `wageBase`, each rounded to the rupee |
| Social security | `employerPercent` of the wage, rounded to the rupee. For a wage above `wageCeiling` the rule says which: `not_covered` gives nothing, `capped` gives the percentage of the ceiling |
| Provident fund | `employeePercent` and `employerPercent` of the sum of the pay components named in `onComponents`, each rounded to the rupee |

`taxService.ruleFor(ctx, kind, date, province?)` returns the confirmed rule in force, or fails with `RULE` and a message naming the kind and date. With a province it prefers that province's rule and falls back to one with no province; it never uses another province's.

Settings: `tax.fee_advance_tax_enabled` (default false), `tax.remind_days_before_due` (default `[7, 3, 1]`), `tax.filer_recheck_days` (default 180).

## 5 · Rules

- **R-tax-1** Only a `confirmed` rule is ever used. Confirming needs `tax-rules:confirm` and a source note, and is audited. The person who drafted a rule may confirm it only if they hold that permission; the product never ships confirmed production rules.
- **R-tax-2** A confirmed rule's figures are not edited. A change in law is a new rule with its own `effective_from`; the old one gets `effective_to` the day before.
- **R-tax-3** A calculation that finds no confirmed rule for its date stops the operation that asked (a payroll run, a voucher run with advance tax on, a vendor payment) with a clear message. It never assumes zero.
- **R-tax-4** Every amount collected or withheld is written to `tax_deductions` in the same transaction as its source, and is reversed by a negative row when the source is reversed.
- **R-tax-5** **Salary tax** is computed for the month by projection over the tax year, using the rule in force on the last day of the pay month. Taxable pay is the sum of components flagged taxable ([M28](m28-payroll.md)). An employee who joins mid-year declares earlier income and tax paid for that year, or it is taken as zero and noted on the payslip.
- **R-tax-6** **Advance tax on fees** applies only when the setting is on and a confirmed rule says so. The base is the family's annual fees on heads flagged `counts_for_advance_tax`. It is charged only once the annual figure exceeds the threshold, and only to non-filers when the rule says `non_filers`; an unknown status is treated as non-filer and the guardian is asked to provide their status. It appears as its own voucher line.
- **R-tax-7** **Vendor withholding** is calculated when a payment is prepared and again when it is paid, from the vendor's kind, supply kind and filer status. A valid exemption certificate on the vendor's tax profile sets it to zero until the certificate expires.
- **R-tax-8** A filer status older than `tax.filer_recheck_days` is shown as "needs re-check" wherever it is used; it still applies until someone updates it.
- **R-tax-9** A filing is prepared by totalling the unassigned deductions of its kind and period, and producing a working schedule (payee, CNIC or NTN, base, tax). Marking it paid needs the payment reference and assigns those deductions to it; they cannot then be assigned again. The payment itself is posted from the payable account to the bank.
- **R-tax-10** Upcoming filings for the year are created when a fiscal year opens, and the next one is created when a repeating one is completed. A filing past its due date becomes `overdue` and stays on the dashboard until dealt with.
- **R-tax-11** A certificate totals a party's deductions of one kind for one tax year. A second certificate for the same party, kind and year replaces the first, which is kept as superseded.
- **R-tax-12** A guardian can read their own tax profile and certificates; a staff member their own; nobody else's.
- **R-tax-13** A compliance item that repeats creates its next occurrence when marked done.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `tax-profile:manage` | Edit the organisation's tax details | finance_head |
| `tax-rules:read` | See tax rules | FINANCE, HR, LEADERS |
| `tax-rules:manage` | Draft and retire tax rules | finance_head, payroll_officer |
| `tax-rules:confirm` | Confirm a rule for use | finance_head |
| `tax-parties:manage` | Maintain filer status and exemptions | ACCOUNTS, payroll_officer |
| `tax-deductions:read` | See tax collected and withheld | ACCOUNTS, payroll_officer, LEADERS |
| `statutory-filings:manage` | Prepare filings and mark them paid | ACCOUNTS, payroll_officer |
| `tax-certificates:issue` | Issue certificates | ACCOUNTS, payroll_officer |
| `compliance:read` | See the compliance calendar | LEADERS, FINANCE, HR |
| `compliance:manage` | Maintain compliance items | ADMINS, finance_head, hr_manager |
| `tax:export` | Export tax schedules | ACCOUNTS, payroll_officer |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/tax-profile` | `tax-rules:read` | The organisation's tax details |
| PUT | `/tax-profile` | `tax-profile:manage` | Saves them |
| GET | `/tax-rules` | `tax-rules:read` | Lists; filter by kind and status |
| POST | `/tax-rules` | `tax-rules:manage` | Drafts a rule, optionally copied from the current one |
| GET | `/tax-rules/[id]` | `tax-rules:read` | One rule |
| PATCH | `/tax-rules/[id]` | `tax-rules:manage` | Edits a draft |
| POST | `/tax-rules/[id]/confirm` | `tax-rules:confirm` | Confirms |
| POST | `/tax-rules/[id]/retire` | `tax-rules:manage` | Retires from a date |
| POST | `/tax-rules/[id]/try` | `tax-rules:read` | Runs the calculator with sample figures |
| GET | `/tax-party-profiles` | `tax-parties:manage` | Lists; filter by party type and "needs re-check" |
| PUT | `/tax-party-profiles` | `tax-parties:manage` | Saves one party's profile |
| GET | `/tax-deductions` | `tax-deductions:read` | Lists; filter by kind, period, party |
| GET | `/tax-deductions/summary` | `tax-deductions:read` | Totals by kind and month |
| GET | `/statutory-filings` | `tax-deductions:read` | The calendar of filings |
| POST | `/statutory-filings/[id]/prepare` | `statutory-filings:manage` | Computes the amount and the working schedule |
| POST | `/statutory-filings/[id]/pay` | `statutory-filings:manage` | Records the payment and posts it |
| POST | `/statutory-filings/[id]/file` | `statutory-filings:manage` | Marks a statement as filed |
| GET | `/withholding-certificates` | `tax-deductions:read` | Lists |
| POST | `/withholding-certificates` | `tax-certificates:issue` | Issues for one party or for all of a kind and year |
| GET | `/compliance-items` | `compliance:read` | The calendar |
| POST | `/compliance-items` | `compliance:manage` | Creates |
| PATCH | `/compliance-items/[id]` | `compliance:manage` | Edits |
| POST | `/compliance-items/[id]/done` | `compliance:manage` | Marks done |
| GET | `/tax/export` | `tax:export` | Exports a schedule |
| GET | `/me/tax` | `signed-in` | My tax profile and certificates |
| PUT | `/me/tax` | `signed-in` | A guardian or staff member declares NTN and filer status |

Idempotent: `POST /statutory-filings/[id]/pay`, `POST /withholding-certificates`.

## 8 · Client layer

Custom hooks: `useTaxRules`, `useTryTaxRule`, `useConfirmTaxRule`, `useTaxDeductionsSummary`, `useFilingsCalendar`, `usePrepareFiling`, `usePayFiling`, `useIssueCertificates`, `useComplianceCalendar`, `useMyTax`.

## 9 · Screens

Built in [Phase 9](../20-phases/phase-09-finance.md) and [Phase 10](../20-phases/phase-10-hr.md).

| Screen | Pattern | Where |
|---|---|---|
| Tax rules | List + Form page | `/school/finance/tax/rules`: one tab per kind; a slab editor for salary tax; a calculator beside the form; a banner on every draft: "Not in use until confirmed" |
| Tax collected | Report | By kind and month; drill to payees |
| Filings | Calendar list | Upcoming, due this week, overdue; Prepare, then Mark paid |
| Certificates | List | Issue for one or for all; download |
| Filer status | List | Guardians, staff and vendors needing a re-check |
| Compliance calendar | Calendar list | `/school/settings/compliance`: by month, with owners |
| **Parent / Staff:** My tax | Detail | Status, certificates to download |

## 10 · Notifications and jobs

Events: `tax-rule.expiring` (a rule with an `effective_to` within 30 days and no successor), `tax-rule.missing` (a calculation was refused), `filing.due`, `filing.overdue`, `tax-certificate.issued` (to the party), `filer-status.requested` (to a guardian with unknown status when advance tax is on), `compliance.due`, `compliance.overdue`.

Jobs: `tax.filing-status` (daily 07:00), `tax.filing-reminders` (daily 09:00), `tax.compliance-reminders` (daily 09:00), `tax.rule-check` (1 June and 1 July each year: reminds the finance head to confirm next year's salary slabs).

Documents: withholding certificate (three kinds), salary tax schedule, fee advance tax schedule, vendor withholding schedule, EOBI and social security contribution schedules.

## 11 · Offline

None.

## 12 · AI

None. Tax figures are never produced or explained by a model. The assistant may say where a setting is and what a field means.

## 13 · Failure cases

- **F-tax-1** Payroll for July is run and no salary tax rule is confirmed for the new tax year → the run stops with "No confirmed salary tax rule covers 31 July 2027"; nothing is computed with last year's slabs.
- **F-tax-2** Two confirmed rules of one kind overlap → the second confirmation is refused, naming the dates.
- **F-tax-3** A vendor's exemption certificate expired yesterday → withholding applies again from today; the payment screen says why.
- **F-tax-4** A payslip is reversed after its tax was included in a paid deposit → a negative deduction is recorded in the current period and reduces the next deposit; the paid filing is not altered.
- **F-tax-5** A guardian's status is unknown and advance tax is on → the tax line is added; the guardian is told how to declare their status; a later declaration affects future vouchers only.
- **F-tax-6** A filing is marked paid with an amount different from the prepared amount → refused until re-prepared or a note explains the difference.
- **F-tax-7** The slab editor is saved with a gap between two slabs → validation refuses it, showing the gap.
- **F-tax-8** A branch in another province has a different social security rate → `ruleFor` picks the rule for the branch's province; a missing provincial rule is reported, not replaced by another province's.

## 14 · Seed data

A tax profile. **Sample rules marked clearly as samples** in their `source_note` ("SAMPLE FIGURES FOR LOCAL TESTING — not for production"): salary slabs for last and this tax year, an advance fee tax rule (off by default; on in one seeded organisation), a vendor withholding table, EOBI, social security for Punjab and Sindh, provident fund, minimum wage. Tax profiles for all staff, vendors and about a third of guardians. Deductions produced by the seeded payroll, vendor payments and vouchers. A year of filings: past ones paid, one prepared, one overdue. Last year's certificates. Twelve compliance items across categories, two overdue.

The production seed contains **no** tax rules. Onboarding makes the school enter and confirm its own.

## 15 · Tests

- **T-tax-1** Salary tax: table tests at every slab boundary; projection for a full year, a mid-year joiner, a mid-year raise, a leaver; the year's twelve months sum to the annual figure to the rupee.
- **T-tax-2** Advance fee tax: below and above the threshold, crossing it mid-year, filer and non-filer, unknown status.
- **T-tax-3** Vendor withholding for every row of the table; exemption and its expiry.
- **T-tax-4** EOBI, social security and provident fund calculators.
- **T-tax-5** `ruleFor`: picks by date and province; refuses when none; never uses a draft.
- **T-tax-6** Confirmed rules cannot be edited or overlap.
- **T-tax-7** Deductions are written with their source and reversed with it.
- **T-tax-8** Filing: prepare totals unassigned deductions; pay assigns them once; posting matches the map.
- **T-tax-9** Certificates total correctly; reissue supersedes.
- **T-tax-10** A person reads only their own tax profile and certificates.
- **T-tax-11** Compliance repeats and reminders.
- **T-tax-12** Row-level security.

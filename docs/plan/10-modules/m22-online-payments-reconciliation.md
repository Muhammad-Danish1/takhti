# M22 · Online payments and reconciliation

## 1 · Purpose

Money that arrives without a cashier: JazzCash, Easypaisa, 1BILL through any banking app, and challans deposited at the bank. This module takes those payments in safely, and then proves that what the bank says arrived is what the books say arrived.

## 2 · Depends on

[M21](m21-fees.md) (records the payment), [M23](m23-accounting.md) (`bank_accounts`, posting), [M05](m05-integrations-api.md) (connections, the incoming webhook route and `webhook_events`), [M00](m00-shared-kernel.md) (files, imports, sequences).

## 3 · Tables

#### `payment_intents` · branch +household
One attempt to pay online.

| Column | Type | Rules |
|---|---|---|
| intent_no | text | required; from the `payment_intent` sequence; sent to the provider as our order reference |
| family_id | uuid → families | required |
| purpose | enum(fees, wallet_top_up) | default fees |
| student_id | uuid → students | optional; required for `wallet_top_up` |
| challan_no | text | optional |
| voucher_ids | uuid[] | default empty; empty means "allocate automatically" |
| amount | paisa | required; > 0 |
| service_charge | paisa | default 0; a convenience charge added for the payer, when the school passes it on |
| provider | enum(jazzcash, easypaisa, onebill, card, fake) | required |
| status | enum(created, pending, succeeded, failed, expired, cancelled) | default created |
| checkout_url | text | optional |
| expires_at | timestamptz | required |
| started_by | uuid → profiles | optional |
| started_from | enum(parent_app, counter_link, whatsapp, website) | required |
| provider_txn_id | text | optional |
| failure_code | text | optional |
| failure_message | text | optional |
| payment_id | uuid → fee_payments | optional; set on success |

Policy: a guardian may insert for their own family and read their own.
Unique: (org_id, intent_no).
Index: (org_id, status, expires_at); (org_id, family_id).

#### `gateway_transactions` · org append-only
Everything a provider told us, one row per provider transaction.

| Column | Type | Rules |
|---|---|---|
| provider | text | required |
| provider_txn_id | text | required |
| kind | enum(payment, refund, chargeback) | required |
| intent_id | uuid → payment_intents | optional |
| challan_no | text | optional; 1BILL payments arrive with the consumer number only |
| amount | paisa | required |
| occurred_at | timestamptz | required |
| webhook_event_id | uuid → webhook_events | optional |
| outcome | enum(applied, duplicate, review, ignored) | required |
| review_reason | text | optional |
| payment_id | uuid → fee_payments | optional |
| settlement_id | uuid → settlements | optional |

Unique: (org_id, provider, provider_txn_id, kind).

#### `settlements` · org
A provider's payout to the school's bank account, net of its charges.

| Column | Type | Rules |
|---|---|---|
| provider | text | required |
| settlement_ref | text | required |
| settlement_date | date | required |
| gross | paisa | required |
| charges | paisa | default 0 |
| tax_on_charges | paisa | default 0 |
| net | paisa | required; `gross - charges - tax_on_charges` |
| bank_account_id | uuid → bank_accounts | required |
| transaction_count | int | default 0 |
| status | enum(expected, received, reconciled, disputed) | default expected |
| file_id | uuid → files | optional; the provider's settlement report |

Unique: (org_id, provider, settlement_ref).

#### `bank_statement_imports` · org

| Column | Type | Rules |
|---|---|---|
| bank_account_id | uuid → bank_accounts | required |
| file_id | uuid → files | required |
| kind | enum(statement, collection_report) | required; a collection report lists challans deposited at the bank |
| layout | text | required; a saved column mapping, or a built-in bank layout |
| period_from | date | optional |
| period_to | date | optional |
| opening_balance | paisa | optional |
| closing_balance | paisa | optional |
| line_count | int | default 0 |
| duplicate_count | int | default 0 |
| status | enum(uploaded, parsed, matched, failed) | default uploaded |
| error | text | optional |
| imported_by | uuid → profiles | required |

#### `bank_statement_lines` · org

| Column | Type | Rules |
|---|---|---|
| import_id | uuid → bank_statement_imports | required |
| bank_account_id | uuid → bank_accounts | required |
| line_no | int | required |
| txn_date | date | required |
| description | text | required |
| reference | text | optional |
| challan_no | text | optional; read from the line by a rule |
| debit | paisa | default 0 |
| credit | paisa | default 0 |
| balance | paisa | optional |
| fingerprint | text | required; a hash of date, amounts, reference and description |
| match_status | enum(unmatched, suggested, matched, ignored) | default unmatched |
| ignore_reason | text | optional |

Unique: (bank_account_id, fingerprint).
Index: (org_id, bank_account_id, txn_date); (org_id, match_status).

#### `reconciliation_matches` · org

| Column | Type | Rules |
|---|---|---|
| statement_line_id | uuid → bank_statement_lines | required |
| target_type | enum(fee_payment, payment_proof, settlement, vendor_payment, salary_transfer, journal_entry, fee_refund) | required |
| target_id | uuid | required |
| amount | paisa | required; a line can be split across several targets |
| method | enum(exact, rule, manual) | required |
| status | enum(suggested, confirmed, rejected) | default suggested |
| decided_by | uuid → profiles | optional |
| decided_at | timestamptz | optional |

Unique: (statement_line_id, target_type, target_id).

#### `reconciliation_rules` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required |
| bank_account_id | uuid → bank_accounts | optional; empty means every account |
| match_field | enum(description, reference) | required |
| pattern | text | required; a regular expression; the first group is the captured value |
| captures | enum(challan_no, receipt_no, intent_no, settlement_ref, none) | required |
| target_type | text | optional; for `none`, what the line is (bank charges, profit, transfer) |
| account_id | uuid → accounts | optional; where a line with no target is posted |
| priority | int | default 100 |
| is_active | bool | default true |

#### `bank_reconciliations` · org
The formal statement that a bank account agrees with the books at a date.

| Column | Type | Rules |
|---|---|---|
| bank_account_id | uuid → bank_accounts | required |
| as_of | date | required |
| statement_balance | paisa | required |
| ledger_balance | paisa | required; computed |
| outstanding_deposits | paisa | default 0; in the books, not yet at the bank |
| outstanding_payments | paisa | default 0 |
| difference | paisa | required; must be zero to complete |
| status | enum(open, completed) | default open |
| completed_by | uuid → profiles | optional |
| document_id | uuid → generated_documents | optional |

Unique: (bank_account_id, as_of).

## 4 · Contracts

`packages/contracts/src/modules/payments/`: `payment-intents`, `gateway-transactions`, `settlements`, `bank-statements`, `reconciliation`.

- `StartPayment`: `{ amount, voucherIds?, provider }` → `{ intentId, checkoutUrl | qr | consumerNo, expiresAt }`.
- `IntentStatus`: `{ status, receiptNo?, failureMessage? }` — what the parent's screen polls.
- `BillInquiryResponse` (1BILL): consumer name, amount within the due date, amount after it, due date, bill status.
- `MatchSuggestion`: a statement line with ranked candidates and why each was suggested.
- `ReconciliationSummary`: per bank account — unmatched lines and amount, unbanked payments and amount, last completed reconciliation.

Provider adapters implement one interface in `packages/core/src/integrations/payments/`: `createCheckout`, `verifyCallback`, `inquire`, `parseSettlement`. `fake` is the local stand-in with a page that lets a developer choose success, failure or delay.

Settings: `payments.providers_enabled`, `payments.intent_minutes` (default 30), `payments.pass_charges_to_payer` (default false), `payments.onebill_partial` (default false), `recon.date_window_days` (default 3), `recon.auto_confirm_exact` (default true).

## 5 · Rules

**Taking a payment**

- **R-pay-1** An intent's amount is between `fees.min_part_payment` and the family's dues plus the allowed advance. It expires after `payments.intent_minutes`.
- **R-pay-2** A payment is recorded only on a provider callback whose signature is valid, or on a status inquiry made by our server. What the payer's browser says on return is never trusted; that page only polls the intent.
- **R-pay-3** Processing a callback is idempotent on the provider's transaction id. A second delivery records `duplicate` and changes nothing.
- **R-pay-4** The amount the provider reports must equal the intent's amount plus its service charge. If it differs, nothing is applied; the transaction is marked `review` and the accountants are alerted.
- **R-pay-5** A success for an intent that had expired or been cancelled is still honoured, because the money moved. The payment is recorded and the intent becomes `succeeded`.
- **R-pay-6** On success, [M21](m21-fees.md) records one `online` payment (channel = provider, reference = the provider's transaction id), allocates it, issues the receipt and sends it, in the same transaction that marks the intent `succeeded`.
- **R-pay-6a** An intent with purpose `wallet_top_up` records no fee payment. On success it credits the student's wallet through [M33](m33-shop-canteen.md) (source `online`, once per intent) and posts cash-in against the wallet liability. Its amount is limited by the wallet settings, not by dues.
- **R-pay-7** A job asks the provider about every intent still `pending` after 2 minutes, then at growing intervals for 24 hours past its expiry, so a lost callback never loses a payment.
- **R-pay-8** **1BILL.** The consumer number is the branch's biller prefix followed by the challan number. An inquiry answers with the amount within the due date and the amount after it (with today's fine), and "already paid" when the balance is zero. A payment notification is applied like any other; when no intent exists the allocation is by challan.
- **R-pay-9** A provider refund or chargeback is never applied automatically. It creates a `review` transaction; an accountant then reverses the fee payment with approval.
- **R-pay-10** The provider's secret keys live only in the encrypted connection settings ([M05](m05-integrations-api.md)), never in the browser. Card numbers never touch Takhti; checkout happens on the provider's page.

**Settlements**

- **R-pay-11** Online payments are posted to a clearing account for the provider, not straight to the bank. A settlement moves the gross amount out of clearing: the net to the bank, the charges and the tax on them to expense.
- **R-pay-12** A settlement is reconciled when the transactions it lists equal its gross amount and its net equals a bank statement line. A transaction missing from any settlement after 5 working days is listed for follow-up.

**Bank statements**

- **R-pay-13** A statement is imported by a saved column mapping. A line already imported (same fingerprint) is skipped and counted. When the opening balance does not equal the previous import's closing balance, the import is flagged as having a gap.
- **R-pay-14** Matching runs in order: exact (same amount, a reference or challan number that identifies one target, date within `recon.date_window_days`), then rules, then suggestions by amount and date. An exact single match is confirmed automatically when `recon.auto_confirm_exact` is on; everything else waits for a person.
- **R-pay-15** One line can match several targets and several lines one target, as long as the amounts agree.
- **R-pay-16** A **collection report** line (a challan deposited at the bank) with no payment yet becomes a `bank_deposit` payment through "Create payments", shown as a preview first: challan found and amount equal; challan found and amount different; challan not found. Only the first group is created without a decision.
- **R-pay-17** A credit line that matches a waiting payment proof verifies that proof ([R-fees-28](m21-fees.md)).
- **R-pay-18** A line with no target (bank charges, profit, a transfer between accounts) is posted to the account named by its rule, or by the accountant, as a journal entry.
- **R-pay-19** A confirmed match can be undone until its bank reconciliation is completed. Undoing never deletes a payment; a payment created from the line is reversed separately.
- **R-pay-20** A bank reconciliation can be completed only when its difference is zero. Completing it locks the matched lines up to that date.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `online-payments:read` | See intents, gateway transactions and settlements | FINANCE, LEADERS |
| `online-payments:manage` | Send a payment link, re-check or cancel an intent, resolve transactions in review | ACCOUNTS |
| `settlements:manage` | Import and reconcile settlements | ACCOUNTS |
| `bank-statements:import` | Import bank statements and collection reports | ACCOUNTS |
| `reconciliation:read` | See statement lines, matches and reconciliations | FINANCE, LEADERS |
| `reconciliation:match` | Confirm, reject and undo matches; create payments from lines | ACCOUNTS |
| `reconciliation:complete` | Complete a bank reconciliation | finance_head |
| `reconciliation-rules:manage` | Maintain matching rules and column mappings | ACCOUNTS |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| POST | `/family/payment-intents` | `signed-in` | Starts an online payment for the guardian's family |
| GET | `/family/payment-intents/[id]` | `signed-in` | The intent's status |
| POST | `/payment-intents` | `online-payments:manage` | Creates a payment link to send to a parent |
| GET | `/payment-intents` | `online-payments:read` | Lists; filter by status, provider, dates |
| GET | `/payment-intents/[id]` | `online-payments:read` | One intent with its provider history |
| POST | `/payment-intents/[id]/inquire` | `online-payments:manage` | Asks the provider now |
| POST | `/payment-intents/[id]/cancel` | `online-payments:manage` | Cancels an unpaid intent |
| POST | `/billers/onebill/inquiry` | `webhook` | Answers a 1BILL bill inquiry |
| POST | `/billers/onebill/payment` | `webhook` | Receives a 1BILL payment notification |
| GET | `/gateway-transactions` | `online-payments:read` | Lists; review first |
| POST | `/gateway-transactions/[id]/resolve` | `online-payments:manage` | Applies, ignores or links a transaction in review |
| GET | `/settlements` | `online-payments:read` | Lists |
| POST | `/settlements/import` | `settlements:manage` | Imports a provider's settlement report |
| GET | `/settlements/[id]` | `online-payments:read` | One settlement with its transactions |
| POST | `/settlements/[id]/reconcile` | `settlements:manage` | Posts and reconciles it |
| GET | `/bank-statements` | `reconciliation:read` | Lists imports |
| POST | `/bank-statements/import` | `bank-statements:import` | Uploads and parses a file |
| GET | `/bank-statements/layouts` | `reconciliation:read` | Built-in and saved column mappings |
| PUT | `/bank-statements/layouts/[key]` | `reconciliation-rules:manage` | Saves a mapping |
| GET | `/bank-statement-lines` | `reconciliation:read` | Lists; filter by account, dates, match status |
| POST | `/bank-statements/[id]/match` | `reconciliation:match` | Runs matching for an import |
| GET | `/bank-statement-lines/[id]/suggestions` | `reconciliation:read` | Candidates for one line |
| POST | `/bank-statement-lines/[id]/match` | `reconciliation:match` | Confirms a match to one or more targets |
| POST | `/bank-statement-lines/[id]/unmatch` | `reconciliation:match` | Undoes |
| POST | `/bank-statement-lines/[id]/ignore` | `reconciliation:match` | Ignores with a reason |
| POST | `/bank-statement-lines/[id]/post` | `reconciliation:match` | Posts a line with no target to an account |
| POST | `/bank-statements/[id]/create-payments/preview` | `reconciliation:match` | Shows what "Create payments" would do |
| POST | `/bank-statements/[id]/create-payments` | `reconciliation:match` | Creates the bank-deposit payments |
| GET | `/reconciliation/summary` | `reconciliation:read` | The summary per bank account |
| GET | `/reconciliation-rules` | `reconciliation:read` | Lists |
| POST | `/reconciliation-rules` | `reconciliation-rules:manage` | Creates |
| PATCH | `/reconciliation-rules/[id]` | `reconciliation-rules:manage` | Edits |
| GET | `/bank-reconciliations` | `reconciliation:read` | Lists |
| POST | `/bank-reconciliations` | `reconciliation:match` | Opens one for an account and date |
| GET | `/bank-reconciliations/[id]` | `reconciliation:read` | The statement with outstanding items |
| POST | `/bank-reconciliations/[id]/complete` | `reconciliation:complete` | Completes |

Provider callbacks for JazzCash and Easypaisa arrive on `POST /webhooks/[provider]` ([M05](m05-integrations-api.md)); this module registers the handlers.

Idempotent: `POST /family/payment-intents`, `POST /payment-intents`, `POST /billers/onebill/payment`, `POST /bank-statements/[id]/create-payments`, `POST /settlements/[id]/reconcile`, `POST /bank-statement-lines/[id]/match`.

## 8 · Client layer

Custom hooks: `useStartPayment`, `useIntentStatus(id)` (polls every 3 seconds until settled, then stops), `usePaymentIntents`, `useGatewayReview`, `useSettlements`, `useImportStatement`, `useStatementLines`, `useLineSuggestions`, `useMatchLine`, `useCreatePaymentsPreview`, `useReconciliationSummary`, `useBankReconciliation`.

## 9 · Screens

Built in [Phase 9](../20-phases/phase-09-finance.md), [Phase 14](../20-phases/phase-14-family-portals.md) and [Phase 18](../20-phases/phase-18-integrations.md).

| Screen | Pattern | Where |
|---|---|---|
| **Parent:** Pay | Wizard | Amount (total due prefilled, editable for part payment), method tiles, then the provider's page or a 1BILL consumer number with steps; a waiting screen that updates itself; the receipt |
| Online payments | List | `/school/finance/online`: intents and transactions; a "Review" tab |
| Settlements | List + Detail | Gross, charges, net; the bank line it matched |
| Bank statements | List | Imports with counts matched and unmatched |
| Import statement | Wizard | Upload, choose or build the column mapping with a preview of the first rows, parse, result |
| **Reconcile** | Split view | Unmatched bank lines on the left, candidates on the right; `Enter` confirms the top suggestion; split a line; post to an account; ignore |
| Create payments from a collection report | Wizard | Three groups with counts; decisions for the two that need them; confirm |
| Bank reconciliation | Detail | Statement balance, ledger balance, outstanding items, difference; Complete; print |
| Rules | Settings | Patterns with a tester: paste a description, see what is captured |

## 10 · Notifications and jobs

Events: `payment.failed` (to the guardian), `payment.review` (to accountants), `settlement.missing`, `bank-statement.gap`, `reconciliation.unmatched` (weekly digest to the finance head). A successful online payment is announced by [M21](m21-fees.md) with its receipt, like any other payment.

Jobs: `payments.process-callback`, `payments.inquire-pending` (every 2 minutes), `payments.expire-intents` (every 5 minutes), `payments.parse-statement`, `payments.match-statement`, `payments.settlement-check` (daily), `payments.integrity` (nightly: every succeeded intent has a payment; every online payment has a gateway transaction; clearing account balance equals unsettled transactions).

## 11 · Offline

None. The parent app shows "You are offline" on the pay screen and keeps the dues readable.

## 12 · AI

- Suggesting a column mapping for a bank's file from its header row; the accountant confirms.
- Explaining why a line was not matched, in plain words. Matching itself is rules and arithmetic, never a model.

## 13 · Failure cases

- **F-pay-1** The parent pays and closes the browser before returning → the callback or the inquiry job records the payment; the parent gets the receipt by message.
- **F-pay-2** The callback arrives twice, or arrives and the inquiry job also sees it → one payment.
- **F-pay-3** The callback never arrives and the provider's inquiry is down → the intent stays `pending`; inquiries continue for 24 hours past expiry; after that it is listed for a person and matched when the settlement arrives.
- **F-pay-4** The parent starts two payments for the same dues and completes both → both are recorded; the second becomes family credit; the parent is told.
- **F-pay-5** A callback has an invalid signature → stored with `signature_ok = false`, not processed, alerting after 5 in an hour.
- **F-pay-6** The amount in the callback is Rs 4,500 but the intent is Rs 5,400 → `review`; nothing is applied.
- **F-pay-7** 1BILL asks about a challan that was cancelled → "bill blocked"; a challan not found → "consumer number invalid".
- **F-pay-8** The same statement file is imported twice → every line is a duplicate; the import reports zero new lines.
- **F-pay-9** A bank line of Rs 13,500 covers three challans → split across three payments in one match.
- **F-pay-10** A collection report lists a challan paid short by Rs 500 → shown under "amount different"; the accountant records the part payment.
- **F-pay-11** The provider is down when the parent opens Pay → the method tile is disabled with "temporarily unavailable"; other methods remain.
- **F-pay-12** A reconciliation shows a difference of Rs 150 → it cannot be completed; the unmatched lines are listed, usually bank charges to post.

## 14 · Seed data

Connections using the `fake` provider. Per branch: 60 intents in every status, with matching gateway transactions (two in review: an amount mismatch and a refund), four settlements (three reconciled, one expected). Two bank accounts with three months of statement lines: mostly matched, about twenty unmatched (bank charges, an unknown credit, a split deposit), one collection report ready for "Create payments". Six matching rules. Completed bank reconciliations for the two earlier months and an open one for the current month.

## 15 · Tests

- **T-pay-1** Intent limits and expiry.
- **T-pay-2** A browser return alone records nothing; a signed callback does.
- **T-pay-3** Callback idempotency under simultaneous delivery.
- **T-pay-4** Amount mismatch goes to review.
- **T-pay-5** Success after expiry is honoured.
- **T-pay-6** The inquiry job recovers a lost callback.
- **T-pay-7** 1BILL inquiry answers for unpaid, part-paid, paid, overdue, cancelled and unknown challans; payment by challan with no intent.
- **T-pay-8** Clearing and settlement postings balance; clearing nets to zero after settlement.
- **T-pay-9** Statement import: mapping, duplicate fingerprints, balance gap.
- **T-pay-10** Matching: exact, rule, split, many-to-one; auto-confirm only for a single exact candidate.
- **T-pay-11** Create payments from a collection report: the three groups; idempotent.
- **T-pay-12** A proof is verified by a matching bank line.
- **T-pay-13** A bank reconciliation completes only at zero difference and locks its lines.
- **T-pay-14** A guardian can start and read intents only for their own family.
- **T-pay-14a** A wallet top-up intent credits the wallet once and creates no fee payment.
- **T-pay-15** Row-level security and branch scope.

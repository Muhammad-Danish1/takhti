# M33 · Shop and canteen

## 1 · Purpose

Selling things inside the school: uniforms, books and stationery at the school shop, and food at the canteen. A fast point-of-sale screen, stock that goes down as items sell, and a prepaid **student wallet** so children do not need to carry cash and parents can see and limit what is bought.

## 2 · Depends on

[M32](m32-inventory-assets.md) (items, stores, `stock.move`), [M07](m07-students.md), [M23](m23-accounting.md) (posting), [M21](m21-fees.md) and [M22](m22-online-payments-reconciliation.md) (top-ups), [M00](m00-shared-kernel.md) (sequences, documents).

## 3 · Tables

#### `shop_outlets` · branch

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per branch; "Uniform shop", "Canteen" |
| kind | enum(shop, canteen) | required |
| warehouse_id | uuid → warehouses | required; where its stock is held |
| accepts_cash | bool | default true |
| accepts_wallet | bool | default true |
| allows_charge_to_fees | bool | default false; a sale may be added to the family's next fee voucher |
| receipt_note | text | optional |
| is_active | bool | default true |

#### `shop_products` · org
What is offered for sale and at what price.

| Column | Type | Rules |
|---|---|---|
| name | text | required |
| name_ur | text | optional |
| outlet_kind | enum(shop, canteen) | required |
| item_id | uuid → inventory_items | optional; set when it is a stocked item; empty for food made to order |
| bundle | jsonb | default `[]`; `{ itemId, quantity }[]` for a set, such as "Grade 5 book set" |
| category | text | optional; a tile group on the sale screen |
| price | paisa | required; ≥ 0; tax included |
| grade_ids | uuid[] | default empty; for book sets and uniforms by grade |
| is_restrictable | bool | default false; guardians may block it for their child |
| image_file_id | uuid → files | optional |
| sort_order | int | default 0 |
| is_active | bool | default true |

Policy: staff; guardians and students may read active products.

#### `shop_sessions` · branch
A shift at a till.

| Column | Type | Rules |
|---|---|---|
| outlet_id | uuid → shop_outlets | required |
| cashier_id | uuid → profiles | required |
| opened_at | timestamptz | required |
| opening_float | paisa | default 0 |
| closed_at | timestamptz | optional |
| expected_cash | paisa | optional |
| counted_cash | paisa | optional |
| difference | paisa | optional |
| difference_note | text | optional; required when not zero |
| status | enum(open, closed, approved) | default open |
| device_id | uuid → sync_devices | optional |

Unique: one open session per cashier per outlet.

#### `shop_sales` · branch +family

| Column | Type | Rules |
|---|---|---|
| sale_no | text | required; from the `shop_sale` sequence |
| device_receipt_code | text | optional; printed on a receipt made offline |
| outlet_id | uuid → shop_outlets | required |
| session_id | uuid → shop_sessions | required |
| sold_at | timestamptz | required |
| student_id | uuid → students | optional; required for wallet and charge-to-fees |
| family_id | uuid → families | optional |
| staff_id | uuid → staff | optional; a sale to a staff member |
| total | paisa | required; the sum of its lines |
| paid_cash | paisa | default 0 |
| paid_wallet | paisa | default 0 |
| charged_to_fees | paisa | default 0; the three add up to `total` |
| status | enum(completed, voided, part_returned, returned) | default completed |
| void_reason | text | optional |
| sold_by | uuid → profiles | required |

Policy: staff of the branch; a guardian may read sales to their own children.
Unique: (org_id, sale_no); (org_id, device_receipt_code).
Index: (org_id, student_id, sold_at); (org_id, session_id).

#### `shop_sale_lines` · branch

| Column | Type | Rules |
|---|---|---|
| sale_id | uuid → shop_sales | required |
| product_id | uuid → shop_products | required |
| name | text | required; copied |
| quantity | numeric(10,3) | required; > 0 |
| unit_price | paisa | required |
| discount | paisa | default 0 |
| total | paisa | required |
| cost | paisa | default 0; the average cost at the sale, for cost of sales |
| returned_quantity | numeric(10,3) | default 0; ≤ `quantity` |

#### `shop_returns` · branch

| Column | Type | Rules |
|---|---|---|
| return_no | text | required; from the `shop_return` sequence |
| sale_id | uuid → shop_sales | required |
| session_id | uuid → shop_sessions | required |
| lines | jsonb | required; `{ saleLineId, quantity, restock }[]` |
| amount | paisa | required |
| refund_to | enum(cash, wallet, fees_credit) | required; follows how the sale was paid |
| reason | text | required |
| processed_by | uuid → profiles | required |

#### `student_wallets` · org +family
One per student, created on first use.

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required; unique |
| balance | paisa | default 0; never below zero |
| daily_limit | paisa | optional; the most that can be spent in a day |
| low_balance_alert | paisa | optional |
| blocked_product_ids | uuid[] | default empty |
| is_active | bool | default true |

#### `wallet_transactions` · org +family append-only

| Column | Type | Rules |
|---|---|---|
| wallet_id | uuid → student_wallets | required |
| student_id | uuid → students | required |
| kind | enum(top_up, purchase, refund, adjustment, cash_out) | required |
| amount | paisa | required; signed: money in is positive |
| balance_after | paisa | required |
| sale_id | uuid → shop_sales | optional |
| source_type | text | required; `counter`, `online`, `shop_sale`, `shop_return`, `manual`, `leaving` |
| source_id | uuid | optional |
| note | text | optional |
| done_by | uuid → profiles | optional |

Unique: (source_type, source_id, kind) where `source_id` is set.
Index: (org_id, wallet_id, created_at).

#### `canteen_menus` · branch

| Column | Type | Rules |
|---|---|---|
| week_start | date | required; a Monday |
| days | jsonb | required; `{ weekday, productIds[] , note? }[]` |
| status | enum(draft, published) | default draft |

Policy: staff of the branch; families may read published menus.
Unique: (branch_id, week_start).

## 4 · Contracts

`packages/contracts/src/modules/shop/`: `shop-outlets`, `shop-products`, `shop-sessions`, `shop-sales`, `shop-returns`, `student-wallets`, `canteen-menus`.

- `PosCatalogue`: the outlet's active products in tile groups with price and stock on hand.
- `Checkout`: `{ outletId, studentId?, staffId?, lines: { productId, quantity, discount? }[], pay: { cash, wallet, chargeToFees } }` → the sale with its receipt.
- `WalletView`: balance, limit, spent today, blocked products, recent transactions.
- `TopUp`: `{ studentId, amount, method }` at the counter; online top-up starts a payment intent with purpose `wallet_top_up` ([M22](m22-online-payments-reconciliation.md)).
- `SalesSummary`: by outlet, day, product and payment method; gross margin.

Settings: `shop.return_days` (default 7), `shop.discount_max_percent` (default 0; above zero lets the cashier discount a line up to it), `shop.wallet_max_balance` (default Rs 10,000), `shop.wallet_min_top_up` (default Rs 100), `shop.offline_wallet_limit` (default 0: wallets cannot be used offline), `shop.require_photo_match` (default true: the cashier sees the student's photo before a wallet sale).

## 5 · Rules

- **R-shop-1** A sale needs the cashier's open session at that outlet. Closing a session works as at the fee counter: counted cash against expected, a note for any difference, approval by the accountant.
- **R-shop-2** A sale is one transaction: the sale and its lines, stock out through `stock.move` for each stocked item (and each part of a bundle), the wallet debit, the ledger entry, and the receipt. If any part fails, nothing is saved.
- **R-shop-3** A stocked product cannot be sold beyond the stock in the outlet's store. Food made to order has no stock check.
- **R-shop-4** The three payment parts add up to the total exactly. Cash change is the cashier's business and is not recorded.
- **R-shop-5** A wallet sale needs a student. It is refused when the wallet is inactive, the balance is short, the day's limit would be passed, or a line is on the student's blocked list; the screen names the reason and the product.
- **R-shop-6** A wallet balance never goes below zero; the debit and the sale share a transaction, and the wallet row is locked for it.
- **R-shop-7** Charging a sale to fees is possible only when the outlet allows it. It creates an on-demand fee voucher line under the matching head through [M21](m21-fees.md), and the guardian is told the same day.
- **R-shop-8** A sale can be voided inside the session it was made in, with a reason: stock returns, the wallet is refunded, the entry is reversed.
- **R-shop-9** A return is accepted within `shop.return_days` with the sale number, for no more than was bought. The refund goes back the way it was paid: cash to cash, wallet to wallet, fees to a credit adjustment. Returned goods go back into stock when marked fit to restock.
- **R-shop-10** A wallet is topped up in cash at the fee counter or the shop (inside a cash or shop session), or online by the guardian. A top-up cannot take the balance above `shop.wallet_max_balance`.
- **R-shop-11** Wallet money is the family's, held by the school: it is a liability in the ledger until spent. When a student leaves, the balance is paid out or moved to family fee credit, and the wallet is closed.
- **R-shop-12** A guardian can see every purchase, set a daily limit, set a low-balance alert, and block products marked restrictable. A student can see their own balance and purchases.
- **R-shop-13** A student is identified at the till by scanning their ID card or by search; with `shop.require_photo_match` the photo is shown before the sale is confirmed.
- **R-shop-14** Prices include tax. A price change applies to new sales only; lines keep the price they were sold at.
- **R-shop-15** A book set or uniform set for a grade is one product that removes each of its items from stock.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `shop:read` | See outlets, products, sales and sessions | store_keeper, FINANCE, LEADERS |
| `shop-setup:manage` | Maintain outlets, products, prices and menus | store_keeper, branch_admin |
| `shop:sell` | Open a session, sell, void in one's own session, close it | store_keeper, cashier |
| `shop-returns:process` | Process returns | store_keeper, accountant |
| `shop-sessions:approve` | Approve closed shop sessions | ACCOUNTS |
| `wallets:read` | See any student's wallet | store_keeper, FINANCE, LEADERS |
| `wallets:top-up` | Top up a wallet at the counter | FINANCE, store_keeper |
| `wallets:adjust` | Adjust or pay out a wallet balance | ACCOUNTS |
| `shop:export` | Export sales reports | store_keeper, ACCOUNTS, LEADERS |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/shop-outlets` | `shop:read` | Lists |
| POST | `/shop-outlets` | `shop-setup:manage` | Creates |
| PATCH | `/shop-outlets/[id]` | `shop-setup:manage` | Edits |
| GET | `/shop-products` | `shop:read` | Lists |
| POST | `/shop-products` | `shop-setup:manage` | Creates |
| PATCH | `/shop-products/[id]` | `shop-setup:manage` | Edits |
| GET | `/shop-outlets/[id]/catalogue` | `shop:sell` | The sale screen's catalogue |
| GET | `/shop-sessions` | `shop:read` | Lists |
| GET | `/shop-sessions/current` | `shop:sell` | My open session with totals |
| POST | `/shop-sessions` | `shop:sell` | Opens |
| POST | `/shop-sessions/[id]/close` | `shop:sell` | Closes with counted cash |
| POST | `/shop-sessions/[id]/approve` | `shop-sessions:approve` | Approves |
| GET | `/shop/customer` | `shop:sell` | Finds a student or staff member by card scan or search, with wallet and restrictions |
| POST | `/shop-sales` | `shop:sell` | Checks out a sale |
| GET | `/shop-sales` | `shop:read` | Lists |
| GET | `/shop-sales/[id]` | `shop:read` | One sale |
| POST | `/shop-sales/[id]/void` | `shop:sell` | Voids inside its session |
| POST | `/shop-sales/[id]/receipt` | `shop:sell` | Reprints |
| POST | `/shop-returns` | `shop-returns:process` | Processes a return |
| GET | `/student-wallets/[studentId]` | `wallets:read` | A wallet with transactions |
| POST | `/student-wallets/[studentId]/top-up` | `wallets:top-up` | Tops up at the counter |
| POST | `/student-wallets/[studentId]/adjust` | `wallets:adjust` | Adjusts with a reason |
| POST | `/student-wallets/[studentId]/cash-out` | `wallets:adjust` | Pays out the balance |
| GET | `/canteen-menus` | `signed-in` | The menu for a week |
| PUT | `/canteen-menus` | `shop-setup:manage` | Saves and publishes a week |
| GET | `/shop/summary` | `shop:read` | Sales summary |
| GET | `/shop/export` | `shop:export` | Exports |
| GET | `/family/children/[id]/wallet` | `signed-in` | A child's wallet and purchases |
| PUT | `/family/children/[id]/wallet` | `signed-in` | Sets the daily limit, alert and blocked products |
| POST | `/family/children/[id]/wallet/top-up` | `signed-in` | Starts an online top-up |
| GET | `/learn/wallet` | `signed-in` | The student's own wallet |

Idempotent: `POST /shop-sales`, `POST /shop-sales/[id]/void`, `POST /shop-returns`, `POST /student-wallets/[studentId]/top-up`, `POST /student-wallets/[studentId]/cash-out`, `POST /family/children/[id]/wallet/top-up`.

## 8 · Client layer

Custom hooks: `usePosCatalogue(outletId)`, `useCart` (a Zustand store, local to the till), `useCustomer(code)`, `useCheckout` (never optimistic; one idempotency key per cart), `useCurrentShopSession`, `useCloseShopSession`, `useProcessReturn`, `useWallet(studentId)`, `useTopUpWallet`, `useChildWallet`, `useSaveWalletControls`, `useSalesSummary`.

## 9 · Screens

Built in [Phase 11](../20-phases/phase-11-front-office-and-operations.md) and [Phase 14](../20-phases/phase-14-family-portals.md).

| Screen | Pattern | Where |
|---|---|---|
| **Point of sale** | Counter | `/school/shop/sell`: product tiles by group on the left, the cart on the right; scan a barcode or tap; scan a student card to attach the customer and show photo, balance and limits; Cash, Wallet or Fees; print. Works with touch, mouse or keyboard |
| Session | Detail | Totals by method; close with a count |
| Products | List + Form in a sheet | Price, tile group, bundle contents, restrictable flag |
| Sales | List + Detail | Void, return, reprint |
| Wallets | List + Detail | Balances; top up; transactions |
| Canteen menu | Grid editor | Days across, products picked per day; publish |
| Sales reports | Report | By product, day, method; margin |
| **Parent:** Wallet | Detail | Balance, top up, purchases, daily limit, blocked items, this week's menu |
| **Student:** Wallet | Detail | Balance and purchases |

## 10 · Notifications and jobs

Events: `wallet.topped-up`, `wallet.low-balance`, `wallet.purchase` (optional, per purchase or as a daily summary by the guardian's preference), `wallet.limit-reached`, `shop.charged-to-fees`, `shop.session-difference`, `canteen.menu-published`.

Jobs: `shop.daily-summaries` (daily 16:00, to guardians who chose a summary), `shop.integrity` (nightly: each wallet balance equals the sum of its transactions; total wallet balances equal `shop.wallets` in the ledger; sale totals equal their lines and payments).

Documents: sale receipt (80 mm thermal and A5), return note, session summary, wallet statement.

## 11 · Offline

The point of sale can keep selling when the connection drops, through a `shop.pos` stream (the outlet's products, prices and its own session):

| Table | Operation | Conflict policy |
|---|---|---|
| `shop_sales` and lines | create, **cash only** | The sale happened, so it is always accepted. Stock is reduced on sync; if that takes a level below zero the sale still stands and a stock discrepancy is raised for the store keeper |

Wallet and charge-to-fees sales need a connection (unless `shop.offline_wallet_limit` is raised, at the school's own risk). Voids, returns and session closing need a connection.

## 12 · AI

Unusual activity: voids clustered at the end of a session, the same card used at two outlets within a minute, returns without matching stock (S5).

## 13 · Failure cases

- **F-shop-1** The cashier taps Pay twice → one sale.
- **F-shop-2** A wallet has Rs 150 and the cart is Rs 200 → the cashier is offered "Rs 150 from the wallet and Rs 50 in cash".
- **F-shop-3** A student's card is used at the shop and the canteen at the same moment → the second waits for the wallet lock and is checked against the new balance.
- **F-shop-4** A blocked product is in the cart for that student → the wallet payment is refused, naming it; the line can be removed or paid in cash only if the school's setting allows cash for blocked items (default: no).
- **F-shop-5** The last item was sold a second ago at another till → checkout refuses that line with the stock left.
- **F-shop-6** The receipt printer is out of paper → the sale stands; reprint from Sales.
- **F-shop-7** A return is asked for after 10 days → refused by the setting, unless a manager overrides with a reason.
- **F-shop-8** A parent's online top-up succeeds but the callback is delayed → the wallet is credited when the payment is confirmed ([F-pay-1](m22-online-payments-reconciliation.md)); the parent sees "processing".
- **F-shop-9** A student leaves with Rs 420 in the wallet → the withdrawal clearance shows it; it is paid out or moved to fee credit.
- **F-shop-10** An offline sale takes stock below zero on sync → accepted; a discrepancy is raised and corrected by a count.

## 14 · Seed data

A uniform and book shop and a canteen per large branch. About 80 products: uniform sizes, book sets per grade, stationery, 30 canteen items (some restrictable). Wallets for about 40% of students with balances, limits and a few blocked products. Six weeks of sales by cash and wallet, a few charged to fees, voids and returns; closed and approved sessions with one difference; one open session. Published canteen menus for this and next week.

## 15 · Tests

- **T-shop-1** Checkout is atomic: a forced failure at any step leaves no sale, no stock change, no wallet change and no entry.
- **T-shop-2** Idempotent checkout.
- **T-shop-3** Stock check for stocked items and bundles; none for made-to-order food.
- **T-shop-4** Wallet rules: balance, daily limit, blocked product, inactive; split payment.
- **T-shop-5** Fifty simultaneous wallet purchases never overdraw.
- **T-shop-6** Void and return reverse stock, wallet and ledger the right way.
- **T-shop-7** Top-up limits; online top-up credited once.
- **T-shop-8** Charge to fees creates the voucher line and tells the guardian.
- **T-shop-9** Postings match the map in [M23](m23-accounting.md); wallet liability equals balances.
- **T-shop-10** Session close arithmetic and approval.
- **T-shop-11** Offline cash sale applied once; discrepancy raised when stock is short.
- **T-shop-12** A guardian reads and controls only their own child's wallet.
- **T-shop-13** Row-level security and branch scope.

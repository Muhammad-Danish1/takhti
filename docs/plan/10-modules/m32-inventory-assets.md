# M32 · Inventory and assets

## 1 · Purpose

Two related things. **Inventory**: consumable stock in the school's stores — stationery, cleaning supplies, lab chemicals, uniforms and books for sale — received, issued, transferred and counted. **Assets**: durable things with a tag and a custodian — computers, furniture, projectors, generators — tracked from purchase to disposal, with depreciation.

## 2 · Depends on

[M02](m02-organisation-branches.md) (rooms), [M26](m26-staff-recruitment.md) (`staff`, departments), [M23](m23-accounting.md) (posting), [M24](m24-expenses-procurement.md) (goods received, vendors), [M00](m00-shared-kernel.md) (approvals, sequences, imports). Used by [M33](m33-shop-canteen.md) (sales) and [M36](m36-maintenance-helpdesk.md) (repairs).

## 3 · Tables

#### `inventory_categories` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation |
| kind | enum(stationery, cleaning, lab, sports, uniform, books, food, it_supplies, medical, other) | required |
| parent_id | uuid → inventory_categories | optional |

#### `inventory_items` · org

| Column | Type | Rules |
|---|---|---|
| sku | text | required; from the `inventory_item` sequence; unique per organisation |
| name | text | required |
| name_ur | text | optional |
| category_id | uuid → inventory_categories | required |
| unit | text | required; "pcs", "ream", "box", "kg", "litre" |
| barcode | text | optional; unique per organisation |
| variant_group | text | optional; groups sizes of one uniform |
| variant_label | text | optional; "Size 32" |
| reorder_level | numeric(12,3) | default 0 |
| reorder_quantity | numeric(12,3) | default 0 |
| average_cost | paisa | default 0; weighted average, maintained by movements |
| last_cost | paisa | default 0 |
| is_sellable | bool | default false; can be sold in the shop |
| is_active | bool | default true |

Index: trigram on `name`; (org_id, category_id).

#### `warehouses` · branch
A store room.

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per branch; "Main store", "Science lab", "Uniform shop" |
| kind | enum(main, lab, library, shop, canteen, sports, clinic, other) | default main |
| room_id | uuid → rooms | optional |
| keeper_staff_id | uuid → staff | optional |
| is_active | bool | default true |

#### `stock_levels` · branch
The quantity of an item in a store. Kept in step with movements inside the same transaction.

| Column | Type | Rules |
|---|---|---|
| warehouse_id | uuid → warehouses | required |
| item_id | uuid → inventory_items | required |
| quantity | numeric(12,3) | default 0; never below zero |
| value | paisa | default 0; the quantity at the item's average cost |

Unique: (warehouse_id, item_id).

#### `stock_movements` · branch append-only

| Column | Type | Rules |
|---|---|---|
| movement_no | text | required; from the `stock_movement` sequence |
| warehouse_id | uuid → warehouses | required |
| item_id | uuid → inventory_items | required |
| kind | enum(opening, receipt, issue, transfer_out, transfer_in, sale, sale_return, count_adjustment, write_off, return_to_vendor) | required |
| quantity | numeric(12,3) | required; signed: into the store is positive |
| unit_cost | paisa | required |
| value | paisa | required; `quantity × unit_cost` |
| balance_after | numeric(12,3) | required |
| moved_on | date | required |
| source_type | text | required; `goods_receipt`, `issue_request`, `stock_transfer`, `stock_count`, `shop_sale`, `manual` |
| source_id | uuid | optional |
| department_id | uuid → departments | optional; who consumed it |
| issued_to_staff_id | uuid → staff | optional |
| cost_center_id | uuid → cost_centers | optional |
| note | text | optional |

Unique: (source_type, source_id, item_id, kind) where `source_id` is set, so a source moves each item once.
Index: (org_id, warehouse_id, item_id, moved_on).

#### `stock_issue_requests` · branch

| Column | Type | Rules |
|---|---|---|
| request_no | text | required; from the `issue_request` sequence |
| requested_by_staff_id | uuid → staff | required |
| department_id | uuid → departments | optional |
| warehouse_id | uuid → warehouses | required |
| purpose | text | required |
| status | enum(pending, approved, issued, partly_issued, rejected, cancelled) | default pending |
| approval_request_id | uuid → approval_requests | optional |
| issued_at | timestamptz | optional |
| issued_by | uuid → profiles | optional |

#### `stock_issue_lines` · branch

| Column | Type | Rules |
|---|---|---|
| request_id | uuid → stock_issue_requests | required |
| item_id | uuid → inventory_items | required |
| quantity_requested | numeric(12,3) | required; > 0 |
| quantity_issued | numeric(12,3) | default 0; ≤ requested |

#### `stock_transfers` · org

| Column | Type | Rules |
|---|---|---|
| transfer_no | text | required; from the `stock_transfer` sequence |
| from_warehouse_id | uuid → warehouses | required |
| to_warehouse_id | uuid → warehouses | required; different from the source |
| sent_on | date | optional |
| received_on | date | optional |
| status | enum(draft, in_transit, received, cancelled) | default draft |
| lines | jsonb | required; `{ itemId, quantitySent, quantityReceived? }[]` |
| note | text | optional |

#### `stock_counts` · branch

| Column | Type | Rules |
|---|---|---|
| warehouse_id | uuid → warehouses | required |
| counted_on | date | required |
| status | enum(counting, review, posted, cancelled) | default counting |
| approval_request_id | uuid → approval_requests | optional |
| counted_by | uuid → profiles | required |

#### `stock_count_lines` · branch

| Column | Type | Rules |
|---|---|---|
| count_id | uuid → stock_counts | required |
| item_id | uuid → inventory_items | required |
| system_quantity | numeric(12,3) | required; frozen when counting starts |
| counted_quantity | numeric(12,3) | optional |
| reason | text | optional; required when they differ |

Unique: (count_id, item_id).

#### `asset_categories` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation; "Computers", "Furniture", "Vehicles" |
| depreciation_method | enum(none, straight_line, declining_balance) | default straight_line |
| useful_life_months | int | optional |
| declining_percent | numeric(5,2) | optional; a yearly rate |
| asset_account_id | uuid → accounts | optional; falls back to the mapping |

#### `assets` · branch

| Column | Type | Rules |
|---|---|---|
| asset_no | text | required; from the `asset` sequence; printed on its tag |
| name | text | required |
| category_id | uuid → asset_categories | required |
| description | text | optional |
| serial_no | text | optional |
| make_model | text | optional |
| purchased_on | date | optional |
| cost | paisa | default 0 |
| salvage_value | paisa | default 0 |
| vendor_id | uuid → vendors | optional |
| vendor_bill_id | uuid → vendor_bills | optional |
| room_id | uuid → rooms | optional |
| custodian_staff_id | uuid → staff | optional |
| condition | enum(new, good, fair, poor, unusable) | default good |
| status | enum(in_use, in_store, under_repair, disposed, lost) | default in_use |
| warranty_until | date | optional |
| depreciation_starts_on | date | optional |
| accumulated_depreciation | paisa | default 0 |
| book_value | paisa | generated: `cost - accumulated_depreciation` |
| disposed_on | date | optional |
| disposal_amount | paisa | optional |
| disposal_reason | text | optional |

Unique: (org_id, asset_no).
Index: (org_id, branch_id, status); (org_id, custodian_staff_id); (org_id, room_id).

#### `asset_assignments` · branch append-only
Where an asset has been and who held it.

| Column | Type | Rules |
|---|---|---|
| asset_id | uuid → assets | required |
| staff_id | uuid → staff | optional |
| room_id | uuid → rooms | optional |
| from_date | date | required |
| to_date | date | optional |
| condition_at_handover | text | optional |
| note | text | optional |

#### `asset_maintenance` · branch

| Column | Type | Rules |
|---|---|---|
| asset_id | uuid → assets | required |
| kind | enum(repair, service, inspection, upgrade) | required |
| done_on | date | required |
| description | text | required |
| cost | paisa | default 0 |
| vendor_id | uuid → vendors | optional |
| ticket_id | uuid → maintenance_tickets | optional |
| expense_id | uuid → expenses | optional |
| next_due_on | date | optional |

#### `depreciation_runs` · org

| Column | Type | Rules |
|---|---|---|
| fiscal_period_id | uuid → fiscal_periods | required; unique among posted runs |
| status | enum(draft, posted, reversed) | default draft |
| total | paisa | default 0 |
| lines | jsonb | default `[]`; `{ assetId, branchId, amount }[]` |
| posted_by | uuid → profiles | optional |

#### `asset_audits` · branch

| Column | Type | Rules |
|---|---|---|
| name | text | required |
| started_on | date | required |
| status | enum(open, review, closed) | default open |
| scans | jsonb | default `[]`; `{ assetId, roomId, condition, at, by }[]` |

## 4 · Contracts

`packages/contracts/src/modules/inventory/`: `inventory-items`, `warehouses`, `stock`, `stock-issues`, `stock-transfers`, `stock-counts`, `assets`, `asset-categories`, `depreciation`.

- `StockCard`: an item in a store — quantity, value, and its movements with a running balance.
- `StockOnHand`: items by store with quantity, value, and a "below reorder level" flag.
- `Reorder`: items at or below their reorder level with the suggested quantity; "raise a purchase request" from the list.
- `Consumption`: what each department or cost center used, by item and month.
- `AssetRegister`: assets with cost, accumulated depreciation, book value, location and custodian.
- `CustodianList`: everything a staff member holds.

One service owns stock: `packages/core/src/modules/inventory/stock.ts` — `stock.move(ctx, { warehouseId, itemId, kind, quantity, unitCost?, source })`. It locks the stock level row, refuses to go below zero, updates the weighted average cost on a receipt, writes the movement and the level, and posts to the ledger. Nothing else writes these tables.

The caller gives the quantity as a plain amount; the kind says which way it goes (a `count_adjustment` alone is signed: more found is positive). A movement out is costed at the item's average at that moment, whatever the caller passes. A movement in is costed at the price given, or at the average when none is. A source that has moved an item once is not moved again: the second call returns the first movement. The arithmetic (quantities to three decimals, value, the weighted average) is in `stock.rules.ts`.

**What a movement posts**, in the `INV` journal, dated the day it moved, in the store's branch:

| Kind | Entry |
|---|---|
| `issue` | Debit `inventory.consumed` (with the cost center, when given), credit `inventory.asset` |
| `write_off` | Debit `inventory.adjustment`, credit `inventory.asset` |
| `count_adjustment` | More found: debit `inventory.asset`, credit `inventory.adjustment`. Less found: the reverse |
| `receipt` | Debit `inventory.asset`, credit the account the caller names: what is owed to the vendor for goods received, `inventory.adjustment` for a donation. With no account named, nothing is posted |
| `return_to_vendor` | Debit the account the caller names, credit `inventory.asset`. With none named, nothing is posted |
| `opening` | Nothing: opening stock is part of the opening balances entry, with which it must agree (R-inventory-11) |
| `transfer_out`, `transfer_in` | Nothing: a transfer posts once, when it is received, from the transfer service |
| `sale`, `sale_return` | Nothing: the shop posts one entry for the whole sale, with its cost of sales |

A caller that posts an entry of its own for the whole operation passes `ledger: false`. A movement worth nothing (an item with no cost yet) posts nothing.

Settings: `inventory.allow_negative` (default false), `inventory.issue_approval` (default true), `inventory.count_approval_above` (default Rs 5,000 of difference), `assets.capitalise_above` (default Rs 25,000; a purchase line above this prompts "record as an asset"), `assets.depreciation_frequency` (`monthly` | `yearly`, default monthly).

## 5 · Rules

**Stock**

- **R-inventory-1** Every change in quantity is a movement. A level is never edited directly.
- **R-inventory-2** A movement out cannot take a store below zero. Two simultaneous issues are serialised by a lock on the level row.
- **R-inventory-3** Cost is weighted average per item across the organisation. A receipt recalculates it: (old quantity × old average + received quantity × its cost) ÷ new quantity. Every movement out uses the average at that moment.
- **R-inventory-4** A posted goods receipt ([M24](m24-expenses-procurement.md)) creates `receipt` movements at the order's price. Cancelling it reverses them only while the stock is still there.
- **R-inventory-5** A staff member requests items; the request is approved by their head (when `inventory.issue_approval`), then the store keeper issues what is available. Issuing creates `issue` movements, records the department, and posts consumption to the ledger. Part issue leaves the request `partly_issued`.
- **R-inventory-6** A transfer moves stock out of one store on sending and into the other on receipt. Between the two it is in transit and belongs to neither. A shortfall on receipt is written off with a reason. Between branches, the posting adds inter-branch lines.
- **R-inventory-7** A stock count freezes the system quantities when it starts and blocks other movements in that store for those items until it is posted or cancelled. Posting creates `count_adjustment` movements for the differences; a total difference above `inventory.count_approval_above` needs approval.
- **R-inventory-8** A write-off (damaged, expired) is a movement with a reason and approval.
- **R-inventory-9** An item with stock or movements cannot be deleted, and its unit cannot change.
- **R-inventory-10** Items at or below their reorder level are listed daily for the store keeper.
- **R-inventory-11** Opening stock is entered once per store as `opening` movements and must agree with the opening balance of the inventory account in [M23](m23-accounting.md).

**Assets**

- **R-inventory-12** An asset gets its number from the sequence and a QR tag. A bill line above `assets.capitalise_above` offers to create assets from it, one per unit.
- **R-inventory-13** Moving an asset or changing its custodian closes the current assignment and opens a new one. The staff member is told what they now hold.
- **R-inventory-14** A staff member cannot be cleared to leave while they are custodian of any asset ([R-staff-7](m26-staff-recruitment.md)).
- **R-inventory-15** Depreciation is calculated per period from each asset's category: straight line (cost − salvage) ÷ useful life in months; or declining balance on book value. It starts the month after `depreciation_starts_on`, stops at salvage value, and skips assets that are disposed or lost. The run is a draft for review; posting it writes one entry per branch and raises each asset's accumulated figure. One posted run per period.
- **R-inventory-16** Disposing of an asset records the date, amount and reason, needs approval, and posts the removal of cost and accumulated depreciation with the gain or loss.
- **R-inventory-17** An asset audit: scan tags room by room; at review it lists assets not found, and assets found in a different room from the record, which can be corrected in one step.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `inventory:read` | See items, stock and movements | store_keeper, FINANCE, LEADERS |
| `inventory-items:manage` | Maintain items, categories and stores | store_keeper, branch_admin |
| `stock:move` | Receive, issue, transfer and write off stock | store_keeper |
| `stock-issues:request` | Ask for items from a store | ALL_STAFF |
| `stock-counts:manage` | Run and post stock counts | store_keeper, accountant |
| `assets:read` | See the asset register | store_keeper, FINANCE, LEADERS, it_admin |
| `assets:manage` | Add, edit, move and assign assets; record maintenance | store_keeper, it_admin, branch_admin |
| `assets:dispose` | Dispose of an asset | finance_head, branch_admin |
| `depreciation:run` | Calculate and post depreciation | ACCOUNTS |
| `inventory:export` | Export inventory and asset reports | store_keeper, ACCOUNTS, LEADERS |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/inventory-categories` | `inventory:read` | Lists |
| POST | `/inventory-categories` | `inventory-items:manage` | Creates |
| GET | `/inventory-items` | `inventory:read` | Lists with stock on hand |
| POST | `/inventory-items` | `inventory-items:manage` | Creates |
| GET | `/inventory-items/[id]` | `inventory:read` | One item with levels by store |
| PATCH | `/inventory-items/[id]` | `inventory-items:manage` | Edits |
| POST | `/inventory-items/import` | `inventory-items:manage` | Imports items and opening stock |
| GET | `/warehouses` | `inventory:read` | Lists |
| POST | `/warehouses` | `inventory-items:manage` | Creates |
| PATCH | `/warehouses/[id]` | `inventory-items:manage` | Edits |
| GET | `/stock/on-hand` | `inventory:read` | Stock on hand |
| GET | `/stock/card` | `inventory:read` | The stock card of an item in a store |
| GET | `/stock/reorder` | `inventory:read` | Items to reorder |
| GET | `/stock/consumption` | `inventory:read` | Consumption by department |
| GET | `/stock-movements` | `inventory:read` | Lists |
| POST | `/stock/receive` | `stock:move` | Receives stock with no purchase order (donation, opening) |
| POST | `/stock/write-off` | `stock:move` | Writes off with a reason |
| GET | `/stock-issue-requests` | `stock-issues:request` | The requests I may see |
| POST | `/stock-issue-requests` | `stock-issues:request` | Requests items |
| POST | `/stock-issue-requests/[id]/issue` | `stock:move` | Issues what is available |
| POST | `/stock-issue-requests/[id]/cancel` | `stock-issues:request` | Cancels |
| GET | `/stock-transfers` | `inventory:read` | Lists |
| POST | `/stock-transfers` | `stock:move` | Creates a draft |
| POST | `/stock-transfers/[id]/send` | `stock:move` | Sends |
| POST | `/stock-transfers/[id]/receive` | `stock:move` | Receives, with quantities |
| GET | `/stock-counts` | `inventory:read` | Lists |
| POST | `/stock-counts` | `stock-counts:manage` | Starts a count for a store |
| PUT | `/stock-counts/[id]/lines` | `stock-counts:manage` | Saves counted quantities |
| POST | `/stock-counts/[id]/post` | `stock-counts:manage` | Posts the differences |
| GET | `/asset-categories` | `assets:read` | Lists |
| POST | `/asset-categories` | `assets:manage` | Creates |
| PATCH | `/asset-categories/[id]` | `assets:manage` | Edits |
| GET | `/assets` | `assets:read` | The register; filter by category, room, custodian, status |
| POST | `/assets` | `assets:manage` | Creates one or many |
| GET | `/assets/[id]` | `assets:read` | One asset with history |
| PATCH | `/assets/[id]` | `assets:manage` | Edits |
| GET | `/assets/by-tag/[assetNo]` | `assets:read` | Finds an asset from its scanned tag |
| POST | `/assets/[id]/move` | `assets:manage` | Changes room or custodian |
| POST | `/assets/[id]/maintenance` | `assets:manage` | Records maintenance |
| POST | `/assets/[id]/dispose` | `assets:dispose` | Disposes |
| POST | `/assets/tags` | `assets:manage` | Queues QR tags |
| GET | `/depreciation-runs` | `assets:read` | Lists |
| POST | `/depreciation-runs` | `depreciation:run` | Calculates a draft for a period |
| POST | `/depreciation-runs/[id]/post` | `depreciation:run` | Posts |
| GET | `/asset-audits` | `assets:read` | Lists |
| POST | `/asset-audits` | `assets:manage` | Starts |
| POST | `/asset-audits/[id]/scans` | `assets:manage` | Adds scans |
| POST | `/asset-audits/[id]/close` | `assets:manage` | Closes and applies corrections |
| GET | `/me/assets` | `signed-in` | Assets I am custodian of |
| GET | `/inventory/export` | `inventory:export` | Exports |

Idempotent: every `POST` that moves stock or posts: `/stock/receive`, `/stock/write-off`, `/stock-issue-requests/[id]/issue`, `/stock-transfers/[id]/send`, `/stock-transfers/[id]/receive`, `/stock-counts/[id]/post`, `/depreciation-runs/[id]/post`, `/assets/[id]/dispose`.

## 8 · Client layer

Custom hooks: `useStockOnHand`, `useStockCard`, `useReorderList`, `useIssueRequest`, `useIssueStock`, `useStockTransfer`, `useStockCount`, `useSaveCountLines` (autosave), `useAssets`, `useAssetByTag`, `useMoveAsset`, `useDepreciationRun`, `useAssetAudit`, `useMyAssets`.

## 9 · Screens

Built in [Phase 11](../20-phases/phase-11-front-office-and-operations.md).

| Screen | Pattern | Where |
|---|---|---|
| Stock on hand | List | `/school/inventory`: by store; quantity, value, reorder flag |
| Item | Detail | Levels by store; the stock card; purchase history |
| Issue requests | List + Form in a sheet | Request, approve, issue with quantities |
| Transfers | List + Form page | Send and receive |
| Stock count | Grid editor | Items down; system and counted quantities; differences highlighted; scan to jump to an item |
| Reorder | List | Raise a purchase request for the selected items |
| Consumption | Report | By department and month |
| Asset register | List + Detail | Tabs: Details, History, Maintenance, Depreciation |
| Add assets | Form page | Create several identical assets at once; print tags |
| Asset audit | Detail | Scan tags with a phone camera, room by room; found against expected |
| Depreciation | Detail | The draft run by category and branch; post |
| **Staff:** My items | List | Requests, and assets I hold |

## 10 · Notifications and jobs

Events: `stock.low` (daily digest to the store keeper), `stock.issue-requested`, `stock.issued` (to the requester), `stock.transfer-sent` (to the receiving keeper), `stock.count-difference` (to the accountant), `asset.assigned` (to the custodian), `asset.warranty-expiring`, `asset.maintenance-due`, `depreciation.ready` (a draft run is waiting).

Jobs: `inventory.reorder-digest` (daily 08:00), `inventory.asset-reminders` (daily), `inventory.depreciation-draft` (first day of each period), `inventory.integrity` (nightly: each level equals the sum of its movements; stock value equals `inventory.asset` in the ledger per branch; asset cost and accumulated depreciation agree with their accounts).

Documents: stock issue note, transfer note, stock count sheet, stock valuation report, asset tags, asset register, custodian handover form.

## 11 · Offline

A stock count and an asset audit can be scanned offline on a phone, through the `store.counts` stream, and uploaded when online: scans are always added and merged by item or asset.

## 12 · AI

Unusual activity: issues to one person far above the department's norm, repeated write-offs of the same item, count differences that always go one way (S5).

## 13 · Failure cases

- **F-inventory-1** Two store keepers issue the last 10 reams at once → the second is refused with the quantity left.
- **F-inventory-2** A transfer arrives 2 short → received with the shortfall written off and a reason; both branches' books stay balanced.
- **F-inventory-3** A count is in progress and someone tries to issue a counted item → refused until the count is posted or cancelled.
- **F-inventory-4** A goods receipt is cancelled after half the stock was issued → refused; return the remainder to the vendor instead.
- **F-inventory-5** The average cost would be computed with zero quantity (first receipt after stock-out) → the receipt's cost becomes the average.
- **F-inventory-6** A depreciation run is posted twice → the second is refused: the period already has a posted run.
- **F-inventory-7** An asset is scanned in a room other than its record → flagged; "move here" corrects it and writes the assignment history.
- **F-inventory-8** A custodian leaves the school → their assets appear in clearance; each must be handed to someone or returned to store.
- **F-inventory-9** The nightly check finds a level that differs from its movements → an integrity finding; the level is not changed automatically.
- **F-inventory-10** An item's unit is wrong after movements exist → it cannot be changed; deactivate the item and create a new one.

## 14 · Seed data

Ten categories and about 150 items, including uniform sizes as variants and book sets. Two or three stores per branch with stock; a dozen items below reorder level. Three months of movements from receipts, issues, two transfers (one in transit), one posted count with differences and one in progress, a write-off. Fifteen issue requests in every status. Eight asset categories and about 220 assets per large branch with tags, custodians, history, maintenance and warranties; depreciation posted to two months ago and a draft run for last month; four disposed assets; one closed audit.

## 15 · Tests

- **T-inventory-1** `stock.move`: every kind; never below zero; concurrent issues.
- **T-inventory-2** Weighted average through a sequence of receipts and issues, including from zero.
- **T-inventory-3** Each source moves an item once (idempotent).
- **T-inventory-4** Issue request flow: approval, part issue, department recorded.
- **T-inventory-5** Transfer: in transit belongs to neither store; shortfall; inter-branch posting balances.
- **T-inventory-6** Count: frozen quantities, movement block, adjustments, approval threshold.
- **T-inventory-7** Postings match the map in [M23](m23-accounting.md).
- **T-inventory-8** Assets: assignment history; clearance block.
- **T-inventory-9** Depreciation: both methods, start month, stop at salvage, skipped states, one posted run per period.
- **T-inventory-10** Disposal posts cost, accumulated depreciation and gain or loss.
- **T-inventory-11** The integrity job catches each planted difference.
- **T-inventory-12** Row-level security and branch scope.

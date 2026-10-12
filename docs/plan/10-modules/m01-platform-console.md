# M01 · Platform console (Super Admin)

## 1 · Purpose

The console Takhti's own staff use to create school groups, choose their plan and modules, bill them, support them and watch the health of the service. Schools never see it, except for three small things: their own subscription page, platform announcements, and approving a support session.

## 2 · Depends on

[M00](m00-shared-kernel.md), [M02](m02-organisation-branches.md), [M03](m03-identity-roles-audit.md).

## 3 · Tables

Platform tables have no automatic `org_id`; where one is needed it is an explicit column.

#### `plans` · global

| Column | Type | Rules |
|---|---|---|
| key | text | required; unique; `starter`, `standard`, `enterprise` |
| name | text | required |
| description | text | optional |
| price_per_student | paisa | required; per month |
| minimum_monthly | paisa | default 0 |
| max_students | int | optional; empty means unlimited |
| max_branches | int | optional |
| trial_days | int | default 14 |
| ai_monthly_budget | paisa | default 0 |
| sms_included | int | default 0; per month |
| is_public | bool | default true; shown on the pricing page |
| is_active | bool | default true |
| sort_order | int | default 0 |

#### `plan_modules` · global

| Column | Type | Rules |
|---|---|---|
| plan_id | uuid → plans | required |
| module_key | text | required; a key from the module list |

Unique: (plan_id, module_key).

#### `subscriptions` · platform

| Column | Type | Rules |
|---|---|---|
| org_id | uuid → orgs | required; one live subscription per organisation |
| plan_id | uuid → plans | required |
| status | enum(trial, active, past_due, suspended, cancelled) | required |
| billing_cycle | enum(monthly, yearly) | default monthly |
| price_per_student | paisa | required; copied from the plan when agreed, so a plan price change does not alter existing customers |
| discount_percent | numeric(5,2) | default 0 |
| started_on | date | required |
| trial_ends_on | date | optional |
| current_period_start | date | required |
| current_period_end | date | required |
| grace_days | int | default 10 |
| cancelled_on | date | optional |
| notes | text | optional |

Unique: (org_id) among live rows.

#### `subscription_invoices` · platform

| Column | Type | Rules |
|---|---|---|
| org_id | uuid → orgs | required |
| subscription_id | uuid → subscriptions | required |
| number | text | required; unique; `TK-{yyyy}-{00000}` |
| period_start | date | required |
| period_end | date | required |
| student_count | int | required; active students counted on the billing day |
| amount | paisa | required |
| discount | paisa | default 0 |
| tax | paisa | default 0 |
| total | paisa | required; `amount - discount + tax` |
| status | enum(draft, issued, paid, overdue, void) | required |
| issued_on | date | optional |
| due_on | date | optional |
| paid_on | date | optional |
| payment_method | enum(bank_transfer, cheque, cash, online) | optional |
| payment_reference | text | optional |
| file_id | uuid → files | optional; the invoice PDF |

Unique: (subscription_id, period_start).

#### `org_modules` · org
Which modules an organisation has. Staff read it; only platform services write it.

| Column | Type | Rules |
|---|---|---|
| module_key | text | required |
| is_enabled | bool | required |
| source | enum(plan, override) | required |
| note | text | optional |

Policy: staff of the organisation may read; no write policy.
Unique: (org_id, module_key).

#### `platform_admins` · platform

| Column | Type | Rules |
|---|---|---|
| user_id | uuid → profiles | required; unique |
| role | enum(super_admin, support_agent) | required |
| is_active | bool | default true |
| mfa_enrolled_at | timestamptz | optional; access is refused while empty |

#### `platform_audit_log` · platform append-only

| Column | Type | Rules |
|---|---|---|
| admin_user_id | uuid → profiles | required |
| action | text | required |
| target_org_id | uuid → orgs | optional |
| entity_type | text | optional |
| entity_id | uuid | optional |
| detail | jsonb | default `{}` |
| ip | text | optional |
| request_id | text | required |

#### `support_sessions` · platform
Time-boxed access by Takhti staff to one organisation.

| Column | Type | Rules |
|---|---|---|
| org_id | uuid → orgs | required |
| admin_user_id | uuid → profiles | required |
| reason | text | required; at least 10 characters |
| access | enum(read, write) | default read |
| status | enum(requested, active, ended, expired, denied) | required |
| approved_by | uuid → profiles | optional; the organisation's owner, required for write access |
| starts_at | timestamptz | optional |
| ends_at | timestamptz | optional; at most 60 minutes after start |

#### `feature_flags` · platform

| Column | Type | Rules |
|---|---|---|
| key | text | required; unique |
| description | text | required |
| default_enabled | bool | default false |
| enabled_org_ids | uuid[] | default empty |
| disabled_org_ids | uuid[] | default empty |

#### `platform_announcements` · global

| Column | Type | Rules |
|---|---|---|
| title | text | required |
| body | text | required |
| audience | enum(everyone, owners, staff) | default staff |
| severity | enum(info, warning, critical) | default info |
| starts_at | timestamptz | required |
| ends_at | timestamptz | required; after `starts_at` |

#### `usage_daily` · platform

| Column | Type | Rules |
|---|---|---|
| org_id | uuid → orgs | required |
| usage_date | date | required |
| active_students | int | default 0 |
| active_users | int | default 0 |
| sms_sent | int | default 0 |
| whatsapp_sent | int | default 0 |
| storage_bytes | bigint | default 0 |
| ai_cost | paisa | default 0 |
| api_requests | int | default 0 |

Unique: (org_id, usage_date).

#### `demo_requests` · platform
Enquiries from the marketing site.

| Column | Type | Rules |
|---|---|---|
| school_name | text | required |
| contact_name | text | required |
| phone | text | required |
| email | text | optional |
| city | text | optional |
| student_band | enum(under_200, 200_500, 500_1000, 1000_3000, over_3000) | optional |
| message | text | optional |
| source | text | optional; campaign or referrer |
| status | enum(new, contacted, demo_booked, won, lost) | default new |
| assigned_to | uuid → profiles | optional |
| notes | text | optional |

#### `platform_settings` · platform

| Column | Type | Rules |
|---|---|---|
| key | text | required; unique |
| value | jsonb | required |

## 4 · Contracts

`packages/contracts/src/modules/platform/`: `plans`, `subscriptions`, `subscription-invoices`, `platform-orgs`, `platform-admins`, `support-sessions`, `feature-flags`, `platform-announcements`, `demo-requests`, `platform-metrics`.

- `ProvisionOrg`: `{ name, slug, city, province, planKey, owner: { fullName, email, phone }, firstBranch: { name, code }, academicYearStartMonth }`.
- `RecordInvoicePayment`: `{ paidOn, method, reference }`.
- `RequestSupportSession`: `{ orgId, reason, access }`.

## 5 · Rules

- **R-platform-1** Provisioning an organisation is one transaction that creates: the organisation, its first branch, the 30 non-platform built-in roles with default permissions, default settings, the subscription in `trial`, `org_modules` from the plan, default grading schemes, fee heads, the chart of accounts (with its journals, account mappings and current fiscal year, see [M23](m23-accounting.md)), notification templates and number sequences, and an invitation for the owner. If any part fails, nothing exists.
- **R-platform-2** A slug is lower-case letters, digits and hyphens, 3 to 40 characters, unique, and not a reserved word (`api`, `platform`, `hq`, `school`, `teach`, `family`, `learn`, `s`, `www`, `admin`, `app`).
- **R-platform-3** Subscription states: `trial → active → past_due → suspended → cancelled`; `past_due → active` on payment; `suspended → active` on payment or by a super admin.
- **R-platform-4** On the billing day an invoice is created for the next period: active students (at least 1) × price, less discount, not below the plan's minimum.
- **R-platform-5** An unpaid invoice past its due date makes the subscription `past_due`. After `grace_days` more it becomes `suspended`.
- **R-platform-6** A **suspended** organisation is read-only: every write is refused with "Your subscription is suspended. Contact Takhti to restore access." The owner can still open the subscription page, download invoices and export data.
- **R-platform-7** A trial that ends without a plan being chosen becomes `suspended`, not deleted.
- **R-platform-8** Enabled modules are the plan's modules plus overrides. Changing a plan re-derives them; an override survives a plan change.
- **R-platform-9** When active students exceed the plan's `max_students`, nothing breaks; the owner and Takhti staff are told, and new admissions show a notice.
- **R-platform-10** A support session with read access starts at once and is shown to the organisation's owner. Write access starts only after the owner approves it. Every session ends after at most 60 minutes.
- **R-platform-11** Everything done inside a support session is written to both audit logs, marked with the session id. A support agent cannot see identity numbers, medical notes or counselling notes unmasked.
- **R-platform-12** A platform admin without two-factor enrolled can do nothing except enrol.
- **R-platform-13** Closing an organisation exports its data, sets it `closed`, and schedules deletion 60 days later. A super admin can cancel the deletion within that time.
- **R-platform-14** An invoice that is `paid` cannot be edited or voided; a correction is a new invoice or a credit recorded in notes.

## 6 · Permissions

Platform routes use the access cell `platform` and check the admin's role in the service: `super_admin` may do everything; `support_agent` may read organisations, usage and invoices, manage demo requests and open support sessions, but cannot create or close organisations, change plans or prices, or manage admins.

Permissions for schools:

| Permission | Allows | Default roles |
|---|---|---|
| `subscription:read` | See the organisation's plan, usage and invoices | finance_head, director |
| `support-sessions:update` | Approve, deny or end a support session | director |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/platform/metrics` | `platform` | Totals: organisations, students, revenue, queue health |
| GET | `/platform/orgs` | `platform` | Lists organisations with plan, status, student count |
| POST | `/platform/orgs` | `platform` | Provisions an organisation |
| GET | `/platform/orgs/[id]` | `platform` | One organisation with usage |
| PATCH | `/platform/orgs/[id]` | `platform` | Changes name, slug, contact details |
| POST | `/platform/orgs/[id]/suspend` | `platform` | Suspends with a reason |
| POST | `/platform/orgs/[id]/reactivate` | `platform` | Reactivates |
| POST | `/platform/orgs/[id]/close` | `platform` | Starts closing |
| GET | `/platform/orgs/[id]/modules` | `platform` | Enabled modules and their source |
| PUT | `/platform/orgs/[id]/modules` | `platform` | Sets overrides |
| POST | `/platform/orgs/[id]/resend-owner-invite` | `platform` | Sends the owner's invitation again |
| GET | `/platform/plans` | `platform` | Lists plans |
| POST | `/platform/plans` | `platform` | Creates a plan |
| PATCH | `/platform/plans/[id]` | `platform` | Changes a plan |
| PUT | `/platform/plans/[id]/modules` | `platform` | Sets the plan's modules |
| GET | `/platform/subscriptions` | `platform` | Lists subscriptions |
| PATCH | `/platform/subscriptions/[id]` | `platform` | Changes plan, price, discount, dates |
| GET | `/platform/invoices` | `platform` | Lists invoices |
| POST | `/platform/invoices/[id]/issue` | `platform` | Issues a draft invoice |
| POST | `/platform/invoices/[id]/record-payment` | `platform` | Marks paid |
| POST | `/platform/invoices/[id]/void` | `platform` | Voids an unpaid invoice |
| GET | `/platform/admins` | `platform` | Lists platform staff |
| POST | `/platform/admins` | `platform` | Adds a platform admin |
| PATCH | `/platform/admins/[id]` | `platform` | Changes role or deactivates |
| GET | `/platform/audit-log` | `platform` | Platform audit log |
| GET | `/platform/support-sessions` | `platform` | Lists sessions |
| POST | `/platform/support-sessions` | `platform` | Requests a session |
| POST | `/platform/support-sessions/[id]/end` | `platform` | Ends one's own session |
| GET | `/platform/feature-flags` | `platform` | Lists flags |
| PATCH | `/platform/feature-flags/[id]` | `platform` | Changes a flag |
| GET | `/platform/announcements` | `platform` | Lists announcements |
| POST | `/platform/announcements` | `platform` | Creates |
| PATCH | `/platform/announcements/[id]` | `platform` | Changes |
| DELETE | `/platform/announcements/[id]` | `platform` | Removes |
| GET | `/platform/usage` | `platform` | Usage per organisation over time |
| GET | `/platform/jobs` | `platform` | Job queue across organisations |
| GET | `/platform/demo-requests` | `platform` | Lists demo requests |
| PATCH | `/platform/demo-requests/[id]` | `platform` | Updates status, assignee, notes |
| GET | `/platform/settings` | `platform` | Reads platform settings |
| PUT | `/platform/settings/[key]` | `platform` | Writes one setting |
| POST | `/demo-requests` | `public` | The marketing site's "book a demo" form |
| GET | `/plans/public` | `public` | Plans for the pricing page |
| GET | `/announcements` | `signed-in` | Announcements currently active for the user |
| GET | `/subscription` | `subscription:read` | The organisation's own plan, period and usage |
| GET | `/subscription/invoices` | `subscription:read` | Its invoices |
| GET | `/support-sessions` | `support-sessions:update` | Sessions on this organisation |
| POST | `/support-sessions/[id]/approve` | `support-sessions:update` | Grants write access |
| POST | `/support-sessions/[id]/deny` | `support-sessions:update` | Denies |
| POST | `/support-sessions/[id]/end` | `support-sessions:update` | Ends it now |

Idempotent: `POST /platform/orgs`, `POST /platform/invoices/[id]/record-payment`.

## 8 · Client layer

`platformOrgsApi`, `plansApi`, `subscriptionsApi`, `platformInvoicesApi`, `platformAdminsApi`, `supportSessionsApi`, `featureFlagsApi`, `platformAnnouncementsApi`, `demoRequestsApi`, `platformMetricsApi`, `subscriptionApi` (school side). Hooks follow the generated pattern, plus `useProvisionOrg`, `useSuspendOrg`, `useRecordInvoicePayment`, `useRequestSupportSession`, `useActiveAnnouncements`.

## 9 · Screens

Shell `/platform` unless stated. Built in [Phase 6](../20-phases/phase-06-platform-console.md).

| Screen | Pattern | Notes |
|---|---|---|
| Overview | Dashboard | Organisations by status, students, revenue this month, overdue invoices, failed jobs, sign-ups from demo requests |
| Organisations | List | Filters: status, plan, city |
| New organisation | Wizard | School, plan, owner, first branch, review |
| Organisation | Detail | Tabs: Summary, Modules, Subscription, Invoices, Usage, Support sessions, Audit |
| Plans | List + Form page | Module tick-list per plan |
| Invoices | List | Record payment dialog |
| Demo requests | Board | Columns by status |
| Platform staff | List | Add, change role, deactivate |
| Audit log | List | The layout of the audit-log reference screen |
| Feature flags | List | |
| Announcements | List + Dialog form | |
| Jobs | List | Across organisations |
| Settings | Settings | Billing day, grace days, invoice numbering, support address |
| **School side:** Subscription | Detail | `/school/settings/subscription` or `/hq/subscription`: plan, period, students billed, invoices |
| **School side:** Support access | List | Approve, deny, end |
| **School side:** Announcement banner | Banner in every shell | Dismissible unless critical |

## 10 · Notifications and jobs

Events: `org.provisioned`, `subscription.trial-ending` (7 and 1 days before), `subscription.invoice-issued`, `subscription.invoice-overdue`, `subscription.suspended`, `subscription.reactivated`, `support-session.started`, `support-session.write-requested`, `plan.limit-exceeded`.

Jobs: `platform.billing` (daily: create invoices, mark overdue, suspend after grace, end trials), `platform.usage-rollup` (nightly), `platform.expire-support-sessions` (every 5 minutes), `platform.close-org` (export, then delete after 60 days).

## 11 · Offline

None.

## 12 · AI

Cost per feature and per organisation is shown on the Usage tab. The model used by each AI feature is chosen in platform settings.

## 13 · Failure cases

- **F-platform-1** Provisioning fails at the owner invitation → the whole transaction rolls back; no half-made organisation.
- **F-platform-2** The owner's email bounces → the organisation exists with a pending invitation; "Resend owner invite" lets staff correct the address.
- **F-platform-3** Two staff provision the same slug at once → the second gets `CONFLICT` on the slug.
- **F-platform-4** A payment is recorded twice → the idempotency key returns the first result.
- **F-platform-5** A support session's time runs out mid-action → the next request is refused with "Support session ended".
- **F-platform-6** A suspended organisation's parent tries to pay a fee online → reads work, the payment page explains the school's service is paused; no data is lost.
- **F-platform-7** The billing job runs twice on the same day → the unique index on `(subscription_id, period_start)` prevents a second invoice.
- **F-platform-8** A module is switched off while staff are using it → their next request in that module gets `FORBIDDEN` with the module message; data is untouched.

## 14 · Seed data

Three plans (Starter, Standard, Enterprise) with module lists; two platform admins; the demo organisation on Standard in `active`; one issued and one paid invoice; four demo requests in different states; one active announcement.

## 15 · Tests

- **T-platform-1** Provisioning creates every listed part; a forced failure late in the service leaves nothing.
- **T-platform-2** Slug rules and reserved words.
- **T-platform-3** Billing: invoice amount with discount and minimum; no second invoice for the same period.
- **T-platform-4** Overdue → past due → suspended after grace; payment restores `active`.
- **T-platform-5** A suspended organisation refuses writes and allows reads, exports and the subscription page.
- **T-platform-6** Module derivation from plan plus overrides; `assertModule` refuses a disabled module.
- **T-platform-7** Support session: read starts at once; write needs owner approval; expiry; double audit entries; sensitive fields masked.
- **T-platform-8** A support agent cannot provision, change prices or manage admins.
- **T-platform-9** A platform admin without two-factor is refused.
- **T-platform-10** School users cannot reach any `/platform` route.

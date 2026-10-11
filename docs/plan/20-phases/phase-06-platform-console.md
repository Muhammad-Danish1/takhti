# Phase 6 · Platform console

**Goal.** Takhti's own staff can create a school group, give it a plan and modules, invite its owner, watch usage, and support it — and the new owner can sign in and walk the setup checklist. This is the first complete portal and the first proof that screens are quick to assemble.

**Depends on.** [Phase 5](phase-05-auth.md).

**Portal.** `/platform`, and the first screen a new owner sees.

**Modules.** [M01](../10-modules/m01-platform-console.md); from [M02](../10-modules/m02-organisation-branches.md) the setup checklist; from [M00](../10-modules/m00-shared-kernel.md) the jobs screen.

## Read first

[M01](../10-modules/m01-platform-console.md) in full; [06](../00-foundation/06-tenancy-roles-and-access.md) ("Takhti staff"); [building a screen](../30-reference/building-a-screen.md).

## Decision to take in this phase

**Plans and prices** ([02](../00-foundation/02-decisions-and-stack.md), open decision). The seed carries three sample plans (Starter, Standard, Enterprise) with sample per-student prices and module lists. Before this phase closes, the product owner confirms the real plans, prices, the minimum monthly charge, the trial length and which modules each plan includes. They are data in the `plans` and `plan_modules` tables, so confirming them is editing rows, not code.

## Screens, in build order

| # | Screen | Path | Pattern | Notes |
|---|---|---|---|---|
| 1 | Overview | `/platform` | Dashboard | Organisations by status, students billed, trials ending, invoices overdue, failed jobs, message and AI spend |
| 2 | Organisations | `/platform/orgs` | List | Search by name, slug, city; filter by status and plan |
| 3 | New organisation | `/platform/orgs/new` | Wizard | Details, plan and modules, first branch, the owner's name and contact; one commit creates the organisation, its roles and settings from defaults, the branch, the subscription, and the owner's invitation |
| 4 | Organisation | `/platform/orgs/[id]` | Detail | Tabs: Overview, Subscription, Modules, Usage, Support, Activity. Actions: suspend, reactivate, close, resend the owner's invitation |
| 5 | Plans | `/platform/plans` | List + Form page | Price per student, minimum, trial days, modules, AI budget |
| 6 | Subscriptions | `/platform/subscriptions` | List | Renewal dates; change plan |
| 7 | Invoices | `/platform/invoices` | List | Issue, record payment, void |
| 8 | Demo requests | `/platform/demo-requests` | Board | New, contacted, demo given, won, lost; convert to an organisation |
| 9 | Support sessions | `/platform/support-sessions` | List | Start a time-boxed session with a reason; end it |
| 10 | Announcements | `/platform/announcements` | List + Dialog form | Shown as a banner in every school's shell |
| 11 | Feature flags | `/platform/feature-flags` | List | Per organisation or for all |
| 12 | Usage and metrics | `/platform/usage`, `/platform/metrics` | Report | Active users, students, storage, messages, AI cost by organisation and feature |
| 13 | Jobs | `/platform/jobs` | List | Every organisation's queue; retry, cancel |
| 14 | Audit log | `/platform/audit-log` | List | Every platform action |
| 15 | Platform staff | `/platform/admins` | List | Invite, suspend; two-factor status |
| 16 | Settings | `/platform/settings` | Settings | Defaults for new organisations; model per AI feature; provider prices |
| 17 | **School side:** Subscription | `/school/settings/subscription`, `/hq/subscription` | Detail | Plan, students billed, invoices, modules |
| 18 | **School side:** Support access | inside Subscription | List | Sessions Takhti staff opened, with reasons; grant or refuse write access |
| 19 | **School side:** Announcement banner | every shell | Banner | Dismissible per user |
| 20 | **School side:** Setup checklist | `/school` for a new organisation | Dashboard | The onboarding tasks of [M02](../10-modules/m02-organisation-branches.md), each linking to where it is done (most of those pages arrive in [Phase 7](phase-07-school-setup-and-people.md); until then the task shows "coming next") |

## Work packages

- [ ] **6.1** Shell: `/platform` navigation from the [navigation map](../30-reference/navigation.md); the environment ribbon; a red "Support session active" bar while one is open.
- [ ] **6.2** Screens 1 to 4: the organisation lifecycle.
- [ ] **6.3** Screens 5 to 8: plans, subscriptions, invoices, demo requests.
- [ ] **6.4** Screens 9 to 16: support, announcements, flags, usage, jobs, audit, staff, settings.
- [ ] **6.5** Screens 17 to 20: the school side.
- [ ] **6.6** Browser tests and the role matrix for `super_admin` and `support_agent`.

## Journeys to automate

| Journey | Steps |
|---|---|
| Create a school | Platform admin signs in with two-factor → New organisation → the invitation appears in the mail catcher → the owner accepts, sets a password, sets up two-factor → lands on the setup checklist |
| Suspend and reactivate | Suspend with a reason → the owner sees `/blocked` → reactivate → the owner is back |
| Switch a module off | Turn Transport off for an organisation → its menu item disappears for that school and its routes return "not part of your plan"; data is untouched; turn it on again |
| Support session | A support agent opens a 60-minute read-only session with a reason → sees the school as its owner would, cannot save → the owner sees the session listed → it ends by itself |
| Trial ends | With the clock moved forward, the billing job marks the trial ended; the owner sees the notice and the subscription page |
| Isolation | A platform admin's token cannot call a school route without an open support session |

## Exit checks

1. Every screen meets "Done when" in [building a screen](../30-reference/building-a-screen.md).
2. The six journeys pass in the browser.
3. Every platform write appears in `platform_audit_log`; a test walks each platform route and checks it.
4. A brand-new organisation created through the wizard passes the generated security tests with zero rows visible to the seeded school, and the reverse.
5. Plans and prices are confirmed by the product owner and recorded in `plans`.
6. `pnpm check`, `pnpm test:db`, `pnpm test:e2e`.

## Left for later, on purpose

- Collecting subscription payments online: invoices are recorded by hand until [Phase 18](phase-18-integrations.md).
- The public demo-request form on the marketing site: [Phase 22](phase-22-marketing-site.md). Until then demo requests are entered by staff.

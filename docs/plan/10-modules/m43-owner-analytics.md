# M43 · Owner analytics

## 1 · Purpose

The view from head office. An owner with several campuses wants to know, in a minute: which branch is doing well and which is slipping, against its own target and against the others; what changed this week; and what needs a decision. This module is the `/hq` portal's brain: branch comparison, targets, alerts and a weekly digest.

It adds almost no data of its own. It reads the KPIs and reports of [M42](m42-dashboards-reports.md) across branches.

## 2 · Depends on

[M42](m42-dashboards-reports.md) (KPIs, snapshots, analysis), [M02](m02-organisation-branches.md) (branches), [M23](m23-accounting.md) (consolidated statements), [M37](m37-messaging-hub.md) (delivery), [M00](m00-shared-kernel.md) (approvals inbox, integrity findings).

## 3 · Tables

#### `branch_targets` · org

| Column | Type | Rules |
|---|---|---|
| branch_id | uuid → branches | required |
| kpi_key | text | required; a KPI from the catalogue |
| period_kind | enum(month, term, year) | required |
| period_start | date | required; the first day of the period |
| target | numeric(18,4) | required |
| note | text | optional |
| set_by | uuid → profiles | required |

Unique: (branch_id, kpi_key, period_kind, period_start).

#### `alert_rules` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required |
| kpi_key | text | required |
| condition | enum(below, above, drops_by_percent, rises_by_percent, below_target_by_percent) | required |
| threshold | numeric(18,4) | required |
| compare_window_days | int | default 7; for the change conditions: this window against the one before |
| branch_ids | uuid[] | default empty; empty means every branch |
| severity | enum(info, warning, critical) | default warning |
| recipient_role_keys | text[] | required |
| cooldown_days | int | default 7; the same rule does not fire again for the same branch within this time |
| is_active | bool | default true |
| is_system | bool | default false; a seeded rule that can be switched off but not deleted |

#### `alerts` · org

| Column | Type | Rules |
|---|---|---|
| rule_id | uuid → alert_rules | required |
| branch_id | uuid → branches | optional; empty for a group-level alert |
| kpi_key | text | required |
| raised_on | date | required |
| value | numeric(18,4) | required |
| compared_to | numeric(18,4) | optional; the target or the earlier figure |
| severity | enum(info, warning, critical) | required |
| message | text | required; written from a template, in plain words |
| status | enum(open, acknowledged, resolved, dismissed) | default open |
| acknowledged_by | uuid → profiles | optional |
| acknowledged_at | timestamptz | optional |
| note | text | optional |
| resolved_on | date | optional; set by the system when the condition clears, or by a person |

Unique: (rule_id, branch_id, raised_on).
Index: (org_id, status, severity).

#### `executive_digests` · org
The weekly summary as it was sent.

| Column | Type | Rules |
|---|---|---|
| week_start | date | required; a Monday; unique per organisation |
| content | jsonb | required; the figures, movements, alerts and decisions waiting |
| narrative | text | optional; a short written summary |
| narrative_source | enum(none, template, ai) | default template |
| sent_at | timestamptz | optional |
| recipient_user_ids | uuid[] | default empty |

#### `hq_notes` · org
A note the owner leaves on a branch or a figure, for themselves and the leadership.

| Column | Type | Rules |
|---|---|---|
| branch_id | uuid → branches | optional |
| kpi_key | text | optional |
| note_date | date | required |
| body | text | required |
| author_id | uuid → profiles | required |
| is_shared_with_branch | bool | default false; the branch's principal can read it |

## 4 · Contracts

`packages/contracts/src/modules/hq/`: `branch-targets`, `alert-rules`, `alerts`, `hq-overview`, `executive-digests`.

- `GroupOverview`: for the chosen period — each headline KPI for the whole group with its change, and a row per branch with the figure, its target, the gap, a small trend and a status (on track, watch, behind).
- `BranchScorecard`: one branch — every KPI against target and against the group average, its rank among branches, open alerts, approvals waiting, integrity findings, recent notes.
- `BranchComparison`: `{ kpiKeys[], period }` → branches as columns, KPIs as rows, with the best and worst marked; per-student versions for money figures so that campuses of different sizes compare fairly.
- `Movements`: what changed most this week or month, up and down, by branch and KPI.
- `DecisionsWaiting`: approvals addressed to the owner or director across branches, grouped by kind, with amounts and age.
- `Forecast`: expected fee collection for the next 90 days by week and branch (S4), with the range it is likely to fall in.
- `Benchmarks`: fee per student, cost per student, staff per student, teacher load, seats filled, by branch.

Status is worked out by rule: on track at or above 95% of target (or at or below 105% for a KPI that should go down), watch between 85% and 95%, behind below that. The thresholds are settings: `hq.on_track_percent`, `hq.watch_percent`.

Other settings: `hq.digest_day` (default Monday), `hq.digest_time` (default 08:00), `hq.digest_roles` (default owner, director, finance_head, academic_head), `hq.compare_per_student` (default true).

## 5 · Rules

- **R-hq-1** Everything in this module respects the person's branch access. A director assigned to three of five branches sees group totals for those three, labelled as such.
- **R-hq-2** A group figure is combined from branch figures by the KPI's own rule: a sum for counts and money; numerator over denominator for rates. Percentages are never averaged.
- **R-hq-3** A target is set per branch, KPI and period. A yearly target can be spread across months evenly or in last year's pattern; the spread is saved as monthly targets and can then be edited.
- **R-hq-4** Targets for the year are locked when the year starts unless the setter holds `targets:manage`; a change afterwards keeps the old value in the audit log.
- **R-hq-5** Alert rules are evaluated nightly after the snapshots. A rule fires for a branch when its condition holds and it has not fired for that branch within its cooldown. The alert's message states the figure, what it is compared with and the size of the gap in plain words.
- **R-hq-6** An alert resolves by itself on the first night its condition no longer holds. A person can acknowledge it with a note (it stays visible until resolved) or dismiss it with a reason.
- **R-hq-7** Critical alerts are sent at once to the rule's recipients; others are collected into the daily and weekly digests.
- **R-hq-8** The weekly digest is built by a job for each recipient with their own branch access, stored once per organisation for the full view, and sent as a link that needs sign-in plus a short summary. The summary contains no student or staff names.
- **R-hq-9** The digest's narrative is written from a template by default. When AI is enabled it may be written by a model from the digest's own figures only, and is marked as such.
- **R-hq-10** Comparisons between branches of different sizes show per-student figures beside totals when `hq.compare_per_student` is on.
- **R-hq-11** Every figure on an `/hq` screen can be opened down to the branch's own report in [M42](m42-dashboards-reports.md), where the usual permissions apply.
- **R-hq-12** A note shared with a branch is visible to that branch's principal; an unshared note is visible to head office roles only.
- **R-hq-13** The forecast is arithmetic over open vouchers and each family's past payment timing; it is shown as a range, labelled an estimate, and never used by any other calculation.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `hq:read` | Open the head office portal: overview, scorecards, comparison, movements | director, finance_head, academic_head, auditor |
| `targets:manage` | Set and change branch targets | director |
| `alert-rules:manage` | Create and change alert rules | director, finance_head |
| `alerts:handle` | Acknowledge and dismiss alerts | director, finance_head, academic_head, principal |
| `hq-notes:write` | Write head office notes | director, finance_head, academic_head |
| `hq:export` | Export head office views | director, finance_head, auditor |

A principal sees their own branch's scorecard, targets and alerts through `/school`, without `hq:read`.

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/hq/overview` | `hq:read` | The group overview for a period |
| GET | `/hq/branches/[id]/scorecard` | `hq:read` | A branch scorecard |
| GET | `/hq/comparison` | `hq:read` | Branch comparison for chosen KPIs |
| GET | `/hq/movements` | `hq:read` | Biggest changes |
| GET | `/hq/decisions` | `hq:read` | Approvals waiting for me across branches |
| GET | `/hq/forecast` | `hq:read` | The collection forecast |
| GET | `/hq/benchmarks` | `hq:read` | Per-student and per-teacher figures by branch |
| GET | `/branch-targets` | `hq:read` | Targets for a period |
| PUT | `/branch-targets` | `targets:manage` | Saves targets, optionally spreading a yearly figure |
| GET | `/alert-rules` | `hq:read` | Lists |
| POST | `/alert-rules` | `alert-rules:manage` | Creates |
| PATCH | `/alert-rules/[id]` | `alert-rules:manage` | Edits, switches on or off |
| DELETE | `/alert-rules/[id]` | `alert-rules:manage` | Deletes one that is not a system rule |
| POST | `/alert-rules/[id]/test` | `alert-rules:manage` | Shows which branches it would fire for today |
| GET | `/alerts` | `alerts:handle` | Lists; open first |
| POST | `/alerts/[id]/acknowledge` | `alerts:handle` | Acknowledges with a note |
| POST | `/alerts/[id]/dismiss` | `alerts:handle` | Dismisses with a reason |
| GET | `/executive-digests` | `hq:read` | Past digests |
| GET | `/executive-digests/[id]` | `hq:read` | One digest, cut to my branches |
| GET | `/hq-notes` | `hq:read` | Notes for a branch or KPI |
| POST | `/hq-notes` | `hq-notes:write` | Writes a note |
| GET | `/branch/scorecard` | `signed-in` | A principal's own branch scorecard, targets and alerts |
| GET | `/hq/export` | `hq:export` | Exports a view |

## 8 · Client layer

Custom hooks: `useGroupOverview(period)`, `useBranchScorecard(branchId)`, `useBranchComparison`, `useMovements`, `useDecisionsWaiting`, `useForecast`, `useBranchTargets`, `useSaveTargets`, `useAlertRules`, `useTestAlertRule`, `useAlerts`, `useAcknowledgeAlert`, `useDigests`, `useHqNotes`. A branch switcher in the `/hq` shell sets "all my branches" or a subset for every hook.

## 9 · Screens

Built in [Phase 15](../20-phases/phase-15-head-office-and-reports.md).

| Screen | Pattern | Where |
|---|---|---|
| **Group overview** | Dashboard | `/hq`: headline figures for the group with change; a table of branches with status chips, target gaps and small trend lines; alerts and decisions waiting on the right |
| Branch scorecard | Dashboard | Every KPI against target and group average, as bullet bars with labels; rank; alerts; notes |
| Compare branches | Grid | KPIs down, branches across; best and worst marked with a label as well as colour; totals and per-student toggle |
| Movements | List | What rose and fell most, each with the figures and a link down |
| Decisions | List | Approvals across branches; approve or reject in a side sheet |
| Finance | Report | Consolidated income statement and balance sheet with branches as columns ([M23](m23-accounting.md)) |
| Forecast | Report | Expected collection by week as a band with the likely range; by branch |
| Targets | Grid editor | Branches across, KPIs down; spread a yearly figure |
| Alerts and rules | List + Form in a sheet | Open alerts; rules with a "test" result |
| Digests | List + Detail | Past weekly digests |

## 10 · Notifications and jobs

Events: `hq.alert-critical` (at once), `hq.alert-digest` (daily, the day's new alerts), `hq.weekly-digest`, `hq.target-missed` (at period end, to the branch's principal and the director), `hq.note-shared` (to the principal).

Jobs: `hq.evaluate-alerts` (daily 00:30, after snapshots), `hq.resolve-alerts` (with it), `hq.weekly-digest` (on `hq.digest_day` at `hq.digest_time`), `hq.period-end` (first day of each month and term: target outcomes).

Documents: branch scorecard, branch comparison, weekly digest as a PDF.

## 11 · Offline

The overview and scorecards keep their last loaded figures with "as of" times. Nothing is written offline.

## 12 · AI

- The weekly narrative: three or four sentences on what changed, from the digest's figures (A9). No names of children or staff are in its input.
- "Why did this change?": for a KPI that moved, the assistant runs a few analysis requests (by grade, by fee head, by week) and reports which split explains most of the movement, showing the requests it used.
- Cash-flow forecast (S4), students at risk by branch as counts (S1), unusual activity across branches (S5).

## 13 · Failure cases

- **F-hq-1** A new branch has no history → its trends are blank, its status is "new" for its first 60 days, and change-based rules skip it.
- **F-hq-2** A branch has no target for a KPI → it shows the figure with "no target"; target-based rules skip it.
- **F-hq-3** A director with three branches opens a digest → figures and alerts for those three only, labelled "3 of 5 branches".
- **F-hq-4** The snapshot for a branch is missing for last night → its figures show "as of" the last good date; alert rules skip it for that night and a system alert is raised.
- **F-hq-5** A rule would fire every night while a problem persists → the cooldown holds it; the open alert stays visible with its age.
- **F-hq-6** A KPI's definition changes between versions → snapshots are rebuilt for the affected range by a job, and the chart notes the date of the change.
- **F-hq-7** The narrative model is unavailable → the template narrative is used; nothing else changes.
- **F-hq-8** Fee collection looks low on the 5th of the month → the comparison is against the same day of last month, not against the full month, so the status is fair.

## 14 · Seed data

Monthly and yearly targets for six KPIs per branch for the current year (one branch on track, one on watch for collection). Eight system alert rules (collection below target by 15%, attendance dropping 3 points, enquiries dropping 30%, outstanding over 60 days rising 20%, staff attendance below 90%, open complaints above 10, overdue tickets above 15, surplus below target). About 25 alerts over two months in every status. Eight weekly digests. A few notes, two shared with a branch.

## 15 · Tests

- **T-hq-1** Group figures combine by each KPI's rule; rates use numerators and denominators.
- **T-hq-2** Branch access limits every view, digest and alert list; labels state the subset.
- **T-hq-3** Status thresholds for KPIs that should rise and those that should fall.
- **T-hq-4** Target spread: even, and by last year's pattern; totals preserved to the unit.
- **T-hq-5** Each rule condition fires and does not fire at its boundary; cooldown; auto-resolve.
- **T-hq-6** Change conditions compare like with like (same day of the previous period).
- **T-hq-7** New branches and missing targets are skipped, not treated as zero.
- **T-hq-8** The digest: built per recipient access, sent once per week, contains no personal names.
- **T-hq-9** A principal reads only their own branch's scorecard and shared notes.
- **T-hq-10** The forecast's total for a known seeded pattern falls inside its stated range.
- **T-hq-11** Row-level security.

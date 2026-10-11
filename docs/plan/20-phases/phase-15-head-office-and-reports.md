# Phase 15 · Head office and reports

**Goal.** The owner sees the whole group at a glance and can go from any figure down to the record behind it; every report in the product is findable, exportable and schedulable in one library; and anyone with the right can build an analysis without asking a developer.

**Depends on.** Phases [7](phase-07-school-setup-and-people.md) to [12](phase-12-communication.md), because the figures come from every module.

**Portals.** `/hq`, and the Reports area of `/school`.

**Modules.** [M42](../10-modules/m42-dashboards-reports.md), [M43](../10-modules/m43-owner-analytics.md), the consolidated statements of [M23](../10-modules/m23-accounting.md), and the head office settings of [M02](../10-modules/m02-organisation-branches.md) and [M04](../10-modules/m04-school-setup.md).

## Read first

[M42](../10-modules/m42-dashboards-reports.md) and [M43](../10-modules/m43-owner-analytics.md) in full; the chart components in the gallery and the dataviz rules they follow.

## Work packages

### 15.1 · Finish the report library — [M42](../10-modules/m42-dashboards-reports.md)

Every module registered its reports in Phase 2 and showed some of them on its own screens. Now:

- [ ] **Report library** (`/school/reports`, `/hq/reports`): reports grouped by module with search; pinned and saved at the top.
- [ ] **Report view**: the filter form built from each report's parameter schema; the table with totals, sorting and paging; a chart where the report defines one; drill-down where defined; Export, Save and Schedule.
- [ ] **Saved reports** with relative dates and sharing by role.
- [ ] **Schedules**: frequency, time, format, recipients; last run and status; "run now".
- [ ] **Report activity** for the principal and IT admin.
- [ ] A sweep through all 45 modules: every report named anywhere in a spec exists in the registry, appears in the library, exports to CSV and XLSX, and prints through the placeholder document.

### 15.2 · Analysis

- [ ] **Analysis** (`/hq/analysis`, and inside `/school/reports`): pick up to three measures, up to two splits, filters and a comparison; the result as a chart chosen by rule with a table tab; "Save as report".
- [ ] The vocabulary screen shows only the measures and splits the person may use.

### 15.3 · Dashboards for every role

- [ ] Review the dashboard of each of the 32 roles in its portal: the right widgets in a sensible order, nothing empty, nothing the role cannot use. Layouts are data (`dashboard_layouts`); this is a content task as much as a coding one.
- [ ] **Customise**: drag, resize, add, remove, reset.
- [ ] **Dashboard defaults** editor for the principal and IT admin.
- [ ] Widget caching and the 06:30 warm-up job; each tile shows "as of".

### 15.4 · The head office portal — [M43](../10-modules/m43-owner-analytics.md)

| Screen | Path | Pattern |
|---|---|---|
| **Group overview** | `/hq` | Dashboard |
| Branches; branch scorecard | `/hq/branches`, `/hq/branches/[id]` | List, Dashboard |
| Compare branches | `/hq/comparison` | Grid |
| Movements | `/hq/movements` | List |
| Decisions | `/hq/decisions` | List with a side sheet |
| Finance (consolidated statements, branches as columns) | `/hq/finance` | Report |
| Forecast | `/hq/forecast` | Report |
| Targets | `/hq/targets` | Grid editor |
| Alerts and rules | `/hq/alerts` | List + Form in a sheet |
| Digests | `/hq/digests` | List + Detail |
| Organisation and group academic settings; subscription | `/hq/settings`, `/hq/subscription` | Settings, Detail |

The branch switcher in the top bar sets "all my branches" or a subset for every page. Status is always shown with a word and a mark as well as a colour. Every figure links down to the branch's own report.

### 15.5 · The principal's view of their own branch

The branch scorecard, targets and alerts inside `/school` for a principal who has no access to `/hq`.

### 15.6 · KPI and alert jobs on real data

- [ ] `reports.snapshot-kpis`, `hq.evaluate-alerts` and `hq.weekly-digest` run nightly in the worker against the seeded data; rebuild snapshots for the last 90 days from the seed.
- [ ] The weekly digest as an in-app page and a message with a sign-in link; the template narrative (the AI narrative is [Phase 19](phase-19-ai.md)).

## Journeys to automate

| Journey | Role | Steps |
|---|---|---|
| Monday morning | Owner | Open `/hq` → City Campus is "behind" on collection → open its scorecard → the collection figure → the fee aging report for that branch → a family's statement |
| Compare | Director | Compare fee per student and attendance across branches, totals and per student |
| A target | Director | Set a yearly collection target, spread by last year's pattern, adjust one month |
| An alert | System, finance head | Collection falls 15% below target → an alert is raised once → acknowledged with a note → it resolves itself when collection recovers |
| Decisions | Owner | Approve a fee structure increase and reject a write-off from the Decisions list |
| Partial access | Director with one of two branches | Every page says "1 of 2 branches" and shows only that branch |
| A scheduled report | Accountant | Save "Defaulters over 60 days" → schedule weekly to the finance head → run now → the message with a sign-in link is in the outbox → the owner of the schedule loses the permission → the next run is refused and the schedule pauses |
| Analysis | Principal | Attendance percent by grade and month for this term compared with last year → save as a report → a measure they lack permission for is not offered |
| Customise | Any staff | Rearrange the dashboard, add a widget, reset |
| Same numbers | Accountant | The total on screen, in the CSV and in the XLSX of the same report are identical |

## Exit checks

1. Every screen meets "Done when".
2. All ten journeys pass in the browser.
3. For every report in the registry: its totals equal the sum of its rows; its export equals its screen; a campus user sees no other branch's rows (the generated tests from Phase 2, now also driven through the UI for a sample of ten).
4. Every KPI's group figure equals the correct combination of its branch figures on seeded data.
5. Each of the 32 role dashboards has been looked at by a person and signed off in a checklist kept with the phase.
6. `/hq` loads in under 2 seconds on the standard seed with snapshots in place.
7. `pnpm check`, `pnpm test:db`, `pnpm test:e2e`.

## Left for later, on purpose

- Printed versions of reports with letterhead: [Phase 16](phase-16-documents-and-printing.md).
- "Ask your data", the AI narrative and unusual-activity screens: [Phase 19](phase-19-ai.md).

# M42 · Dashboards and reports

## 1 · Purpose

Turning the school's records into answers. Three things: a **dashboard** for each role, made of small widgets that show what needs attention today; a **report library** where every report across the product is found, filtered, exported and scheduled; and an **analysis service** that answers "measure X by dimension Y with filters Z" safely, which is also what "Ask your data" uses.

Reports that belong to one module are defined in that module. This module supplies the machinery that runs, lists, exports, schedules and audits all of them.

## 2 · Depends on

[M00](m00-shared-kernel.md) (`export_jobs`, jobs, documents), [M03](m03-identity-roles-audit.md) (permissions), [M37](m37-messaging-hub.md) (scheduled delivery). Every other module registers reports, measures and widgets with it.

## 3 · Tables

#### `kpi_snapshots` · org
One figure for one branch on one day, stored nightly so trends are fast and comparable.

| Column | Type | Rules |
|---|---|---|
| kpi_key | text | required; a key from the catalogue |
| branch_id | uuid → branches | optional; empty for a group-level figure |
| snapshot_date | date | required |
| value | numeric(18,4) | required |
| numerator | numeric(18,4) | optional; kept so ratios can be combined across branches correctly |
| denominator | numeric(18,4) | optional |
| dims | jsonb | default `{}`; an optional breakdown key such as `{ gradeId }` |
| dims_key | text | generated; a stable text form of `dims`, for uniqueness |

Unique: (org_id, kpi_key, branch_id, snapshot_date, dims_key).
Index: (org_id, kpi_key, snapshot_date).

#### `saved_reports` · org +self
A report with its filters, kept by a person and optionally shared.

| Column | Type | Rules |
|---|---|---|
| user_id | uuid → profiles | required; the owner |
| report_key | text | required; a report from the registry, or `analysis` for an analysis request |
| name | text | required |
| params | jsonb | required; valid for that report's parameter schema |
| is_shared | bool | default false |
| shared_role_keys | text[] | default empty; with `is_shared`, the roles that can see it |
| is_pinned | bool | default false |

Policy: the owner; and, through the service, staff holding a role it is shared with, provided they hold the report's own permission.

#### `report_schedules` · org

| Column | Type | Rules |
|---|---|---|
| saved_report_id | uuid → saved_reports | required |
| frequency | enum(daily, weekly, monthly, term_end) | required |
| weekday | int | optional; for weekly |
| day_of_month | int | optional; for monthly; 1 to 28 |
| send_time | time | required |
| format | enum(pdf, xlsx, csv) | required |
| recipient_user_ids | uuid[] | required; staff of the organisation, at least one |
| run_as_user_id | uuid → profiles | required; the report is run with this person's access |
| next_run_at | timestamptz | required |
| last_run_at | timestamptz | optional |
| last_status | enum(ok, failed, skipped) | optional |
| is_active | bool | default true |
| created_by | uuid → profiles | required |

#### `dashboard_layouts` · org +self

| Column | Type | Rules |
|---|---|---|
| portal | enum(hq, school, teach, family, learn) | required |
| role_key | text | optional; a default layout for a role |
| user_id | uuid → profiles | optional; a person's own layout; exactly one of role and user is set |
| widgets | jsonb | required; `{ key, x, y, w, h, params? }[]` on a 12-column grid |

Policy: staff may read role layouts; a person reads and writes their own.
Unique: (org_id, portal, role_key), (org_id, portal, user_id) where set.

#### `report_runs` · org append-only
Who ran which report, with what filters. For audit and for finding slow reports.

| Column | Type | Rules |
|---|---|---|
| report_key | text | required |
| user_id | uuid → profiles | optional; empty for a scheduled run |
| schedule_id | uuid → report_schedules | optional |
| params | jsonb | required |
| branch_ids | uuid[] | default empty; the branches it covered |
| row_count | int | optional |
| duration_ms | int | optional |
| output | enum(screen, pdf, xlsx, csv, ai) | required |
| status | enum(ok, failed, refused) | required |
| error | text | optional |

Index: (org_id, report_key, created_at); (org_id, user_id, created_at).
Rows older than one year are deleted by a job.

## 4 · Contracts

`packages/contracts/src/modules/reports/`: `reports`, `analysis`, `kpis`, `dashboards`, `saved-reports`, `report-schedules`.

**Three registries, all in code.**

1. **Reports** — each module registers its own in `packages/core/src/modules/<module>/<module>.reports.ts`:

```ts
defineReport({
  key: 'fees.aging',
  module: 'fees',
  title: { en: 'Fee aging', ur: '…' },
  permission: 'fees:reports',
  params: z.object({ branchIds: BranchIds, asOf: IsoDate, gradeIds: Ids.optional() }),
  columns: [{ key: 'family', label, type: 'text' }, { key: 'd0_30', label, type: 'money', total: 'sum' }, …],
  run: async (ctx, params) => ({ rows, totals }),      // calls the module's own db-services with ctx
  pdf: { orientation: 'landscape', groupBy: 'grade' },
});
```

2. **Measures and dimensions** for analysis — `packages/core/src/modules/reports/vocabulary.ts`. A fixed list, each with the permission it needs and the dimensions it may be split by:

| Measure | Split by | Needs |
|---|---|---|
| `students.count`, `students.joined`, `students.left` | branch, grade, section, gender, month | `students:read` |
| `attendance.percent`, `attendance.absent_days` | branch, grade, section, weekday, month | `attendance:read` |
| `fees.billed`, `fees.collected`, `fees.outstanding`, `fees.discounts`, `fees.fines` | branch, grade, fee head, method, month | `fees:reports` |
| `admissions.enquiries`, `admissions.conversions` | branch, grade, source, month | `admission-enquiries:read` |
| `results.average_percent`, `results.pass_percent` | branch, grade, section, subject, exam | `results:read` |
| `staff.count`, `staff.attendance_percent` | branch, department, staff type, month | `staff-attendance:read` |
| `payroll.gross`, `payroll.net`, `payroll.cost` | branch, department, month | `payroll:reports` |
| `expenses.amount` | branch, category, cost center, month | `expenses:read` |
| `finance.income`, `finance.expense`, `finance.surplus` | branch, account group, month | `financial-reports:read` |
| `transport.riders`, `library.loans`, `complaints.count`, `tickets.count` | branch, month, category | each module's read permission |

An `AnalysisRequest` is `{ measures: [1–3], splitBy: [0–2], filters: { branchIds?, gradeIds?, from, to, … }, compareTo?: 'previous_period' | 'previous_year', top?: number }`. It is validated against the vocabulary: an unknown measure, a split the measure does not allow, or a measure the caller lacks permission for is refused before anything runs. Each measure is implemented once as a query that goes through the caller's `ctx`.

3. **KPIs** — `kpis.ts`: a named figure for the dashboard and the nightly snapshot, with its unit, its good direction (up or down), how it combines across branches (sum, or numerator over denominator), and the permission to see it. The seeded set: enrolment, capacity used, attendance today, attendance this month, fee collection this month against billed, outstanding over 60 days, admissions this month, enquiry conversion, staff attendance today, average result of the latest exam, pass rate, open complaints, overdue helpdesk tickets, payroll cost, surplus this month.

4. **Widgets** — each registered with a key, the permission it needs, the portals it suits, a default size and a server function that returns its data: `kpi-tile`, `kpi-trend`, `today-attendance`, `unmarked-sections`, `fee-collection`, `defaulters-top`, `admissions-funnel`, `approvals-waiting`, `my-tasks`, `timetable-today`, `substitutions-needed`, `marks-due`, `upcoming-events`, `birthdays`, `notices`, `complaints-open`, `tickets-overdue`, `cash-position`, `branch-comparison`, `integrity-findings`, `job-failures`.

**Shapes**

- `ReportCatalogue`: every report the caller has permission for, grouped by module, with its parameter schema as JSON Schema so the screen can build the filter form.
- `ReportResult`: `{ columns, rows, totals, page, generatedAt, params }`. Large reports page on the server.
- `AnalysisResult`: a table plus a suggested chart form (single figure, bars, lines over time, or a table) chosen by rule from the shape of the request.
- `DashboardData`: for a layout — each widget's data, fetched together; a widget that fails returns an error for that tile only.

Settings: `reports.max_rows_screen` (default 5,000), `reports.max_rows_export` (default 200,000), `reports.export_needs_reason` (default false; when on, an export of personal data asks for a reason that is stored in the audit log).

## 5 · Rules

- **R-reports-1** A report runs with the access of the person who runs it: its own permission is checked first, then every query goes through their `ctx`, so branch scope and row-level security apply. A report can never show a person more than the screens do.
- **R-reports-2** A scheduled report runs with the access of its `run_as_user_id` at the moment it runs. If that person has left, lost the permission, or lost a branch, the run is `refused`, the schedule is paused and its creator is told. Recipients must be current staff of the organisation; a schedule never sends outside it.
- **R-reports-3** Every run, on screen or exported, writes a `report_runs` row. An export also writes an audit entry and goes through `export_jobs` ([M00](m00-shared-kernel.md)), with the row limit in the settings.
- **R-reports-4** A report's totals are computed by the report from all matching rows, never by summing the rows of the page on screen.
- **R-reports-5** Money in reports is exact paisa internally and shown in rupees; a ratio across branches is recomputed from summed numerators and denominators, never averaged from percentages.
- **R-reports-6** An analysis request is refused, not narrowed, when it asks for something outside the vocabulary or the caller's permissions. The refusal says what was not allowed.
- **R-reports-7** Analysis results with a small group hide it: a split that would show a count below 5 for students by a sensitive dimension (religion, disability, fee concession type) is not offered at all; those dimensions are not in the vocabulary.
- **R-reports-8** KPI snapshots are written nightly per branch and for the group, are idempotent for a date, and can be rebuilt for a date range. Today's figure on a dashboard is computed live; the trend behind it comes from snapshots.
- **R-reports-9** A dashboard shows only widgets the person has permission for. A role layout that contains a widget someone lacks permission for simply omits it for them.
- **R-reports-10** A person can rearrange, resize, add and remove widgets; "Reset" returns to the role's layout. A change to a role layout does not overwrite personal layouts.
- **R-reports-11** A widget's data is cached for a short time suited to it (a minute for attendance today, an hour for collection this month) and refreshed in the background; each tile shows when it was last updated.
- **R-reports-12** A saved report stores filters, not results. Opening it runs it again. A shared saved report is visible only to people who hold the report's own permission.
- **R-reports-13** Relative dates in saved filters ("this month", "last term", "today") are stored as such and resolved when the report runs.
- **R-reports-14** A report that would exceed `reports.max_rows_screen` asks the person to narrow the filters or export; it never silently truncates.
- **R-reports-15** Every report prints with the school's letterhead, its filters, who ran it and when, and page numbers.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `reports:read` | Open the report library and run reports one has module permission for | ALL_STAFF |
| `reports:export` | Export a report to a file | LEADERS, ACADEMIC, FINANCE, HR, FRONT |
| `reports:schedule` | Schedule a saved report to be sent | LEADERS, ACCOUNTS, hr_manager, academic_head |
| `reports:share` | Share a saved report with roles | LEADERS, ACCOUNTS, hr_manager, academic_head |
| `analysis:use` | Build analysis requests | LEADERS, ACADEMIC, ACCOUNTS, hr_manager |
| `dashboards:customise` | Change one's own dashboard | ALL_STAFF |
| `dashboards:manage` | Set the default dashboard for a role | principal, director, it_admin |
| `report-runs:read` | See who ran which reports | principal, director, it_admin |

Running any particular report also needs that report's own permission.

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/reports` | `reports:read` | The catalogue of reports I may run |
| GET | `/reports/[key]` | `reports:read` | One report's definition and parameter schema |
| POST | `/reports/[key]/run` | `reports:read` | Runs it and returns a page of rows with totals |
| POST | `/reports/[key]/export` | `reports:export` | Queues an export |
| POST | `/analysis/run` | `analysis:use` | Runs an analysis request |
| GET | `/analysis/vocabulary` | `analysis:use` | The measures and dimensions I may use |
| GET | `/saved-reports` | `reports:read` | Mine and those shared with me |
| POST | `/saved-reports` | `reports:read` | Saves a report with its filters |
| PATCH | `/saved-reports/[id]` | `reports:read` | Renames, pins, changes filters |
| POST | `/saved-reports/[id]/share` | `reports:share` | Shares with roles |
| DELETE | `/saved-reports/[id]` | `reports:read` | Deletes my own |
| GET | `/report-schedules` | `reports:schedule` | Lists |
| POST | `/report-schedules` | `reports:schedule` | Creates |
| PATCH | `/report-schedules/[id]` | `reports:schedule` | Edits, pauses, resumes |
| DELETE | `/report-schedules/[id]` | `reports:schedule` | Deletes |
| POST | `/report-schedules/[id]/run-now` | `reports:schedule` | Sends it now |
| GET | `/kpis` | `signed-in` | Current values of the KPIs I may see, for chosen branches |
| GET | `/kpis/[key]/trend` | `signed-in` | A KPI's snapshots for a date range |
| GET | `/dashboard` | `signed-in` | My layout for a portal with every widget's data |
| GET | `/dashboard/widgets` | `signed-in` | The widgets I may add |
| GET | `/dashboard/widgets/[key]` | `signed-in` | One widget's data |
| PUT | `/dashboard/layout` | `dashboards:customise` | Saves my layout |
| DELETE | `/dashboard/layout` | `dashboards:customise` | Resets to the role's layout |
| GET | `/dashboard-layouts` | `dashboards:manage` | Role layouts |
| PUT | `/dashboard-layouts` | `dashboards:manage` | Saves a role layout |
| GET | `/report-runs` | `report-runs:read` | Who ran what |
| POST | `/kpis/rebuild` | `dashboards:manage` | Rebuilds snapshots for a date range |

The named-report routes inside each module (`/fees/reports/[report]`, `/payroll/reports/[report]`, `/library/reports/[report]`, `/accounting/reports`) are thin wrappers over `POST /reports/[key]/run` kept for readable links.

## 8 · Client layer

Custom hooks: `useReportCatalogue`, `useReportDefinition(key)`, `useReport(key, params)` (keeps the last result while the next loads), `useExportReport`, `useAnalysis(request)`, `useVocabulary`, `useSavedReports`, `useReportSchedules`, `useDashboard(portal)`, `useWidget(key, params)` (its own refresh interval), `useSaveLayout`, `useKpis`, `useKpiTrend`.

Shared UI in `@takhti/ui`: `<ReportView />` (builds the filter form from the parameter schema, shows the table with totals, sorting and paging, and the Export, Save and Schedule actions), `<AnalysisBuilder />`, `<DashboardGrid />`, `<KpiTile />`, and the chart components. Charts follow the dataviz rules of the design system: one axis, colours assigned in a fixed order, a legend for more than one series, a table view of the same data, and a tooltip.

## 9 · Screens

Built in [Phase 4](../20-phases/phase-04-frontend-foundation.md) (the grid, tiles and report view), each portal phase (its own widgets and reports), and [Phase 15](../20-phases/phase-15-head-office-and-reports.md) (the library, analysis, schedules).

| Screen | Pattern | Where |
|---|---|---|
| Dashboard | Dashboard | The first page of every portal: a 12-column grid of widgets; "Customise" turns on drag, resize, add and remove |
| Report library | List | `/school/reports` and `/hq/reports`: reports grouped by module with a search box; pinned and saved reports at the top |
| Report | Report | Filters across the top, the table with totals beneath, a chart when the report defines one; Export, Save, Schedule; drill from a figure to its rows where defined |
| Analysis | Split view | Pick measures, split, filters and comparison on the left; the result as a chart with a table tab on the right; "Save as report" |
| Saved reports | List | Mine and shared; pin; share |
| Schedules | List + Form in a sheet | Frequency, time, format, recipients; last run and its status |
| Report activity | List | Who ran what and when; slow reports |
| Dashboard defaults | Grid editor | A layout per role and portal |

## 10 · Notifications and jobs

Events: `report.scheduled-ready` (to recipients, with a link that needs sign-in; the file is attached only for email and only when the school allows it), `report.schedule-paused` (to its creator), `report.export-ready` (from [M00](m00-shared-kernel.md)).

Jobs: `reports.snapshot-kpis` (daily 23:30), `reports.run-schedules` (every 5 minutes), `reports.purge-runs` (weekly), `reports.warm-dashboards` (06:30 on working days: computes the heavy widgets before staff arrive).

## 11 · Offline

A dashboard shows its last loaded data with "as of" times when offline. Reports need a connection.

## 12 · AI

- **Ask your data** (A9): a question in English, Urdu or Roman Urdu becomes an `AnalysisRequest` (or a named report with filters). The request is validated exactly like one built by hand, run with the asker's access, and shown beside the answer so the person can see and change what was asked.
- A one-sentence reading of a chart or a KPI's change, written from the figures already on screen.
- The model never writes a query and never sees rows beyond the result it is asked to describe.

## 13 · Failure cases

- **F-reports-1** A report takes longer than 30 seconds → it is cancelled with "Narrow the filters or export"; export runs it as a job.
- **F-reports-2** A scheduled report's owner has left → the run is refused, the schedule pauses, its creator is told.
- **F-reports-3** One widget's query fails → that tile shows "Could not load" with Retry; the rest of the dashboard is unaffected.
- **F-reports-4** A person opens a shared saved report for a module they have no permission for → it is not listed for them; a direct link returns `FORBIDDEN`.
- **F-reports-5** An analysis asks for payroll cost by department from a principal without payroll permission → refused, naming the measure.
- **F-reports-6** The nightly snapshot job fails for one branch → the others are saved; the failed branch is retried and, if still failing, its trend shows a gap rather than a zero.
- **F-reports-7** A report is exported with 400,000 rows → refused at the limit with the count; the person narrows the range.
- **F-reports-8** A branch is added to someone's access → their saved reports that said "all my branches" include it from the next run.
- **F-reports-9** The same report shows a different total on screen and in the export → cannot happen by construction: both call the same `run` with the same parameters; a test compares them.
- **F-reports-10** A user drags a widget off the grid on a phone → layouts are per screen width; the phone layout is one column and cannot break.

## 14 · Seed data

Role layouts for every built-in role in each portal. Ninety days of KPI snapshots per branch and for the group, consistent with the seeded transactions. A dozen saved reports (some shared, some pinned) and four schedules (one paused because its owner left). Report runs for the last month.

## 15 · Tests

- **T-reports-1** Every registered report: runs with seeded data; its totals equal the sum of all its rows; its parameter schema rejects bad input; it refuses a caller without its permission.
- **T-reports-2** Branch scope: a campus user's report contains no row from another branch, for every report (a generated test over the registry).
- **T-reports-3** Screen and export give identical rows and totals.
- **T-reports-4** The vocabulary: every measure with every allowed split returns figures that equal a direct count on seeded data; a disallowed split or an unpermitted measure is refused.
- **T-reports-5** Ratios across branches use numerators and denominators.
- **T-reports-6** Snapshots: idempotent per date; rebuild; a failed branch leaves a gap.
- **T-reports-7** Schedules: next run time for each frequency; run-as access; refusal and pause; recipients must be current staff.
- **T-reports-8** Dashboards: role default, personal override, reset; a widget without permission is omitted; one failing widget does not fail the page.
- **T-reports-9** Saved reports: relative dates resolve at run time; sharing respects the report's permission.
- **T-reports-10** Row limits on screen and export.
- **T-reports-11** Every run is recorded; exports are audited.
- **T-reports-12** Row-level security.

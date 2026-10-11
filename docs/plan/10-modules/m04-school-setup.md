# M04 · School setup

## 1 · Purpose

The calendar and rule-book of a school group: academic years, terms, holidays, shifts, examination boards and grading schemes. Everything here is data so that a change in government policy never needs a code change. Background in [12 · Pakistan domain rules](../00-foundation/12-pakistan-domain-rules.md).

## 2 · Depends on

[M02](m02-organisation-branches.md). Used by every academic, finance and HR module.

## 3 · Tables

#### `academic_years` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; `2026–27` |
| start_date | date | required |
| end_date | date | required; after `start_date`; at most 15 months later |
| status | enum(planned, active, closed) | default planned |
| closed_at | timestamptz | optional |
| closed_by | uuid → profiles | optional |

Policy: every member of the organisation may read, because results, fees and the calendar name the year; staff write, by permission.
Unique: (org_id, name) among live rows. At most one row with status `active` per organisation (partial unique index). Date ranges of live rows must not overlap (exclusion constraint).

#### `terms` · org

| Column | Type | Rules |
|---|---|---|
| academic_year_id | uuid → academic_years | required |
| name | text | required; `First Term` |
| name_ur | text | optional |
| sequence | int | required; 1, 2, 3 |
| start_date | date | required; inside the year |
| end_date | date | required; after `start_date` |
| weight_percent | numeric(5,2) | default 0; share of the annual result |

Policy: every member of the organisation may read; staff write, by permission.
Unique: (academic_year_id, sequence). Terms of one year must not overlap.

#### `holidays` · org

| Column | Type | Rules |
|---|---|---|
| branch_id | uuid → branches | optional; empty means every branch |
| name | text | required |
| name_ur | text | optional |
| start_date | date | required |
| end_date | date | required; ≥ `start_date` |
| kind | enum(public, religious, vacation, local, emergency) | required |
| is_tentative | bool | default false; moon-sighting dates |
| applies_to | enum(everyone, students_only) | default everyone |

Policy: every member of the organisation may read: the school calendar is shown to families; staff write, by permission.
Index: (org_id, start_date, end_date).

#### `shifts` · branch

| Column | Type | Rules |
|---|---|---|
| name | text | required; `Morning` |
| start_time | time | required |
| end_time | time | required; after `start_time` |
| is_default | bool | default false |

Policy: every member of the organisation may read, because the times of the school day are shown with a child's class; staff of the branch write, by permission.
Unique: (branch_id, name) among live rows.

#### `boards` · global
Examination boards, seeded.

| Column | Type | Rules |
|---|---|---|
| key | text | required; unique; `bise-lahore`, `fbise`, `aku-eb` |
| name | text | required |
| short_name | text | required |
| province | text | optional |
| kind | enum(bise, federal, private) | required |
| website | text | optional |
| is_active | bool | default true |

#### `grading_schemes` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required |
| description | text | optional |
| board_id | uuid → boards | optional |
| pass_percent | numeric(5,2) | required; 0 to 100 |
| applies_from | date | required |
| uses_grade_points | bool | default false |
| percent_rounding | enum(none, one_decimal, whole_half_up) | default one_decimal |
| position_rule | enum(none, competition, dense) | default competition; competition gives 1, 2, 2, 4 |
| status | enum(draft, active, archived) | default draft |
| supersedes_id | uuid → grading_schemes | optional; the scheme this one replaced |

Unique: (org_id, name) among live rows.

#### `grade_bands` · org

| Column | Type | Rules |
|---|---|---|
| scheme_id | uuid → grading_schemes | required |
| grade | text | required; `A++` |
| min_percent | numeric(5,2) | required |
| max_percent | numeric(5,2) | required; > `min_percent` |
| grade_point | numeric(4,2) | optional |
| description | text | optional; `Extraordinary` |
| description_ur | text | optional |
| is_pass | bool | required |
| sort_order | int | required |

Unique: (scheme_id, grade).

## 4 · Contracts

`packages/contracts/src/modules/setup/`: `academic-years`, `terms`, `holidays`, `shifts`, `boards`, `grading-schemes`.

- `SetGradeBands`: `{ bands: GradeBand[], version }` — the whole set is saved together.
- `RolloverYear`: `{ fromYearId, name, startDate, endDate, copy: { terms, sections, gradeSubjects, feeStructures, bellSchedules, holidays } }`.
- `WorkingDaysQuery`: `{ branchId, from, to }` → `{ date, kind: full | half | off | holiday, holidayName? }[]`.

Settings registered here: `academics.promotion_rules`, `academics.age_rules`, `academics.roll_number_format`, `academics.due_date_on_holiday` (`same_day` or `next_working_day`).

## 5 · Rules

- **R-setup-1** Exactly one academic year is `active`. Activating a year requires the previous one to be `closed`, or closes nothing and is refused.
- **R-setup-2** A year can be **closed** only when: every exam in it is published or cancelled, every enrolment has an outcome (promoted, detained, left), and no attendance session is still in draft. The response lists what blocks closing.
- **R-setup-3** A closed year is read-only for attendance, marks, timetable and enrolments. Reopening needs `academic-years:reopen` and a reason.
- **R-setup-4** Deleting a year, term or shift that is referenced by any record is refused with the count of records.
- **R-setup-5** Terms must lie inside their year and not overlap. Weights of a year's terms sum to 100 or to 0.
- **R-setup-6** A holiday that covers a date with a submitted attendance session, a scheduled exam paper or a timetable substitution warns and asks for confirmation; confirming cancels the attendance sessions of that date and flags the exam papers for rescheduling.
- **R-setup-7** An `emergency` holiday for today or tomorrow notifies every guardian and staff member of the affected branches at once, ignoring quiet hours.
- **R-setup-8** `isWorkingDay(branch, date)` is the single function every module uses: it combines the branch's working week and holidays. Half days count as working days.
- **R-setup-9** A grading scheme's bands must cover 0 to 100 with no gap and no overlap; exactly the bands at or above `pass_percent` are `is_pass`.
- **R-setup-10** An `active` scheme that has been used by a published result cannot be edited. "Revise" clones it as a draft with a new `applies_from` and `supersedes_id`.
- **R-setup-11** `gradeFor(scheme, percent)` matches on the lower bound, highest band first, after applying the scheme's rounding.
- **R-setup-12** Rollover creates the next year as `planned` and copies only what was ticked. Sections are copied without students; class teachers are copied as suggestions. Nothing in the old year changes.
- **R-setup-13** Shifts cannot overlap in time within a branch unless they use different rooms; the timetable enforces rooms.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `academic-years:read` | See years and terms | ALL_STAFF, FAMILY |
| `academic-years:update` | Create and edit years and terms; activate; roll over | director, principal, academic_head |
| `academic-years:close` | Close a year | director, principal |
| `academic-years:reopen` | Reopen a closed year | director |
| `holidays:read` | See holidays | ALL_STAFF, FAMILY |
| `holidays:update` | Create, edit and delete holidays | ADMINS, coordinator |
| `shifts:read` | See shifts | ALL_STAFF |
| `shifts:update` | Create, edit and delete shifts | ADMINS |
| `grading-schemes:read` | See grading schemes | ALL_STAFF |
| `grading-schemes:update` | Create, revise, activate and archive schemes | director, principal, academic_head, exam_controller |
| `academic-settings:update` | Change promotion, age and roll-number rules | principal, academic_head |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/academic-years` | `academic-years:read` | Lists years |
| POST | `/academic-years` | `academic-years:update` | Creates a planned year |
| GET | `/academic-years/[id]` | `academic-years:read` | One year with its terms |
| PATCH | `/academic-years/[id]` | `academic-years:update` | Edits name and dates |
| DELETE | `/academic-years/[id]` | `academic-years:update` | Deletes an unused planned year |
| POST | `/academic-years/[id]/activate` | `academic-years:update` | Makes it the active year |
| GET | `/academic-years/[id]/close-check` | `academic-years:close` | Lists what still blocks closing |
| POST | `/academic-years/[id]/close` | `academic-years:close` | Closes the year |
| POST | `/academic-years/[id]/reopen` | `academic-years:reopen` | Reopens with a reason |
| POST | `/academic-years/rollover/preview` | `academic-years:update` | Shows what a rollover would copy |
| POST | `/academic-years/rollover` | `academic-years:update` | Creates the next year |
| GET | `/terms` | `academic-years:read` | Lists terms |
| POST | `/terms` | `academic-years:update` | Creates |
| PATCH | `/terms/[id]` | `academic-years:update` | Edits |
| DELETE | `/terms/[id]` | `academic-years:update` | Deletes an unused term |
| GET | `/holidays` | `holidays:read` | Lists holidays in a date range |
| POST | `/holidays` | `holidays:update` | Creates |
| POST | `/holidays/import-public` | `holidays:update` | Adds the year's gazetted holidays from the seeded list, all marked for review |
| PATCH | `/holidays/[id]` | `holidays:update` | Edits |
| DELETE | `/holidays/[id]` | `holidays:update` | Deletes |
| GET | `/working-days` | `signed-in` | Day kinds for a branch and date range |
| GET | `/shifts` | `shifts:read` | Lists shifts |
| POST | `/shifts` | `shifts:update` | Creates |
| PATCH | `/shifts/[id]` | `shifts:update` | Edits |
| DELETE | `/shifts/[id]` | `shifts:update` | Deletes |
| GET | `/boards` | `signed-in` | The board catalogue |
| GET | `/grading-schemes` | `grading-schemes:read` | Lists schemes |
| POST | `/grading-schemes` | `grading-schemes:update` | Creates a draft, optionally from a seeded template |
| GET | `/grading-schemes/[id]` | `grading-schemes:read` | One scheme with its bands |
| PATCH | `/grading-schemes/[id]` | `grading-schemes:update` | Edits a draft |
| PUT | `/grading-schemes/[id]/bands` | `grading-schemes:update` | Replaces the bands of a draft |
| POST | `/grading-schemes/[id]/activate` | `grading-schemes:update` | Activates after validation |
| POST | `/grading-schemes/[id]/revise` | `grading-schemes:update` | Clones an active scheme as a new draft |
| POST | `/grading-schemes/[id]/archive` | `grading-schemes:update` | Archives |
| DELETE | `/grading-schemes/[id]` | `grading-schemes:update` | Deletes an unused draft |

Idempotent: `POST /academic-years/rollover`, `POST /academic-years/[id]/close`.

## 8 · Client layer

Generated CRUD for `academic-years`, `terms`, `holidays`, `shifts`, `grading-schemes`. Custom hooks: `useActiveYear()` (used everywhere to default filters), `useWorkingDays(branchId, from, to)`, `useCloseCheck`, `useRollover`, `useSetGradeBands`, `useBoards`.

`@takhti/contracts` also exports the pure function `gradeFor(bands, rounding, percent)` so the browser and the server grade identically.

## 9 · Screens

Under `/school/settings/academics` and `/hq/settings/academics`. Built in [Phase 7](../20-phases/phase-07-school-setup-and-people.md).

| Screen | Pattern | Notes |
|---|---|---|
| Academic years | List | Active year marked; actions: activate, close, roll over |
| Academic year | Detail | Terms as an editable list with a timeline bar |
| Close year | Wizard | Checklist of blockers with links, then confirm |
| New year (rollover) | Wizard | Dates, what to copy, preview, create |
| Holidays | Calendar + List | Month grid; tentative holidays hatched; "Add public holidays" |
| Shifts | List + Dialog form | |
| Grading schemes | List | Status, pass mark, used by |
| Grading scheme | Grid editor | Bands table with a live bar showing coverage 0 to 100 and any gap in red; "Try a percentage" box |
| Academic rules | Settings | Promotion rules, age rules per grade, roll-number format |

## 10 · Notifications and jobs

Events: `academic-year.activated`, `academic-year.closed`, `holiday.created`, `holiday.emergency`, `grading-scheme.activated`.

Jobs: `setup.year-end-reminders` (30 and 7 days before a year's end date, lists what must be done before closing).

## 11 · Offline

The active year, terms, holidays for the term and shifts are in the `me` stream, read-only.

## 12 · AI

None.

## 13 · Failure cases

- **F-setup-1** Two admins activate different years at once → the partial unique index lets one win; the other gets `CONFLICT` "Another year is already active".
- **F-setup-2** A holiday is added over dates with marked attendance → warned; on confirm those sessions are cancelled and their parent messages are not re-sent.
- **F-setup-3** Eid moves by a day → the tentative holiday is edited; attendance on the newly working day opens, and on the new holiday closes.
- **F-setup-4** Bands leave 50.01 to 50.99 uncovered → activation refused, naming the gap.
- **F-setup-5** A scheme is revised mid-year → results already published keep their grades; unpublished results use whichever scheme their exam points to.
- **F-setup-6** A year is closed with one section's promotions unfinished → refused, listing the section.
- **F-setup-7** Rollover is run twice → the second is refused because the year name exists.

## 14 · Seed data

Years: 2025–26 (closed) and 2026–27 (active, 1 Apr 2026 to 31 Mar 2027). Three terms for 2026–27 weighted 30, 30, 40. Public holidays for 2026–27 with Eid dates tentative, summer vacation 1 Jun to 14 Aug. Shifts: Morning at both branches. All boards (the `boards` table follows the list in `packages/contracts/src/modules/setup/boards.data.ts` on every migration run, in every environment). Three grading schemes: "National 2026 (10-point, pass 40%)" active and default for Grades 9–10, "Pre-2026 (7-point, pass 33%)" archived, "Primary (5-band, pass 40%)" active for Grades 1–8.

## 15 · Tests

- **T-setup-1** Only one active year; overlapping years refused.
- **T-setup-2** Close check lists each kind of blocker; close succeeds when none remain; a closed year refuses an attendance write.
- **T-setup-3** Reopen needs its permission and a reason.
- **T-setup-4** Term overlap and weight-sum rules.
- **T-setup-5** `isWorkingDay` across a working week with a half day, a single holiday, a range, a branch-only holiday and a students-only holiday.
- **T-setup-6** Band validation: gap, overlap, wrong pass flags.
- **T-setup-7** `gradeFor` at every boundary of the national scale: 39.99, 40, 50, 50.5, 95.4, 95.5, 100, with each rounding mode.
- **T-setup-8** A scheme used by a published result cannot be edited; revise creates a linked draft.
- **T-setup-9** Rollover copies exactly what was ticked and nothing else.
- **T-setup-10** Emergency holiday queues messages to every guardian of the affected branch and to no other branch.
- **T-setup-11** Row-level security for every table; guardians can read years and holidays only.

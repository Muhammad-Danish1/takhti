# M12 · Timetable

## 1 · Purpose

When each class has each subject, with which teacher, in which room; the bell times for each season; and who covers when a teacher is away. It answers "where should 8-B be right now, and who is teaching them?" for every other module.

## 2 · Depends on

[M02](m02-organisation-branches.md) (`rooms`), [M04](m04-school-setup.md) (shifts, holidays, working week), [M11](m11-academic-structure.md), [M26](m26-staff-recruitment.md), [M27](m27-staff-attendance-leave.md) (leave feeds substitutions).

## 3 · Tables

#### `bell_schedules` · branch
The clock times of a school day. Summer, winter, Ramadan and Friday each have their own.

| Column | Type | Rules |
|---|---|---|
| name | text | required; `Summer`, `Ramadan`, `Friday` |
| shift_id | uuid → shifts | required |
| valid_from | date | required |
| valid_to | date | optional; empty means until replaced |
| weekdays | text[] | required; subset of `mon`…`sun` this schedule applies to |
| lesson_count | int | required; number of teaching periods in the day |
| status | enum(draft, active, archived) | default draft |

Policy: every member of the organisation may read a schedule that is `active`, because a family's timetable shows the times of lessons; staff of the branch write, by permission.
Unique: (branch_id, name) among live rows.

#### `bell_periods` · branch

| Column | Type | Rules |
|---|---|---|
| bell_schedule_id | uuid → bell_schedules | required |
| sequence | int | required; order in the day |
| kind | enum(lesson, break, assembly, prayer, activity) | required |
| lesson_no | int | optional; 1, 2, 3… for `lesson` rows only |
| name | text | required; `Period 1`, `Break` |
| start_time | time | required |
| end_time | time | required; after `start_time` |

Policy: every member of the organisation may read; staff of the branch write, by permission.
Unique: (bell_schedule_id, sequence); (bell_schedule_id, lesson_no) where set. Periods of one schedule must not overlap.

#### `timetables` · branch
A weekly plan for all sections of a shift.

| Column | Type | Rules |
|---|---|---|
| academic_year_id | uuid → academic_years | required |
| shift_id | uuid → shifts | required |
| name | text | required |
| effective_from | date | required |
| effective_to | date | optional |
| status | enum(draft, published, archived) | default draft |
| published_at | timestamptz | optional |
| published_by | uuid → profiles | optional |
| copied_from_id | uuid → timetables | optional |

Policy: every member of the organisation may read a `published` timetable; staff of the branch read drafts and write, by permission.

At most one `published` timetable per (branch, shift) for any date (exclusion constraint on the effective range).

#### `timetable_entries` · branch

| Column | Type | Rules |
|---|---|---|
| timetable_id | uuid → timetables | required |
| section_id | uuid → sections | required |
| weekday | enum(mon, tue, wed, thu, fri, sat, sun) | required |
| lesson_no | int | required; > 0 |
| section_subject_id | uuid → section_subjects | required |
| teacher_id | uuid → staff | optional; defaults to the subject's teacher |
| room_id | uuid → rooms | optional; defaults to the section's room |
| note | text | optional |

Policy: every member of the organisation may read. An entry has no state of its own: the service serves a family only the entries of the published timetable, for the sections of their own children.
Unique: (timetable_id, section_id, weekday, lesson_no); (timetable_id, teacher_id, weekday, lesson_no) where teacher is set; (timetable_id, room_id, weekday, lesson_no) where room is set. The last two make a double booking impossible to save.

#### `teacher_availability` · branch

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| weekday | enum(mon, tue, wed, thu, fri, sat, sun) | required |
| lesson_no | int | required |
| kind | enum(unavailable, preferred) | required |
| reason | text | optional |

Unique: (staff_id, weekday, lesson_no).

#### `substitutions` · branch
One period on one date covered by someone else, or left free.

| Column | Type | Rules |
|---|---|---|
| substitution_date | date | required |
| timetable_entry_id | uuid → timetable_entries | required |
| section_id | uuid → sections | required |
| lesson_no | int | required |
| absent_teacher_id | uuid → staff | required |
| substitute_teacher_id | uuid → staff | optional; empty means a free period |
| reason | enum(leave, absent, duty, training, other) | required |
| leave_request_id | uuid → leave_requests | optional |
| status | enum(planned, confirmed, cancelled) | default planned |
| note | text | optional |

Unique: (substitution_date, timetable_entry_id) among live rows; (substitution_date, substitute_teacher_id, lesson_no) where set.

## 4 · Contracts

`packages/contracts/src/modules/timetable/`: `bell-schedules`, `timetables`, `timetable-entries`, `teacher-availability`, `substitutions`, `timetable-views`.

- `SetBellPeriods`: the whole day saved together.
- `SaveEntries`: `{ upserts: EntryInput[], deletes: Id[], version }`.
- `Conflict`: `{ kind: teacher_clash | room_clash | teacher_unavailable | over_weekly_periods | under_weekly_periods | over_daily_limit | over_consecutive | beyond_day_length | no_teacher, severity: hard | soft, sectionId?, teacherId?, weekday?, lessonNo?, message }`.
- `DayView`: for a date and a section, teacher or room — an ordered list of `{ lessonNo, startTime, endTime, subject, section, teacher, room, isSubstitution, isFree, isBreak }` after applying the right bell schedule, substitutions and holidays.
- `SubstituteSuggestion`: `{ staffId, name, reasons: string[], periodsToday }`.

Settings: `timetable.max_periods_per_day`, `timetable.max_consecutive_periods`, `timetable.max_periods_per_week`, `timetable.same_subject_per_day` (default 2).

## 5 · Rules

- **R-timetable-1** All active bell schedules of a shift must have the same `lesson_count`, except schedules for half days, which may have fewer. A timetable entry whose `lesson_no` is beyond a day's lesson count is simply not taught that day, and the validator reports it.
- **R-timetable-2** `bellScheduleFor(branch, shift, date)` picks the active schedule whose weekdays include the date's weekday and whose date range contains it; the most specific (shortest range) wins.
- **R-timetable-3** The validator returns **hard** conflicts (teacher clash, room clash, entry with no teacher) and **soft** ones (limits exceeded, weekly periods not matched, teacher marked unavailable, preferred slot ignored).
- **R-timetable-4** A timetable can be published only with zero hard conflicts. Soft conflicts are listed and must be acknowledged.
- **R-timetable-5** Publishing a timetable ends the previously published one for that shift on the day before `effective_from`. History is kept, so last month's attendance still knows who taught.
- **R-timetable-6** A published timetable is edited by copying it to a draft, changing it, and publishing with a new effective date. Small same-day fixes are substitutions.
- **R-timetable-7** A substitute must be active staff with access to the branch and free in that lesson on that date (no entry of their own and no other substitution).
- **R-timetable-8** When a teacher's leave is approved or they are marked absent, a substitution row with no substitute is created for each of their lessons on those dates, and the coordinator is told.
- **R-timetable-9** Suggestions rank free teachers by: teaches the same subject, teaches the same section, fewest periods that day, fewest substitutions this month.
- **R-timetable-10** For the lesson they cover, a substitute gets the absent teacher's rights for that section: attendance, diary and behaviour.
- **R-timetable-11** `DayView` returns nothing for a holiday or non-working day and says why.
- **R-timetable-12** Deleting a `section_subjects` row, room or teacher that has entries in a published timetable is refused until the timetable is revised.
- **R-timetable-13** Auto-fill places only missing lessons, never moves an existing entry, and reports what it could not place.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `bell-schedules:read` | See bell schedules | ALL_STAFF, FAMILY |
| `bell-schedules:update` | Create and edit bell schedules | ADMINS, coordinator |
| `timetables:read` | See timetables | ALL_STAFF |
| `timetables:update` | Create and edit draft timetables | ADMINS, academic_head, section_head, coordinator |
| `timetables:publish` | Publish a timetable | principal, academic_head, coordinator |
| `teacher-availability:update` | Set when a teacher cannot teach | ADMINS, coordinator |
| `substitutions:read` | See substitutions | ALL_STAFF |
| `substitutions:update` | Assign and cancel substitutes | ADMINS, section_head, coordinator |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/bell-schedules` | `bell-schedules:read` | Lists schedules |
| POST | `/bell-schedules` | `bell-schedules:update` | Creates |
| GET | `/bell-schedules/[id]` | `bell-schedules:read` | One schedule with its periods |
| PATCH | `/bell-schedules/[id]` | `bell-schedules:update` | Edits |
| PUT | `/bell-schedules/[id]/periods` | `bell-schedules:update` | Replaces the day's periods |
| POST | `/bell-schedules/[id]/activate` | `bell-schedules:update` | Activates |
| DELETE | `/bell-schedules/[id]` | `bell-schedules:update` | Deletes a draft |
| GET | `/timetables` | `timetables:read` | Lists timetables |
| POST | `/timetables` | `timetables:update` | Creates a draft |
| GET | `/timetables/[id]` | `timetables:read` | One timetable |
| PATCH | `/timetables/[id]` | `timetables:update` | Edits name and dates |
| DELETE | `/timetables/[id]` | `timetables:update` | Deletes a draft |
| GET | `/timetables/[id]/entries` | `timetables:read` | Entries; filter by section, teacher or room |
| PUT | `/timetables/[id]/entries` | `timetables:update` | Saves changes to entries |
| POST | `/timetables/[id]/validate` | `timetables:read` | Returns conflicts |
| POST | `/timetables/[id]/auto-fill` | `timetables:update` | Places missing lessons |
| POST | `/timetables/[id]/copy` | `timetables:update` | Copies to a new draft |
| POST | `/timetables/[id]/publish` | `timetables:publish` | Publishes |
| GET | `/timetable/day` | `timetables:read` | The resolved day for a section, teacher or room |
| GET | `/timetable/week` | `timetables:read` | The resolved week |
| GET | `/timetable/free-teachers` | `substitutions:read` | Teachers free in a lesson on a date |
| GET | `/teacher-availability` | `timetables:read` | A teacher's availability |
| PUT | `/teacher-availability/[staffId]` | `teacher-availability:update` | Sets it |
| GET | `/substitutions` | `substitutions:read` | Lists for a date range |
| POST | `/substitutions` | `substitutions:update` | Creates |
| GET | `/substitutions/[id]/suggestions` | `substitutions:update` | Ranked substitutes |
| PATCH | `/substitutions/[id]` | `substitutions:update` | Assigns or changes the substitute |
| POST | `/substitutions/[id]/cancel` | `substitutions:update` | Cancels |
| GET | `/teach/timetable` | `signed-in` | The signed-in teacher's day or week |
| GET | `/family/children/[id]/timetable` | `signed-in` | A child's week |
| GET | `/learn/timetable` | `signed-in` | The student's own week |

Idempotent: `POST /timetables/[id]/publish`.

## 8 · Client layer

Generated CRUD for bell schedules, timetables and substitutions. Custom hooks: `useTimetableEntries`, `useSaveEntries` (optimistic), `useValidateTimetable`, `usePublishTimetable`, `useDayView`, `useWeekView`, `useFreeTeachers`, `useSubstituteSuggestions`, `useMyDay` (teacher home), `useChildTimetable`.

## 9 · Screens

Under `/school/academics/timetable`. Built in [Phase 8](../20-phases/phase-08-academics.md).

| Screen | Pattern | Notes |
|---|---|---|
| Bell schedules | List + Grid editor | A day as a vertical strip of periods; season dates |
| Timetables | List | Draft, published, archived |
| Timetable editor | Grid editor | Days across, lessons down; switch between Section, Teacher and Room views; drag a subject chip into a cell; conflicts shown live at the side; weekly period counters per subject |
| Publish | Dialog form | Effective date; hard conflicts block; soft conflicts acknowledged |
| Today | Calendar (day) | Whole branch: sections down, lessons across; substitutions highlighted; free periods flagged |
| Substitutions | List | "Needs cover" first; suggestion chips to assign in one click |
| Teacher availability | Grid editor | A week grid per teacher |
| **Teacher:** Today | Dashboard | `/teach`: the day's lessons with room and "mark attendance" on the current one |
| **Parent / Student:** Timetable | Calendar (week) | `/family/timetable`, `/learn/timetable` |

## 10 · Notifications and jobs

Events: `timetable.published` (to teachers and, if set, guardians), `substitution.needs-cover` (to the coordinator), `substitution.assigned` (to the substitute), `substitution.cancelled`.

Jobs: `timetable.create-substitutions-from-leave`, `timetable.uncovered-alert` (30 minutes before the first bell: lessons today with no cover).

## 11 · Offline

Read-only in `teacher.timetable`: the teacher's own entries and substitutions for the term, with bell times.

## 12 · AI

- Auto-fill and substitute ranking are a search in code (S6).
- The planning tools place lessons using this module's calendar (A3).

## 13 · Failure cases

- **F-timetable-1** Two coordinators put the same teacher in two rooms at once → the unique index refuses the second save with "Mr Tariq already teaches 9-A in lesson 3 on Monday".
- **F-timetable-2** A teacher leaves mid-term → entries keep their history; future lessons show "no teacher" and appear as needing cover until reassigned.
- **F-timetable-3** Ramadan starts a day earlier than planned → the Ramadan bell schedule's `valid_from` is edited; day views change at once.
- **F-timetable-4** A substitute is assigned who then takes leave → the substitution returns to "needs cover".
- **F-timetable-5** The timetable is published with an effective date in the past → refused; the earliest date is today.
- **F-timetable-6** Auto-fill cannot place 4 lessons → it places the rest and lists the 4 with the reason for each.
- **F-timetable-7** A holiday is declared for tomorrow → day views are empty for that date and its substitutions are cancelled.

## 14 · Seed data

Bell schedules for both branches: Summer (8 lessons), Winter (8), Ramadan (6, shorter), Friday (5). A published timetable for each shift covering every section, with every weekly period placed. Six teachers with availability limits. Ten substitutions in the current week: 6 assigned, 2 needing cover today, 2 free periods.

## 15 · Tests

- **T-timetable-1** Bell schedule selection across season boundaries, Friday and Ramadan.
- **T-timetable-2** The database refuses a teacher clash and a room clash.
- **T-timetable-3** Each validator conflict kind, hard and soft.
- **T-timetable-4** Publish blocked by hard conflicts; publishing ends the previous timetable; history remains queryable for a past date.
- **T-timetable-5** Substitute rules: free, active, branch access; double cover refused.
- **T-timetable-6** Approved leave creates substitution rows for exactly the teacher's lessons.
- **T-timetable-7** Suggestion ranking order.
- **T-timetable-8** A substitute can mark attendance for the covered lesson only.
- **T-timetable-9** Day view on a holiday, a half day and a normal day.
- **T-timetable-10** Auto-fill never moves existing entries.
- **T-timetable-11** A guardian sees only their child's section; a teacher's own-day route returns only their lessons.
- **T-timetable-12** Row-level security and branch scope.

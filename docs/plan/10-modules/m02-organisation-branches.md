# M02 · Organisation and branches

## 1 · Purpose

The school group itself and its campuses: profile, settings, branches, wings and rooms. Everything else hangs from these rows.

## 2 · Depends on

[M00](m00-shared-kernel.md). Referenced by every module.

## 3 · Tables

#### `orgs` · org
One row per school group. This row's own `id` is the organisation id; it has no `org_id` column.

| Column | Type | Rules |
|---|---|---|
| name | text | required |
| name_ur | text | optional |
| slug | text | required; unique across the platform |
| legal_name | text | optional |
| logo_file_id | uuid → files | optional |
| ntn | text | optional; printed on receipts |
| phone | text | optional |
| email | text | optional |
| website | text | optional |
| address | text | optional |
| city | text | required |
| province | enum(punjab, sindh, kp, balochistan, ict, ajk, gb) | required |
| academic_year_start_month | int | required; 1 to 12; default 4 |
| fiscal_year_start_month | int | required; default 7 |
| default_locale | enum(en, ur) | default en |
| billing_mode | enum(student, family) | default student; one voucher per student or per family |
| status | enum(provisioning, active, suspended, closed) | required |

Policy: staff may read their own organisation's row; family users may read name, logo and contact columns through the service; writes are by permission.

#### `org_settings` · org

| Column | Type | Rules |
|---|---|---|
| key | text | required; must be a registered setting with scope `org` |
| value | jsonb | required; validated by the setting's schema |

Policy: every member of the organisation may read, because a setting also shapes what a family sees (which payment methods are offered, who may apply for leave); only staff may write, by permission. The service decides which settings a screen shows.
Unique: (org_id, key).

#### `branches` · org
A campus. All staff of the group can see the list of branches; what they can do inside one depends on their branch access.

| Column | Type | Rules |
|---|---|---|
| code | text | required; 2 to 5 capital letters or digits; used in numbers |
| name | text | required |
| name_ur | text | optional |
| address | text | required |
| city | text | required |
| phone | text | optional |
| email | text | optional |
| gender | enum(boys, girls, mixed) | default mixed |
| principal_staff_id | uuid → staff | optional |
| regulator_name | text | optional |
| regulator_registration_no | text | optional |
| regulator_expires_on | date | optional |
| board_id | uuid → boards | optional |
| board_affiliation_no | text | optional |
| board_affiliation_expires_on | date | optional |
| capacity | int | optional |
| opened_on | date | optional |
| latitude | numeric(9,6) | optional |
| longitude | numeric(9,6) | optional |
| status | enum(active, inactive) | default active |

Unique: (org_id, code) among live rows.

#### `branch_settings` · branch

| Column | Type | Rules |
|---|---|---|
| key | text | required; a registered setting with scope `branch` |
| value | jsonb | required |

Policy: every member of the organisation may read; staff of the branch may write, by permission.
Unique: (branch_id, key).

#### `wings` · branch
A part of a campus with its own head: Primary, Middle, Secondary, or Boys and Girls.

| Column | Type | Rules |
|---|---|---|
| name | text | required |
| name_ur | text | optional |
| grade_from | int | required; 1 to 10 |
| grade_to | int | required; ≥ `grade_from` |
| gender | enum(boys, girls, mixed) | default mixed |
| head_staff_id | uuid → staff | optional |

Unique: (branch_id, name) among live rows.

#### `rooms` · branch

| Column | Type | Rules |
|---|---|---|
| name | text | required |
| kind | enum(classroom, lab, library, hall, office, clinic, store, other) | default classroom |
| capacity | int | optional; > 0 |
| floor | text | optional |
| is_bookable | bool | default false |

Unique: (branch_id, name) among live rows.

#### `onboarding_tasks` · org
The setup checklist a new school group works through.

| Column | Type | Rules |
|---|---|---|
| key | text | required; `profile`, `academic_year`, `grades`, `sections`, `subjects`, `fee_structure`, `staff`, `students`, `first_voucher_run` |
| status | enum(pending, done, skipped) | default pending |
| completed_at | timestamptz | optional |
| completed_by | uuid → profiles | optional |

Unique: (org_id, key).

## 4 · Contracts

`packages/contracts/src/modules/organisation/`: `orgs`, `org-settings`, `branches`, `branch-settings`, `wings`, `rooms`, `onboarding`.

- `UpdateOrg` cannot change `slug` or `status` (platform only).
- `Setting` values are parsed by the registered schema for their key.
- A registered setting also states who may change it (`permission`; left out, it is `org-settings:update`, and `branch-settings:update` for a branch's own value) and who may read it through the API (`readableBy`: `staff`, the default; `member`, for the settings that shape a family's screens; or a permission). `SettingView` is `{ key, scope, label, value, defaultValue, source, canChange }`.
- `GET /org/settings/[key]` takes an optional `branchId` and answers with the value in force there. Staff are told a branch's own values only at a branch they work at (row-level security shows them no other branch's rows), so asking about another branch is refused rather than answered with the group's value; a family may ask about any branch.
- `settings.ts` in this folder registers the organisation-wide keys that belong to no other module: `general.languages`, `general.number_formats`, `general.working_week`, `security.password_policy`, `security.mfa_roles`, `security.session_hours`, `documents.letterhead`, `documents.signatures`.

## 5 · Rules

- **R-org-1** A setting can be read or written only if its key is registered. The registry states its scope, schema, default and the permission needed to change it.
- **R-org-2** `getSetting` returns the branch value, else the organisation value, else the default. A branch can override only keys registered as overridable.
- **R-org-3** A branch code is unique in the group and cannot change once any number has been issued with it.
- **R-org-4** A group always has at least one active branch.
- **R-org-5** A branch with active students or open vouchers cannot be deactivated. The message says how many students and vouchers block it.
- **R-org-6** An inactive branch is read-only. Its history, reports and documents remain available.
- **R-org-7** Changing `billing_mode` is allowed only when no voucher is open for the current period: none of this month's vouchers is unpaid or part-paid. The fees module answers the question (`registerBillingModeBlocker`), and the message says how many vouchers block it.
- **R-org-8** Changing `academic_year_start_month` is refused once an academic year exists; later years are edited in [M04](m04-school-setup.md). Changing `fiscal_year_start_month` is refused once the fiscal year has been used: it has a journal entry, a closed period, or a second year beside it. A new school is given its first fiscal year when it is created ([M23](m23-accounting.md)); while that year is untouched, changing the month rebuilds the year and its twelve periods around today.
- **R-org-9** A wing's grade range must not overlap another wing of the same branch, unless one is for boys and the other for girls.
- **R-org-10** A room in use by a section, a timetable entry or a future booking cannot be deleted.
- **R-org-11** New branches copy the group's defaults: working week, bell schedule template, and optionally last year's fee structures. The working week needs no copying: a branch without a value of its own has the group's (R-org-2). For the rest, `POST /branches` takes `copyBellSchedule` (default yes) and `copyFeeStructuresFrom` (a branch of the group, optional), and `branch.created` carries them; the timetable and fees modules subscribe and do their own copying.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `org:read` | See the group's profile | ALL_STAFF |
| `org:update` | Change the group's profile | director |
| `org-settings:read` | See settings | LEADERS, finance_head, academic_head, it_admin |
| `org-settings:update` | Change general and security settings | director, principal |
| `branches:read` | See branches | ALL_STAFF |
| `branches:create` | Add a branch | director |
| `branches:update` | Change or deactivate a branch | director, principal |
| `branch-settings:update` | Change a branch's own settings | ADMINS |
| `wings:read` | See wings | ALL_STAFF |
| `wings:update` | Create, change and delete wings | ADMINS |
| `rooms:read` | See rooms | ALL_STAFF |
| `rooms:update` | Create, change and delete rooms | ADMINS, coordinator |
| `onboarding:update` | Tick off setup tasks | ADMINS |

Settings owned by other modules (fees, attendance, exams) need that module's own settings permission, declared in the registry.

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/org` | `org:read` | The group's profile |
| PATCH | `/org` | `org:update` | Changes the profile |
| GET | `/org/settings` | `org-settings:read` | All organisation settings with their defaults |
| GET | `/org/settings/[key]` | `signed-in` | One setting the user's permissions allow |
| PUT | `/org/settings/[key]` | `signed-in` | Writes one setting; the service checks the setting's own permission |
| GET | `/org/public` | `signed-in` | Name, logo and contact details, for family portals |
| GET | `/branches` | `branches:read` | Lists branches |
| POST | `/branches` | `branches:create` | Adds a branch |
| GET | `/branches/[id]` | `branches:read` | One branch |
| PATCH | `/branches/[id]` | `branches:update` | Changes a branch |
| POST | `/branches/[id]/deactivate` | `branches:update` | Deactivates, if nothing blocks it |
| POST | `/branches/[id]/activate` | `branches:update` | Reactivates |
| GET | `/branches/[id]/settings` | `org-settings:read` | The branch's overrides and effective values |
| PUT | `/branches/[id]/settings/[key]` | `signed-in` | Writes one branch override |
| DELETE | `/branches/[id]/settings/[key]` | `signed-in` | Removes an override |
| GET | `/wings` | `wings:read` | Lists wings |
| POST | `/wings` | `wings:update` | Creates |
| PATCH | `/wings/[id]` | `wings:update` | Changes |
| DELETE | `/wings/[id]` | `wings:update` | Deletes |
| GET | `/rooms` | `rooms:read` | Lists rooms |
| POST | `/rooms` | `rooms:update` | Creates |
| PATCH | `/rooms/[id]` | `rooms:update` | Changes |
| DELETE | `/rooms/[id]` | `rooms:update` | Deletes |
| GET | `/onboarding` | `org:read` | The setup checklist with live completion checks |
| POST | `/onboarding/[key]/complete` | `onboarding:update` | Marks done or skipped |

## 8 · Client layer

`orgApi`, `settingsApi` (`get`, `put`, `list`), `branchesApi`, `wingsApi`, `roomsApi`, `onboardingApi`. Hooks: `useOrg`, `useUpdateOrg`, `useSetting(key, branchId?)`, `useSaveSetting`, generated CRUD hooks for branches, wings and rooms, `useOnboarding`.

`useSetting` is the one way a screen reads a setting. It returns the effective value and whether it is overridden at the branch.

## 9 · Screens

Shell `/school/settings` for a branch, `/hq/settings` for the group. Built in [Phase 7](../20-phases/phase-07-school-setup-and-people.md).

| Screen | Pattern | Notes |
|---|---|---|
| Setup checklist | Dashboard | Shown on first sign-in until every task is done or skipped; each task links to its screen |
| School profile | Settings | Name in English and Urdu, logo, contacts, NTN |
| Letterhead and signatures | Settings | Live preview of a document header |
| Branches | List | Students, staff and status per branch |
| Branch | Detail | Tabs: Profile, Wings, Rooms, Settings, Registration |
| New branch | Form page | Option to copy fee structures and bell schedule |
| Rooms | List + Dialog form | |
| General settings | Settings | Languages, working week, number formats |
| Security settings | Settings | Password rules, roles that need two-factor, session length |

## 10 · Notifications and jobs

Events: `branch.created`, `branch.deactivated`, `org.settings-changed`.
The expiry job (`shared.expiry-reminders`) reminds the principal 60, 30 and 7 days before a regulator registration or board affiliation expires.

## 11 · Offline

Branch and room lists are in the `me` sync stream, read-only.

## 12 · AI

None.

## 13 · Failure cases

- **F-org-1** A setting value fails its schema → `VALIDATION` naming the field inside the setting.
- **F-org-2** A key is requested that is not registered → `NOT_FOUND`.
- **F-org-3** Deactivating a branch with 412 active students → `RULE` "412 active students must be transferred or withdrawn first".
- **F-org-4** Two admins edit the school profile at once → the second gets `STALE`.
- **F-org-5** The logo upload fails → the profile saves without the logo and offers a retry.
- **F-org-6** A branch code is changed after vouchers exist → `RULE`.

## 14 · Seed data

Organisation "Roshan Public School" (slug `roshan`), Lahore, Punjab, academic year from April, fiscal year from July. Two branches: Main Campus (`MC`, mixed, 3 wings, 24 rooms) and City Campus (`CC`, girls, 2 wings, 14 rooms). Letterhead with a sample logo. Onboarding mostly done, with two tasks still pending so the checklist is visible.

## 15 · Tests

- **T-org-1** Setting resolution: branch, then organisation, then default; non-overridable key refused at branch level.
- **T-org-2** A setting's own permission is enforced.
- **T-org-3** Branch code uniqueness and lock after first use.
- **T-org-4** Last active branch cannot be deactivated; a branch with students cannot be deactivated.
- **T-org-5** An inactive branch refuses writes in a branch-scoped module.
- **T-org-6** Wing overlap rule.
- **T-org-7** Room in use cannot be deleted.
- **T-org-8** A guardian can read `/org/public` and the settings marked for families, and nothing else in this module.
- **T-org-9** Row-level security: staff of another organisation cannot read `orgs`, `branches`, settings, wings or rooms.

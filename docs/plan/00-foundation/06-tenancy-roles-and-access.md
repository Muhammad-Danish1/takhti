# 06 · Tenancy, roles and access

How Takhti keeps each school's data separate and decides who may do what.

## The hierarchy

```
Takhti platform
└─ Organisation (a school group)            orgs            ← the tenant
   └─ Branch (a campus)                     branches
      └─ Grade and section, per year        grades, sections
         └─ Student                         students, enrollments
```

- **Organisation-level** data is shared by all branches: subjects, grading scheme, fee heads, chart of accounts, roles, staff directory.
- **Branch-level** data belongs to one campus: sections, students, vouchers, attendance, timetable, stock.
- Head office sets policy at the organisation level. A branch may override a setting only where the setting says it can (`branch_settings`).

## People and logins are separate

A person record exists whether or not the person can sign in.

| Record | Table | May have a login |
|---|---|---|
| Employee | `staff` | Yes |
| Parent or guardian | `guardians` | Yes |
| Student | `students` | Yes |
| Login | `auth.users` + `profiles` | — |

A **membership** joins a login to an organisation and to one person record:

```
profiles (user) ──< memberships >── orgs
                        │  kind: staff | guardian | student
                        ├─ staff_id / guardian_id / student_id
                        ├─< membership_roles >── roles ──< role_permissions
                        └─< membership_branches >── branches
```

- One user may hold memberships in more than one organisation (a teacher who is also a parent at another school). The user picks the active one at sign-in; it can be switched later.
- A staff membership can hold **several roles**. Permissions are the union.
- Tables are specified in [M03](../10-modules/m03-identity-roles-audit.md).

## The actor

Built once per request by `authenticate()` and carried in `ctx.actor`.

```ts
interface Actor {
  userId: string;
  orgId: string;
  membershipId: string;
  kind: 'staff' | 'guardian' | 'student' | 'platform';
  roleKeys: readonly string[];
  permissions: ReadonlySet<string>;        // "students:create"
  allBranches: boolean;
  branchIds: readonly string[];
  staffId?: string;
  guardianId?: string;
  studentIds: readonly string[];           // the students a guardian is linked to, or the student
  familyId?: string;                       // the family of a guardian or student
  caps: readonly Capability[];             // 'hr' | 'payroll' | 'health' | 'counselling' | 'papers'
  locale: 'en' | 'ur';
}
```

Roles, permissions, branches and children are read from the database (cached 60 seconds per membership), never trusted from the token. A change to someone's role therefore takes effect within a minute, and suspending a membership takes effect at once because `memberships.status` is checked on every request.

## Two walls

**Wall 1 — the service layer.** Every service function starts with `assertCan(ctx, resource, action)` and applies data scoping. This is where the precise rule lives.

**Wall 2 — row-level security.** Every query runs in a transaction where Postgres knows the actor, and policies filter by organisation, branch and ownership. A missing `where` clause in a query cannot leak another school's rows.

The API connects to Postgres as a role **without** `bypassrls`. Only migrations, the seed script, platform services and the worker's system jobs use the privileged connection, and each such use is listed in [07 · Backend kernel](07-backend-kernel.md).

### What Postgres is told

At the start of each transaction:

```sql
select set_config('request.jwt.claims', '<json>', true);
set local role authenticated;
```

The JSON carries: `sub`, `role`, `org_id`, `kind`, `staff_id`, `guardian_id`, `all_branches`, `branch_ids`, `student_ids`, `family_id`, `caps`. Helper functions in the `app` schema read it:

| Function | Returns |
|---|---|
| `app.org_id()` | uuid |
| `app.user_id()` | uuid |
| `app.kind()` | text |
| `app.is_staff()` | boolean |
| `app.all_branches()` | boolean |
| `app.branch_ids()` | uuid[] |
| `app.student_ids()` | uuid[] |
| `app.staff_id()`, `app.guardian_id()` | uuid |
| `app.family_id()` | uuid; empty for staff |
| `app.has_cap(text)` | boolean; whether the user holds a capability |
| `app.today()` | date, in Pakistan time |

Supabase Realtime and Storage use the user's real token. A Supabase *custom access token hook* (`public.custom_access_token_hook`) adds the same claim names to that token, so the same policies protect those paths.

### Policy templates

A table is declared with `defineTable(name, access, columns)` (`packages/db/src/kernel/define-table.ts`), and its policies are built from `access`: the scope, the modifiers and any finer rule. The templates below are what each produces. (The tables of Wave 0 were written before `defineTable` and apply the same templates through `kernel/policies.ts`.) In every policy, function calls are wrapped as `(select app.x())` so Postgres evaluates them once per query.

**`org`** — staff of the school group.

```sql
create policy t_staff on t for all to authenticated
  using      (org_id = (select app.org_id()) and (select app.is_staff()))
  with check (org_id = (select app.org_id()) and (select app.is_staff()));
```

**`branch`** — the `org` policy plus a restrictive policy:

```sql
create policy t_branch on t as restrictive for all to authenticated
  using      (not (select app.is_staff()) or (select app.all_branches())
              or branch_id = any ((select app.branch_ids())::uuid[]))
  with check (same);
```

**`+family`** — an extra read policy. The column is `student_id` unless the spec says `+family(column)`.

```sql
create policy t_family_read on t for select to authenticated
  using (org_id = (select app.org_id())
         and student_id = any ((select app.student_ids())::uuid[]));
```

**`+household`** — an extra read policy for rows that belong to a family as a whole (fee vouchers, payments, family credit). The column is `family_id` unless the spec says `+household(column)`; on the `families` table itself it is `id`.

```sql
create policy t_household_read on t for select to authenticated
  using (org_id = (select app.org_id())
         and family_id = (select app.family_id()));
```

**`+self`** — an extra policy for the row's own user. The column is `user_id` unless the spec says `+self(column)`. On an organisation table the row must also belong to the organisation the user is signed in to, so a person who belongs to two schools never reaches one school's rows from the other.

```sql
create policy t_self on t for all to authenticated
  using      (org_id = (select app.org_id()) and user_id = (select app.user_id()))
  with check (org_id = (select app.org_id()) and user_id = (select app.user_id()));
```

A spec's `Policy:` line may narrow what the owner can do: read and update but not create or remove (`profiles`), or read only (`memberships`, `login_events`). `memberships` is the one table read across organisations, for the "choose where to continue" screen.

**`global`** — `for select using (true)`; no write policy.
**`platform`** — row-level security on, no policy: unreachable except through the privileged connection.
**`append-only`** — only `insert` and `select` policies exist.

Where a family user may write (a leave request, a chat message, a homework submission), the module spec states the exact policy in a `Policy:` line, and the table's `access` carries it:

| Said in `access` | Policy it produces |
|---|---|
| `member: 'read'` | Every member of the organisation may read. Used for what a family's screens need although staff own it: the calendar, grades, sections, subjects, who teaches what |
| `member: { read: { status: 'published' } }` | Members read rows in that state only; the service narrows further (to a child's class, say) |
| `familyRule: 'append'` | A guardian or student may also add rows about their own students |
| `familyRule: { read: true, update: { status: 'draft' } }` | ... and change them while they are in that state |
| `householdRule`, `selfAccess` | The same for a household's rows and a user's own |
| `guardian: 'id'` | The guardian a row is about may read it (`guardians`, a request about themself) |

A rule that still cannot be said this way is written by hand and the table is marked `custom`.

**What a family may know about staff.** Families never read the `staff` table: its rows carry work phone numbers and employment details. They read the view **`staff_directory`** (id, name, gender, photograph, whether the person still works here), which filters by the reader's organisation itself and cannot be written to. A view runs with its owner's rights, so row-level security on the table beneath does not guard it; every view is therefore listed in `tests/db/foundation.test.ts` and proved in `tests/api/security/views.test.ts`.

### The table registry

Every table is registered in `packages/db/src/registry.ts` with its scope, its modifiers, and what each group of users may do (`none`, `read`, `insert`, `append`, `update`, `write`, or operation by operation, optionally only while a row is in a named state). The registry is what the generated security tests read: for each table they write rows in three places (own organisation and branch, another branch, another organisation), act as seven kinds of user, and compare what each could read, change, remove and add with what the registry says. Where a rule depends on a row's state, the whole probe is repeated with the rows in each such state and once in none of them. A missing policy and a policy that is too wide both fail; `tests/api/security/rls.engine.test.ts` damages policies on purpose to prove it. A table with a hand-written policy is marked `custom` and has its own section in `tests/api/security/custom-policies.test.ts`.

### One door

Supabase can expose every table through its own Data API (PostgREST and GraphQL). **Takhti switches that off**, locally in `supabase/config.toml` and in the cloud project's settings. Row-level security would still hold there, but every rule and permission lives in the services, and a second door straight into the tables would let a signed-in user step around them. Visitors who are not signed in (`anon`) hold no privilege on any table, and signed-in users hold only select, insert, update and delete, never truncate.

### Capabilities for sensitive tables

Permissions are checked in services, because there are several hundred of them and they change. A few tables are sensitive enough to deserve a second wall in the database as well: salaries, staff private details, health records and counselling notes. For those, the actor carries a short list of **capabilities**, each derived from permissions:

| Capability | Held by anyone with at least one of |
|---|---|
| `hr` | `staff-private:read`, `staff:manage` |
| `payroll` | `payroll:read`, `payroll:run`, `salary-structures:manage` |
| `health` | `health:read`, `clinic:manage` |
| `counselling` | `counselling:read-all`. A counsellor reaches their own notes as their author; only this permission opens everyone's |
| `papers` | `question-papers:read-all`, `question-papers:approve`. An examination paper is confidential until its exam date: before that, only its writer and holders of this capability read it |

The list lives in `packages/contracts/src/access/capabilities.ts`. A table marked **`+cap(name)`** gets a restrictive policy:

```sql
create policy t_cap on t as restrictive for all to authenticated
  using (not (select app.is_staff())
         or (select app.has_cap('payroll'))
         or staff_id = (select app.staff_id()));   -- last line only when the table has a staff_id column
```

So a staff member without the capability sees nothing in that table except rows about themselves, even if a service forgot a permission check. Family users are unaffected by this policy and are still limited by `+family`, `+household` or `+self`.

Two consequences to keep in mind. A `+cap` table is written only by people who hold the capability, by the person the row is about, or by a system job (`runAsSystem` carries every capability). And a table that ordinary users must write to indirectly — the ledger, which a cashier's payment posts to — is deliberately **not** a `+cap` table; it is protected by permissions in its service.

### Scoping that row-level security does not do

Finer rules are enforced in services with helpers from `kernel/scope.ts` (and, for the two that read the academic tables, `modules/academics/scope.ts`), and each has a test.

| Rule | Helper |
|---|---|
| A teacher sees only the sections they teach or are class teacher of | `teacherSectionIds(ctx)` |
| A section head sees only the grades of their wing | `wingGradeIds(ctx)` |
| A cashier sees only their own open cash session's payments by default | `ownCashSession(ctx)` |
| A guardian acts only for their own children | `assertOwnStudent(ctx, studentId)` |
| Members may read a shared table (sections, timetable, published homework) but a family is shown only what concerns its own children | the service's own query |
| A person never approves their own request | `assertNotSelf(ctx, requestedBy)` |

## Roles

32 built-in roles. A school group can copy any of them into a custom role and change its permissions.

| Level | Key | Name | Branches |
|---|---|---|---|
| Platform | `super_admin` | Super Admin | — |
| Platform | `support_agent` | Support Agent | — |
| Group | `owner` | Owner / CEO | All |
| Group | `director` | Director | All |
| Group | `finance_head` | Group Finance Head | All |
| Group | `academic_head` | Group Academic Head | All |
| Group | `auditor` | Auditor (read-only) | All |
| Branch | `principal` | Principal | Assigned |
| Branch | `vice_principal` | Vice Principal | Assigned |
| Branch | `branch_admin` | Branch Admin | Assigned |
| Branch | `section_head` | Section Head (Primary / Middle / Secondary) | Assigned |
| Academics | `coordinator` | Academic Coordinator | Assigned |
| Academics | `exam_controller` | Exam Controller | Assigned |
| Academics | `class_teacher` | Class Teacher | Assigned |
| Academics | `subject_teacher` | Subject Teacher | Assigned |
| Academics | `counsellor` | Counsellor | Assigned |
| Finance | `accountant` | Accountant | Assigned |
| Finance | `cashier` | Cashier | Assigned |
| HR | `hr_manager` | HR Manager | Assigned |
| HR | `payroll_officer` | Payroll Officer | Assigned |
| Front office | `admissions_officer` | Admissions Officer | Assigned |
| Front office | `receptionist` | Receptionist | Assigned |
| Operations | `librarian` | Librarian | Assigned |
| Operations | `transport_manager` | Transport Manager | Assigned |
| Operations | `driver` | Driver / Attendant | Assigned |
| Operations | `store_keeper` | Store Keeper | Assigned |
| Operations | `nurse` | Nurse | Assigned |
| Operations | `hostel_warden` | Hostel Warden | Assigned |
| Operations | `security_guard` | Security Guard | Assigned |
| Operations | `it_admin` | IT Admin | Assigned |
| Family | `guardian` | Parent / Guardian | — |
| Family | `student` | Student | — |

### Role groups used in the module specs

| Group | Roles |
|---|---|
| `LEADERS` | director, principal, vice_principal, branch_admin |
| `ADMINS` | principal, branch_admin |
| `ACADEMIC` | academic_head, section_head, coordinator, exam_controller |
| `TEACHERS` | class_teacher, subject_teacher |
| `FINANCE` | finance_head, accountant, cashier |
| `ACCOUNTS` | finance_head, accountant |
| `HR` | hr_manager, payroll_officer |
| `FRONT` | admissions_officer, receptionist |
| `FAMILY` | guardian, student |
| `ALL_STAFF` | every role from `owner` to `it_admin` |
| `PLATFORM` | super_admin, support_agent |

### Two computed roles

- **`owner`** holds every permission. It is never listed in a "Default roles" column. An organisation must always have at least one active owner; the last one cannot be removed or suspended.
- **`auditor`** holds every permission whose action is `read`, `reports` or `export`, and nothing else. The two exceptions are health and counselling records, which an auditor has no reason to read: permissions that grant the `health` or `counselling` capability are left out.

## Permissions

- Key format: `<resource>:<action>`. Standard actions: `read`, `create`, `update`, `delete`, `export`, and `manage` (create, change and remove, used for setup records where splitting the three adds nothing). Modules add verbs that name a real step: `approve`, `publish`, `collect`, `reverse`, `lock`, `decide`, `verify`, `pay`, `run`. An action that lets someone go past a rule is named for it: `override`, `waive`, `unlock`, `reopen`; these are checked inside services, not on a route.
- The catalogue is code: each module's contract file exports its permission list with a label and description. A migration seeds the `permissions` table from it, so the roles screen always shows the real list.
- Default grants per role come from the "Default roles" column in each module spec. They are seeded when an organisation is created and can then be edited per organisation.
- Any action other than `read` implies `read` of the same resource when that permission exists: the roles screen ticks `read` automatically and will not save a role that can change what it cannot see.
- The compiled list is generated in [`../30-reference/permissions-index.md`](../30-reference/permissions-index.md).

## Modules can be switched off

`org_modules` records which modules a school group has, from its plan plus overrides. Each service calls `assertModule(ctx, 'transport')`. When a module is off:

- its routes return `403 FORBIDDEN` with the message "Transport is not part of your plan";
- its menu items and dashboard tiles are hidden;
- its data is kept, never deleted.

## Takhti staff

- Platform staff sign in at `/platform` and are checked against `platform_admins`. Two-factor sign-in is compulsory.
- Platform routes use the permission cell `platform` and run on the privileged connection inside `runAsPlatform()`, which writes every action to `platform_audit_log`.
- **Support access** to a school is a time-boxed session (default 60 minutes) that the school's owner can see, with a stated reason, read-only unless the owner grants write access. See [M01](../10-modules/m01-platform-console.md).

## Sign-in methods

| Who | Identifier | Proof |
|---|---|---|
| Staff | Email or phone | Password; two-factor code compulsory for owner, finance and platform roles |
| Guardian | Phone | One-time code by SMS or WhatsApp, or a password they set |
| Student | School code + admission number | Password or PIN issued by the school |

Details and screens are in [Phase 5](../20-phases/phase-05-auth.md).

## What each kind of user can reach

| | Own organisation | Other organisations | Own branch | Other branches | Own children | Other students |
|---|---|---|---|---|---|---|
| Staff, all branches | Yes | Never | Yes | Yes | — | By permission |
| Staff, assigned branches | Yes | Never | Yes | Never | — | By permission and section scope |
| Guardian | Only shared items (notices, calendar) | Never | — | — | Yes | Never |
| Student | Only shared items | Never | — | — | Self only | Never |
| Platform staff | Through a support session | Through a support session | — | — | — | — |

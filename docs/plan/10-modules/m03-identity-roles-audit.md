# M03 · Identity, roles and audit

## 1 · Purpose

Who can sign in, which organisation and person record they belong to, what they are allowed to do, and a permanent record of what they did. The model is explained in [06 · Tenancy, roles and access](../00-foundation/06-tenancy-roles-and-access.md).

## 2 · Depends on

[M00](m00-shared-kernel.md), [M02](m02-organisation-branches.md). Person records come from [M07](m07-students.md) (`students`, `guardians`) and [M26](m26-staff-recruitment.md) (`staff`).

## 3 · Tables

#### `profiles` · platform +self(id)
One row per Supabase Auth user. `id` equals `auth.users.id`.

| Column | Type | Rules |
|---|---|---|
| full_name | text | required |
| email | text | optional; lower case |
| phone | text | optional; E.164 |
| avatar_file_id | uuid → files | optional |
| last_seen_at | timestamptz | optional |
| is_platform | bool | default false |

Policy: a user reads and updates their own row, and can neither create nor remove it (the system does both); staff may read the profiles of current members of their own organisation (through `memberships`).

#### `memberships` · org +self
Joins a login to an organisation and one person record.

| Column | Type | Rules |
|---|---|---|
| user_id | uuid → profiles | required |
| kind | enum(staff, guardian, student) | required |
| staff_id | uuid → staff | required when kind is staff |
| guardian_id | uuid → guardians | required when kind is guardian |
| student_id | uuid → students | required when kind is student |
| status | enum(invited, active, suspended) | required |
| all_branches | bool | default false |
| suspended_reason | text | optional |
| token_version | int | default 1; raising it ends every session of this membership |
| last_active_at | timestamptz | optional |

Unique: (org_id, user_id, kind) among live rows; (org_id, staff_id), (org_id, guardian_id), (org_id, student_id) among live rows where set.
Check: exactly one of `staff_id`, `guardian_id`, `student_id` is set, matching `kind`.
Policy: a user may read their own memberships in every organisation they belong to (the "choose where to continue" screen needs that) and may change none of them.

#### `membership_roles` · org

| Column | Type | Rules |
|---|---|---|
| membership_id | uuid → memberships | required |
| role_id | uuid → roles | required |

Unique: (membership_id, role_id).

#### `membership_branches` · org

| Column | Type | Rules |
|---|---|---|
| membership_id | uuid → memberships | required |
| branch_id | uuid → branches | required |

Unique: (membership_id, branch_id).

#### `roles` · org

| Column | Type | Rules |
|---|---|---|
| key | text | required; a built-in key or a slug for a custom role |
| name | text | required |
| name_ur | text | optional |
| description | text | optional |
| level | enum(group, branch, academics, finance, hr, front, operations, family) | required |
| is_system | bool | default false; built-in roles |
| is_locked | bool | default false; `owner`, `auditor`, `guardian`, `student` cannot be edited |
| default_all_branches | bool | default false |

Unique: (org_id, key) among live rows.

#### `permissions` · global
The catalogue, seeded from code by a migration.

| Column | Type | Rules |
|---|---|---|
| key | text | required; unique; `resource:action` |
| resource | text | required |
| action | text | required |
| module_key | text | required |
| label | text | required |
| description | text | optional |
| is_sensitive | bool | default false; shown with a warning on the roles screen |

#### `role_permissions` · org

| Column | Type | Rules |
|---|---|---|
| role_id | uuid → roles | required |
| permission_key | text | required; must exist in `permissions` |

Unique: (role_id, permission_key).

#### `invitations` · org

| Column | Type | Rules |
|---|---|---|
| kind | enum(staff, guardian, student) | required |
| person_id | uuid | required; the staff, guardian or student record |
| email | text | optional |
| phone | text | optional; at least one of email and phone |
| token_hash | text | required; unique; the token itself is never stored |
| role_ids | uuid[] | default empty; staff only |
| branch_ids | uuid[] | default empty |
| all_branches | bool | default false |
| status | enum(pending, accepted, expired, revoked) | default pending |
| expires_at | timestamptz | required; 7 days |
| sent_count | int | default 0 |
| last_sent_at | timestamptz | optional |
| accepted_at | timestamptz | optional |
| accepted_user_id | uuid → profiles | optional |

Unique: (org_id, kind, person_id) where status is pending.

#### `audit_log` · org append-only
Every change, by whom, when and how.

| Column | Type | Rules |
|---|---|---|
| actor_id | uuid → profiles | optional; empty for system jobs |
| actor_kind | enum(staff, guardian, student, platform, system) | required |
| source | enum(api, sync, job, ai) | required |
| request_id | text | required |
| branch_id | uuid → branches | optional |
| entity | text | required; resource name |
| entity_id | uuid | required |
| action | text | required; `create`, `update`, `delete`, or a verb |
| changes | jsonb | default `{}`; `{ field: [before, after] }`, sensitive values masked |
| summary | text | optional; one readable line |
| ip | text | optional |
| user_agent | text | optional |
| device_id | uuid → sync_devices | optional |
| support_session_id | uuid → support_sessions | optional |

Policy: any member may insert; staff may read.
Index: (org_id, entity, entity_id, created_at); (org_id, actor_id, created_at); (org_id, created_at).

#### `login_events` · platform +self append-only

| Column | Type | Rules |
|---|---|---|
| user_id | uuid → profiles | optional; empty for a failed attempt on an unknown identifier |
| org_id | uuid → orgs | optional |
| event | enum(sign_in, sign_out, failed, locked, otp_sent, mfa_passed, mfa_failed, password_reset, invitation_accepted) | required |
| identifier_hash | text | optional; hash of the email or phone tried |
| ip | text | optional |
| user_agent | text | optional |

Policy: a user may read their own sign-in history and change nothing.

#### `user_devices` · platform +self

| Column | Type | Rules |
|---|---|---|
| user_id | uuid → profiles | required |
| fingerprint | text | required; a stable per-browser or per-app id |
| name | text | optional |
| platform | enum(web, android, ios) | required |
| push_token | text | optional |
| last_seen_at | timestamptz | required |

Unique: (user_id, fingerprint).

#### `user_preferences` · platform +self

| Column | Type | Rules |
|---|---|---|
| user_id | uuid → profiles | required; unique |
| locale | enum(en, ur) | default en |
| theme | enum(system, light, dark) | default system |
| density | enum(compact, normal, comfortable) | default normal |
| number_style | enum(international, south_asian) | default international |
| default_org_id | uuid → orgs | optional |
| default_branch_id | uuid → branches | optional |

## 4 · Contracts

`packages/contracts/src/modules/identity/`: `me`, `roles`, `permissions`, `memberships`, `invitations`, `audit-log`, `login-events`.

- `Me`: `{ user, membership, org, roles, permissions[], branches, allBranches, modules[], person, preferences, otherMemberships[] }` — everything a client needs to draw the right shell.
- `SetRolePermissions`: `{ permissionKeys: string[], version }`.
- `CreateInvitation`: `{ kind, personId, email?, phone?, roleIds?, branchIds?, allBranches? }`.
- `AcceptInvitation`: `{ token, password?, otp? }`.
- `AuditQuery`: filters by `entity`, `entityId`, `actorId`, `action`, `source`, `branchId`, `from`, `to`; cursor paging.

## 5 · Rules

- **R-identity-1** One login per person record per organisation. A second invitation for the same person replaces the pending one.
- **R-identity-2** A guardian's login is identified by phone number. Children who share that guardian record are all reachable from the one login.
- **R-identity-3** An organisation always has at least one active member holding `owner`. The last one cannot be suspended, lose the role, or be deleted.
- **R-identity-4** `owner`, `auditor`, `guardian` and `student` roles cannot be edited. Other built-in roles can be edited and reset to their defaults.
- **R-identity-5** Saving a role adds `read` for every resource where it holds `create`, `update`, `delete` or a custom verb.
- **R-identity-6** A role held by any member cannot be deleted.
- **R-identity-7** A user cannot grant a permission they do not hold themselves, nor assign a role containing one.
- **R-identity-8** A user cannot change their own roles or branch access.
- **R-identity-9** Changing a membership's roles or branches raises `token_version` and clears the access cache; the change is in force on the next request.
- **R-identity-10** Suspending a membership refuses its very next request. Reactivating restores exactly the roles it had.
- **R-identity-11** A staff membership's branch access defaults to the staff record's home branch, or all branches if any of its roles has `default_all_branches`.
- **R-identity-12** An invitation link is single use and expires after 7 days. It can be resent at most 5 times, at least 2 minutes apart.
- **R-identity-13** Accepting an invitation creates the login if none exists for that email or phone, or links the existing login, then activates the membership.
- **R-identity-14** When a staff member's employment ends ([M26](m26-staff-recruitment.md)), their membership is suspended automatically at the end of their last working day.
- **R-identity-15** When a student leaves or graduates, the student's and guardians' memberships stay active in read-only form for 90 days so documents can be downloaded, then are suspended. A guardian with another active child is unaffected.
- **R-identity-16** A role listed in the `security.mfa_roles` setting cannot use the app until two-factor is enrolled.
- **R-identity-17** The audit log cannot be edited or deleted by anyone, including owners and platform staff.
- **R-identity-18** Audit entries mask the fields on the redaction list. Reading the unmasked value of a sensitive field needs `…:read-sensitive` and itself writes an audit entry.
- **R-identity-19** A user with memberships in several organisations chooses one at sign-in; switching issues a fresh session for the chosen organisation.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `roles:read` | See roles and their permissions | LEADERS, hr_manager, it_admin |
| `roles:update` | Create, edit, reset and delete roles | director, principal |
| `memberships:read` | See who has access and with which roles | LEADERS, hr_manager, it_admin |
| `memberships:update` | Change a user's roles and branches; suspend and reactivate | director, principal, hr_manager |
| `invitations:read` | See pending invitations | LEADERS, hr_manager, admissions_officer, it_admin |
| `invitations:create` | Invite staff, guardians and students; resend and revoke | ADMINS, hr_manager, admissions_officer, it_admin |
| `audit-log:read` | Read the audit log | LEADERS, finance_head, it_admin |
| `audit-log:export` | Export the audit log | director, principal |
| `login-events:read` | See sign-in history of the organisation's members | ADMINS, it_admin |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/me` | `signed-in` | The current user, membership, permissions and modules |
| PATCH | `/me` | `signed-in` | Changes own name, photo and preferences |
| GET | `/me/memberships` | `signed-in` | Organisations this login belongs to |
| POST | `/me/switch-org` | `signed-in` | Makes another membership the active one |
| POST | `/me/sign-out-everywhere` | `signed-in` | Ends every session of this user |
| POST | `/me/change-phone` | `signed-in` | Starts a verified phone change |
| POST | `/me/change-phone/verify` | `signed-in` | Completes it with the code sent to the new number |
| GET | `/me/login-events` | `signed-in` | Own recent sign-ins and devices |
| GET | `/permissions` | `roles:read` | The permission catalogue, grouped by module |
| GET | `/roles` | `roles:read` | Lists roles with member counts |
| POST | `/roles` | `roles:update` | Creates a custom role, optionally copied from another |
| GET | `/roles/[id]` | `roles:read` | One role with its permissions |
| PATCH | `/roles/[id]` | `roles:update` | Renames or describes a role |
| PUT | `/roles/[id]/permissions` | `roles:update` | Replaces the role's permissions |
| POST | `/roles/[id]/reset` | `roles:update` | Restores a built-in role's defaults |
| DELETE | `/roles/[id]` | `roles:update` | Deletes an unused custom role |
| GET | `/memberships` | `memberships:read` | Lists members with roles, branches, status, last active |
| GET | `/memberships/[id]` | `memberships:read` | One member |
| PATCH | `/memberships/[id]` | `memberships:update` | Sets roles and branch access |
| POST | `/memberships/[id]/suspend` | `memberships:update` | Suspends with a reason |
| POST | `/memberships/[id]/reactivate` | `memberships:update` | Reactivates |
| POST | `/memberships/[id]/force-sign-out` | `memberships:update` | Ends the member's sessions |
| POST | `/memberships/[id]/reset-password` | `memberships:update` | Sends a reset link or issues a temporary PIN for a student |
| GET | `/invitations` | `invitations:read` | Lists invitations |
| POST | `/invitations` | `invitations:create` | Invites one person |
| POST | `/invitations/bulk` | `invitations:create` | Invites many (all guardians of a class, all new staff) |
| POST | `/invitations/[id]/resend` | `invitations:create` | Sends again |
| POST | `/invitations/[id]/revoke` | `invitations:create` | Cancels |
| GET | `/invitations/lookup` | `public` | Given a token: the school's name and the person's first name |
| POST | `/invitations/accept` | `public` | Accepts an invitation |
| GET | `/audit-log` | `audit-log:read` | Reads the audit log with filters |
| GET | `/audit-log/export` | `audit-log:export` | Exports it |
| GET | `/login-events` | `login-events:read` | Sign-in history of the organisation's members |

Signing in, one-time codes, password reset and two-factor are calls from the browser to Supabase Auth, not routes of ours. See [Phase 5](../20-phases/phase-05-auth.md).

## 8 · Client layer

`meApi`, `rolesApi`, `permissionsApi`, `membershipsApi`, `invitationsApi`, `auditLogApi`. Hooks: `useMe` (loaded once per session and kept fresh), `useCan(permission)`, `useModule(key)`, generated role and membership hooks, `useSetRolePermissions`, `useInvite`, `useBulkInvite`, `useAcceptInvitation`, `useAuditLog` (infinite list).

`@takhti/hooks` also exports `SessionProvider`, which supplies `useMe`, handles "session expired" from the API client, and reloads access when the server reports a higher `token_version`.

## 9 · Screens

| Screen | Pattern | Where |
|---|---|---|
| Sign in, verify code, two-factor, forgot password, choose organisation, accept invitation | Auth pages | `(auth)`, [Phase 5](../20-phases/phase-05-auth.md) |
| My account | Settings | Every shell: profile, language, theme, password, two-factor, devices, sign out everywhere |
| Users and access | List | `/school/settings/users`: filter by role, branch, status, kind |
| User access | Detail | Roles, branches, status, recent activity, sign-in history |
| Roles | List | Built-in and custom, member counts |
| Role | Grid editor | Permission matrix grouped by module; sensitive permissions flagged; "what changed" before saving |
| Invitations | List | Pending, expired; resend, revoke; bulk invite |
| Audit log | List | The layout of the audit-log reference: tabs by outcome, search, filters, table |
| Activity tab | Timeline | On every detail page: that record's audit entries |

## 10 · Notifications and jobs

Events: `invitation.created` (sends the link by email, SMS or WhatsApp), `membership.suspended`, `membership.roles-changed`, `auth.new-device`, `auth.password-changed`, `auth.locked`.

Jobs: `identity.expire-invitations` (hourly), `identity.suspend-ended-staff` (daily), `identity.suspend-left-families` (daily).

## 11 · Offline

`me` (profile, permissions, modules) is synced so the offline shell can draw the right menu. No offline writes.

## 12 · AI

None. The assistant's tools are filtered by the same permission set loaded here.

## 13 · Failure cases

- **F-identity-1** A guardian accepts an invitation with a phone number that already has a login in another school → the existing login gains a second membership; nothing is duplicated.
- **F-identity-2** Two parents share one phone number → one login reaches both guardian records' children; the admissions screen warns when a phone is reused across guardians.
- **F-identity-3** The invitation link is opened after it expired → a clear page with "Ask the school to send a new link"; staff see it as expired with a resend action.
- **F-identity-4** An admin removes their own last admin role → refused by R-identity-8.
- **F-identity-5** The only owner tries to leave → refused by R-identity-3.
- **F-identity-6** A role is edited while 40 members are working → all 40 pick up the change on their next request; nobody is signed out.
- **F-identity-7** A suspended user's device is offline → it wipes at next contact ([14](../00-foundation/14-offline-design.md)).
- **F-identity-8** The SMS with the invitation is not delivered → the invitation shows "not delivered" and can be resent or copied as a link for the school to share.
- **F-identity-9** A permission is removed from the code catalogue in a later release → the migration removes it from `permissions` and `role_permissions`; roles are otherwise unchanged.

## 14 · Seed data

All 30 non-platform built-in roles with their default permissions; one custom role ("Deputy Head — Girls Wing"); one active member for every built-in role; two suspended members; six pending and two expired invitations; about 400 audit entries spread over the seeded activity.

## 15 · Tests

- **T-identity-1** `/me` returns the right permissions, branches and modules for each built-in role.
- **T-identity-2** `owner` holds everything; `auditor` holds only read and export.
- **T-identity-3** Implied `read` on role save.
- **T-identity-4** Cannot grant what one does not hold; cannot edit own access.
- **T-identity-5** Last owner protection in all three forms.
- **T-identity-6** Suspension takes effect on the next request; reactivation restores roles.
- **T-identity-7** Role change is visible within the cache window and immediately after `token_version` rises.
- **T-identity-8** Invitation: create, accept, reuse refused, expiry, resend limits, replacing a pending one.
- **T-identity-9** One phone, two guardian records: one login reaches both families' children.
- **T-identity-10** Audit log: every write in a sample of services produced one entry; masked fields are masked; no route can update or delete an entry.
- **T-identity-11** Row-level security: a member of another organisation reads no roles, memberships or audit entries; a guardian reads no other member's data.
- **T-identity-12** The role matrix test ([11](../00-foundation/11-testing-strategy.md)) passes for all built-in roles.

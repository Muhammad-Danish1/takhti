# M00 · Shared kernel tables

## 1 · Purpose

Tables and routes that belong to no single module: files, background jobs, events, approvals, imports and exports, numbering, custom fields, notes, and the offline bookkeeping. The code that uses them is the kernel described in [07 · Backend kernel](../00-foundation/07-backend-kernel.md).

## 2 · Depends on

[M02](m02-organisation-branches.md) (`orgs`, `branches`), [M03](m03-identity-roles-audit.md) (`profiles`).

## 3 · Tables

#### `files` · org
One uploaded or generated file. Bytes live in Storage; this row is the record of them.

| Column | Type | Rules |
|---|---|---|
| bucket | text | required |
| path | text | required; unique |
| purpose | enum(photo, document, learning, import, export, generated, knowledge, site, payment_proof) | required |
| original_name | text | required; label only, never used as a path |
| mime_type | text | required |
| size_bytes | bigint | required; > 0 |
| status | enum(pending, ready, quarantined, deleted) | required; default pending |
| checksum | text | optional; SHA-256 of the content |
| width | int | optional; images |
| height | int | optional; images |
| thumbnail_path | text | optional |
| uploaded_by | uuid → profiles | required |

Policy: any member of the organisation may insert their own upload, read it, and change it while it is still `pending`; staff read and write every file row of the organisation. Everyone else reaches a file only through a signed link issued by a service.
Index: (org_id, status, created_at).

#### `attachments` · org
Links a file to any record.

| Column | Type | Rules |
|---|---|---|
| entity_type | text | required; a resource name such as `students` |
| entity_id | uuid | required |
| file_id | uuid → files | required |
| label | text | optional |
| sort_order | int | default 0 |

Index: (org_id, entity_type, entity_id).

#### `generated_documents` · org
A PDF made by the document pipeline.

| Column | Type | Rules |
|---|---|---|
| kind | text | required; a key from the document catalogue |
| entity_type | text | required |
| entity_id | uuid | required |
| file_id | uuid → files | required |
| number | text | optional; the document's printed number |
| language | enum(en, ur, both) | required |
| content_hash | text | required |
| verify_token_hash | text | optional; for the public verification page |
| batch_id | uuid | optional |
| revoked_at | timestamptz | optional |
| revoked_reason | text | optional |

Unique: (org_id, kind, number) where number is set.

#### `number_sequences` · org
Counters behind human-facing numbers.

| Column | Type | Rules |
|---|---|---|
| key | text | required; `admission`, `fee_voucher`, `receipt`, … |
| branch_id | uuid → branches | optional |
| period | text | required; empty text when the sequence never resets |
| next_value | int | required; default 1; > 0 |

Policy: any member of the organisation may read and change its counters, because a family user's action (raising a complaint, paying online) can take a number too. Nothing reaches this table except the numbering kernel.
Unique: (org_id, key, branch_id, period), where an empty `branch_id` counts as a value.

#### `jobs` · org
The background job queue.

| Column | Type | Rules |
|---|---|---|
| name | text | required |
| payload | jsonb | required |
| status | enum(queued, running, succeeded, failed, cancelled) | required; default queued |
| priority | int | default 0 |
| run_at | timestamptz | required; default now |
| attempts | int | default 0 |
| max_attempts | int | default 5 |
| timeout_seconds | int | default 120 |
| concurrency_key | text | optional; jobs sharing a key never run together |
| dedupe_key | text | optional |
| locked_by | text | optional; worker id |
| locked_at | timestamptz | optional |
| started_at | timestamptz | optional |
| finished_at | timestamptz | optional |
| last_error | text | optional |
| parent_job_id | uuid → jobs | optional |
| progress | jsonb | optional; `{ done, total }` |

`org_id` is empty for platform jobs, which are reachable only through the privileged connection.
Policy: any member may insert a job for their organisation; staff with `jobs:read` read.
Unique: (dedupe_key) where status is queued or running.
Index: (status, run_at, priority); (org_id, name, created_at).

#### `job_schedules` · platform
Recurring jobs.

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique |
| cron | text | required; evaluated in Pakistan time |
| job_name | text | required |
| payload | jsonb | default `{}` |
| fan_out | enum(platform, per_org, per_branch) | required |
| is_enabled | bool | default true |
| last_enqueued_for | timestamptz | optional |

#### `domain_events` · org append-only
Every business event, in the transaction that caused it.

| Column | Type | Rules |
|---|---|---|
| name | text | required; `fee.payment.recorded` |
| payload | jsonb | required |
| entity_type | text | optional |
| entity_id | uuid | optional |
| request_id | text | required |
| source | enum(api, sync, job, ai) | required |

Policy: any member may insert; staff read.
Index: (org_id, name, created_at); (org_id, entity_type, entity_id).

#### `idempotency_keys` · org +self
Stored results of requests that must not run twice.

| Column | Type | Rules |
|---|---|---|
| user_id | uuid → profiles | required |
| key | text | required |
| route | text | required |
| request_hash | text | required |
| response_status | int | optional; empty while the first request is running |
| response_body | jsonb | optional |
| expires_at | timestamptz | required; 24 hours |

Policy: only the user who made the request reaches their rows, and only inside the organisation they are signed in to. Staff have no access of their own: a stored response may hold another person's data.
Unique: (org_id, user_id, key).

#### `rate_limits` · platform

| Column | Type | Rules |
|---|---|---|
| key | text | required |
| window_start | timestamptz | required |
| count | int | required |

Unique: (key, window_start).

#### `approval_policies` · org
Who must approve what.

| Column | Type | Rules |
|---|---|---|
| entity_type | text | required; `student-discounts`, `expenses`, `leave-requests`, … |
| name | text | required |
| min_amount | paisa | optional; the policy applies at or above this amount |
| steps | jsonb | required; ordered list of `{ roleKeys: string[] }` |
| is_active | bool | default true |

#### `approval_requests` · org

| Column | Type | Rules |
|---|---|---|
| entity_type | text | required |
| entity_id | uuid | required |
| branch_id | uuid → branches | optional |
| policy_id | uuid → approval_policies | required |
| summary | text | required; one line shown to the approver |
| amount | paisa | optional |
| status | enum(pending, approved, rejected, cancelled) | required; default pending |
| current_step | int | default 1 |
| requested_by | uuid → profiles | required |
| decided_at | timestamptz | optional |

Unique: (org_id, entity_type, entity_id) where status is pending.

#### `approval_steps` · org

| Column | Type | Rules |
|---|---|---|
| request_id | uuid → approval_requests | required |
| step_order | int | required |
| status | enum(pending, approved, rejected, skipped) | required |
| decided_by | uuid → profiles | optional |
| decided_at | timestamptz | optional |
| note | text | optional; required on reject |

#### `import_batches` · org

| Column | Type | Rules |
|---|---|---|
| kind | text | required; `students`, `staff`, `marks`, … |
| file_id | uuid → files | required |
| branch_id | uuid → branches | optional |
| status | enum(uploaded, validating, ready, committing, completed, failed, cancelled) | required |
| total_rows | int | default 0 |
| valid_rows | int | default 0 |
| invalid_rows | int | default 0 |
| created_rows | int | default 0 |
| options | jsonb | default `{}` |
| error_file_id | uuid → files | optional; the failed rows with an error column |
| started_by | uuid → profiles | required |

#### `import_rows` · org

| Column | Type | Rules |
|---|---|---|
| batch_id | uuid → import_batches | required |
| row_number | int | required |
| raw | jsonb | required; the cells as uploaded |
| parsed | jsonb | optional; after validation |
| status | enum(valid, invalid, created, skipped, failed) | required |
| errors | jsonb | optional; `{ column: message }` |
| entity_id | uuid | optional; the record created |

Index: (batch_id, status, row_number).

#### `export_jobs` · org +self

| Column | Type | Rules |
|---|---|---|
| user_id | uuid → profiles | required |
| kind | text | required; the list being exported |
| filters | jsonb | required |
| format | enum(csv, xlsx, pdf) | required |
| status | enum(queued, running, ready, failed, expired) | required |
| file_id | uuid → files | optional |
| row_count | int | optional |
| includes_sensitive | bool | default false |

#### `custom_field_defs` · org
Extra fields a school adds to students, guardians, staff or admissions.

| Column | Type | Rules |
|---|---|---|
| entity | enum(student, guardian, staff, admission) | required |
| key | text | required; lower snake_case |
| label | text | required |
| label_ur | text | optional |
| field_type | enum(text, number, date, select, bool) | required |
| options | jsonb | optional; for select |
| is_required | bool | default false |
| sort_order | int | default 0 |
| is_active | bool | default true |

Unique: (org_id, entity, key). Values are stored in the `custom` jsonb column of the owning table and validated against these definitions.

#### `notes` · org
Internal staff notes on any record.

| Column | Type | Rules |
|---|---|---|
| entity_type | text | required |
| entity_id | uuid | required |
| body | text | required; up to 5,000 characters |
| visibility | enum(staff, leaders) | default staff |
| is_pinned | bool | default false |

Index: (org_id, entity_type, entity_id, created_at).

#### `saved_views` · org +self
A user's saved filters for a list.

| Column | Type | Rules |
|---|---|---|
| user_id | uuid → profiles | required |
| list_key | text | required |
| name | text | required |
| filters | jsonb | required |
| is_default | bool | default false |

#### `integrity_findings` · org
Results of the nightly integrity checks.

| Column | Type | Rules |
|---|---|---|
| check_name | text | required |
| entity_type | text | optional |
| entity_id | uuid | optional |
| detail | jsonb | required |
| severity | enum(info, warning, critical) | required |
| status | enum(open, acknowledged, resolved) | default open |
| resolved_by | uuid → profiles | optional |
| resolved_note | text | optional |

#### `sync_devices` · org +self

| Column | Type | Rules |
|---|---|---|
| user_id | uuid → profiles | required |
| device_code | text | required; two characters, unique per branch, printed in offline receipt numbers |
| name | text | required |
| platform | enum(web, android, ios) | required |
| app_version | text | required |
| last_sync_at | timestamptz | optional |
| pending_count | int | default 0 |
| status | enum(active, revoked) | default active |
| revoked_by | uuid → profiles | optional |

Unique: (org_id, device_code) among live rows.

#### `sync_ops` · org append-only
Operation ids already applied, so a repeated upload is harmless.

| Column | Type | Rules |
|---|---|---|
| device_id | uuid → sync_devices | required |
| op_id | text | required |
| table_name | text | required |
| result | enum(applied, rejected, conflict, duplicate) | required |

Policy: any member may insert through the upload route; staff read.
Unique: (org_id, device_id, op_id).

#### `sync_rejections` · org +self

| Column | Type | Rules |
|---|---|---|
| user_id | uuid → profiles | required |
| device_id | uuid → sync_devices | required |
| op_id | text | required |
| table_name | text | required |
| entity_id | uuid | required |
| payload | jsonb | required |
| reason_code | text | required; an API error code |
| reason | text | required; written for the user |
| resolved_at | timestamptz | optional |

#### `sync_conflicts` · org

| Column | Type | Rules |
|---|---|---|
| device_id | uuid → sync_devices | required |
| table_name | text | required |
| entity_id | uuid | required |
| device_value | jsonb | required |
| server_value | jsonb | required |
| status | enum(open, kept_server, took_device, merged) | default open |
| resolved_by | uuid → profiles | optional |
| resolved_at | timestamptz | optional |

## 4 · Contracts

`packages/contracts/src/modules/shared/`: `files`, `jobs`, `approvals`, `approval-policies`, `imports`, `exports`, `custom-fields`, `notes`, `saved-views`, `sync`, `integrity-findings`, `search`.

Notable schemas:

- `CreateUpload`: `{ purpose, fileName, mimeType, size }` — size and type are checked against the purpose's limits before a link is issued.
- `SyncUpload`: `{ deviceId, ops: SyncOp[] }` with at most 500 operations; `SyncOp = { opId, table, op: PUT | PATCH | DELETE, id, data?, baseVersion? }`.
- `Decision`: `{ note? }`; `note` is required for a rejection.
- `GlobalSearch`: `{ q (min 2 characters), kinds?: (students | guardians | staff | vouchers)[] }`.

## 5 · Rules

- **R-shared-1** A file is usable only when `ready`. Confirming checks the stored object's real size and type against what was declared; a mismatch quarantines it.
- **R-shared-2** A file may be attached only by a user who can update the target record.
- **R-shared-3** A download link is issued only to a user who can read the record the file belongs to.
- **R-shared-4** An approval request picks the active policy for its entity type with the highest `min_amount` not above its amount. With no policy, the action needs no approval.
- **R-shared-5** The requester can never decide their own request.
- **R-shared-6** A step can be decided only by a user holding one of the step's roles, with access to the request's branch.
- **R-shared-7** Rejecting ends the request. Approving the last step ends it as approved and emits `approval.approved`; the owning module reacts in the same transaction.
- **R-shared-8** An import commits only rows marked valid, in batches of 200, each row in its own savepoint.
- **R-shared-9** An import batch that is `committing` or `completed` cannot be committed again.
- **R-shared-10** Custom field values are validated against active definitions; a required custom field blocks saving the record.
- **R-shared-11** A sync operation whose `opId` is in `sync_ops` is acknowledged as a duplicate and not applied again.
- **R-shared-12** A sync operation on a table that is not in the offline registry is rejected with `FORBIDDEN`.
- **R-shared-13** A revoked device's upload is refused and the response tells the device to wipe.
- **R-shared-14** Global search returns only records the user could open, at most 8 per kind.
- **R-shared-15** A failed job can be retried by a permitted user at most 3 more times; a cancelled job is never retried.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `jobs:read` | See the organisation's job queue | ADMINS, it_admin, finance_head |
| `jobs:retry` | Retry or cancel a job | ADMINS, it_admin |
| `approvals:read` | See all approval requests, not only one's own | LEADERS, finance_head, academic_head |
| `approval-policies:read` | See approval policies | LEADERS, finance_head |
| `approval-policies:update` | Create and change approval policies | principal, finance_head |
| `custom-fields:read` | See custom field definitions | ALL_STAFF |
| `custom-fields:update` | Create and change custom fields | ADMINS |
| `notes:read` | Read staff notes | ALL_STAFF |
| `notes:create` | Add, edit and delete one's own notes | ALL_STAFF |
| `imports:read` | See past imports | ADMINS, it_admin |
| `integrity:read` | See integrity findings | ADMINS, finance_head, it_admin |
| `integrity:update` | Acknowledge and resolve findings | ADMINS, finance_head |
| `sync-devices:read` | See devices with offline mode on | ADMINS, it_admin |
| `sync-devices:update` | Revoke a device | ADMINS, it_admin |
| `sync-conflicts:update` | Resolve a sync conflict | ACADEMIC, ACCOUNTS, ADMINS |

Deciding an approval needs no permission of its own: the step's roles decide who may act. Starting an import needs the create permission of the thing being imported.

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| POST | `/files/uploads` | `signed-in` | Issues a signed upload link |
| POST | `/files/[id]/confirm` | `signed-in` | Checks and marks the file ready |
| GET | `/files/[id]/url` | `signed-in` | Issues a 5-minute download link after an access check |
| DELETE | `/files/[id]` | `signed-in` | Deletes one's own unattached file |
| GET | `/attachments` | `signed-in` | Lists files attached to a record the user can read |
| POST | `/attachments` | `signed-in` | Attaches a file to a record the user can update |
| DELETE | `/attachments/[id]` | `signed-in` | Detaches |
| GET | `/jobs` | `jobs:read` | Lists jobs with status filter |
| GET | `/jobs/[id]` | `jobs:read` | One job with its error |
| POST | `/jobs/[id]/retry` | `jobs:retry` | Requeues a failed job |
| POST | `/jobs/[id]/cancel` | `jobs:retry` | Cancels a queued job |
| GET | `/approvals` | `signed-in` | Requests waiting for me, or raised by me; all with `approvals:read` |
| GET | `/approvals/[id]` | `signed-in` | One request with its steps |
| POST | `/approvals/[id]/approve` | `signed-in` | Approves the current step |
| POST | `/approvals/[id]/reject` | `signed-in` | Rejects with a note |
| POST | `/approvals/[id]/cancel` | `signed-in` | The requester withdraws |
| GET | `/approval-policies` | `approval-policies:read` | Lists policies |
| POST | `/approval-policies` | `approval-policies:update` | Creates a policy |
| PATCH | `/approval-policies/[id]` | `approval-policies:update` | Changes a policy |
| DELETE | `/approval-policies/[id]` | `approval-policies:update` | Deletes a policy |
| GET | `/imports/templates/[kind]` | `signed-in` | Downloads the spreadsheet template |
| POST | `/imports` | `signed-in` | Starts an import from an uploaded file |
| GET | `/imports` | `imports:read` | Lists imports |
| GET | `/imports/[id]` | `signed-in` | Status and counts of one's own import |
| GET | `/imports/[id]/rows` | `signed-in` | Rows with their errors |
| POST | `/imports/[id]/commit` | `signed-in` | Writes the valid rows |
| POST | `/imports/[id]/cancel` | `signed-in` | Cancels before commit |
| GET | `/exports` | `signed-in` | One's own exports |
| GET | `/exports/[id]` | `signed-in` | Status and download link |
| GET | `/custom-fields` | `custom-fields:read` | Lists definitions |
| POST | `/custom-fields` | `custom-fields:update` | Creates |
| PATCH | `/custom-fields/[id]` | `custom-fields:update` | Changes |
| DELETE | `/custom-fields/[id]` | `custom-fields:update` | Deactivates |
| GET | `/notes` | `notes:read` | Notes on a record |
| POST | `/notes` | `notes:create` | Adds a note |
| PATCH | `/notes/[id]` | `notes:create` | Edits one's own note |
| DELETE | `/notes/[id]` | `notes:create` | Deletes one's own note |
| GET | `/saved-views` | `signed-in` | One's saved views for a list |
| POST | `/saved-views` | `signed-in` | Saves a view |
| PATCH | `/saved-views/[id]` | `signed-in` | Renames or sets default |
| DELETE | `/saved-views/[id]` | `signed-in` | Deletes |
| GET | `/search` | `signed-in` | Global search |
| GET | `/integrity-findings` | `integrity:read` | Lists findings |
| POST | `/integrity-findings/[id]/acknowledge` | `integrity:update` | Marks as seen |
| POST | `/integrity-findings/[id]/resolve` | `integrity:update` | Closes with a note |
| POST | `/sync/devices` | `signed-in` | Registers this device for offline use |
| GET | `/sync/devices` | `sync-devices:read` | Lists devices and pending counts |
| POST | `/sync/devices/[id]/revoke` | `sync-devices:update` | Revokes a device |
| POST | `/sync/upload` | `signed-in` | Applies queued offline operations |
| GET | `/sync/rejections` | `signed-in` | One's own refused operations |
| POST | `/sync/rejections/[id]/dismiss` | `signed-in` | Marks one as dealt with |
| GET | `/sync/conflicts` | `sync-conflicts:update` | Open conflicts |
| POST | `/sync/conflicts/[id]/resolve` | `sync-conflicts:update` | Keeps the server value or takes the device value |

`POST /sync/upload` and the two approval decisions are idempotent routes.

## 8 · Client layer

- `filesApi`: `createUpload`, `confirm`, `url`, `remove`; helper `uploadFile(file, purpose, onProgress)` that does all three steps and retries the byte upload.
- `approvalsApi` + hooks `useMyApprovals`, `useApproval`, `useApprove`, `useReject`.
- `importsApi` + hooks `useImport` (polls while validating or committing), `useImportRows`, `useCommitImport`.
- `exportsApi` + `useExport` (polls until ready).
- `searchApi` + `useGlobalSearch` (debounced 250 ms).
- Generated CRUD for `approval-policies`, `custom-fields`, `notes`, `saved-views`.
- `syncApi` used only by `@takhti/sync`.

## 9 · Screens

| Screen | Pattern | Where |
|---|---|---|
| Approvals inbox | List with a detail sheet | Every staff shell, in the top bar |
| Approval policies | Settings | `/school/settings/approvals` |
| Import wizard | Wizard: upload, check, preview errors, commit, result | Opened from each list's "Import" action |
| My exports | List | User menu |
| Custom fields | Settings | `/school/settings/custom-fields` |
| Notes panel | A tab on every detail page | — |
| Background jobs | List | `/school/settings/jobs` |
| Data checks (integrity findings) | List | `/school/settings/data-checks` |
| Devices | List | `/school/settings/devices` |
| Recently deleted | List with Restore | `/school/settings/recently-deleted` |
| Command palette and global search | Overlay | Every shell |

## 10 · Notifications and jobs

Events: `approval.requested`, `approval.approved`, `approval.rejected`, `import.completed`, `export.ready`, `job.failed`, `integrity.finding`.

Jobs: `shared.validate-import`, `shared.commit-import`, `shared.build-export`, `shared.process-image`, `shared.cleanup`, `shared.integrity`, `shared.expiry-reminders`. The notification jobs that run on this queue are listed in [M37](m37-messaging-hub.md).

## 11 · Offline

This module provides the offline plumbing. Its own records are not edited offline.

## 12 · AI

None.

## 13 · Failure cases

- **F-shared-1** The byte upload fails after the link was issued → the file stays `pending` and is removed after 24 hours; the form shows "Retry upload" and the record can still be saved without it.
- **F-shared-2** A file's real type differs from the declared one → quarantined; the user sees "This file type is not allowed".
- **F-shared-3** An approver's role is removed while a request waits → the request stays pending and becomes visible to the remaining holders of that role; if nobody holds it, leaders are alerted.
- **F-shared-4** The record under approval is deleted → the request is cancelled automatically.
- **F-shared-5** An import file has the wrong columns → rejected at upload with the list of expected and found columns.
- **F-shared-6** An import is committed twice by a double click → the second call returns the first result.
- **F-shared-7** The worker stops mid-import → the reaper requeues the job; rows already created are skipped by their natural key.
- **F-shared-8** A sync batch contains one bad operation → it is rejected alone; the others apply.
- **F-shared-9** An export is requested for 200,000 rows → it runs as a job, streams to the file, and the link expires after 7 days.
- **F-shared-10** A sequence is used by 50 requests at once → 50 distinct consecutive numbers.

## 14 · Seed data

Approval policies for discounts, expenses, leave and payroll; three custom fields on students ("Previous school", "House colour", "Transport needed"); one completed import; a failed job; two open integrity findings so the screens are not empty.

## 15 · Tests

- **T-shared-1** Upload, confirm, download link; a user without access to the record gets `NOT_FOUND`.
- **T-shared-2** A declared-size mismatch quarantines the file.
- **T-shared-3** Approval: two-step policy; requester cannot approve; wrong role cannot approve; reject requires a note.
- **T-shared-4** Approval policy selection by amount.
- **T-shared-5** Import: preview counts; commit writes only valid rows; re-commit is refused; error file contains the failed rows.
- **T-shared-6** `nextNumber` under 50 parallel callers; rollback leaves no gap.
- **T-shared-7** Idempotency: same key and body, same key and different body, concurrent duplicates.
- **T-shared-8** Jobs: retry with backoff; dead after the limit; concurrency key serialises; dedupe key; reaper requeues a stuck job; a rolled-back transaction leaves no job.
- **T-shared-9** Sync upload: duplicate op, unknown table, revoked device, mixed batch.
- **T-shared-10** Custom fields: required, type validation, inactive definitions ignored.
- **T-shared-11** Global search respects branch and section scope.
- **T-shared-12** Row-level security for every table in this module.

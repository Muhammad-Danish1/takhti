# M05 · Integrations and API

## 1 · Purpose

How Takhti connects to the outside: payment gateways, SMS and WhatsApp providers, biometric attendance machines, GPS trackers, and other software that wants to call Takhti or be told when something happens. Real providers are connected in [Phase 18](../20-phases/phase-18-integrations.md); the tables, adapters and local stand-ins exist from Phases 1 and 2.

## 2 · Depends on

[M00](m00-shared-kernel.md), [M02](m02-organisation-branches.md), [M03](m03-identity-roles-audit.md).

## 3 · Tables

#### `integration_connections` · org
One configured connection to an outside service.

| Column | Type | Rules |
|---|---|---|
| category | enum(payment, sms, whatsapp, email, push, biometric, gps, ai) | required |
| provider | text | required; `jazzcash`, `easypaisa`, `onebill`, `whatsapp_cloud`, `sms_generic`, `smtp`, `zkteco`, `traccar`, `log`, `fake` |
| branch_id | uuid → branches | optional; empty means the whole group |
| name | text | required |
| mode | enum(test, live) | default test |
| config | jsonb | default `{}`; non-secret settings (merchant id, sender name) |
| secrets_encrypted | text | optional; encrypted keys; write-only |
| is_default | bool | default false |
| status | enum(disconnected, connected, error) | default disconnected |
| last_checked_at | timestamptz | optional |
| last_error | text | optional |

Unique: one default per (org_id, category, branch_id) among live rows.

#### `webhook_events` · platform
Every message an outside service sends us, kept raw.

| Column | Type | Rules |
|---|---|---|
| org_id | uuid → orgs | optional; resolved after parsing |
| provider | text | required |
| event_id | text | required; the provider's own id |
| signature_ok | bool | required |
| payload | jsonb | required |
| headers | jsonb | default `{}` |
| status | enum(received, processed, ignored, failed) | default received |
| attempts | int | default 0 |
| error | text | optional |
| processed_at | timestamptz | optional |

Unique: (provider, event_id).

#### `api_keys` · org
Keys for other software to call the API.

| Column | Type | Rules |
|---|---|---|
| name | text | required |
| key_prefix | text | required; first 8 characters, shown in lists |
| key_hash | text | required; unique |
| permission_keys | text[] | required; the key can do only these |
| branch_ids | uuid[] | default empty; empty means all branches |
| expires_at | timestamptz | optional |
| last_used_at | timestamptz | optional |
| revoked_at | timestamptz | optional |

#### `webhook_endpoints` · org
Where Takhti sends events to.

| Column | Type | Rules |
|---|---|---|
| url | text | required; `https` only |
| description | text | optional |
| event_names | text[] | required; at least one |
| secret_encrypted | text | required; used to sign deliveries |
| is_active | bool | default true |
| failure_count | int | default 0 |
| disabled_reason | text | optional |

#### `webhook_deliveries` · org

| Column | Type | Rules |
|---|---|---|
| endpoint_id | uuid → webhook_endpoints | required |
| event_id | uuid → domain_events | required |
| status | enum(pending, delivered, failed) | default pending |
| attempts | int | default 0 |
| response_status | int | optional |
| response_ms | int | optional |
| next_attempt_at | timestamptz | optional |
| last_error | text | optional |

Unique: (endpoint_id, event_id).

#### `biometric_devices` · branch

| Column | Type | Rules |
|---|---|---|
| name | text | required |
| serial_no | text | required |
| model | text | optional |
| location | text | optional |
| used_for | enum(staff, students, both) | default staff |
| direction | enum(in, out, both) | default both |
| last_seen_at | timestamptz | optional |
| status | enum(active, inactive) | default active |

Unique: (org_id, serial_no) among live rows.

#### `biometric_enrolments` · branch
Maps a person to their number on the machine.

| Column | Type | Rules |
|---|---|---|
| person_kind | enum(staff, student) | required |
| staff_id | uuid → staff | required when staff |
| student_id | uuid → students | required when student |
| device_user_code | text | required |

Unique: (branch_id, device_user_code) among live rows; (branch_id, staff_id), (branch_id, student_id) where set.

#### `biometric_punches` · branch append-only

| Column | Type | Rules |
|---|---|---|
| device_id | uuid → biometric_devices | required |
| device_user_code | text | required |
| punched_at | timestamptz | required; the machine's time |
| direction | enum(in, out, unknown) | default unknown |
| person_kind | enum(staff, student) | optional; empty when the code is unknown |
| staff_id | uuid → staff | optional |
| student_id | uuid → students | optional |
| is_processed | bool | default false |
| raw | jsonb | required |

Unique: (device_id, device_user_code, punched_at).
Index: (branch_id, is_processed, punched_at).

## 4 · Contracts

`packages/contracts/src/modules/integrations/`: `integration-connections`, `api-keys`, `webhook-endpoints`, `webhook-deliveries`, `biometric-devices`, `biometric-enrolments`, `biometric-punches`.

- `SaveConnection`: `{ category, provider, name, branchId?, mode, config, secrets? }` — `secrets` is accepted but never returned; reads show `hasSecrets: true`.
- Each provider declares a Zod schema for its `config` and `secrets`; saving validates against it.
- `CreateApiKey` returns `{ apiKey, key }` where `key` is shown exactly once.

## 5 · Rules

- **R-integ-1** Secrets are encrypted before storage, never returned by the API and never logged.
- **R-integ-2** "Test connection" makes one harmless call to the provider and stores the result. A connection is `connected` only after a successful test.
- **R-integ-3** Resolving a provider for a branch: the branch's default connection, else the group's default, else the local stand-in (`log` or `fake`).
- **R-integ-4** `live` mode requires the connection to have passed a test in `live`. Switching mode clears the status.
- **R-integ-5** An incoming webhook is stored before anything else. Its signature is checked against the raw body. A bad signature is stored with `signature_ok = false` and never processed.
- **R-integ-6** A webhook with an `event_id` already stored is acknowledged and not processed again.
- **R-integ-7** Webhook processing happens in a job, so the provider always gets a fast `200`.
- **R-integ-8** An API key acts as a system user of kind `staff` with exactly its listed permissions and branches. It can never hold a permission its creator did not hold, and never any `:read-sensitive`, role, membership or payroll permission.
- **R-integ-9** API keys are stored hashed. A revoked or expired key is refused. Each key has its own rate limit (60 requests a minute by default).
- **R-integ-10** Outgoing webhooks are signed (`X-Takhti-Signature`: HMAC-SHA256 of the body) and retried with backoff for 24 hours. After 20 consecutive failures the endpoint is disabled and its owner is told.
- **R-integ-11** A biometric machine is trusted only if its serial number is registered and active for a branch of the organisation.
- **R-integ-12** Punches are stored raw first. A job maps each to a person through `biometric_enrolments` and hands staff punches to [M27](m27-staff-attendance-leave.md) and student punches to [M14](m14-student-attendance.md). A punch with an unknown code stays unprocessed and is listed for staff to map.
- **R-integ-13** A machine's clock more than 10 minutes away from server time raises a device warning; its punches are kept but flagged.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `integrations:read` | See connections and their status | ADMINS, it_admin, finance_head |
| `integrations:update` | Create, change, test and remove connections | principal, it_admin |
| `api-keys:read` | See API keys | principal, it_admin |
| `api-keys:update` | Create and revoke API keys | principal, it_admin |
| `webhooks:read` | See webhook endpoints and deliveries | principal, it_admin |
| `webhooks:update` | Create, change and remove endpoints; redeliver | principal, it_admin |
| `biometric-devices:read` | See machines, enrolments and punches | ADMINS, hr_manager, it_admin |
| `biometric-devices:update` | Register machines; map people; reprocess punches | ADMINS, hr_manager, it_admin |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/integrations/providers` | `integrations:read` | Providers available per category with their config fields |
| GET | `/integrations` | `integrations:read` | Lists connections |
| POST | `/integrations` | `integrations:update` | Creates a connection |
| GET | `/integrations/[id]` | `integrations:read` | One connection, secrets hidden |
| PATCH | `/integrations/[id]` | `integrations:update` | Changes config or secrets |
| POST | `/integrations/[id]/test` | `integrations:update` | Tests the connection |
| POST | `/integrations/[id]/set-default` | `integrations:update` | Makes it the default for its category and branch |
| DELETE | `/integrations/[id]` | `integrations:update` | Removes |
| GET | `/api-keys` | `api-keys:read` | Lists keys by prefix |
| POST | `/api-keys` | `api-keys:update` | Creates a key and shows it once |
| POST | `/api-keys/[id]/revoke` | `api-keys:update` | Revokes |
| GET | `/webhook-endpoints` | `webhooks:read` | Lists endpoints |
| POST | `/webhook-endpoints` | `webhooks:update` | Creates; returns the signing secret once |
| PATCH | `/webhook-endpoints/[id]` | `webhooks:update` | Changes |
| DELETE | `/webhook-endpoints/[id]` | `webhooks:update` | Removes |
| POST | `/webhook-endpoints/[id]/test` | `webhooks:update` | Sends a sample event |
| GET | `/webhook-deliveries` | `webhooks:read` | Lists deliveries |
| POST | `/webhook-deliveries/[id]/redeliver` | `webhooks:update` | Tries again |
| POST | `/webhooks/[provider]` | `webhook` | Receives a provider's callback |
| GET | `/biometric-devices` | `biometric-devices:read` | Lists machines |
| POST | `/biometric-devices` | `biometric-devices:update` | Registers a machine |
| PATCH | `/biometric-devices/[id]` | `biometric-devices:update` | Changes |
| DELETE | `/biometric-devices/[id]` | `biometric-devices:update` | Removes |
| GET | `/biometric-enrolments` | `biometric-devices:read` | Lists mappings |
| POST | `/biometric-enrolments` | `biometric-devices:update` | Maps a person |
| POST | `/biometric-enrolments/bulk` | `biometric-devices:update` | Maps many |
| DELETE | `/biometric-enrolments/[id]` | `biometric-devices:update` | Unmaps |
| GET | `/biometric-punches` | `biometric-devices:read` | Lists punches, including unmapped ones |
| POST | `/biometric-punches/reprocess` | `biometric-devices:update` | Maps and applies unprocessed punches again |

Machines do not call `/api/v1`. ZKTeco-style devices push to a fixed path, served by `apps/web/app/iclock/[...path]/route.ts`, which validates the serial number, stores punches and answers in the device's own protocol.

## 8 · Client layer

Generated CRUD for connections, API keys, webhook endpoints, biometric devices and enrolments. Custom hooks: `useProviders`, `useTestConnection`, `useCreateApiKey` (returns the one-time key), `useRedeliverWebhook`, `useReprocessPunches`.

## 9 · Screens

Under `/school/settings/integrations`. Built in [Phase 18](../20-phases/phase-18-integrations.md).

| Screen | Pattern | Notes |
|---|---|---|
| Integrations | List grouped by category | Status badge, mode, last checked; "Test" |
| Connection | Form page | Fields come from the provider's schema; secrets are write-only with "Replace" |
| API keys | List + Dialog form | The new key is shown once with a copy button and a warning |
| Webhooks | List + Detail | Deliveries with response code and time; redeliver |
| Biometric machines | List | Last seen, clock warning |
| Enrolments | Grid editor | Staff or students against machine codes; bulk paste |
| Punches | List | Tab "Unmapped" with "Map to person" |
| Developer outbox | List | Development only: every SMS, WhatsApp and push the local stand-in "sent" |

## 10 · Notifications and jobs

Events: `integration.error`, `webhook-endpoint.disabled`, `biometric-device.offline` (no contact for 30 minutes during working hours), `biometric-device.clock-drift`.

Jobs: `integrations.process-webhook`, `integrations.deliver-webhook`, `integrations.process-punches` (every minute), `integrations.health-check` (hourly test of live connections).

## 11 · Offline

None.

## 12 · AI

The AI provider is one category here. Its model per feature is set by platform staff ([M01](m01-platform-console.md)), not by schools.

## 13 · Failure cases

- **F-integ-1** A gateway sends the same callback three times → processed once.
- **F-integ-2** A callback arrives before our own request to the gateway returned → the callback finds the payment intent by reference and completes it; the late response is a no-op.
- **F-integ-3** A callback has a bad signature → stored, flagged, not processed, and an `integration.error` event is raised.
- **F-integ-4** A provider is down → the adapter returns a typed failure; the caller falls back as in [09](../00-foundation/09-reliability-and-error-proofing.md).
- **F-integ-5** A biometric machine was offline for two days and then pushes 600 punches → all are stored; attendance for past days is filled in, never overwriting a record a person edited by hand.
- **F-integ-6** A machine's user code is unknown → the punch waits in "Unmapped"; mapping it later applies it.
- **F-integ-7** An API key is leaked → revoking refuses it on the next request; the audit log shows every call it made.
- **F-integ-8** A school's webhook endpoint is slow → the delivery times out at 10 seconds and is retried; our own requests are never held up.
- **F-integ-9** Secrets are saved with a wrong value → the test fails with the provider's message; the connection stays `error` and is not used.

## 14 · Seed data

Local stand-in connections for every category, set as defaults; one webhook endpoint (its deliveries are seeded once services write events, in Phase 2); one biometric machine at Main Campus with 20 staff enrolments and a day of punches, three of them unmapped.

## 15 · Tests

- **T-integ-1** Secrets never appear in any response or log line.
- **T-integ-2** Provider resolution order: branch, group, stand-in.
- **T-integ-3** Webhook: valid signature processed once; duplicate acknowledged; bad signature not processed.
- **T-integ-4** API key: scoped permissions; cannot exceed creator; revoked and expired refused; rate limit.
- **T-integ-5** Outgoing webhook: signature verifies; retries; auto-disable.
- **T-integ-6** Punch mapping to staff and student attendance; unknown code; duplicate punch ignored; hand-edited attendance preserved.
- **T-integ-7** A machine with an unregistered serial number is refused.
- **T-integ-8** Row-level security for every table.

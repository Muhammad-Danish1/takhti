# M37 · Messaging hub

## 1 · Purpose

The one place every message leaves from: the bell in each portal, WhatsApp, SMS, email and push. Other modules never call a provider; they emit an event, and this module decides who hears about it, on which channel, in which language, at what time, and records whether it arrived. Staff also use it to send bulk messages to chosen groups.

The flow, channels and base rules are in [13 · Jobs, notifications, files and documents](../00-foundation/13-notifications-jobs-and-files.md). This spec is the data model and the screens.

## 2 · Depends on

[M00](m00-shared-kernel.md) (`domain_events`, jobs), [M03](m03-identity-roles-audit.md) (profiles, devices, preferences), [M05](m05-integrations-api.md) (provider connections, incoming callbacks), [M07](m07-students.md) and [M26](m26-staff-recruitment.md) (contact points).

## 3 · Tables

#### `channel_settings` · org
One row per channel.

| Column | Type | Rules |
|---|---|---|
| channel | enum(in_app, push, whatsapp, sms, email) | required; unique per organisation |
| is_enabled | bool | default false, except `in_app` |
| connection_id | uuid → integration_connections | optional; required to enable an outside channel |
| sender | text | optional; the WhatsApp number, SMS sender name or from-address |
| rate_per_minute | int | default 60 |
| quiet_from | time | default 21:00 |
| quiet_to | time | default 08:00 |
| credit_balance | paisa | default 0; for `sms` and `whatsapp`, kept in step with the ledger |
| low_credit_alert | paisa | default 0 |

#### `notification_rules` · org
An organisation's override of a default rule in the catalogue.

| Column | Type | Rules |
|---|---|---|
| event_key | text | required; an event from the catalogue |
| audience | text | required; a resolver from the catalogue, such as `guardians-of-student` |
| is_enabled | bool | default true |
| channels | text[] | required; in order of preference; the first that can deliver is used |
| also_in_app | bool | default true |
| delay_minutes | int | default 0 |
| digest | enum(none, daily) | default none |

Unique: (org_id, event_key, audience).
A rule marked compulsory in the catalogue cannot be disabled.

#### `notification_templates` · org
An organisation's own wording. Defaults live in code.

| Column | Type | Rules |
|---|---|---|
| event_key | text | required |
| channel | enum(in_app, push, whatsapp, sms, email) | required |
| locale | enum(en, ur) | required |
| subject | text | optional; email and in-app title |
| body | text | required; uses only the variables the event provides |
| whatsapp_template_id | uuid → whatsapp_templates | optional; required to send this kind on WhatsApp |
| is_active | bool | default true |

Unique: (org_id, event_key, channel, locale).

#### `whatsapp_templates` · org
A message template registered with WhatsApp.

| Column | Type | Rules |
|---|---|---|
| name | text | required; lower case with underscores; unique per organisation and language |
| language | enum(en, ur) | required |
| category | enum(utility, authentication, marketing) | required |
| body | text | required; with numbered placeholders |
| variables | text[] | required; which event variable fills each placeholder |
| buttons | jsonb | default `[]` |
| status | enum(draft, submitted, approved, rejected, paused) | default draft |
| provider_template_id | text | optional |
| rejected_reason | text | optional |

#### `notifications` · org +self
The in-app notification: one row per person per event.

| Column | Type | Rules |
|---|---|---|
| user_id | uuid → profiles | required |
| event_key | text | required |
| category | text | required; the catalogue group: `fees`, `attendance`, `academics`, `messages`, `approvals`, `system` |
| title | text | required |
| body | text | required |
| link | text | optional; a path inside the user's portal |
| entity_type | text | optional |
| entity_id | uuid | optional |
| student_id | uuid → students | optional; which child it is about |
| is_urgent | bool | default false |
| read_at | timestamptz | optional |
| dedupe_key | text | required |

Unique: (org_id, dedupe_key).
Index: (user_id, read_at, created_at).
Rows older than 180 days are deleted by a job.

#### `message_deliveries` · org
One attempt to reach one person on one outside channel.

| Column | Type | Rules |
|---|---|---|
| channel | enum(push, whatsapp, sms, email) | required |
| user_id | uuid → profiles | optional |
| guardian_id | uuid → guardians | optional |
| staff_id | uuid → staff | optional |
| address | text | required; the phone number, email address or device token; masked in lists |
| event_key | text | optional; empty for a campaign |
| notification_id | uuid → notifications | optional |
| campaign_id | uuid → message_campaigns | optional |
| locale | enum(en, ur) | required |
| body | text | required; as rendered |
| parts | int | default 1; SMS parts |
| cost | paisa | default 0 |
| provider | text | required |
| provider_message_id | text | optional |
| status | enum(queued, held, sending, sent, delivered, read, failed, skipped) | default queued |
| skip_reason | enum(muted, no_address, opted_out, no_credit, template_not_approved, expired, duplicate, channel_off) | optional |
| send_after | timestamptz | optional; set by quiet hours or a delay |
| attempts | int | default 0 |
| error_code | text | optional |
| error | text | optional |
| fallback_of_id | uuid → message_deliveries | optional; the delivery this one replaced |
| sent_at | timestamptz | optional |
| delivered_at | timestamptz | optional |
| read_at | timestamptz | optional |
| dedupe_key | text | required |

Unique: (org_id, dedupe_key).
Index: (org_id, status, send_after); (org_id, provider, provider_message_id); (org_id, guardian_id, created_at).

#### `message_campaigns` · org
A bulk message composed by staff.

| Column | Type | Rules |
|---|---|---|
| title | text | required; internal name |
| branch_ids | uuid[] | required; the sender must have access to each |
| channels | text[] | required; in order of preference |
| body_en | text | optional; at least one language is required |
| body_ur | text | optional |
| whatsapp_template_id | uuid → whatsapp_templates | optional; required when WhatsApp is a channel |
| audience | jsonb | required; `{ kind: guardians \| staff \| students, gradeIds?, sectionIds?, routeIds?, roleKeys?, filter?: defaulters \| absent_today \| boarders, userIds? }` |
| is_urgent | bool | default false |
| send_at | timestamptz | optional; empty means on approval |
| status | enum(draft, pending_approval, scheduled, sending, sent, cancelled, failed) | default draft |
| recipient_count | int | default 0 |
| estimated_cost | paisa | default 0 |
| actual_cost | paisa | default 0 |
| counts | jsonb | default `{}`; by status |
| approval_request_id | uuid → approval_requests | optional |
| created_by | uuid → profiles | required |

#### `campaign_recipients` · org
The audience as it was resolved when the campaign was sent.

| Column | Type | Rules |
|---|---|---|
| campaign_id | uuid → message_campaigns | required |
| user_id | uuid → profiles | optional |
| guardian_id | uuid → guardians | optional |
| staff_id | uuid → staff | optional |
| student_ids | uuid[] | default empty; the children this message concerns |
| status | enum(pending, queued, skipped) | default pending |

Unique: (campaign_id, guardian_id), (campaign_id, staff_id), (campaign_id, user_id) where set.

#### `user_notification_prefs` · org +self

| Column | Type | Rules |
|---|---|---|
| user_id | uuid → profiles | required |
| category | text | required |
| channel | enum(in_app, push, whatsapp, sms, email) | required |
| is_muted | bool | default false |

Unique: (org_id, user_id, category, channel).

#### `message_opt_outs` · org
A number or address that must not be messaged on a channel.

| Column | Type | Rules |
|---|---|---|
| channel | enum(whatsapp, sms, email) | required |
| address | text | required |
| reason | enum(stop_reply, bounced, invalid, requested, complaint) | required |
| note | text | optional |

Unique: (org_id, channel, address).

#### `message_credit_ledger` · org append-only

| Column | Type | Rules |
|---|---|---|
| channel | enum(sms, whatsapp) | required |
| kind | enum(purchase, usage, refund, adjustment) | required |
| amount | paisa | required; signed |
| balance_after | paisa | required |
| delivery_id | uuid → message_deliveries | optional |
| campaign_id | uuid → message_campaigns | optional |
| note | text | optional |

Policy: staff may read; only platform services and the delivery job write.

#### `inbound_messages` · org
What people send back on WhatsApp or SMS.

| Column | Type | Rules |
|---|---|---|
| channel | enum(whatsapp, sms) | required |
| from_address | text | required |
| body | text | optional |
| media_file_id | uuid → files | optional |
| received_at | timestamptz | required |
| guardian_id | uuid → guardians | optional; matched by number |
| provider_message_id | text | required |
| handled_as | enum(stop, chatbot, chat_thread, ignored) | optional |
| chat_thread_id | uuid → chat_threads | optional |

Unique: (org_id, channel, provider_message_id).

## 4 · Contracts

`packages/contracts/src/modules/messaging/`: `channel-settings`, `notification-rules`, `notification-templates`, `whatsapp-templates`, `notifications`, `message-deliveries`, `message-campaigns`, `notification-prefs`.

**The catalogue** is the source of truth for every event. `defineEvent` lives in `packages/contracts/src/kernel/events.ts`; each module declares its events in `packages/contracts/src/modules/<module>/<module>.events.ts`; `packages/contracts/src/catalogue.ts` gathers them all:

```ts
defineEvent({
  key: 'fee.payment-received',
  category: 'fees',
  payload: z.object({ familyId: Id, paymentId: Id, amount: Paisa, receiptNo: z.string() }),
  variables: ['guardianName', 'amount', 'receiptNo', 'studentNames', 'receiptLink'],
  rules: [{ audience: 'guardians-of-family', channels: ['whatsapp', 'sms'], compulsory: true }],
  urgent: false,
  mergePerFamily: true,
  templates: { in_app: { en, ur }, whatsapp: { en, ur }, sms: { en, ur } },
});
```

The human-readable list is the [notification catalogue](../30-reference/notification-catalogue.md).

- `emit(ctx, key, payload)` is the only function other modules call.
- `TemplatePreview`: `{ eventKey, channel, locale, body }` → the rendered text with sample data, the SMS part count, and any unknown variable.
- `AudiencePreview` for a campaign: the count, how many have no usable address for each channel, and the first 20 names.
- `CampaignEstimate`: recipients by channel, SMS parts, estimated cost, credit after sending.
- `DeliveryStats`: sent, delivered, read and failed by channel, event and day.
- `MyNotifications`: a cursor-paged list with an unread count.

## 5 · Rules

- **R-messaging-1** A module never sends anything itself. It calls `emit`, which writes a `domain_events` row in the caller's transaction and queues `notify.dispatch`.
- **R-messaging-2** Dispatch resolves the rule (the organisation's, else the catalogue default), the audience, each person's preferences, language and address, renders the template, writes the in-app notification, and queues one delivery per person on the first channel in the rule that can reach them.
- **R-messaging-3** One event reaches one person once per channel: the dedupe key is the event id, the recipient and the channel. Running dispatch again changes nothing.
- **R-messaging-4** When several children of one family are affected by events of a kind marked `mergePerFamily` within the same dispatch, the guardian gets one message listing them.
- **R-messaging-5** Which guardian: those linked to the student with `receives_messages`; the primary contact when none is marked. A guardian with no login still receives WhatsApp and SMS.
- **R-messaging-6** In quiet hours a non-urgent delivery is `held` with `send_after` set to the end of quiet hours. An urgent event ignores quiet hours. A held message whose event sets an expiry (an "exam tomorrow" reminder) is skipped as `expired` if its time has passed.
- **R-messaging-7** A person can mute a category on a channel, except events marked compulsory (one-time codes, fee receipts, emergency notices, safety alerts).
- **R-messaging-8** **Fallback.** A delivery that fails permanently, or is skipped for `no_address`, `opted_out`, `template_not_approved` or `no_credit`, is retried once on the next channel in the rule, linked by `fallback_of_id`. In-app is always written, so nobody is left with nothing.
- **R-messaging-9** A temporary failure is retried three times with growing delays. A permanent "invalid number" adds the address to `message_opt_outs` as `invalid` and flags the contact on the guardian or staff record for the office to correct.
- **R-messaging-10** A reply of STOP (or its Urdu equivalents) opts the number out of that channel for non-compulsory messages and is confirmed once.
- **R-messaging-11** WhatsApp is sent only with an approved template for that kind of message and language. Sending free text is possible only inside the 24-hour window after the person wrote to the school.
- **R-messaging-12** Each SMS and WhatsApp delivery records its cost and reduces the channel's credit in the same transaction as it is marked sent. With no credit, deliveries are skipped as `no_credit` and fall back; the owner is told once a day.
- **R-messaging-13** Deliveries are sent no faster than the channel's `rate_per_minute`. A large campaign is fed to the queue in batches so that event-driven messages (absence alerts, receipts) are never stuck behind it.
- **R-messaging-14** Provider callbacks update delivery status (`sent → delivered → read`, or `failed`). A status never moves backwards.
- **R-messaging-15** A template can be saved only if every variable it uses exists for its event and it renders with sample data. SMS shows the part count; Urdu uses the shorter per-part limit.
- **R-messaging-16** A campaign is limited to the branches its author can access. Its audience is resolved and frozen into `campaign_recipients` when it is sent, not when it was drafted.
- **R-messaging-17** A campaign above `messaging.approval_above_recipients` (default 200), or to all guardians of a branch, needs approval by someone other than its author. An urgent campaign needs `campaigns:emergency`, goes on every enabled channel at once, and ignores quiet hours and mutes.
- **R-messaging-18** Before sending, the estimate is shown: recipients, people with no address, parts and cost. Sending is refused when credit is below the estimate, unless the author chooses to send what the credit allows.
- **R-messaging-19** A campaign can be cancelled while `scheduled`, or while `sending`, which stops what has not yet left.
- **R-messaging-20** Messages never contain passwords, full identity numbers or medical details. A payslip, result or fee message carries a link that requires sign-in, plus only the summary the school has chosen to show.
- **R-messaging-21** An inbound message from a known guardian number goes to the parent chatbot when it is switched on ([M44](m44-ai-suite.md)), otherwise to the office's support thread ([M38](m38-chat-ptm.md)); from an unknown number it gets one standard reply and is stored.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `messages:read` | See delivery logs and statistics | LEADERS, FRONT, it_admin, ACCOUNTS |
| `campaigns:create` | Draft bulk messages and submit them | LEADERS, section_head, coordinator, FRONT, ACCOUNTS, class_teacher |
| `campaigns:send` | Send a campaign without approval up to the limit; approve others' | ADMINS, vice_principal |
| `campaigns:emergency` | Send an urgent broadcast | principal, director |
| `notification-settings:manage` | Change rules, templates and channel settings | principal, it_admin |
| `whatsapp-templates:manage` | Create and submit WhatsApp templates | principal, it_admin |
| `message-credits:read` | See credit balance and the ledger | LEADERS, ACCOUNTS, it_admin |

A class teacher's campaign is limited to the guardians of their own section.

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/notifications` | `signed-in` | My notifications, newest first |
| GET | `/notifications/unread-count` | `signed-in` | My unread count |
| POST | `/notifications/[id]/read` | `signed-in` | Marks one read |
| POST | `/notifications/read-all` | `signed-in` | Marks all read, optionally for one category |
| GET | `/me/notification-preferences` | `signed-in` | My preferences by category and channel |
| PUT | `/me/notification-preferences` | `signed-in` | Saves them |
| GET | `/notification-catalogue` | `notification-settings:manage` | Every event with its default rule and variables |
| GET | `/notification-rules` | `notification-settings:manage` | The organisation's overrides |
| PUT | `/notification-rules` | `notification-settings:manage` | Saves overrides |
| GET | `/notification-templates` | `notification-settings:manage` | Templates for an event, default and overridden |
| PUT | `/notification-templates` | `notification-settings:manage` | Saves an override |
| DELETE | `/notification-templates/[id]` | `notification-settings:manage` | Returns to the default |
| POST | `/notification-templates/preview` | `notification-settings:manage` | Renders with sample data |
| POST | `/notification-templates/test` | `notification-settings:manage` | Sends a test to oneself |
| GET | `/whatsapp-templates` | `notification-settings:manage` | Lists |
| POST | `/whatsapp-templates` | `whatsapp-templates:manage` | Creates |
| PATCH | `/whatsapp-templates/[id]` | `whatsapp-templates:manage` | Edits a draft |
| POST | `/whatsapp-templates/[id]/submit` | `whatsapp-templates:manage` | Submits for approval by the provider |
| POST | `/whatsapp-templates/sync` | `whatsapp-templates:manage` | Refreshes statuses from the provider |
| GET | `/channel-settings` | `notification-settings:manage` | Lists |
| PUT | `/channel-settings/[channel]` | `notification-settings:manage` | Saves |
| GET | `/message-campaigns` | `campaigns:create` | Lists the campaigns I may see |
| POST | `/message-campaigns` | `campaigns:create` | Creates a draft |
| GET | `/message-campaigns/[id]` | `campaigns:create` | One campaign with counts |
| PATCH | `/message-campaigns/[id]` | `campaigns:create` | Edits a draft |
| POST | `/message-campaigns/audience-preview` | `campaigns:create` | Counts and samples an audience |
| POST | `/message-campaigns/[id]/estimate` | `campaigns:create` | The estimate |
| POST | `/message-campaigns/[id]/submit` | `campaigns:create` | Sends, schedules, or sends for approval |
| POST | `/message-campaigns/[id]/cancel` | `campaigns:create` | Cancels |
| GET | `/message-campaigns/[id]/deliveries` | `campaigns:create` | Its deliveries with status |
| POST | `/message-campaigns/emergency` | `campaigns:emergency` | Sends an urgent broadcast |
| GET | `/message-deliveries` | `messages:read` | Lists; filter by channel, status, event, person, dates |
| POST | `/message-deliveries/[id]/retry` | `messages:read` | Tries a failed delivery again |
| GET | `/messages/stats` | `messages:read` | Delivery statistics |
| GET | `/messages/person` | `messages:read` | Everything sent to one guardian or staff member |
| GET | `/message-opt-outs` | `messages:read` | Lists |
| DELETE | `/message-opt-outs/[id]` | `notification-settings:manage` | Removes one after the person asks to be messaged again |
| GET | `/message-credits` | `message-credits:read` | Balances and the ledger |
| GET | `/dev/outbox` | `signed-in` | Development only: every message the local stand-ins "sent" |

Provider status callbacks and inbound messages arrive on `POST /webhooks/[provider]` ([M05](m05-integrations-api.md)).

Idempotent: `POST /message-campaigns/[id]/submit`, `POST /message-campaigns/emergency`.

## 8 · Client layer

Custom hooks: `useNotifications` (cursor paging), `useUnreadCount` (Supabase Realtime on the user's own rows, falling back to polling every 60 seconds), `useMarkRead` (optimistic), `useNotificationPrefs`, `useCatalogue`, `useTemplatePreview` (debounced), `useCampaign`, `useAudiencePreview`, `useCampaignEstimate`, `useSubmitCampaign`, `useDeliveries`, `useDeliveryStats`, `usePersonMessages`.

`<NotificationBell />` and `<NotificationList />` live in the shared UI package and are used by every portal shell.

## 9 · Screens

Built in [Phase 4](../20-phases/phase-04-frontend-foundation.md) (the bell), [Phase 12](../20-phases/phase-12-communication.md) (everything else) and [Phase 18](../20-phases/phase-18-integrations.md) (real providers).

| Screen | Pattern | Where |
|---|---|---|
| Notification bell | Popover | Every shell: unread count, the latest ten grouped by day, "See all" |
| Notifications | List | `/…/notifications`: filter by category; mark all read |
| My preferences | Settings | A grid: categories down, channels across; compulsory ones locked with the reason |
| **Compose message** | Wizard | Audience (with a live count and "no number" warning), message in English and Urdu with a phone preview, channels and cost, schedule, send |
| Campaigns | List + Detail | Status and counts; a delivery breakdown; cancel |
| Delivery log | List | Filter by person, channel, status; the reason for each failure in plain words |
| Person's messages | Detail in a sheet | From a guardian or staff record: everything sent, with status |
| Notification settings | Settings | Events grouped by module: enable, channel order, edit wording with a preview |
| WhatsApp templates | List + Form in a sheet | Status from the provider; which events use each |
| Channels and credit | Settings | Connection, sender, quiet hours, balance and ledger |
| Emergency broadcast | Form page | A red-edged page with one text box, the audience, and a typed confirmation |

## 10 · Notifications and jobs

Events of its own: `messaging.low-credit`, `messaging.no-credit`, `messaging.campaign-finished` (to the author with counts), `messaging.campaign-approval-requested`, `messaging.channel-failing` (a provider failing more than 20% for 15 minutes), `messaging.contact-invalid` (to the office, daily digest of numbers that failed), `messaging.template-rejected`.

Jobs: `notify.dispatch` (per event), `notify.deliver` (per delivery), `notify.release-held` (every 5 minutes), `notify.campaign-feed` (feeds a campaign's recipients in batches), `notify.digests` (per rule with `digest: daily`), `notify.status-sweep` (hourly: asks the provider about deliveries stuck in `sent` for over 6 hours), `notify.purge` (daily: old notifications and delivery bodies beyond the retention period).

## 11 · Offline

A user's notifications are cached and readable offline. Marking as read is queued. Nothing is sent from a device.

## 12 · AI

- Drafting a notice or reminder and translating it between English and Urdu in the composer (A10).
- The parent chatbot answers inbound WhatsApp messages (A11); see [M44](m44-ai-suite.md).
- Suggesting a shorter wording when an SMS runs to several parts.

## 13 · Failure cases

- **F-messaging-1** The WhatsApp provider is down → deliveries fail temporarily and retry; after three tries they fall back to SMS; a channel-failing alert goes to the IT admin.
- **F-messaging-2** A guardian's number is wrong → the provider reports it invalid; the number is opted out, the guardian record is flagged, and the message falls back to in-app.
- **F-messaging-3** A campaign to 3,000 guardians is sent at the same time as the morning absence alerts → the absence alerts go first; the campaign is fed in batches behind them.
- **F-messaging-4** Dispatch runs twice for the same event after a worker crash → dedupe keys stop any second message.
- **F-messaging-5** A notice is sent at 10 pm → held until 8 am; the in-app notification appears at once.
- **F-messaging-6** Credit runs out halfway through a campaign → the rest are skipped as `no_credit` and fall back to in-app; the campaign shows exactly how many went by each route.
- **F-messaging-7** A template is edited to use a variable the event does not have → saving is refused, naming the variable.
- **F-messaging-8** WhatsApp rejects a template → the kind of message it served falls back to SMS until a new template is approved; the IT admin is told.
- **F-messaging-9** A guardian replies STOP → opted out of non-compulsory messages on that channel; receipts and emergency notices still arrive.
- **F-messaging-10** A family has three children absent → one message naming all three.
- **F-messaging-11** A callback says "delivered" for a message already marked "read" → ignored.
- **F-messaging-12** A class teacher tries to message the whole school → the audience is cut to their own section; the screen says why.

## 14 · Seed data

Channel settings using the local stand-ins, with credit on SMS and WhatsApp. A handful of overridden rules and templates. Approved, submitted and rejected WhatsApp templates. Notifications for every seeded user (some unread). About 5,000 deliveries over two months in every status with realistic failure reasons. Eight campaigns in every status, one waiting for approval. Preferences for some users. A few opt-outs and inbound messages.

## 15 · Tests

- **T-messaging-1** `emit` writes the event in the caller's transaction; a rollback leaves no event and no job.
- **T-messaging-2** Rule resolution: override beats default; a compulsory rule cannot be disabled.
- **T-messaging-3** Audience resolvers, including which guardian receives.
- **T-messaging-4** Dedupe: dispatch twice gives one notification and one delivery.
- **T-messaging-5** Family merge.
- **T-messaging-6** Quiet hours hold and release; urgent bypass; expiry.
- **T-messaging-7** Mutes respected; compulsory events ignore mutes.
- **T-messaging-8** Fallback chain for each skip reason and for permanent failure; in-app always written.
- **T-messaging-9** Retry schedule for temporary failures; invalid numbers opted out and flagged.
- **T-messaging-10** WhatsApp needs an approved template; the 24-hour window.
- **T-messaging-11** Credit: cost recorded once; no credit skips and falls back.
- **T-messaging-12** Throttling and priority of event messages over campaigns.
- **T-messaging-13** Status callbacks never move backwards.
- **T-messaging-14** Template validation and SMS part counts in English and Urdu.
- **T-messaging-15** Campaign: audience frozen at send; branch and section limits; approval threshold; cancel mid-send.
- **T-messaging-16** A user reads only their own notifications, including over Realtime.
- **T-messaging-17** Every event key used anywhere in the code exists in the catalogue (a build-time check).
- **T-messaging-18** Row-level security.

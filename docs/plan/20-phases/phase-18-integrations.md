# Phase 18 · Integrations

**Goal.** The local stand-ins are joined by real providers: payments (1BILL, JazzCash, Easypaisa), WhatsApp, SMS, email, biometric attendance machines and vehicle trackers; and schools get API keys and outgoing webhooks for their own systems. Each real adapter sits behind the same interface the stand-in has implemented since Phase 0, so no service and no screen changes.

**Depends on.** Phases [9](phase-09-finance.md), [10](phase-10-hr.md), [11](phase-11-front-office-and-operations.md) and [12](phase-12-communication.md).

**Modules.** [M05](../10-modules/m05-integrations-api.md), [M22](../10-modules/m22-online-payments-reconciliation.md), [M37](../10-modules/m37-messaging-hub.md), and the device sides of [M27](../10-modules/m27-staff-attendance-leave.md), [M14](../10-modules/m14-student-attendance.md) and [M30](../10-modules/m30-transport.md).

**This is the first phase that needs accounts outside the developer's machine.** Everything is built and tested against each provider's **sandbox or test mode**. Live credentials are entered only in [Phase 21](phase-21-hardening-and-launch.md).

## Decisions to take before starting

These are open in [02](../00-foundation/02-decisions-and-stack.md). Each needs the product owner, because each involves a commercial agreement.

| Decision | Options and what to weigh |
|---|---|
| First payment channel | **1BILL** reaches every banking app with one integration and suits the challan habit, but needs a biller agreement through a bank or aggregator. **JazzCash** and **Easypaisa** offer merchant accounts with hosted checkout and wallets. Start with whichever agreement is ready first; the adapter interface is the same |
| WhatsApp access | Directly with the WhatsApp Business Platform, or through a business solution provider. Needs a verified business, a dedicated number and template approval, which takes days |
| SMS provider | A Pakistani aggregator with a registered sender name (masking) and delivery reports |
| Email | A transactional email service with a verified sending domain |
| Biometric machines | Which models the first schools own; ZKTeco-style push protocol is the default |
| Vehicle trackers | A tracker platform with an API or webhook, or the driver's phone only |

Record each decision, with the date, in [02](../00-foundation/02-decisions-and-stack.md).

## Rules for every adapter

- It lives in `packages/core/src/providers/<kind>/<provider>.ts` and implements the kind's interface. Nothing outside `providers/` imports a provider's SDK.
- **Before writing it, read the provider's current API documentation.** Endpoints, signature schemes and field names are taken from that documentation, not from memory or from examples found elsewhere. Note the documentation's version or date at the top of the file.
- Credentials are entered by a school's IT admin (or by Takhti for shared accounts) in **Integrations**, stored encrypted ([M05](../10-modules/m05-integrations-api.md)), shown masked, and never logged.
- Every outgoing call has a timeout, retries with backoff for temporary failures only, and a circuit breaker: after repeated failures the connection is marked failing, callers get a typed "unavailable", and the module's fallback applies.
- Every incoming call is stored raw first, verified by signature against the raw body, deduplicated by the provider's event id, then processed by a job.
- A **contract test** per adapter replays recorded sandbox requests and responses (with secrets removed), so the adapter is tested without the network; a **live sandbox test** is run by hand before each release and its result recorded.
- "Test connection" in the Integrations screen performs a real, harmless call and reports the provider's answer in plain words.

## Work packages

### 18.1 · Integrations screens — [M05](../10-modules/m05-integrations-api.md)

Integrations grouped by category with status; the connection form per provider with its fields and "Test connection"; API keys (shown once); webhook endpoints with deliveries and redeliver; biometric machines, enrolments and punches. Under `/school/settings/integrations`.

### 18.2 · Payments — [M22](../10-modules/m22-online-payments-reconciliation.md)

For each chosen provider: `createCheckout`, `verifyCallback`, `inquire`, `parseSettlement`; its callback handler on `POST /webhooks/[provider]`; for 1BILL the inquiry and payment endpoints with the response codes and timings its specification requires.

Tested in the sandbox for: success; failure; the payer abandoning; a late callback; a duplicate callback; an amount mismatch; an inquiry for a paid, part-paid, overdue, cancelled and unknown challan; a settlement file.

### 18.3 · WhatsApp — [M37](../10-modules/m37-messaging-hub.md)

Sending template messages; submitting and syncing templates; delivery and read callbacks; inbound messages into `inbound_messages` (STOP handling, the 24-hour window, hand-off to the office inbox); media for receipts and report cards as documents where the school enables it. Every message kind in the [notification catalogue](../30-reference/notification-catalogue.md) that uses WhatsApp is mapped to a template, and the templates are submitted for approval.

### 18.4 · SMS and email

SMS: send, delivery reports, sender name, the part count agreeing with the provider's own count, inbound STOP where the provider supports it. One-time codes for sign-in now go through the real SMS provider configured in Supabase Auth (or through an Auth hook that calls the messaging hub), replacing the fixed local codes outside development.

Email: send through the provider with the verified domain; SPF, DKIM and DMARC records documented for the launch checklist; bounce and complaint callbacks feeding `message_opt_outs`.

### 18.5 · Biometric machines — [M05](../10-modules/m05-integrations-api.md), [M27](../10-modules/m27-staff-attendance-leave.md)

The device push route (`apps/web/app/iclock/[...path]/route.ts`) tested against a real machine: registration by serial number, receiving punches, answering in the device's protocol, pushing enrolled users where supported, clock drift detection. A setup guide for a school's IT person: the machine's server address setting, network needs, what to do when it shows offline.

### 18.6 · Vehicle trackers — [M30](../10-modules/m30-transport.md)

An adapter receiving positions by webhook or polling an API, mapping tracker ids to vehicles, applying the sanity filter, writing `vehicle_locations`. The driver's phone remains the fallback source.

### 18.7 · The school's own integrations — [M05](../10-modules/m05-integrations-api.md)

- [ ] **API keys**: a key carries a role and branches like a user; calls with a key go through the same routes, permissions and rate limits, audited as the key.
- [ ] **Outgoing webhooks**: signed deliveries with retries for the events a school subscribes to (student enrolled, payment received, attendance marked, result published).
- [ ] **Public API reference**: generated from the route manifest and the contracts (an OpenAPI document and a readable page), listing only the routes a key may call.

### 18.8 · Monitoring the connections

The hourly health check; a status line per connection (last success, failure rate); alerts to the IT admin and to Takhti's platform console when a connection fails; the fallback each module takes while it does.

## Journeys to automate (against sandboxes, run before each release)

| Journey | Steps |
|---|---|
| Pay by wallet | A parent pays a voucher through the provider's sandbox → callback → receipt → settlement file imported and reconciled |
| Pay by 1BILL | Inquiry returns the right amount before and after the due date → payment notification → voucher paid → a second inquiry says paid |
| A lost callback | Block the callback → the inquiry job records the payment within minutes |
| WhatsApp receipt | A payment sends the approved template → delivered and read statuses arrive → the parent replies → the reply reaches the office inbox |
| Provider down | With the WhatsApp adapter forced to fail, messages fall back to SMS, the connection shows failing, and recovery is automatic |
| Sign-in code | A parent receives a real one-time code by SMS in the sandbox and signs in |
| A punch | A staff member punches on a real machine → attendance row within a minute |
| A school's script | A key with read-only student access lists students, is refused fees, and is rate-limited when abusive |

## Exit checks

1. Each chosen provider has an adapter, a contract test, a recorded live sandbox run and a "Test connection".
2. Every journey above passes against the sandboxes.
3. Switching any connection back to its local stand-in still works, so development needs no outside account.
4. No secret appears in a log, an error message, an audit entry or a response; a test greps the logs of the whole suite for the seeded sandbox secrets.
5. Forged, replayed and malformed callbacks are rejected and counted; none changes data.
6. With every outside provider unreachable, the product still works: payments at the counter, in-app notifications, manual attendance.
7. `pnpm check`, `pnpm test:db`, `pnpm test:e2e`.

## Left for later, on purpose

- Live credentials and real money: [Phase 21](phase-21-hardening-and-launch.md), after the security review.
- Card payments through a card gateway, and other wallets or banks: added as adapters when a school needs them.
- Accounting exports to other software: on request, as report exports.

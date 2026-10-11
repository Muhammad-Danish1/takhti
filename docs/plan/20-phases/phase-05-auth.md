# Phase 5 · Sign-in and access for every role

**Goal.** Every kind of user can get in, lands in the right portal, sees only what their role allows, and is turned away cleanly from everything else. Proved by signing in as each of the 32 built-in roles in a browser test.

**Depends on.** [Phase 4](phase-04-frontend-foundation.md).

**Produces.** The `(auth)` pages, the account pages in every shell, role-based landing, the portal and organisation switchers, and the role matrix that every later phase extends.

**Modules.** [M03](../10-modules/m03-identity-roles-audit.md) (sign-in, invitations, own account). The management screens of M03 (users, roles, audit log) come in [Phase 7](phase-07-school-setup-and-people.md).

## Read first

[06 · Tenancy, roles and access](../00-foundation/06-tenancy-roles-and-access.md) ("Sign-in methods", "What each kind of user can reach"), [10 · Security and privacy](../00-foundation/10-security-and-privacy.md), [M03](../10-modules/m03-identity-roles-audit.md), [17 · Local environment](../00-foundation/17-local-environment.md) (the `config.toml` settings).

## How people sign in

| Who | Identifier | Proof | Second factor |
|---|---|---|---|
| Takhti staff (`/platform`) | Email | Password | Authenticator app, compulsory |
| School staff | Email or phone | Password | Authenticator app: compulsory for owner, director, finance head, accountant, payroll officer, HR manager, IT admin; optional for others |
| Guardian | Phone | One-time code by WhatsApp or SMS; or a password they chose | None |
| Student | School code + admission number | Password or a PIN issued by the school | None |

Nobody signs themselves up. Every account starts from an invitation ([M03](../10-modules/m03-identity-roles-audit.md)) or, for students, from the school issuing a PIN.

Signing in, codes, password reset and two-factor are calls from the browser to Supabase Auth. Takhti's own routes come after: `GET /me` builds the session's picture of the user.

**Students.** Supabase needs an email or a phone number as an identity. A student's login is stored under a synthetic address made from the organisation and the admission number (never shown, never mailed). The sign-in page turns "school code + admission number" into that address. The school code is the organisation's slug.

## Screens

All under `apps/web/app/(auth)/`, in a centred single-column layout with the Takhti mark, a language switch and a theme switch. Every page works at 360 px.

| Path | Screen | Notes |
|---|---|---|
| `/sign-in` | Sign in | Three tabs: **Staff**, **Parent**, **Student**; the last choice is remembered on the device. Staff: email or phone, password. Parent: phone, then "Send code" or "Use password". Student: school code, admission number, password or PIN |
| `/sign-in/code` | Enter the code | Six boxes, paste works, auto-submit; a 60-second cooldown before "Send again"; "Send by SMS instead" when the first went by WhatsApp; the code lasts 5 minutes |
| `/sign-in/two-factor` | Authenticator code | With "Use a recovery code" |
| `/two-factor/set-up` | Set up the authenticator | Shown after sign-in to a role that must have it and does not: QR code, the key as text, confirm with a code, then ten recovery codes to save. The portal is not reachable until this is done |
| `/forgot-password` | Forgot password | Staff: a link by email, or a code to their phone. Parent: a code to their phone. Student: "Ask your class teacher or the school office" |
| `/reset-password` | Choose a new password | From the link or after the code; strength shown; the policy stated in words |
| `/invite/[token]` | Accept an invitation | Shows the school's name and the person's first name (`GET /invitations/lookup`). Staff: confirm details, choose a password. Parent: verify the phone with a code; a password is optional. Then straight into the portal |
| `/choose` | Choose where to go | Shown only when a login has more than one membership or more than one portal: a card per organisation and portal ("Roshan Public School — Staff", "Roshan Public School — Parent") |
| `/first-time` | First sign-in steps | A student with an issued PIN must choose a new one; anyone picks a language; a guardian confirms which children are theirs |
| `/signed-out` | Signed out | Also used for "your session ended" |
| `/blocked` | Cannot continue | One page for: membership suspended; organisation suspended; no active membership. Says which, and who to contact |

In every shell, **My account** (Settings pattern): profile and photo, language, theme, number format, password, two-factor and recovery codes, devices and recent sign-ins (`GET /me/login-events`), change phone with verification, notification preferences ([M37](../10-modules/m37-messaging-hub.md)), "Sign out everywhere".

## Where each role lands

After `GET /me`, the landing is decided in one function, `landingFor(me)` in `apps/web/src/server/landing.ts`, with a test per role:

| Membership | Lands on |
|---|---|
| Platform admin (`super_admin`, `support_agent`) | `/platform` |
| `owner`, `director`, `finance_head`, `academic_head`, `auditor` | `/hq` |
| Any other staff role except the two below | `/school` |
| Only `class_teacher` and/or `subject_teacher` | `/teach` |
| `driver` only | `/school/trips`, the driver's phone-first page ([Phase 11](phase-11-front-office-and-operations.md)) |
| `security_guard` only | `/school/gate`, the gate's phone-first page |
| `guardian` | `/family` |
| `student` | `/learn` |

A person whose roles fit more than one portal (a principal who also teaches; an owner who wants the working app) gets a **portal switcher** in the user menu, and their last choice is remembered. Opening a portal one's roles do not fit shows the forbidden state with a link to the right one.

## Work packages

### 5.1 · Supabase Auth configuration

- [ ] `config.toml`: sign-up off; password minimum 10 characters with the leaked-password check on; email confirmations on; phone provider block and the test OTP map; TOTP enrol and verify on; access token 1 hour, refresh token rotation on; the custom access token hook.
- [ ] Auth email templates in `supabase/templates/` (invitation, reset, change of email), in English and Urdu, in the theme.
- [ ] The hook `public.custom_access_token_hook` adds the active membership's claims. It is used only for Realtime and Storage; the API still loads access from the database on every request.
- [ ] Server-side helpers on the privileged Supabase client: create a user on invitation acceptance, set a student's PIN, end a user's sessions.

### 5.2 · The pages

- [ ] Every screen in the table above, built from `@takhti/ui`, with all states.
- [ ] Error wording that never says which part was wrong: "These details do not match. Check them and try again."
- [ ] The "session expired" dialog from Phase 4 wired to real re-authentication, returning to the same page with form state intact.

### 5.3 · Session and protection

- [ ] `proxy.ts`: refresh the session; signed-out visitors of `(app)` go to `/sign-in?next=…`; signed-in visitors of `(auth)` go to their landing. `next` is accepted only when it is a path inside the app.
- [ ] Each shell's server layout calls `GET /me` and renders `/blocked`, `/two-factor/set-up`, `/first-time` or `/choose` when the state requires it, before any page of the portal.
- [ ] Rate limits ([M00](../10-modules/m00-shared-kernel.md) `rate_limits`): sign-in attempts per identifier and per address; code requests per phone (3 in 10 minutes, 10 a day); password resets per identifier. After 5 wrong passwords the identifier is locked for 15 minutes and the person is told how long.
- [ ] `login_events` written for every success and failure with the device and address; a sign-in from a device not seen before sends `auth.new-device` to the person.
- [ ] Suspending a membership, changing a password or pressing "Sign out everywhere" ends existing sessions within a minute.
- [ ] Cookies: `HttpOnly`, `Secure`, `SameSite=Lax`. Every mutating request must carry an `Origin` that matches the app ([07](../00-foundation/07-backend-kernel.md)).

### 5.4 · Invitations end to end

- [ ] Staff create invitations ([M03](../10-modules/m03-identity-roles-audit.md) routes exist from Phase 2); the email or message goes through the messaging hub and appears in the mail catcher or `/dev/outbox`.
- [ ] Accepting creates the Supabase user, links it to the profile and membership, marks the invitation used, signs the person in.
- [ ] A person who already has a login (a guardian with children in two schools; a staff member who is also a parent) is recognised by email or phone: accepting adds a membership to the existing login instead of creating a second one.

### 5.5 · The role matrix

`tests/e2e/roles.ts` holds, for each of the 32 roles: the seeded account, the portal it lands on, the navigation items it must see, three pages it must reach and three it must be refused. This phase fills it against the shells and placeholder pages; every later phase adds its real pages. A page under `(app)` that appears in no role's list fails the suite, so nothing is ever left untested.

`tests/e2e/auth/`: one spec per flow in the table below.

## Cases that must work

| Case | Expected |
|---|---|
| Wrong password five times | Locked for 15 minutes; the page says so; a `login_events` row each time |
| Code requested four times in ten minutes | The fourth is refused with the wait time |
| Code typed after 5 minutes | "This code has expired" with "Send again" |
| Parent has no WhatsApp | "Send by SMS instead" works |
| Parent's phone is not known to any school | The same neutral message as a wrong code; no hint that the number is unknown |
| A role that needs two-factor signs in without it | Sent to set-up; no portal page loads first |
| Authenticator lost | A recovery code signs in once and is spent; with none left, an administrator with `memberships:update` resets two-factor, which is audited and notified |
| Invitation link opened after it expired | A clear page: "Ask the school to send a new link" |
| Invitation link opened twice | The second visit says it was already used and offers sign-in |
| A login with two schools | `/choose`, then the chosen school; switching later from the user menu (`POST /me/switch-org`) |
| A teacher who is also a parent at the same school | `/choose` offers Staff and Parent; each portal shows only its own data |
| Membership suspended while signed in | The next request returns `403`; the page becomes `/blocked` |
| Organisation suspended by the platform | Staff see `/blocked` with the reason; guardians see a notice and read-only data |
| Student with an issued PIN | Must choose a new one on first sign-in |
| Student forgets the PIN | The class teacher or office issues a new one ([M03](../10-modules/m03-identity-roles-audit.md) `POST /memberships/[id]/reset-password`) |
| `?next=https://evil.example` | Ignored; the person goes to their landing |
| A signed-in guardian opens `/school` | The forbidden state with a link to `/family` |
| Session expires while a long form is open | The sign-in dialog appears over the page; after signing in, the form is still filled and saving works |
| Two tabs, sign out in one | The other shows the session-ended dialog at its next request |
| The device clock is five minutes off | Authenticator codes within the tolerance work; beyond it the page suggests checking the clock |

## Exit checks

1. The role matrix passes: all 32 seeded accounts sign in, land on the right portal, see the right navigation, reach their pages and are refused the others.
2. Every row of "Cases that must work" has a passing browser test.
3. All auth pages pass axe, render in both themes and both languages, and work at 360 px.
4. No auth page or response reveals whether an email, phone or admission number exists.
5. `pnpm check`, `pnpm test:db` and `pnpm test:e2e` are green. From this phase on, `pnpm test:e2e` is part of closing a phase.
6. A manual walk on a real phone on the local network: a parent signs in with the test code, a student with a PIN, a teacher with a password.

## Left for later, on purpose

- Real SMS and WhatsApp delivery of codes: [Phase 18](phase-18-integrations.md). Until then the fixed local test codes are used.
- Users, roles and audit screens: [Phase 7](phase-07-school-setup-and-people.md).
- Biometric or passkey sign-in on phones: [Phase 23](phase-23-mobile-apps.md).

# Phase 23 · Mobile apps

**Goal.** Native apps for the people who live on their phones: parents, teachers, students, drivers, and the owner. They add what a web page cannot do well: push notifications, a dependable offline store, the camera and scanner, background location for buses, and a place on the home screen.

**Depends on.** The web product being complete and live ([Phase 21](phase-21-hardening-and-launch.md)). The apps add no business logic: they call the same API with the same contracts, api-client and hooks.

**This phase is planned in outline.** It is written in detail when it is about to start, because the mobile toolchain changes quickly and the web product's real usage will show which screens matter most on a phone.

## What already makes this cheap

| Reused unchanged | From |
|---|---|
| Every Zod schema and type | `@takhti/contracts` |
| Every API call | `@takhti/api-client` (it uses `fetch` and takes its base URL and token provider as configuration) |
| Every query and mutation hook, keys and invalidation | `@takhti/hooks` |
| Translations | The message files |
| Design tokens | `packages/ui/tokens` (colours, spacing, type scale) exported for React Native |
| Offline model, streams, conflict rules, the upload route | [Phase 17](phase-17-offline.md); the native PowerSync SDK replaces the web one |
| Permissions, navigation rules | `GET /me` and the [navigation map](../30-reference/navigation.md) |

The API accepts the Supabase token as a bearer header ([03](../00-foundation/03-architecture.md)), so nothing on the server changes.

## The apps

| App | For | First release |
|---|---|---|
| **Takhti Parent** | Guardians | Home, fees and payment, attendance, diary and homework, results, messages, notices, calendar, transport with the live bus, requests and consents. Push for everything the messaging hub sends in-app |
| **Takhti Teacher** | Teachers | Today, attendance, diary and homework, marks, behaviour, messages, lesson plans, leave. Fully offline for the first five |
| **Takhti Student** | Students of older grades | Timetable, homework, quizzes, resources, results |
| **Takhti Driver** | Drivers and attendants | Trips, the manifest, boarding and drop-off, background location during a running trip, fuel log |
| **Takhti Owner** | Owners, directors, principals | Overview, branch scorecards, alerts, approvals, the weekly digest |

One codebase (`apps/mobile`, Expo) can ship several apps from shared packages, each with its own navigation, icon and store listing; or one staff app and one family app that show sections by role. Decide when starting, from how schools want to roll out.

## Decisions to take when starting

- One app per audience, or two apps (family, staff) with roles inside.
- The Expo SDK and React Native versions current at the time; the navigation and styling libraries; whether to share any UI code with the web through a universal layer or to write native screens from the shared tokens. Native screens from shared tokens and hooks is the default assumption.
- Android first. Almost all of the school's users are on Android ([12](../00-foundation/12-pakistan-domain-rules.md)); iOS follows from the same code.
- Minimum Android version and the smallest device to support, from the pilot schools' real devices.
- How updates are delivered: store releases, with over-the-air updates for fixes that do not change native code.

## Work, in outline

1. **Foundation.** The Expo project in the monorepo; the tokens and base components in React Native (square corners, the Kashi palette, the four typefaces including Nastaliq); right-to-left; light and dark; the API client and query client configured with a secure token store.
2. **Sign-in.** The same three ways as the web; biometric unlock of a stored session; the app PIN for offline; device registration in `user_devices`.
3. **Push.** Device tokens registered on sign-in; the push channel of the messaging hub ([M37](../10-modules/m37-messaging-hub.md)) switched from "logged" to a real provider; notification categories that match user preferences; a tap opens the right screen.
4. **Offline.** The native PowerSync SDK with an encrypted database; the same streams; background upload; the sync status and "needs attention" screens.
5. **Parent app**, then **Teacher app**, then **Driver app**, then **Student** and **Owner**, each screen built from the existing hooks.
6. **Device features.** Camera for photos, proof of payment and homework; QR and barcode scanning for ID cards, books and asset tags; background location for the driver app with clear consent, only during a running trip; printing a receipt to a Bluetooth thermal printer from the cashier's tablet, if schools ask for it.
7. **Store work.** Listings in English and Urdu, privacy declarations that match the privacy notice, test tracks, a staged rollout.

## Rules

- **No business rule in an app.** If a screen needs a rule, the API already enforces it and returns the reason.
- **The web stays complete.** Nothing may exist only in an app; a parent without a smartphone, or with an old one, uses the web portal.
- **Small and frugal.** Install size, memory and data use are budgets, because devices are modest and data is paid for.
- **The same tests.** Each app screen has the journey its web counterpart has, run on an emulator; the API and offline suites already cover what is behind it.
- **An old app must keep working.** The API is versioned (`/api/v1`); a change that would break a released app goes into a new version or behind a capability check, and the app tells the user when it must be updated.

## Exit checks, to be detailed when the phase is written out

1. Each app's first-release screens pass their journeys on a low-end Android device.
2. Push notifications arrive for every event that sends in-app notifications, and respect preferences and quiet hours.
3. The teacher and driver apps pass the offline scenarios of [Phase 17](phase-17-offline.md) on a device in flight mode.
4. A released app continues to work against a newer server.
5. Store listings are approved and a staged rollout has reached the pilot schools.

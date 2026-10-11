# Phase 4 · Frontend foundation

**Goal.** Everything a screen is made of exists before the first real screen is built: the Kashi theme, every component, the form system, the data table, the page patterns, the seven shells with their navigation, translation with Urdu, and a gallery that shows all of it. From Phase 6 on, building a screen means assembling these pieces.

**Depends on.** [Phase 3](phase-03-client-layer.md).

**Produces.** `@takhti/ui`, the shells in `apps/web/src/components`, the message files, and `/dev/ui`.

## Read first

[16 · Frontend architecture](../00-foundation/16-frontend-architecture.md) is the specification for this phase. The approved look is [`docs/design/theme/kashi-theme.html`](../../design/theme/kashi-theme.html); its tokens are in [`globals.css`](../../design/theme/globals.css), generated from [`tokens.mjs`](../../design/theme/build/tokens.mjs).

**Fixed design rules** (approved; do not reopen):

- Border radius is **0** everywhere. No rounded corners on any component, including avatars, badges, inputs, dialogs and chart bars.
- Colours: cobalt primary, turquoise and marigold accents, ink sidebar, the neutral scale. All from tokens; no colour value in a component.
- Type: Lexend for headings, IBM Plex Sans for text, IBM Plex Mono for codes and numbers in tables, Noto Nastaliq Urdu for Urdu.
- Icons: Material Symbols Sharp, as SVG components.
- Density: controls 28, 32 and 40 px high; table header 36 px and rows 40 px; sidebar 208 px.
- Radios are diamonds. Borders are 1 px. Focus ring is 2 px with a 2 px offset.
- Light and dark themes, both complete.

## Work packages

### 4.1 · Tokens, fonts and base styles

- [ ] Tailwind v4 set up in `@takhti/ui` with the tokens from `globals.css` as theme variables; `apps/web` imports it.
- [ ] Move the token build (`docs/design/theme/build/`) into `packages/ui/tokens/` as the single source; `pnpm ui:tokens` regenerates the CSS and re-runs the contrast checks. A failing contrast check fails the build.
- [ ] Fonts with `next/font/local`, files in `packages/ui/fonts/` (licences checked: all four are open licences). Variables: `--font-heading`, `--font-sans`, `--font-mono`, `--font-urdu`.
- [ ] Base layer: the reset, `:focus-visible` ring, selection colour, scrollbars, `[dir="rtl"]` and `:lang(ur)` rules (Urdu two steps larger, line height 2.1).
- [ ] `next-themes` with class `.dark`, default "system".
- [ ] The icon set: a script turns the chosen Material Symbols Sharp SVGs into typed React components in `@takhti/ui/icons`; adding an icon is one line in a list.

### 4.2 · Primitives

Each of the primitives listed in [16](../00-foundation/16-frontend-architecture.md), from shadcn/ui, copied into `packages/ui/src/primitives/` and restyled: radius 0, 1 px borders, the three control heights, token colours, logical properties only.

For every primitive: all its states (default, hover, focus, active, disabled, invalid, loading where it applies); keyboard behaviour per the WAI-ARIA pattern; both themes; both directions; a component test; an entry in the gallery.

### 4.3 · Data display

`DataTable` first, because most screens are lists:

- [ ] Column definitions typed from the contract's entity; server-side paging, sorting and filtering through `useListParams`.
- [ ] Sticky header; density switch (32, 40, 48 px rows) remembered per user; column visibility and order remembered per table (`saved_views`, [M00](../10-modules/m00-shared-kernel.md)).
- [ ] Row selection with `BulkBar`; row actions menu; row click opens the detail or a sheet.
- [ ] States inside the table frame: skeleton rows while loading; the previous page dimmed while the next loads; empty with a reason and an action; error with Retry; forbidden.
- [ ] Virtualised body above 200 rows.
- [ ] On a phone the table becomes a list of cards using each column's `mobile` setting (title, subtitle, meta, hidden).
- [ ] Keyboard: arrows move between rows, Enter opens, Space selects.

Then `FilterBar` (search with debounce, filter chips, a Filters sheet built from the contract's filter schema, saved filter sets), `StatStrip`, `StatusBadge` (one registry of status → tone and translated word; a status with no entry fails a test), `KeyValue`, `Timeline`, the value renderers (`Money`, `DateText`, `Code`, `Phone`, `Masked`), the five standard states, and `QueryBoundary`.

Charts (`@takhti/ui/charts`, Recharts wrapped): bar, stacked bar, line, bullet bar and sparkline. Each follows the dataviz rules already adopted for the theme: one axis; categorical colours assigned in the fixed order from the tokens, never cycled; square bar ends; a legend whenever there is more than one series; direct labels for up to four; a tooltip; and a "view as table" toggle built in. Chart text uses text tokens, not series colours. The chart palette is the one validated in `tokens.mjs` for both themes.

### 4.4 · Forms

- [ ] `Form`, `FormSection`, `FormActions`, `Field` and every field component in [16](../00-foundation/16-frontend-architecture.md), all wired to React Hook Form with the Zod resolver.
- [ ] `useContractForm(schema, options)`: sets up the form from a contract schema, default values, the unsaved-changes guard, the draft autosave (per user, per form, in the browser), `applyApiError`, focus on the first invalid field, and the `STALE` dialog.
- [ ] `MoneyField` (typed in rupees, value in paisa, separators as typed, never a float), `DateField` and friends (string values only), `PhoneField` and `CnicField` (format as typed), `UrduField` (right-to-left, Nastaliq, on-screen keyboard toggle).
- [ ] `FileField` and `PhotoField` on `useUpload`: progress, retry, remove, client-side type and size checks, crop for photos.
- [ ] The domain pickers (`StudentPicker`, `GuardianPicker`, `StaffPicker`, `SectionPicker`, `GradePicker`, `SubjectPicker`, `BranchPicker`, `AcademicYearPicker`, `AccountPicker`, `FeeHeadPicker`, plus `AudiencePicker`): each a `ComboboxField` backed by its list hook, searching on the server, showing the label format the module uses (a student as "Name · Father's name · 7-B").
- [ ] `GridEditor`: the spreadsheet-like editor used for marks, attendance registers, fee structures, budgets and timetables. Cell types (text, number, money, select, toggle), arrow and Tab movement, Enter moves down, paste from a spreadsheet, per-cell validation and error mark, dirty tracking, autosave hook, frozen first column, totals row.

### 4.5 · Page patterns

One component per pattern in [16](../00-foundation/16-frontend-architecture.md), so a page is a few lines:

`ListPage`, `DetailPage` (header, status, actions, tabs bound to the URL, an Activity tab fed by the audit log), `FormPage`, `DialogForm`, `SheetForm`, `Wizard` (numbered steps, per-step validation, a summary step, one commit, resumable), `Board`, `GridPage`, `CounterPage` (search box with focus on load, record panel, short form, one commit, keyboard map, scanner input), `ChecklistPage`, `SplitView`, `ChatView`, `TreeView`, `CalendarView` (day, week, month, agenda), `DashboardGrid` with `KpiTile`, `ReportView` (filters from a JSON Schema, table with totals, chart, export, save, schedule), `SettingsPage`, `PrintView`.

### 4.6 · Shells and navigation

- [ ] `AppShell`, `Sidebar`, `TopBar`, `PageHeader`, `PageTabs`, `MobileNav`, `CommandPalette` (`Ctrl+K`: navigation items and record search, filtered by permission).
- [ ] A shell layout for each of `/platform`, `/hq`, `/school`, `/teach`, `/family`, `/learn` and `/s/[school]`, each reading `useMe()` once on the server and rendering the frame; the placeholder pages from Phase 0 now sit inside real shells.
- [ ] `nav.ts` per shell from the [navigation map](../30-reference/navigation.md): each item with its path, icon, permission and module. An item the user cannot use is not rendered. A test asserts every path in `nav.ts` has a page and every page under `(app)` is in `nav.ts` or marked as a sub-page.
- [ ] Branch switcher (staff with more than one branch) and academic-year switcher in the top bar; child switcher in `/family`.
- [ ] `NotificationBell` and the notifications page on `useNotifications` and `useUnreadCount` ([M37](../10-modules/m37-messaging-hub.md)).
- [ ] The offline banner (`useOnline`), the "session expired" sign-in dialog, the environment ribbon ("LOCAL", "STAGING").
- [ ] `loading.tsx`, `error.tsx` and `not-found.tsx` for every route segment, from templates.
- [ ] `useCan`, `<Can>`, and the forbidden state for a whole page.

### 4.7 · Translation and Urdu

- [ ] `next-intl`: messages split by module under `apps/web/src/i18n/messages/{en,ur}/`; shared words in `common.json`.
- [ ] `<html lang dir>` from the user's preference; a language switch in the top bar and on the sign-in page.
- [ ] `pnpm i18n:check`: every key in English exists in Urdu and the reverse; no unused key; no hard-coded string in a component (a lint rule flags JSX text).
- [ ] `<Ltr>`: wraps numbers, dates, amounts and codes inside Urdu text.
- [ ] Number and date formatting through one module (`format.ts`): `Rs 8,500`, lakh and crore or international abbreviation by user preference, dates as `12 Oct 2026`.
- [ ] Urdu for everything in `@takhti/ui` and the shells is written in this phase. Module messages are written with each module's screens.

### 4.8 · The gallery — `/dev/ui`

Development only. One page per component group showing every component in every state, with switches for theme, direction and density. Also: every page pattern with fake data, the icon set, the colour and type scales, and every status badge. Screenshot tests (Playwright) run against the gallery in light and dark, left-to-right and right-to-left, at 400 and 1440 px.

### 4.9 · Developer pages

`/dev/outbox` (messages the local adapters "sent"), `/dev/payments` (complete, fail or delay a fake payment), `/dev/jobs` (queue state), `/dev/hooks` (from Phase 3). All excluded from production builds by a build-time flag and a test that requests them in a production build.

## Exit checks

1. `/dev/ui` shows every component listed in [16](../00-foundation/16-frontend-architecture.md) in all states; the screenshot suite passes in both themes and both directions at both widths.
2. An automated scan of the built CSS finds no `border-radius` other than 0 and no colour outside the tokens.
3. axe reports no violation on any gallery page; every component passes its keyboard test.
4. `pnpm i18n:check` passes; switching to Urdu flips the shells to right-to-left with Nastaliq and no overlapping text.
5. A sample **Students** list page, built only from `ListPage`, `useStudentsList` and column definitions, is under 60 lines and shows loading, empty, error and forbidden states correctly. A sample form page for a holiday, built from `FormPage` and the contract, shows field errors returned by the server under the right fields.
6. Each shell renders for a seeded account of the right kind, with the navigation filtered by that account's permissions and modules.
7. Lighthouse on the sample list page: performance and accessibility at or above 90 on a mid-range phone profile.

## Left for later, on purpose

- Real screens: from [Phase 5](phase-05-auth.md) on.
- Print layouts: [Phase 16](phase-16-documents-and-printing.md).
- Service worker and installable app: [Phase 17](phase-17-offline.md).

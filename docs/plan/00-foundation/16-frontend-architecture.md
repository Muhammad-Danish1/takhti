# 16 · Frontend architecture

How every screen is built. The design system is set up in [Phase 4](../20-phases/phase-04-frontend-foundation.md); the portals follow from Phase 6.

The look is the approved **Kashi** theme: [`docs/design/theme/kashi-theme.html`](../../design/theme/kashi-theme.html). Its tokens are in [`globals.css`](../../design/theme/globals.css) and are generated from [`tokens.mjs`](../../design/theme/build/tokens.mjs). Colours are changed there and nowhere else.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js App Router, React Compiler on |
| Styling | Tailwind CSS v4 with the Kashi tokens |
| Components | shadcn/ui, copied into `@takhti/ui` and restyled: radius 0, 1px borders, 28/32/40px controls |
| Icons | Material Symbols Sharp (weight 400), as SVG components in `@takhti/ui/icons`. No icon font |
| Fonts | Lexend (headings), IBM Plex Sans (text), IBM Plex Mono (codes), Noto Nastaliq Urdu. Bundled with `next/font/local`, never fetched at runtime |
| Server state | TanStack Query through `@takhti/hooks` only |
| URL state | `nuqs`: page, filters, sort and open tab live in the address bar |
| Local state | React state; Zustand only for cross-page UI preferences (sidebar, density) |
| Forms | React Hook Form with the Zod resolver, using the contract's schema |
| Tables | TanStack Table, server-side paging, sorting and filtering; TanStack Virtual for long lists |
| Charts | Recharts wrapped in `@takhti/ui/charts`: square bars, token colours, tooltip and table view built in |
| Translation | `next-intl`, English and Urdu |
| Theme switch | `next-themes`, class `.dark`, default follows the system |
| Dates | `date-fns` for display only; date maths stays in the kernel's string functions |

## Rules for screens

1. A screen imports **hooks, contracts and UI components**. It never calls `fetch`, never imports `@takhti/core` or `@takhti/db`.
2. Pages under `(app)` are thin: the page file sets the title and renders one feature component from `src/features/<module>/`.
3. Data screens are client components. The server renders the shell (layout, navigation, session check).
4. No text in components. Every string comes from a message file.
5. No colour, radius or spacing value in a component. Only tokens and the spacing scale.
6. Only logical CSS: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`. A lint rule bans `ml-`, `mr-`, `left-`, `right-`, so Urdu (right-to-left) works without extra work.
7. Every async surface is wrapped in a `QueryBoundary`, which renders loading, error, empty, forbidden and not-found the same way everywhere.
8. Every write uses a mutation hook, disables its trigger while pending, and ends in a toast or an inline error.

## The design system — `@takhti/ui`

### Primitives (restyled shadcn)

Button, IconButton, Input, Textarea, Select, Combobox, Checkbox, Radio (diamond), Switch, Label, Badge, Avatar (square), Tooltip, Popover, DropdownMenu, ContextMenu, Dialog, AlertDialog, Sheet (side panel), Tabs, SegmentedControl, Accordion, Collapsible, Separator, ScrollArea, Skeleton, Progress, Meter, Toast, Calendar, Command (palette), Breadcrumb, Pagination, Table.

### Data display

| Component | Purpose |
|---|---|
| `DataTable` | The one list component: columns, server paging, sort, column visibility, density (32/40/48px rows), row selection, sticky header, loading skeleton rows, empty and error states |
| `BulkBar` | Appears when rows are selected: count and actions |
| `FilterBar` | Search box, filter chips, "Filters" sheet, saved filter sets; bound to the URL |
| `StatStrip` | The joined row of figures at the top of a page |
| `StatusBadge` | Maps a status to its tone and translated word; one mapping per status type |
| `KeyValue` | Label and value pairs on detail pages |
| `Timeline` | Activity and audit history |
| `Money`, `DateText`, `Code`, `Phone`, `Masked` | Render a value in its one correct format |
| `EmptyState`, `ErrorState`, `ForbiddenState`, `NotFoundState`, `OfflineState` | The standard states |
| `Chart*` | Bar, line, stacked bar; each ships with legend, tooltip and a "view as table" toggle |

### Forms

| Component | Purpose |
|---|---|
| `Form`, `FormSection`, `FormActions` | Layout: labelled sections and a sticky footer with Save and Cancel |
| `Field` | Label (11px capitals), control, hint and error, wired to React Hook Form |
| `TextField`, `NumberField`, `TextareaField` | |
| `MoneyField` | Typed in rupees, stored in paisa, thousands separators while typing |
| `DateField`, `TimeField`, `PeriodField`, `DateRangeField` | Values are strings; the calendar never produces a `Date` in form state |
| `PhoneField`, `CnicField` | Format as typed; validate with the contract primitives |
| `UrduField` | Right-to-left, Nastaliq, with an on-screen Urdu keyboard toggle |
| `SelectField`, `ComboboxField`, `MultiSelectField` | Static or searched through a hook |
| `CheckboxField`, `RadioGroupField`, `SwitchField` | |
| `FileField`, `PhotoField` | Upload through the files API with progress, retry and remove; photo adds crop |
| Domain pickers | `StudentPicker`, `GuardianPicker`, `StaffPicker`, `SectionPicker`, `GradePicker`, `SubjectPicker`, `BranchPicker`, `AcademicYearPicker`, `AccountPicker`, `FeeHeadPicker` |

Form behaviour, the same everywhere:

- Validation runs on blur and on submit, using the contract. Server errors land under their field through `applyApiError`.
- Leaving with unsaved changes asks first.
- Long forms autosave a draft in the browser per user and offer to restore it.
- On `STALE`, a dialog shows what changed on the server and offers Reload, keeping the user's values to re-apply.
- The first invalid field gets focus.

### Shell

`AppShell` (sidebar, top bar, content), `Sidebar` (208px, collapses to 56px, groups with capital labels), `TopBar` (breadcrumb, command palette, branch switcher, academic-year switcher, notifications, language, theme, user menu), `PageHeader` (title, description, actions), `PageTabs`, `MobileNav` (bottom bar for `/teach`, `/family`, `/learn`).

Navigation is data: each shell has a `nav.ts` listing items with the permission and module each needs. Items the user cannot use are not rendered, and the same list drives the command palette.

## Page patterns

Every screen is one of these, or two of them joined ("List + Detail" is a list whose rows open a detail page; "List + Form in a sheet" is a list with its form in a side panel). A module spec's **Screens** section names the pattern for each screen.

| Pattern | Layout | Example |
|---|---|---|
| **List** | PageHeader, optional StatStrip, FilterBar, DataTable, pagination | Students, vouchers |
| **Detail** | PageHeader with status and actions, PageTabs, panels | A student's record |
| **Form page** | PageHeader, Form with sections, sticky actions | New staff member |
| **Dialog form** | A short form over the list | Mark a cheque cleared |
| **Form in a sheet** | A form in a side panel, with the list still visible behind it | Add a vendor, log a clinic visit |
| **Wizard** | Numbered steps, a summary step, then one commit | Admission, payroll run, promotion, import |
| **Board** | Columns of cards moved between stages | Admissions pipeline, complaints |
| **Grid editor** | A spreadsheet-like grid with keyboard movement and paste | Marks entry, attendance register, timetable |
| **Grid** | The same grid, read-only: rows against columns with a value or status in each cell | Month attendance sheet, marking progress |
| **Counter** | One search box, the person's record, a short form and a single commit; built for speed and the keyboard, and for a barcode scanner | Collect fees, library desk, point of sale |
| **Checklist** | Large rows with one tap each, for a phone held in one hand | Trip manifest, hostel roll-call |
| **Split view** | A list on one side and the selected item's working area on the other | Bank reconciliation, page editor, messages |
| **Chat** | A conversation with a composer at the bottom | Parent–teacher messages, the assistant |
| **Tree** | An indented hierarchy that can be expanded, and edited where the screen says so | Chart of accounts, syllabus, site menus |
| **Calendar** | Day, week or month views | Timetable, events, meetings |
| **Dashboard** | StatStrip, charts, short lists that link to full pages | Each portal's home |
| **Report** | Filters at the top, chart and table below, export | Fee collection report |
| **Settings** | Left list of sections, form on the right | School setup |
| **Print view** | The document on a white page with a print bar | Challan, report card |

## Shells and their character

| Shell | Device first | Navigation | Notes |
|---|---|---|---|
| `/platform` | Desktop | Sidebar | Dense tables, like the audit-log reference |
| `/hq` | Desktop | Sidebar | Dashboards and comparisons across branches |
| `/school` | Desktop, works on tablet | Sidebar with workspaces by role | The main working app |
| `/teach` | Phone | Bottom bar: Today, Classes, Marks, Messages, More | Large touch targets; offline-capable |
| `/family` | Phone | Bottom bar: Home, Fees, Attendance, Results, More | Child switcher at the top |
| `/learn` | Phone and tablet | Bottom bar: Home, Timetable, Homework, Results | Simple, friendly wording |
| `/s/[school]` | Any | Top bar | Public; no session |

Breakpoints: 400 (phone), 768 (tablet), 1024 (laptop), 1440 (desktop). Every screen is checked at 400 and 1440.

## Translation and Urdu

- Messages are split by module: `messages/en/fees.json`, `messages/ur/fees.json`. Keys are named by meaning (`voucher.status.overdue`), never by English text.
- Plurals and numbers use ICU message syntax.
- The `<html>` element gets `lang` and `dir` from the user's choice. Fonts switch by `lang`.
- Urdu text is set two sizes larger with line height 2.1 (a token, `--leading-urdu`).
- Numbers, dates, amounts and codes inside Urdu text are wrapped so they stay left-to-right.
- Names typed in Urdu are stored in the `_ur` columns and shown beside the English name where the screen has room.
- A missing Urdu message fails the build's translation check; it never silently shows English.

## Access on the client

- `useCan('fee-payments:collect')` and `<Can permission="…">` hide what the user cannot do.
- This is for convenience only. The server refuses regardless.
- A page the user may not open shows the forbidden state, not a blank page or a redirect loop.

## Accessibility

- WCAG 2.2 level AA.
- Everything works by keyboard: visible focus ring (2px, 2px offset), logical tab order, Escape closes overlays, arrow keys move within grids, menus and tabs.
- Every control has a label. Icons-only buttons have an accessible name.
- Colour is never the only signal: statuses have words, errors have text, charts have labels and a table view.
- Touch targets are at least 40px on phone shells.
- Motion is small and respects "reduce motion".

## Speed

- Each route loads only its own code. Heavy pieces (charts, rich-text editor, grid editor) load when first needed.
- Lists fetch one page. Long grids are virtualised.
- A link's data is prefetched on hover or focus.
- Images go through `next/image` with fixed sizes, so nothing shifts when they load.
- A new list keeps the previous page visible while the next one loads.

## Errors

- Each route segment has `loading.tsx`, `error.tsx` and `not-found.tsx`.
- A session that expires opens a sign-in dialog over the page; after signing in, the page continues with its form intact.
- A network failure on a read retries once, then shows the error state with "Try again".
- An unexpected crash shows a calm page with the request id and a "Reload" button, and is reported.

## Component gallery

`/dev/ui` (development only) shows every component in every state, in both themes and both directions. It replaces a separate Storybook and is the reference when building screens. Screenshot tests run against it.

# Phase 20 · Public school website

**Goal.** Each school has a public website it can edit itself, in its own colours, in English and Urdu, and the public parts of other modules live there: online admission, job applications, events, transport routes, certificate checking and the fee payment link.

**Depends on.** Phases [7](phase-07-school-setup-and-people.md) (admissions, certificates), [10](phase-10-hr.md) (job openings), [12](phase-12-communication.md) (events) and [18](phase-18-integrations.md) (payments), for the features it exposes. The site itself needs only [Phase 4](phase-04-frontend-foundation.md).

**Portals.** `/s/[school]` for visitors; the Website area of `/school` for editors.

**Modules.** [M41](../10-modules/m41-school-website.md), and the public screens of [M06](../10-modules/m06-admissions.md), [M08](../10-modules/m08-certificates-id-cards.md), [M10](../10-modules/m10-alumni.md), [M22](../10-modules/m22-online-payments-reconciliation.md), [M26](../10-modules/m26-staff-recruitment.md), [M30](../10-modules/m30-transport.md), [M39](../10-modules/m39-notices-events-calendar.md).

## Read first

[M41](../10-modules/m41-school-website.md) in full; [10 · Security and privacy](../00-foundation/10-security-and-privacy.md) (public surfaces); the rows marked **Public:** in each module above.

## Rules for public pages

- **Public means deliberately public.** A public page shows only what a person at the school chose to publish, or what a visitor is entitled to by a token they hold. No public route returns a student's or a guardian's personal details.
- **Server-rendered and cached.** Public pages are rendered on the server, cached per school, and revalidated when that school publishes. They work with scripts disabled, except forms.
- **Fast on a cheap phone.** No client framework code on a content page beyond what the language switch and forms need; images in modern formats at the right size; fonts subset and bundled.
- **Every form is defended**: rate limits by address and by phone number, a hidden field, server-side validation with the same contract, uploads scanned, and a neutral answer that never confirms whether a person or record exists.
- **Accessible and findable**: one main heading per page, alt text on every image, a sitemap, sensible titles and descriptions, no-index until the school publishes.
- **The school's look, within limits**: its logo, two colours that pass the contrast check, a header style. Square corners and the Kashi type stay.

## Work packages

### 20.1 · The site shell and routing

- [ ] `/s/[school]` layout: top bar with logo and menu, footer with branches and contact, language switch, "coming soon" for an unpublished site.
- [ ] `/s/[school]/ur/…` for Urdu, right-to-left.
- [ ] Custom domains: the edge `proxy.ts` asks `GET /public/resolve-domain` (cached) and rewrites a verified domain to its school; an unknown domain gets "site not found". Locally, custom domains are tested with entries in the hosts file.
- [ ] Per-school theme variables from `site_settings.theme`, checked for contrast when saved.
- [ ] Cache tags per school; publishing revalidates only that school.

### 20.2 · Blocks

A server component per block type in `apps/web/src/site/blocks/` ([M41 §4](../10-modules/m41-school-website.md)): hero, text, image and text, stats, features, gallery, team, testimonials, FAQ, fee table, news, events, admissions call-to-action, branches, contact form, map, video, downloads, divider. Each with full and minimal data, in both languages, at phone and desktop widths, in the gallery (`/dev/ui/site`).

### 20.3 · The editor

| Screen | Path | Pattern |
|---|---|---|
| Website | `/school/website` | Dashboard |
| **Page editor** | `/school/website/pages/[id]` | Split view |
| Posts | `/school/website/posts` | List + Form page |
| Media | `/school/website/media` | Grid |
| Menus | `/school/website/menus` | Tree |
| Settings | `/school/website/settings` | Settings |
| Contact messages | `/school/website/messages` | List |

The page editor: blocks on the left to add, reorder and remove; the selected block's form in the middle; a live preview on the right that switches between phone and desktop and between English and Urdu; draft and published kept apart; undo and redo; autosave. "Create starter site" builds Home, About, Admissions, Academics, Facilities and Contact from what Takhti already knows.

### 20.4 · Built-in public pages

| Page | Path | From |
|---|---|---|
| Admissions: information, **enquiry**, **online application** (saves progress on the device), **check status** by tracking code | `/s/[school]/admissions/…` | [M06](../10-modules/m06-admissions.md) |
| Jobs: openings and **apply** with a CV upload | `/s/[school]/jobs` | [M26](../10-modules/m26-staff-recruitment.md) |
| News | `/s/[school]/news` | [M41](../10-modules/m41-school-website.md) |
| Events | `/s/[school]/events` | [M39](../10-modules/m39-notices-events-calendar.md) |
| Transport routes and stops | `/s/[school]/transport` | [M30](../10-modules/m30-transport.md) |
| **Check a certificate** by its code or QR | `/s/[school]/verify` | [M08](../10-modules/m08-certificates-id-cards.md) |
| **Pay fees** by challan number: shows the amount and the payer's first name only, then the provider's page | `/s/[school]/pay` | [M22](../10-modules/m22-online-payments-reconciliation.md) |
| Alumni: update my details through a personal link | `/s/[school]/alumni/update` | [M10](../10-modules/m10-alumni.md) |
| Contact | `/s/[school]/contact` | [M41](../10-modules/m41-school-website.md) |
| Calendar feed | `/public/calendar-feed/[token]` | [M39](../10-modules/m39-notices-events-calendar.md) |

Each takes the school's theme and is switched on or off in the site's features.

### 20.5 · Search engines and sharing

Titles, descriptions and share images per page; a sitemap and robots file per school and per custom domain; structured data for the school and its events; no-index while unpublished.

## Journeys to automate

| Journey | Steps |
|---|---|
| A site in ten minutes | Create the starter site → change the hero text and image → pick colours (a failing colour is refused with a suggestion) → publish → the site is live at `/s/roshan` |
| Draft is private | Edit a published page → the public still sees the old version → publish → the new one appears; discard returns the draft to published |
| A parent applies | Open the site on a phone → Admissions → apply for Grade 6 with documents → a tracking code → the application is in the admissions list → check status with the code |
| A hostile form | 50 contact submissions in a minute → rate-limited; a script tag in a field is stored as text and never rendered as markup |
| Verify | A certificate's code confirms it with the name partly masked; a wrong code says "not found" |
| Pay by challan | Enter a challan number → the amount and first name → pay in the sandbox → receipt; a wrong number says "not found" without hinting whether it nearly matched |
| Urdu | Switch to Urdu → right-to-left layout, Nastaliq, the English-only page falls back with a note |
| A custom domain | Add a domain → the DNS record to create is shown → verify fails without it and succeeds with it → the site answers on the domain; another school's unverified domain never resolves |
| No personal data | A crawl of every public route's responses finds no field from the forbidden list |

## Exit checks

1. Every screen and public page meets "Done when"; public pages additionally pass with scripts disabled (except forms).
2. All nine journeys pass in the browser.
3. Lighthouse on the seeded home page on a mid-range phone profile: performance, accessibility, best practices and SEO each at or above 90.
4. The snapshot test over every public response ([T-website-5](../10-modules/m41-school-website.md)) passes.
5. An automated scan of the public routes with a standard web scanner reports no high or medium finding (missing headers, reflected input, open redirects).
6. `pnpm check`, `pnpm test:db`, `pnpm test:e2e`.

## Left for later, on purpose

- A free-form page designer, e-commerce, blogs with comments: not planned.
- Takhti's own marketing site: [Phase 22](phase-22-marketing-site.md).

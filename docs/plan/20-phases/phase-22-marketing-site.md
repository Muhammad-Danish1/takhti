# Phase 22 · Marketing site

**Goal.** Takhti's own public website: what the product is, who it is for, what it costs, and a way to ask for a demo. Built last, when there is a real product, real screenshots and real schools to speak about.

**Depends on.** [Phase 21](phase-21-hardening-and-launch.md), so that every claim on the site is true. It reuses the design system of [Phase 4](phase-04-frontend-foundation.md).

**Where.** `apps/web/app/(marketing)/`, served at the root of the main domain. The application lives under `/sign-in` and the portal paths, so the two never collide.

## Decisions to take first

Open in [02](../00-foundation/02-decisions-and-stack.md): the domain name; the company's legal name, address and contact details as they will appear; the plans and prices to publish (or "contact us"); which languages the site launches in (English and Urdu are both expected); and which schools have agreed to be named or quoted.

## Rules

- **Say only what the product does today.** No feature that is not built, no number that is not measured, no customer who has not agreed in writing.
- **Show the product.** Real screenshots of the seeded demo school, in both themes, kept current by a script that captures them from the running app. No stock photographs of children; illustrations and product images only.
- **Speak to three readers**, each with their own page: the owner (control across branches, money, reports), the principal (the school day), and the accountant or administrator (fees, payroll, less re-keying).
- **Pakistan first.** Rupees, the board system, WhatsApp, the challan, Urdu: the site should feel written for this market because the product is.
- **Fast and plain.** Server-rendered, almost no client script, readable on a cheap phone, Kashi theme with square corners, excellent in Urdu.
- **Honest about data.** A clear page on where data is stored, who can see it, backups, and what happens when a school leaves.

## Pages

| Page | Path | Content |
|---|---|---|
| Home | `/` | What Takhti is in one sentence; the three readers; the main modules as a visual tour; proof (schools, figures, quotes) where permitted; a demo request |
| Product | `/product` and `/product/[area]` | One page per area: admissions and students, academics and exams, fees and accounts, staff and payroll, communication, operations, head office, AI; each with screenshots and the problems it removes |
| For owners, principals, accounts | `/for/[role]` | The same product told from each seat |
| Pricing | `/pricing` | The plans, what each includes, how billing works, common questions |
| Security and data | `/security` | Isolation between schools, encryption, backups, access by Takhti staff, data location, leaving |
| About | `/about` | Who builds it and why |
| Contact and demo | `/contact`, `/demo` | A form that creates a **demo request** in the platform console ([M01](../10-modules/m01-platform-console.md)); phone and WhatsApp |
| Help | `/help` | The public parts of the in-app guides |
| Updates | `/updates` | The changelog schools can read |
| Legal | `/privacy`, `/terms` | The reviewed documents from Phase 21 |
| Urdu | `/ur/…` | Every page above |

## Work packages

- [ ] **22.1** Content first: the copy for every page written and agreed in English, then written (not machine-translated and left) in Urdu and reviewed by a native reader.
- [ ] **22.2** The marketing layout and its sections, from `@takhti/ui`: hero, feature rows with screenshots, comparison table, quote, pricing table, FAQ, call to action, footer.
- [ ] **22.3** The screenshot script: signs in to a local app with seeded data and captures the listed screens at fixed sizes in both themes and both languages; run before each release.
- [ ] **22.4** The demo request form: validated, rate-limited, with the hidden field; it posts to a `public` route that writes `demo_requests` and notifies platform staff. A thank-you page says when to expect a call.
- [ ] **22.5** Search and sharing: titles, descriptions, share images, structured data, sitemap; redirects from `www`.
- [ ] **22.6** Privacy-respecting analytics (no advertising trackers), with a cookie notice only if something needs consent.
- [ ] **22.7** A public demo: a button that signs a visitor in to a shared, read-only demo school that resets nightly. Read-only is enforced by a role with read permissions only, not by hiding buttons.

## Exit checks

1. Every page exists in English and Urdu, reads well on a 360 px phone, and passes the automated accessibility check.
2. Lighthouse on Home, Pricing and one product page on a mid-range phone profile: every category at or above 95.
3. Every factual claim on the site is traceable to something in the product or a measurement, listed in a short "claims" file reviewed by the product owner.
4. A demo request submitted on the site appears in the platform console and its notification is sent.
5. The public demo cannot change any data: a test tries every mutating route with the demo account.
6. The screenshot script runs clean and its output is what the pages use.

## Left for later, on purpose

- A blog, case studies and comparison pages: content work that continues after launch.
- Self-service sign-up with online payment for the subscription: schools are onboarded by Takhti's staff until the onboarding is smooth enough to automate.

# M41 · School website

## 1 · Purpose

A public website for each school, built from blocks in a simple editor and served by Takhti at `/s/[school]` or on the school's own domain. It shows what the school chooses to publish, and it is the front door for the public parts of other modules: admission enquiry and application, job openings, events, transport routes, certificate checking and the fee payment link.

It is not a general website builder. The layouts are fixed and well made, in the school's colours, in English and Urdu.

## 2 · Depends on

[M02](m02-organisation-branches.md) (organisation, branches, logo), [M00](m00-shared-kernel.md) (files). Shows public data from [M06](m06-admissions.md), [M08](m08-certificates-id-cards.md), [M26](m26-staff-recruitment.md), [M30](m30-transport.md), [M39](m39-notices-events-calendar.md).

## 3 · Tables

#### `site_settings` · org
One row per organisation.

| Column | Type | Rules |
|---|---|---|
| is_published | bool | default false |
| custom_domain | text | optional; unique across the platform; lower case |
| domain_status | enum(none, pending, verified, failed) | default none |
| domain_token | text | optional; the value the school puts in a DNS record to prove ownership |
| languages | text[] | default `{en}`; `en`, `ur` |
| default_language | enum(en, ur) | default en |
| theme | jsonb | default `{}`; `{ primary, accent, headerStyle: light \| dark \| brand }`; colours must pass the contrast check |
| tagline | text | optional |
| tagline_ur | text | optional |
| contact | jsonb | default `{}`; phone, WhatsApp, email, address, map coordinates, office hours, per branch |
| social | jsonb | default `{}`; Facebook, Instagram, YouTube, X links; `https` only |
| seo | jsonb | default `{}`; default title, description, share image |
| features | jsonb | default `{}`; which public features are on: admissions, jobs, events, transport, certificate check, fee payment, results notice |
| analytics_id | text | optional |
| footer_text | text | optional |

Unique: (org_id).

#### `site_pages` · org

| Column | Type | Rules |
|---|---|---|
| slug | text | required; lower case, hyphens; unique per organisation; `home` is the front page |
| title | text | required |
| title_ur | text | optional |
| blocks | jsonb | required; an ordered list of blocks, each validated by its own schema |
| blocks_ur | jsonb | optional; the Urdu version; falls back to English blocks with Urdu text where given |
| seo_title | text | optional |
| seo_description | text | optional |
| status | enum(draft, published) | default draft |
| published_blocks | jsonb | optional; what the public sees; set when published |
| published_at | timestamptz | optional |
| updated_by | uuid → profiles | optional |

Policy: staff of the organisation. The public reads published pages through the public route only.

#### `site_posts` · org
News and announcements.

| Column | Type | Rules |
|---|---|---|
| slug | text | required; unique per organisation |
| title | text | required |
| title_ur | text | optional |
| excerpt | text | optional |
| body | text | required; rich text, sanitised |
| body_ur | text | optional |
| cover_file_id | uuid → files | optional |
| category | enum(news, achievement, event, notice) | default news |
| branch_id | uuid → branches | optional |
| status | enum(draft, scheduled, published, archived) | default draft |
| publish_at | timestamptz | optional |
| published_at | timestamptz | optional |
| author_id | uuid → profiles | required |

Index: (org_id, status, published_at).

#### `site_media` · org
Images for galleries and blocks. Stored in the one public bucket.

| Column | Type | Rules |
|---|---|---|
| file_id | uuid → files | required |
| alt | text | required; a description for people who cannot see the image |
| alt_ur | text | optional |
| album | text | optional; "Sports day 2026" |
| caption | text | optional |
| sort_order | int | default 0 |
| has_consent | bool | default false; confirmed that the people shown may appear publicly |

#### `site_menus` · org

| Column | Type | Rules |
|---|---|---|
| location | enum(header, footer) | required; unique per organisation |
| items | jsonb | required; `{ label, labelUr?, kind: page \| post_list \| feature \| link, target, children?: [] }[]`; two levels at most |

#### `site_contact_messages` · org
What visitors send through the contact form.

| Column | Type | Rules |
|---|---|---|
| name | text | required |
| phone | text | optional; one of phone and email is required |
| email | text | optional |
| subject | text | optional |
| message | text | required; at most 2,000 characters |
| branch_id | uuid → branches | optional |
| page_slug | text | optional |
| status | enum(new, handled, spam) | default new |
| handled_by | uuid → profiles | optional |
| handled_note | text | optional |

## 4 · Contracts

`packages/contracts/src/modules/website/`: `site-settings`, `site-pages`, `site-blocks`, `site-posts`, `site-media`, `site-menus`, `site-contact`.

**Blocks** (`site-blocks.ts`, a discriminated union on `type`): `hero` (heading, text, image, up to two buttons), `text` (rich text), `image_text`, `stats` (up to four figures with labels), `features` (icon, title, text cards), `gallery` (an album), `team` (people with photo, name, role — entered by hand, or chosen staff who have agreed), `testimonials`, `faq`, `fee_table` (entered by hand, or the active fee structure's tuition by grade when the school chooses to show it), `news` (latest posts), `events` (upcoming public events), `admissions_cta`, `branches` (address, phone, map link per branch), `contact_form`, `map`, `video` (YouTube or Vimeo by link), `downloads` (files), `divider`.

- `PublicSite`: settings, menus and the list of published page slugs — fetched once per visit and cached.
- `PublicPage`: the published blocks with every reference already resolved (image links, latest posts, events), so the page renders with no further requests.
- `PagePreview`: the draft blocks resolved the same way, for the editor, behind a short-lived signed link.
- Starter content: `packages/core/src/modules/website/starter.ts` creates Home, About, Admissions, Academics, Facilities, Contact and both menus for a new school, filled from what Takhti already knows (name, logo, branches, grades).

Rendering lives in `apps/web/app/s/[school]/`; each block is a server component in `apps/web/src/site/blocks/`.

## 5 · Rules

- **R-website-1** Nothing is public until `is_published` is true. Until then `/s/[school]` shows a plain "coming soon" page with the school's name, and the public features (admissions and the rest) still work if they are switched on.
- **R-website-2** A page has a draft and a published version. Editing never changes what the public sees; publishing copies the draft to `published_blocks`. "Discard changes" returns the draft to the published version.
- **R-website-3** Every block is validated against its schema on save. Rich text is sanitised to a fixed list of tags; scripts, inline styles, iframes and event handlers are removed. Embedded video is by link to an allowed provider only.
- **R-website-4** The home page cannot be deleted or unpublished while the site is published. A page linked from a menu cannot be deleted until the link is removed.
- **R-website-5** A slug is unique, cannot clash with the reserved paths (`admissions`, `jobs`, `events`, `news`, `transport`, `verify`, `pay`, `contact`, `calendar`), and changing a published page's slug keeps the old one working as a redirect.
- **R-website-6** Images are resized on upload to a set of widths and served from the public bucket. An image must have alt text. An image showing students may be used only when `has_consent` is ticked; the editor asks each time.
- **R-website-7** **The website can show only what is deliberately public.** Blocks that read live data (`fee_table` from the structure, `events`, `news`, `team` from staff, `branches`) read through services that return a public shape with no personal details. No block can show a student's name or photo from the student records.
- **R-website-8** A custom domain is verified by a DNS record containing `domain_token` before it is served. An unverified domain is never routed to the school. The certificate is issued by the hosting platform; local development uses `/s/[school]` only.
- **R-website-9** Publishing a page, a post, the menus or the settings revalidates the cached public pages for that school only.
- **R-website-10** The contact form is rate-limited per address and per phone number, has a hidden field that real visitors leave empty, and accepts no links in the name field. A message reaches the office's inbox ([M38](m38-chat-ptm.md)) as a new enquiry and, when the visitor chose "admission", becomes an admission enquiry in [M06](m06-admissions.md).
- **R-website-11** Each page sets its title, description and share image, has one main heading, and is listed in the school's sitemap. An unpublished site tells search engines not to index it.
- **R-website-12** Urdu pages are served under `/ur/…` with right-to-left layout and the Nastaliq font; a language switch appears only when both languages are enabled.
- **R-website-13** A scheduled post is published by a job at its time. An archived post leaves lists but its link still works.
- **R-website-14** The theme's colours must pass the contrast check against white and against the header style chosen; a failing colour is refused with the nearest passing shade suggested.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `website:read` | See the editor, drafts and contact messages | LEADERS, FRONT, it_admin |
| `website:edit` | Edit pages, posts, media and menus as drafts | principal, branch_admin, it_admin, admissions_officer |
| `website:publish` | Publish pages, posts and menus; discard changes | principal, it_admin |
| `website-settings:manage` | Change site settings, theme, features and domain; publish or unpublish the site | principal, director, it_admin |
| `website-messages:handle` | Handle contact messages | FRONT, branch_admin |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/site-settings` | `website:read` | The settings |
| PUT | `/site-settings` | `website-settings:manage` | Saves |
| POST | `/site-settings/publish` | `website-settings:manage` | Publishes or unpublishes the site |
| POST | `/site-settings/domain` | `website-settings:manage` | Sets a custom domain and returns the DNS record to add |
| POST | `/site-settings/domain/verify` | `website-settings:manage` | Checks the DNS record |
| POST | `/site/starter` | `website-settings:manage` | Creates the starter pages and menus |
| GET | `/site-pages` | `website:read` | Lists with draft and published state |
| POST | `/site-pages` | `website:edit` | Creates |
| GET | `/site-pages/[id]` | `website:read` | One page with its draft blocks |
| PATCH | `/site-pages/[id]` | `website:edit` | Saves the draft |
| POST | `/site-pages/[id]/publish` | `website:publish` | Publishes |
| POST | `/site-pages/[id]/discard` | `website:publish` | Discards draft changes |
| POST | `/site-pages/[id]/unpublish` | `website:publish` | Unpublishes |
| DELETE | `/site-pages/[id]` | `website:publish` | Deletes |
| POST | `/site-pages/[id]/preview-link` | `website:edit` | A signed link to view the draft |
| GET | `/site-posts` | `website:read` | Lists |
| POST | `/site-posts` | `website:edit` | Creates |
| PATCH | `/site-posts/[id]` | `website:edit` | Edits |
| POST | `/site-posts/[id]/publish` | `website:publish` | Publishes or schedules |
| POST | `/site-posts/[id]/archive` | `website:publish` | Archives |
| GET | `/site-media` | `website:read` | Lists; filter by album |
| POST | `/site-media` | `website:edit` | Adds images |
| PATCH | `/site-media/[id]` | `website:edit` | Edits alt text, caption, album, consent |
| DELETE | `/site-media/[id]` | `website:edit` | Removes an image not used by a published page |
| GET | `/site-menus` | `website:read` | Both menus |
| PUT | `/site-menus` | `website:publish` | Saves and publishes |
| GET | `/site-contact-messages` | `website-messages:handle` | Lists; new first |
| PATCH | `/site-contact-messages/[id]` | `website-messages:handle` | Marks handled or spam |
| GET | `/public/[school]/site` | `public` | Settings, menus and page list |
| GET | `/public/[school]/pages/[slug]` | `public` | A published page, resolved |
| GET | `/public/[school]/posts` | `public` | Published posts, paged |
| GET | `/public/[school]/posts/[slug]` | `public` | One post |
| POST | `/public/[school]/contact` | `public` | Sends a contact message |
| GET | `/public/resolve-domain` | `public` | Maps a verified custom domain to a school; used by the edge middleware |

Public routes are rate-limited by address and cached; their responses contain no internal ids beyond what a link needs.

## 8 · Client layer

Custom hooks: `useSiteSettings`, `useSitePages`, `usePageEditor(id)` (the draft held in a local store; autosave every few seconds; undo and redo), `usePublishPage`, `useSitePosts`, `useSiteMedia`, `useUploadSiteImages`, `useSiteMenus`, `useContactMessages`. The public site uses server components and no client hooks except the contact form and the language switch.

## 9 · Screens

Built in [Phase 20](../20-phases/phase-20-public-website.md).

| Screen | Pattern | Where |
|---|---|---|
| Website | Dashboard | `/school/website`: published or not, pages with unpublished changes, new contact messages, a "View site" link |
| **Page editor** | Split view | Blocks listed on the left to add, reorder and remove; the selected block's form in the middle; a live preview on the right that can switch between phone and desktop width and between English and Urdu |
| Posts | List + Form page | Rich text editor with a cover image; schedule |
| Media | Grid | Albums; alt text and consent on each image |
| Menus | Tree editor | Drag to order and nest |
| Settings | Settings | Languages, theme with a live sample and contrast result, contact details, social links, features, domain with step-by-step DNS help |
| Contact messages | List | Handle, or convert to an admission enquiry |
| **Public site** | Pages | `/s/[school]/…`: a top bar with the logo and menu, the blocks, a footer with branches and contact; built-in pages for admissions, jobs, events, news, transport, certificate check and fee payment that take the school's theme |

## 10 · Notifications and jobs

Events: `website.contact-received` (to the office), `website.domain-verified`, `website.domain-failed`, `website.published` (to the owner, the first time).

Jobs: `website.publish-posts` (every 5 minutes), `website.verify-domains` (hourly for pending domains, daily for verified ones; a domain that stops pointing here is marked failed and its owner is told), `website.image-variants` (per upload).

## 11 · Offline

None.

## 12 · AI

- Drafting page text from a few facts the school gives ("founded 1998, 1,200 students, science labs"), in English and Urdu, as a draft in the editor (A10).
- Suggesting alt text for an uploaded image, for the editor to confirm.
- Checking a page for reading level and missing headings; advice only.

## 13 · Failure cases

- **F-website-1** An editor pastes text with a script tag → it is removed on save; the preview shows clean text.
- **F-website-2** Someone points another school's domain at Takhti without the token → never served; the request falls through to a "site not found" page.
- **F-website-3** A page is published with a gallery whose album was deleted → the block renders nothing and the editor shows a warning on that block.
- **F-website-4** The contact form is hit by a bot → the hidden field or the rate limit rejects it silently; real messages are unaffected.
- **F-website-5** A staff photo is shown in a `team` block and the person leaves → the block stops showing them from their last working day.
- **F-website-6** Two editors edit the same page → the second save gets `STALE` and is offered the other's version or their own.
- **F-website-7** The school unpublishes the site → `/s/[school]` shows "coming soon" within a minute; admission links keep working.
- **F-website-8** An image with no alt text is added to a block → the block cannot be saved until alt text is given.
- **F-website-9** A custom domain's DNS record is removed later → the daily check marks it failed; the site stays reachable at `/s/[school]`.
- **F-website-10** A visitor opens an Urdu link for a page with no Urdu version → the English blocks are shown inside the right-to-left frame, with a note offering English.

## 14 · Seed data

A published site for the seeded school: starter pages filled in, with a hero, statistics, facilities, a fee table, a gallery of placeholder illustrations (no real children), testimonials and a contact page with both branches. Eight posts (one scheduled). Menus. A theme in the school's colours. Features on: admissions, jobs, events, certificate check. Six contact messages, two new. No custom domain.

## 15 · Tests

- **T-website-1** Draft and published versions are separate; publish, discard and unpublish.
- **T-website-2** Every block type: schema validation and rendering with full and minimal data.
- **T-website-3** Sanitising: scripts, handlers, styles and iframes are removed; allowed tags survive.
- **T-website-4** Reserved slugs refused; a changed slug redirects.
- **T-website-5** Public routes return only published content and never a personal field; a snapshot test over the whole public response guards this.
- **T-website-6** An unpublished site shows "coming soon" and sets no-index.
- **T-website-7** Domain verification: wrong token, right token, later removal.
- **T-website-8** Contact form: rate limit, hidden field, conversion to an admission enquiry.
- **T-website-9** Cache revalidation touches only that school.
- **T-website-10** Urdu routing and fallback.
- **T-website-11** Theme contrast check refuses a failing colour.
- **T-website-12** Each public page passes automated accessibility checks at phone and desktop widths.
- **T-website-13** Row-level security.

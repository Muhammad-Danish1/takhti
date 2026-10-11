# M08 · Certificates and ID cards

## 1 · Purpose

Official papers and cards: leaving, character and bonafide certificates, staff experience letters, and ID cards for students and staff. Each has a number, a frozen copy of what it said, and a QR code anyone can scan to confirm it is genuine.

## 2 · Depends on

[M00](m00-shared-kernel.md) (documents pipeline), [M07](m07-students.md), [M26](m26-staff-recruitment.md), [M21](m21-fees.md) (clearance).

## 3 · Tables

#### `certificate_types` · org

| Column | Type | Rules |
|---|---|---|
| key | text | required; `leaving`, `character`, `bonafide`, `provisional`, `fee_clearance`, `date_of_birth`, `experience`, `merit`, or a custom slug |
| name | text | required |
| name_ur | text | optional |
| issued_to | enum(student, staff) | required |
| requires_approval | bool | default false |
| requires_clearance | bool | default false; leaving certificates |
| one_active_per_person | bool | default false; leaving certificates |
| number_format | text | required; default `{KEY}-{yyyy}-{0000}` |
| is_system | bool | default false |
| is_active | bool | default true |

Unique: (org_id, key) among live rows.

#### `certificate_templates` · org

| Column | Type | Rules |
|---|---|---|
| type_id | uuid → certificate_types | required |
| name | text | required |
| language | enum(en, ur, both) | required |
| page | enum(a4_portrait, a4_landscape, a5_landscape) | default a4_portrait |
| body | text | required; rich text with `{{variables}}` |
| show_letterhead | bool | default true |
| show_photo | bool | default false |
| signatures | jsonb | default `[]`; ordered `{ title, name?, signatureFileId? }` |
| is_default | bool | default false |
| status | enum(draft, active, archived) | default draft |

One default per (type_id, language) among active templates.

#### `certificates` · branch +family
A certificate requested or issued.

| Column | Type | Rules |
|---|---|---|
| type_id | uuid → certificate_types | required |
| template_id | uuid → certificate_templates | required |
| student_id | uuid → students | required when issued to a student |
| staff_id | uuid → staff | required when issued to staff |
| number | text | optional until issued; then required |
| purpose | text | optional; "For passport application" |
| status | enum(requested, draft, pending_approval, issued, revoked, rejected) | required |
| requested_via | enum(staff, portal) | default staff |
| data | jsonb | default `{}`; the merged values, frozen at issue |
| issued_on | date | optional |
| issued_by | uuid → profiles | optional |
| document_id | uuid → generated_documents | optional |
| is_duplicate_copy | bool | default false |
| original_id | uuid → certificates | optional; for a duplicate copy |
| collected_by | text | optional |
| collected_on | date | optional |
| revoked_reason | text | optional |

Policy: a guardian or student may read the certificates of their own students and add a request for one (status `requested`); staff of the branch do everything else, by permission.
Unique: (org_id, number) among live rows where set.

#### `id_card_templates` · org

| Column | Type | Rules |
|---|---|---|
| issued_to | enum(student, staff) | required |
| name | text | required |
| orientation | enum(portrait, landscape) | default portrait |
| fields | jsonb | required; which fields appear front and back |
| show_qr | bool | default true |
| accent | enum(primary, brand, ink) | default primary |
| back_text | text | optional; "If found, please return to…" |
| is_default | bool | default false |

#### `id_cards` · branch +family

| Column | Type | Rules |
|---|---|---|
| issued_to | enum(student, staff) | required |
| student_id | uuid → students | required when student |
| staff_id | uuid → staff | required when staff |
| template_id | uuid → id_card_templates | required |
| academic_year_id | uuid → academic_years | optional; student cards |
| card_no | text | required |
| qr_token_hash | text | required; unique |
| issued_on | date | required |
| valid_until | date | required |
| status | enum(active, lost, replaced, expired, cancelled) | default active |
| replaced_by_id | uuid → id_cards | optional |
| batch_id | uuid → id_card_batches | optional |

One `active` card per person (partial unique index).

#### `id_card_batches` · branch

| Column | Type | Rules |
|---|---|---|
| template_id | uuid → id_card_templates | required |
| issued_to | enum(student, staff) | required |
| filters | jsonb | required; grade, section or department |
| card_count | int | default 0 |
| status | enum(queued, generating, ready, failed) | default queued |
| document_id | uuid → generated_documents | optional; the print sheet |

## 4 · Contracts

`packages/contracts/src/modules/certificates/`: `certificate-types`, `certificate-templates`, `certificates`, `id-card-templates`, `id-cards`, `id-card-batches`, `public-verify`.

- `certificateVariables(type)`: the exact list of variables a template of that type may use (`studentName`, `fatherName`, `admissionNo`, `class`, `dateOfBirth`, `dateOfBirthInWords`, `admittedOn`, `leftOn`, `conduct`, `lastExamResult`, `issueDate`, …). Saving a template validates its variables against this list.
- `RequestCertificate` (portal): `{ studentId, typeKey, purpose }`.
- `VerifyResult` (public): `{ valid, kind, number, issuedOn, personName, schoolName, status }` — nothing else.

## 5 · Rules

- **R-certs-1** States: `requested → draft → pending_approval → issued`; `draft → issued` when the type needs no approval; `issued → revoked`; `requested → rejected`.
- **R-certs-2** At issue the certificate takes its number, freezes `data`, renders the PDF and stores a verification token. After that its content never changes.
- **R-certs-3** A type with `requires_clearance` can be issued only when the student's withdrawal is completed or their fee, library and inventory clearances are clear. `certificates:override-clearance` allows otherwise with a reason.
- **R-certs-4** A type with `one_active_per_person` allows one issued, non-revoked certificate per person. A further copy is a **duplicate copy**: same number, marked "Duplicate", linked to the original.
- **R-certs-5** Revoking needs a reason. The public verification page then shows it as revoked.
- **R-certs-6** A template in use by an issued certificate cannot be edited; it is archived and a new one made.
- **R-certs-7** A guardian may request only types the school has opened to the portal, only for their own child.
- **R-certs-8** The date of birth is printed in figures and in words, in the certificate's language.
- **R-certs-9** Issuing an ID card for someone who has an active one marks the old card `replaced`; its QR stops working at once.
- **R-certs-10** A student card is valid to the end of its academic year; a staff card for one year or until employment ends.
- **R-certs-11** Marking a card `lost` disables its QR immediately and offers a replacement.
- **R-certs-12** The QR on a card or certificate holds an opaque token, never a name or number. Only its hash is stored.
- **R-certs-13** A scanned card resolves to a person only for a signed-in staff member with access to that person (attendance, library, gate). The public verification page confirms validity and shows the photo and name only.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `certificates:read` | See certificates | ADMINS, FRONT, section_head, hr_manager |
| `certificates:create` | Draft a certificate | ADMINS, FRONT, hr_manager |
| `certificates:issue` | Issue, or approve for issue | principal, vice_principal |
| `certificates:revoke` | Revoke an issued certificate | principal |
| `certificates:override-clearance` | Issue despite pending clearance | principal |
| `certificate-templates:update` | Manage types and templates | ADMINS |
| `id-cards:read` | See cards | ADMINS, FRONT, hr_manager, librarian, security_guard |
| `id-cards:update` | Issue, replace, mark lost; print batches | ADMINS, FRONT, hr_manager |
| `id-card-templates:update` | Manage card templates | ADMINS |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/certificate-types` | `certificates:read` | Lists types |
| POST | `/certificate-types` | `certificate-templates:update` | Creates a custom type |
| PATCH | `/certificate-types/[id]` | `certificate-templates:update` | Edits |
| GET | `/certificate-types/[id]/variables` | `certificates:read` | Variables a template may use |
| GET | `/certificate-templates` | `certificates:read` | Lists templates |
| POST | `/certificate-templates` | `certificate-templates:update` | Creates |
| PATCH | `/certificate-templates/[id]` | `certificate-templates:update` | Edits a draft |
| POST | `/certificate-templates/[id]/activate` | `certificate-templates:update` | Activates |
| POST | `/certificate-templates/[id]/preview` | `certificate-templates:update` | Renders with a sample person |
| GET | `/certificates` | `certificates:read` | Lists with filters |
| POST | `/certificates` | `certificates:create` | Drafts for a student or staff member |
| GET | `/certificates/[id]` | `certificates:read` | One certificate |
| PATCH | `/certificates/[id]` | `certificates:create` | Edits a draft's purpose or editable values |
| POST | `/certificates/[id]/submit` | `certificates:create` | Sends for approval |
| POST | `/certificates/[id]/issue` | `certificates:issue` | Issues |
| POST | `/certificates/[id]/reject` | `certificates:issue` | Rejects a request |
| POST | `/certificates/[id]/revoke` | `certificates:revoke` | Revokes |
| POST | `/certificates/[id]/duplicate` | `certificates:issue` | Issues a duplicate copy |
| POST | `/certificates/[id]/collected` | `certificates:create` | Records who collected it |
| GET | `/certificates/[id]/file` | `certificates:read` | The PDF |
| GET | `/id-card-templates` | `id-cards:read` | Lists templates |
| POST | `/id-card-templates` | `id-card-templates:update` | Creates |
| PATCH | `/id-card-templates/[id]` | `id-card-templates:update` | Edits |
| GET | `/id-cards` | `id-cards:read` | Lists cards |
| POST | `/id-cards` | `id-cards:update` | Issues one card |
| POST | `/id-cards/[id]/lost` | `id-cards:update` | Marks lost |
| POST | `/id-cards/[id]/replace` | `id-cards:update` | Issues a replacement |
| POST | `/id-cards/resolve` | `id-cards:read` | Given a scanned token, returns the person the user may see |
| GET | `/id-card-batches` | `id-cards:read` | Lists print batches |
| POST | `/id-card-batches` | `id-cards:update` | Issues and prints cards for a class or department |
| GET | `/id-card-batches/[id]` | `id-cards:read` | Status and print sheet |
| GET | `/family/certificates` | `signed-in` | A guardian's children's certificates |
| POST | `/family/certificates` | `signed-in` | Requests a certificate |
| GET | `/public/verify/[token]` | `public` | Confirms a certificate or card is genuine |

Idempotent: `POST /certificates/[id]/issue`, `POST /id-card-batches`.

## 8 · Client layer

Generated CRUD for types, templates and cards. Custom hooks: `useCertificateVariables`, `usePreviewTemplate`, `useIssueCertificate`, `useRevokeCertificate`, `useIssueDuplicate`, `useIdCardBatch` (polls), `useResolveCard`, `useRequestCertificate`, `useVerifyDocument`.

## 9 · Screens

Under `/school/certificates` and `/school/id-cards`. Built in [Phase 11](../20-phases/phase-11-front-office-and-operations.md); PDFs in [Phase 16](../20-phases/phase-16-documents-and-printing.md).

| Screen | Pattern | Notes |
|---|---|---|
| Certificates | List | Tabs: Requested, Drafts, Awaiting approval, Issued, Revoked |
| New certificate | Wizard | Person, type, template, editable values (conduct, purpose), preview |
| Certificate | Detail | Preview of the PDF, status, collection, activity |
| Templates | List + Form page | Rich-text editor with a variable picker and live preview |
| ID cards | List | Status, validity; lost and replace |
| Print cards | Wizard | Pick class or department, template, preview sheet, generate |
| Card templates | Form page | Field ticks with a live front and back preview |
| **Parent:** Certificates | List | `/family/certificates`: request and download |
| **Public:** Verify | Detail | `/verify/[token]`: genuine or revoked, with the school's name |

## 10 · Notifications and jobs

Events: `certificate.requested`, `certificate.pending-approval`, `certificate.issued` (the guardian is told it is ready), `certificate.rejected`, `certificate.revoked`, `id-card.lost`.

Jobs: `certificates.render` (single), `certificates.render-card-batch`, `certificates.expire-cards` (daily).

## 11 · Offline

`POST /id-cards/resolve` has an offline twin: the teacher and gate devices hold the token hashes for the people in their streams, so a card can be scanned for attendance without a connection.

## 12 · AI

Drafting a certificate body in Urdu from the English one, or the reverse (A10).

## 13 · Failure cases

- **F-certs-1** Issue fails while rendering the PDF → the transaction rolls back; no number is consumed; the certificate stays in its previous state.
- **F-certs-2** Two staff issue the same leaving certificate at once → the one-active rule and a row lock let one succeed.
- **F-certs-3** A template uses `{{classs}}` → refused on save, naming the unknown variable.
- **F-certs-4** A student's name is corrected after a certificate was issued → the certificate keeps its frozen data; staff may revoke and reissue.
- **F-certs-5** A card batch of 600 is interrupted → the job resumes; cards already issued are not issued twice.
- **F-certs-6** A revoked certificate's QR is scanned → the public page says "Revoked on 3 Nov 2026" and nothing else.
- **F-certs-7** Someone guesses verification tokens → tokens are 128-bit random; the route is rate-limited and answers "not found" identically for unknown and malformed tokens.

## 14 · Seed data

All system certificate types with one English and one Urdu template each; 30 issued certificates (including one revoked and one duplicate copy), numbered per type and year under the counter `certificate:<type key>`, 4 requested through the portal, 3 awaiting approval; student and staff card templates; active cards for all students and staff of two sections and one department; one ready print batch.

## 15 · Tests

- **T-certs-1** Every status transition; approval path and direct path.
- **T-certs-2** Issue freezes data: later edits to the student do not change the certificate.
- **T-certs-3** Clearance rule and its override.
- **T-certs-4** One-active rule; duplicate copy keeps the number.
- **T-certs-5** Template variable validation.
- **T-certs-6** Card replacement and lost: the old token stops resolving at once.
- **T-certs-7** Public verification returns only the allowed fields; revoked shown as revoked; unknown token indistinguishable from malformed.
- **T-certs-8** `resolve` respects the scanner's access to the person.
- **T-certs-9** A guardian can request only for their own child and only open types.
- **T-certs-10** Row-level security on every table.

# M06 · Admissions

## 1 · Purpose

Everything before a child becomes a student: the enquiry, follow-ups, the application form (filled at the desk or online by the parent), the test and interview, the offer, and the single step that turns an accepted application into a student with a family, a class and a first fee voucher.

## 2 · Depends on

[M02](m02-organisation-branches.md), [M04](m04-school-setup.md), [M07](m07-students.md), [M11](m11-academic-structure.md), [M21](m21-fees.md) (first voucher), [M26](m26-staff-recruitment.md) (`staff`).

## 3 · Tables

#### `lead_sources` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required |
| kind | enum(walk_in, referral, website, facebook, instagram, whatsapp, banner, newspaper, event, other) | required |
| is_active | bool | default true |

Unique: (org_id, name) among live rows.

#### `admission_enquiries` · branch

| Column | Type | Rules |
|---|---|---|
| enquiry_no | text | required; from the `enquiry` sequence |
| academic_year_id | uuid → academic_years | required |
| grade_id | uuid → grades | required; the class asked for |
| child_name | text | required |
| gender | enum(male, female) | optional |
| date_of_birth | date | optional |
| guardian_name | text | required |
| relation | enum(father, mother, guardian, other) | default father |
| phone | text | required |
| whatsapp_phone | text | optional |
| email | text | optional |
| area | text | optional |
| source_id | uuid → lead_sources | optional |
| campaign | text | optional; `utm_campaign` or the advert's name |
| created_via | enum(staff, public_form, website, whatsapp) | default staff |
| status | enum(new, contacted, visit_scheduled, visited, applied, converted, lost) | default new |
| lost_reason | enum(fee, distance, chose_other_school, no_seat, no_response, age, other) | optional; required when lost |
| assigned_to | uuid → staff | optional |
| next_follow_up_on | date | optional |
| score | int | default 0; 0 to 100 |
| existing_family_id | uuid → families | optional; a sibling is already here |
| notes | text | optional |

Unique: (org_id, enquiry_no) among live rows.
Index: (org_id, branch_id, status, next_follow_up_on); (org_id, phone).

#### `enquiry_followups` · branch append-only

| Column | Type | Rules |
|---|---|---|
| enquiry_id | uuid → admission_enquiries | required |
| kind | enum(call, whatsapp, sms, email, visit, note) | required |
| outcome | enum(reached, no_answer, interested, not_interested, visit_booked, call_back) | optional |
| note | text | optional |
| next_follow_up_on | date | optional |

#### `admission_seats` · branch
How many new students each grade will take this year.

| Column | Type | Rules |
|---|---|---|
| academic_year_id | uuid → academic_years | required |
| grade_id | uuid → grades | required |
| seats | int | required; ≥ 0 |

Unique: (branch_id, academic_year_id, grade_id).

#### `admission_applications` · branch

| Column | Type | Rules |
|---|---|---|
| application_no | text | required; from the `application` sequence |
| enquiry_id | uuid → admission_enquiries | optional |
| academic_year_id | uuid → academic_years | required |
| grade_id | uuid → grades | required |
| status | enum(draft, submitted, under_review, test_scheduled, tested, offered, accepted, waitlisted, rejected, withdrawn, enrolled) | default draft |
| full_name | text | required |
| full_name_ur | text | optional |
| father_name | text | required |
| gender | enum(male, female) | required |
| date_of_birth | date | required |
| b_form_no | text | optional; sensitive |
| religion | enum(islam, christianity, hinduism, sikhism, other) | default islam |
| previous_school | text | optional |
| previous_class | text | optional |
| previous_result_percent | numeric(5,2) | optional |
| guardians | jsonb | required; list of `{ relation, fullName, cnic?, phone, occupation?, isPrimary }`, at least one, exactly one primary |
| address | text | required |
| city | text | optional |
| family_id | uuid → families | optional; an existing family |
| photo_file_id | uuid → files | optional |
| custom | jsonb | default `{}` |
| form_fee_paid | bool | default false |
| submitted_at | timestamptz | optional |
| submitted_via | enum(staff, public_form) | default staff |
| tracking_token_hash | text | optional; unique; lets a parent check status without signing in |
| proposed_section_id | uuid → sections | optional |
| decided_by | uuid → profiles | optional |
| decided_at | timestamptz | optional |
| decision_note | text | optional |
| offer_expires_on | date | optional |
| student_id | uuid → students | optional; set when enrolled |

Unique: (org_id, application_no) among live rows.
Index: (org_id, branch_id, academic_year_id, status); (org_id, b_form_no).

#### `application_documents` · branch

| Column | Type | Rules |
|---|---|---|
| application_id | uuid → admission_applications | required |
| kind | enum(b_form, birth_certificate, previous_result, leaving_certificate, guardian_cnic, vaccination_card, photo, other) | required |
| file_id | uuid → files | required |
| is_verified | bool | default false |

#### `admission_tests` · branch
Entry tests and interviews.

| Column | Type | Rules |
|---|---|---|
| application_id | uuid → admission_applications | required |
| kind | enum(test, interview) | required |
| scheduled_at | timestamptz | required |
| room_id | uuid → rooms | optional |
| conducted_by | uuid → staff | optional |
| status | enum(scheduled, completed, no_show, cancelled) | default scheduled |
| score | numeric(6,2) | optional |
| max_score | numeric(6,2) | optional; ≥ `score` |
| result | enum(pending, pass, fail) | default pending |
| remarks | text | optional |

## 4 · Contracts

`packages/contracts/src/modules/admissions/`: `lead-sources`, `admission-enquiries`, `enquiry-followups`, `admission-seats`, `admission-applications`, `admission-tests`, `public-admission`.

- `PublicEnquiry` and `PublicApplication` are the forms on the school's public page. They accept only the fields a parent supplies and never a status, a branch the school has not opened, or an id.
- `Decide`: `{ decision: offer | waitlist | reject, note?, proposedSectionId?, offerExpiresOn? }`.
- `Enrol`: `{ sectionId, admittedOn, familyId?, guardianMatches?: {...}, generateFirstVoucher: boolean, inviteGuardians: boolean, confirmNotDuplicate?: boolean }`.
- `PipelineStats`: counts per status, conversion rate per source.

Settings registered here: `admissions.public_form_enabled`, `admissions.required_documents` (per grade range), `admissions.test_required_from_grade`, `admissions.form_fee`, `admissions.offer_valid_days`, `admissions.follow_up_days`.

## 5 · Rules

- **R-admissions-1** Enquiry states: `new → contacted → visit_scheduled → visited → applied → converted`; any state may go to `lost` with a reason; `lost → contacted` reopens.
- **R-admissions-2** A new enquiry is assigned to an admissions officer of the branch in rotation unless one is chosen, and gets a follow-up date `admissions.follow_up_days` ahead.
- **R-admissions-3** An enquiry whose phone matches a guardian in the organisation is flagged as a sibling and linked to that family.
- **R-admissions-4** A public form submission from the same phone for the same child name within 24 hours updates the existing enquiry instead of creating another.
- **R-admissions-5** Application states: `draft → submitted → under_review → test_scheduled → tested → offered → accepted → enrolled`; from `under_review` or `tested` also `waitlisted` or `rejected`; `waitlisted → offered`; any state before `enrolled` may become `withdrawn`.
- **R-admissions-6** An application can be submitted only when its required fields and the documents in `admissions.required_documents` for its grade are present. Staff with `admission-applications:override` may submit without a document, recording which.
- **R-admissions-7** Where `admissions.test_required_from_grade` applies, an offer needs a completed test with result `pass`, unless overridden with a note.
- **R-admissions-8** Offers for a grade cannot exceed `admission_seats.seats` minus students already enrolled as new this year. Beyond that the decision can only be `waitlist`, unless overridden.
- **R-admissions-9** An offer expires on `offer_expires_on`. An expired offer returns the application to `under_review` and frees the seat.
- **R-admissions-10** **Enrol** is one transaction, through the same service that creates a student in [M07](m07-students.md): duplicate check, family and guardian matching, the student, the enrollment, documents copied from the application, optionally the first fee voucher (admission fee, security deposit and the current period), optionally guardian invitations. The application becomes `enrolled` and the enquiry `converted`.
- **R-admissions-11** An application can be enrolled once. A repeat returns the existing student.
- **R-admissions-12** A parent can check an application's status with its number and the tracking code sent to their phone. The page shows the status and next step only.
- **R-admissions-13** Lead score is recomputed on each change from: source kind, speed of first contact, visit made, sibling present, and days since last contact.
- **R-admissions-14** An enquiry or application cannot be deleted once it has follow-ups, tests or a decision; it is marked `lost` or `withdrawn` instead.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `admission-enquiries:read` | See enquiries | ADMINS, FRONT, section_head |
| `admission-enquiries:create` | Add an enquiry and follow-ups | ADMINS, FRONT |
| `admission-enquiries:update` | Edit, assign, mark lost | ADMINS, admissions_officer |
| `admission-enquiries:export` | Export enquiries | ADMINS, admissions_officer |
| `admission-applications:read` | See applications | ADMINS, admissions_officer, section_head |
| `admission-applications:create` | Start and submit an application | ADMINS, admissions_officer |
| `admission-applications:update` | Edit an application; schedule and record tests | ADMINS, admissions_officer |
| `admission-applications:decide` | Offer, waitlist or reject | principal, vice_principal, section_head |
| `admission-applications:enrol` | Turn an accepted application into a student | ADMINS, admissions_officer |
| `admission-applications:override` | Skip a required document, test or seat limit | principal |
| `admission-settings:update` | Seats, sources, form settings | ADMINS |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/lead-sources` | `admission-enquiries:read` | Lists sources |
| POST | `/lead-sources` | `admission-settings:update` | Creates |
| PATCH | `/lead-sources/[id]` | `admission-settings:update` | Edits |
| DELETE | `/lead-sources/[id]` | `admission-settings:update` | Deactivates |
| GET | `/admission-enquiries` | `admission-enquiries:read` | Lists with filters: status, grade, source, assignee, follow-up due |
| POST | `/admission-enquiries` | `admission-enquiries:create` | Creates |
| GET | `/admission-enquiries/export` | `admission-enquiries:export` | Exports |
| GET | `/admission-enquiries/stats` | `admission-enquiries:read` | Pipeline counts and conversion by source |
| GET | `/admission-enquiries/[id]` | `admission-enquiries:read` | One enquiry with follow-ups |
| PATCH | `/admission-enquiries/[id]` | `admission-enquiries:update` | Edits or assigns |
| POST | `/admission-enquiries/[id]/followups` | `admission-enquiries:create` | Records a follow-up and the next date |
| POST | `/admission-enquiries/[id]/status` | `admission-enquiries:update` | Moves the status |
| POST | `/admission-enquiries/[id]/start-application` | `admission-applications:create` | Creates a draft application filled from the enquiry |
| GET | `/admission-seats` | `admission-applications:read` | Seats and how many are taken |
| PUT | `/admission-seats` | `admission-settings:update` | Sets seats for a year |
| GET | `/admission-applications` | `admission-applications:read` | Lists with filters |
| POST | `/admission-applications` | `admission-applications:create` | Creates a draft |
| GET | `/admission-applications/[id]` | `admission-applications:read` | One application with documents and tests |
| PATCH | `/admission-applications/[id]` | `admission-applications:update` | Edits |
| POST | `/admission-applications/[id]/submit` | `admission-applications:create` | Submits after checks |
| POST | `/admission-applications/[id]/documents` | `admission-applications:update` | Adds a document |
| DELETE | `/application-documents/[id]` | `admission-applications:update` | Removes a document |
| POST | `/admission-applications/[id]/tests` | `admission-applications:update` | Schedules a test or interview |
| PATCH | `/admission-tests/[id]` | `admission-applications:update` | Records the result, or reschedules |
| POST | `/admission-applications/[id]/decide` | `admission-applications:decide` | Offer, waitlist or reject |
| POST | `/admission-applications/[id]/accept` | `admission-applications:update` | Records that the family accepted the offer |
| POST | `/admission-applications/[id]/withdraw` | `admission-applications:update` | Withdraws |
| POST | `/admission-applications/[id]/enrol` | `admission-applications:enrol` | Creates the student |
| GET | `/public/schools/[slug]/admission-form` | `public` | Open grades, required fields and documents |
| POST | `/public/schools/[slug]/enquiries` | `public` | The public enquiry form |
| POST | `/public/schools/[slug]/applications` | `public` | The public application form |
| POST | `/public/schools/[slug]/applications/status` | `public` | Status by application number and tracking code |

Idempotent: `POST /admission-applications/[id]/enrol`, `POST /public/schools/[slug]/enquiries`, `POST /public/schools/[slug]/applications`.

## 8 · Client layer

Generated CRUD for enquiries and applications. Custom hooks: `usePipelineStats`, `useAddFollowup`, `useMoveEnquiry`, `useStartApplication`, `useSubmitApplication`, `useScheduleTest`, `useDecide`, `useEnrol`, `usePublicAdmissionForm`, `useSubmitPublicEnquiry`, `useSubmitPublicApplication`, `useApplicationStatus`.

## 9 · Screens

Under `/school/admissions`. Built in [Phase 7](../20-phases/phase-07-school-setup-and-people.md); public pages in [Phase 20](../20-phases/phase-20-public-website.md).

| Screen | Pattern | Notes |
|---|---|---|
| Admissions home | Dashboard | Follow-ups due today, new enquiries, seats left per grade, conversion by source |
| Enquiries | Board and List (toggle) | Columns by status; drag to move; overdue follow-ups in red |
| Enquiry | Detail in a side sheet | Follow-up timeline; quick actions: call logged, WhatsApp, book visit, start application |
| New enquiry | Dialog form | Sibling warning when the phone matches |
| Applications | List | Tabs by status with counts |
| Application | Detail | Tabs: Form, Documents (checklist with verified ticks), Tests, Decision, Activity |
| New application | Wizard | Child, guardians, previous school, documents, review |
| Decide | Dialog form | Seats left shown; offer date |
| Enrol | Wizard | Class, family matching, first voucher preview, invitations, confirm |
| Seats and sources | Settings | |
| **Public:** Admission enquiry | Form page | `/s/[school]/admissions/enquire` |
| **Public:** Online application | Wizard | `/s/[school]/admissions/apply`; saves progress on the device |
| **Public:** Check status | Form page | Application number and code |

## 10 · Notifications and jobs

Events: `enquiry.created` (to the assigned officer; an acknowledgement to the parent), `enquiry.follow-up-due`, `application.submitted` (acknowledgement with the number and tracking code), `application.test-scheduled`, `application.offered`, `application.waitlisted`, `application.rejected`, `application.offer-expiring`, `application.enrolled` (welcome message with sign-in instructions).

Jobs: `admissions.follow-up-reminders` (daily 09:00), `admissions.expire-offers` (daily), `admissions.rescore` (nightly).

## 11 · Offline

None. Enquiries taken at the desk during an outage go into the front-office visitor log ([M09](m09-front-office.md)) and are converted afterwards.

## 12 · AI

- Reading a photographed form or B-Form into the application (A7).
- Lead scoring (S7).
- Drafting a follow-up message in English or Urdu (A10).

## 13 · Failure cases

- **F-admissions-1** The public form is submitted twice by a double tap → one enquiry (idempotency key plus R-admissions-4).
- **F-admissions-2** A bot floods the public form → rate limit by IP and a proof-of-humanity check; excess requests get `429`.
- **F-admissions-3** Two principals offer the last seat at once → the seat check runs under a lock per grade; the second gets "No seats left in Grade 6. You can waitlist."
- **F-admissions-4** Enrol fails while creating the first voucher → the whole enrolment rolls back; the application stays `accepted`.
- **F-admissions-5** The child already exists as a student (returning after leaving) → the duplicate check offers re-admission of the existing record instead of a new one.
- **F-admissions-6** A parent uploads a 30 MB photo → refused before upload with the size limit; other fields are kept.
- **F-admissions-7** The parent loses the tracking code → staff can resend it to the phone on the application.
- **F-admissions-8** An offer expires on a holiday → it expires on the stated date regardless; the reminder two days before says so.

## 14 · Seed data

Six lead sources; 120 enquiries across all statuses with follow-ups, 20 of them due today; seats for every grade; 45 applications across all statuses, including 6 accepted and ready to enrol, 4 waitlisted and 3 submitted through the public form; tests with results.

## 15 · Tests

- **T-admissions-1** Every enquiry and application transition, allowed and refused.
- **T-admissions-2** Sibling detection by phone; duplicate public submission merges.
- **T-admissions-3** Submission checks: required fields and documents; override.
- **T-admissions-4** Test requirement by grade; override.
- **T-admissions-5** Seat limit under concurrent offers.
- **T-admissions-6** Offer expiry returns the seat.
- **T-admissions-7** Enrol creates student, family, guardians, enrollment, documents, voucher and invitations; is atomic; is idempotent.
- **T-admissions-8** Public routes: only allowed fields accepted; rate limited; status check needs both number and code.
- **T-admissions-9** Pipeline statistics match the rows.
- **T-admissions-10** Row-level security and branch scope on every table.

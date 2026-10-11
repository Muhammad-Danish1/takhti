# M26 · Staff and recruitment

## 1 · Purpose

The record of everyone who works for the school group, from job opening to last working day: who they are, what they do, where, under what contract, and with which documents. Other modules read it constantly: the timetable for teachers, payroll for salaries, identity for logins.

## 2 · Depends on

[M02](m02-organisation-branches.md) (branches, wings), [M04](m04-school-setup.md) (shifts), [M11](m11-academic-structure.md) (subjects), [M03](m03-identity-roles-audit.md) (memberships, invitations), [M00](m00-shared-kernel.md) (files, sequences, approvals).

## 3 · Tables

#### `departments` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation |
| name_ur | text | optional |
| code | text | required; unique per organisation |
| head_staff_id | uuid → staff | optional |
| parent_id | uuid → departments | optional |
| is_active | bool | default true |

#### `designations` · org

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per organisation; "Senior Teacher", "Accountant" |
| name_ur | text | optional |
| category | enum(leadership, teaching, academic_support, administration, finance, support, transport, security, medical) | required |
| is_teaching | bool | default false |
| pay_grade | int | optional |
| is_active | bool | default true |

#### `staff` · org
The directory record. Readable by every staff member of the organisation, so it holds nothing private.

| Column | Type | Rules |
|---|---|---|
| employee_no | text | required; from the `employee` sequence; unique per organisation |
| full_name | text | required |
| full_name_ur | text | optional |
| father_or_husband_name | text | optional |
| gender | enum(male, female, other) | required |
| photo_file_id | uuid → files | optional |
| designation_id | uuid → designations | required |
| department_id | uuid → departments | optional |
| home_branch_id | uuid → branches | required |
| wing_id | uuid → wings | optional |
| reports_to_staff_id | uuid → staff | optional; not themselves, and no loops |
| staff_type | enum(teaching, non_teaching) | required |
| employment_type | enum(permanent, probation, contract, part_time, visiting, daily_wage) | required |
| joined_on | date | required |
| probation_ends_on | date | optional; required for `probation` |
| confirmed_on | date | optional |
| contract_ends_on | date | optional; required for `contract` |
| last_working_day | date | optional |
| status | enum(active, on_leave, suspended, notice, left) | default active |
| work_phone | text | optional; normalised |
| work_email | text | optional |
| shift_id | uuid → shifts | optional |
| work_schedule_id | uuid → work_schedules | optional; falls back to the branch default |
| teachable_subject_ids | uuid[] | default empty; used for timetable and substitute suggestions |
| max_lessons_per_week | int | optional; for teaching staff |
| custom | jsonb | default `{}`; custom fields |

Policy: staff of the organisation read and, by permission, write. Family users never read this table: they read the view `staff_directory`, which gives only a staff member's id, name, gender, photograph and whether they still work here.
Index: (org_id, home_branch_id, status); trigram on `full_name`, `employee_no`.

#### `staff_private` · org +cap(hr)
One row per staff member.

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required; unique |
| cnic | text | required; 13 digits; unique per organisation among staff not `left` |
| cnic_expires_on | date | optional |
| date_of_birth | date | required; at least 18 years before `joined_on` |
| marital_status | enum(single, married, widowed, divorced) | optional |
| religion | text | optional |
| blood_group | text | optional |
| personal_phone | text | required; normalised |
| personal_email | text | optional |
| address | text | optional |
| city | text | optional |
| emergency_name | text | optional |
| emergency_phone | text | optional |
| emergency_relation | text | optional |
| eobi_no | text | optional |
| social_security_no | text | optional |
| previous_income_this_tax_year | paisa | default 0; declared on joining |
| previous_tax_this_tax_year | paisa | default 0 |

#### `staff_bank_accounts` · org +cap(hr)

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| bank_name | text | required |
| account_title | text | required |
| account_no | text | required |
| iban | text | optional; a valid Pakistani IBAN |
| is_primary | bool | default true; one primary per staff member |
| status | enum(active, closed) | default active |

#### `staff_documents` · org +cap(hr)

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| kind | enum(cnic, photo, degree, experience_letter, appointment_letter, contract, police_verification, medical_fitness, reference, other) | required |
| title | text | optional |
| file_id | uuid → files | required |
| issued_on | date | optional |
| expires_on | date | optional |
| verified_by | uuid → profiles | optional |
| verified_at | timestamptz | optional |

#### `staff_qualifications` · org

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| level | enum(matric, intermediate, bachelors, masters, mphil, phd, b_ed, m_ed, diploma, certificate, hifz, dars_e_nizami, other) | required |
| title | text | required; "BS Mathematics" |
| institution | text | optional |
| year | int | optional |
| result | text | optional |
| is_verified | bool | default false |

#### `staff_experience` · org +cap(hr)

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| employer | text | required |
| role | text | required |
| from_date | date | required |
| to_date | date | optional; ≥ `from_date` |
| reason_for_leaving | text | optional |
| reference_name | text | optional |
| reference_phone | text | optional |

#### `employment_contracts` · org +cap(hr)

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| kind | enum(appointment, renewal, amendment) | required |
| starts_on | date | required |
| ends_on | date | optional |
| terms | text | optional |
| document_id | uuid → generated_documents | optional; the letter Takhti produced |
| signed_file_id | uuid → files | optional; the signed copy |
| status | enum(draft, active, expired, terminated) | default draft |

#### `staff_movements` · org append-only
Every change of branch, department, designation, reporting line or status.

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| kind | enum(joined, confirmed, transfer, promotion, redesignation, department_change, status_change, rejoined, left) | required |
| effective_on | date | required |
| from_value | jsonb | optional; `{ branchId?, designationId?, departmentId?, status? }` |
| to_value | jsonb | optional |
| order_no | text | optional; the office order |
| reason | text | optional |
| approval_request_id | uuid → approval_requests | optional |

Index: (org_id, staff_id, effective_on).

#### `staff_change_requests` · org +cap(hr)
A staff member asking for their own details to be corrected.

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| changes | jsonb | required; field → new value, limited to an allowed list |
| file_id | uuid → files | optional; proof |
| status | enum(pending, approved, rejected) | default pending |
| reviewed_by | uuid → profiles | optional |
| reviewed_at | timestamptz | optional |
| review_note | text | optional |

Policy: a staff member may insert and read their own requests; `staff:manage` reads all.

#### `staff_exits` · org
Clearance owners outside HR update this table, so it is protected by its service, not by a capability. The reason and the exit interview are returned only to holders of `staff-private:read`.

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required |
| kind | enum(resignation, termination, contract_end, retirement, death, absconded) | required |
| notice_date | date | required |
| last_working_day | date | required; ≥ `notice_date` |
| reason | text | optional |
| clearance | jsonb | default `[]`; `{ key, label, ownerRole, status, note, doneBy, doneAt }[]` |
| exit_interview | text | optional |
| rehire_eligible | bool | optional |
| status | enum(pending, clearance, settled, closed, withdrawn) | default pending |
| approval_request_id | uuid → approval_requests | optional |

Unique: one exit that is not `closed` or `withdrawn` per staff member.

#### `job_openings` · org

| Column | Type | Rules |
|---|---|---|
| title | text | required |
| designation_id | uuid → designations | required |
| department_id | uuid → departments | optional |
| branch_id | uuid → branches | required |
| positions | int | default 1; ≥ 1 |
| employment_type | text | required |
| description | text | optional; rich text |
| requirements | text | optional |
| salary_min | paisa | optional; never shown publicly |
| salary_max | paisa | optional |
| opens_on | date | required |
| closes_on | date | optional |
| is_public | bool | default false; listed on the school website |
| status | enum(draft, open, on_hold, filled, closed) | default draft |

#### `job_applicants` · org

| Column | Type | Rules |
|---|---|---|
| opening_id | uuid → job_openings | required |
| full_name | text | required |
| phone | text | required; normalised |
| email | text | optional |
| cnic | text | optional |
| gender | enum(male, female, other) | optional |
| highest_qualification | text | optional |
| experience_years | numeric(4,1) | optional |
| expected_salary | paisa | optional |
| cv_file_id | uuid → files | optional |
| source | enum(website, walk_in, referral, job_portal, newspaper, other) | default walk_in |
| stage | enum(applied, shortlisted, interview, demo_lesson, offered, hired, rejected, withdrawn) | default applied |
| rating | int | optional; 1 to 5 |
| note | text | optional |
| rejected_reason | text | optional |
| staff_id | uuid → staff | optional; set when hired |

Index: (org_id, opening_id, stage).

#### `applicant_interviews` · org

| Column | Type | Rules |
|---|---|---|
| applicant_id | uuid → job_applicants | required |
| kind | enum(interview, demo_lesson, written_test) | required |
| scheduled_at | timestamptz | required |
| panel_staff_ids | uuid[] | default empty |
| result | enum(pending, pass, fail, no_show) | default pending |
| score | numeric(5,2) | optional |
| feedback | text | optional |

## 4 · Contracts

`packages/contracts/src/modules/staff/`: `departments`, `designations`, `staff`, `staff-private`, `staff-documents`, `staff-exits`, `staff-movements`, `job-openings`, `job-applicants`.

- `CreateStaff`: directory fields plus private fields in one form; the service writes both tables in one transaction and, when asked, sends an invitation.
- `StaffProfile`: the directory record with what the caller may see added: private details, bank, documents, contract, movements, and links to salary, leave and appraisal tabs.
- `StaffDirectoryRow`: name, photo, designation, department, branch, work phone and email. Nothing else.
- `TeacherLoad`: lessons per week assigned against `max_lessons_per_week`, sections and subjects.
- `MissingItems`: per staff member — documents required for their designation that are absent or expired.
- `HireApplicant`: `{ applicantId, joinedOn, designationId, branchId, employmentType, ... }` → a staff record prefilled from the applicant.

Settings: `staff.required_documents` (by designation category; default CNIC, photo, highest degree, appointment letter), `staff.probation_months` (default 3), `staff.notice_days` (default 30), `staff.retirement_age` (default 60), `staff.clearance_items` (default list: library books, school assets, ID card, keys, loans and advances, handover of classes, exam papers, login closed).

## 5 · Rules

- **R-staff-1** The employee number comes from the sequence and never changes or is reused.
- **R-staff-2** A CNIC can belong to only one staff member who has not left. Creating a second is refused and offers the existing record. A person who left and returns is **rejoined** on their old record: same employee number, a new `joined_on`, a `rejoined` movement.
- **R-staff-3** Directory fields live in `staff`, everything personal in `staff_private`. A user without the `hr` capability can read only the directory and their own private row.
- **R-staff-4** Any change to branch, department, designation, reporting line or status is made through an action that writes a `staff_movements` row with an effective date. Transfers and promotions need approval.
- **R-staff-5** A branch transfer on its effective date changes `home_branch_id`, updates the person's branch access ([M03](m03-identity-roles-audit.md)), and lists what must be reassigned at the old branch: timetable entries, class teacher duty, open marking, approvals waiting for them.
- **R-staff-6** Status changes allowed: `active ↔ on_leave`, `active ↔ suspended`, `active → notice → left`, `active → left` (termination, absconded, death), `left → active` (rejoin only).
- **R-staff-7** An exit starts with approval, then clearance: each item is ticked by its owner (librarian, store keeper, accountant, IT). The final settlement in [M28](m28-payroll.md) can be approved only when every item is done or waived with a note.
- **R-staff-8** At the end of the last working day: status becomes `left`, the login is suspended ([R-identity-14](m03-identity-roles-audit.md)), a `staff_child` fee discount ends ([R-fees-7](m21-fees.md)), and future timetable entries are flagged for reassignment.
- **R-staff-9** Thirty and seven days before a probation or contract ends, HR and the manager are reminded. Nothing happens automatically on the date; a contract that passes its end date is shown as expired until renewed or ended.
- **R-staff-10** Documents required for the designation and missing, and documents within 30 days of expiry, are listed on the HR dashboard.
- **R-staff-11** A staff member can ask for corrections to an allowed list of their own fields (phone, address, emergency contact, bank account). Bank changes always need HR approval and take effect from the next payroll run that has not been calculated.
- **R-staff-12** A teacher's `teachable_subject_ids` and `max_lessons_per_week` are what the timetable checks ([M12](m12-timetable.md)).
- **R-staff-13** Deleting staff is not possible once they have attendance, a payslip, marks or a timetable entry. They leave instead.
- **R-staff-14** A public job application is accepted only for an opening that is `open`, public and not past its closing date. Uploads are scanned; the form is rate-limited per phone number and address.
- **R-staff-15** Hiring an applicant creates the staff record from their details, marks the applicant `hired`, and marks the opening `filled` when its positions are all taken. Other applicants are not rejected automatically.
- **R-staff-16** Salary figures never appear in this module. They are in [M28](m28-payroll.md) behind the `payroll` capability.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `staff:read` | See the staff directory | ALL_STAFF |
| `staff-private:read` | See private details, bank accounts, documents and contracts | HR, principal, director |
| `staff:manage` | Add and edit staff; record movements; manage documents and contracts | HR, branch_admin |
| `staff:transfer` | Start transfers and promotions | HR, director |
| `staff-exits:manage` | Start and run exits; tick any clearance item | HR |
| `staff-clearance:update` | Tick the clearance items owned by one's role | librarian, store_keeper, accountant, it_admin, coordinator |
| `staff-setup:manage` | Maintain departments and designations | hr_manager |
| `staff-changes:review` | Approve or reject staff change requests | HR |
| `job-openings:manage` | Create and manage job openings | HR, principal |
| `job-applicants:read` | See applicants | HR, principal, vice_principal |
| `job-applicants:manage` | Move applicants through stages; schedule interviews; hire | HR, principal |
| `staff:import` | Import staff | hr_manager |
| `staff:export` | Export staff data | HR, director |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/departments` | `staff:read` | Lists |
| POST | `/departments` | `staff-setup:manage` | Creates |
| PATCH | `/departments/[id]` | `staff-setup:manage` | Edits |
| GET | `/designations` | `staff:read` | Lists |
| POST | `/designations` | `staff-setup:manage` | Creates |
| PATCH | `/designations/[id]` | `staff-setup:manage` | Edits |
| GET | `/staff` | `staff:read` | The directory; filter by branch, department, designation, type, status |
| POST | `/staff` | `staff:manage` | Creates directory and private records |
| POST | `/staff/check-duplicate` | `staff:manage` | Looks for an existing record by CNIC or phone |
| GET | `/staff/[id]` | `staff:read` | The profile, as much as the caller may see |
| PATCH | `/staff/[id]` | `staff:manage` | Edits directory fields that are not movements |
| GET | `/staff/[id]/private` | `staff-private:read` | Private details |
| PUT | `/staff/[id]/private` | `staff:manage` | Saves private details |
| GET | `/staff/[id]/bank-accounts` | `staff-private:read` | Lists |
| PUT | `/staff/[id]/bank-accounts` | `staff:manage` | Saves |
| GET | `/staff/[id]/documents` | `staff-private:read` | Lists |
| POST | `/staff/[id]/documents` | `staff:manage` | Adds |
| DELETE | `/staff-documents/[id]` | `staff:manage` | Removes |
| PUT | `/staff/[id]/qualifications` | `staff:manage` | Saves qualifications |
| PUT | `/staff/[id]/experience` | `staff:manage` | Saves experience |
| GET | `/staff/[id]/contracts` | `staff-private:read` | Lists |
| POST | `/staff/[id]/contracts` | `staff:manage` | Creates a contract or renewal and its letter |
| GET | `/staff/[id]/movements` | `staff-private:read` | The history |
| POST | `/staff/[id]/confirm` | `staff:manage` | Confirms after probation |
| POST | `/staff/[id]/transfer` | `staff:transfer` | Starts a transfer |
| POST | `/staff/[id]/promote` | `staff:transfer` | Starts a promotion or redesignation |
| POST | `/staff/[id]/status` | `staff:manage` | Suspends or reinstates |
| POST | `/staff/[id]/rejoin` | `staff:manage` | Rejoins someone who had left |
| POST | `/staff/[id]/invite` | `staff:manage` | Sends or resends the login invitation |
| GET | `/staff/missing-items` | `staff-private:read` | Missing and expiring documents |
| GET | `/staff/teacher-loads` | `staff:read` | Teaching load per teacher |
| POST | `/staff/import` | `staff:import` | Starts an import |
| GET | `/staff/export` | `staff:export` | Exports |
| GET | `/staff-exits` | `staff-private:read` | Lists |
| POST | `/staff-exits` | `staff-exits:manage` | Starts an exit |
| GET | `/staff-exits/[id]` | `staff-private:read` | One exit with clearance |
| PATCH | `/staff-exits/[id]/clearance` | `staff-clearance:update` | Ticks or waives an item |
| POST | `/staff-exits/[id]/withdraw` | `staff-exits:manage` | Withdraws a resignation |
| GET | `/staff-change-requests` | `staff-changes:review` | Lists |
| POST | `/staff-change-requests/[id]/review` | `staff-changes:review` | Approves or rejects |
| GET | `/me/staff` | `signed-in` | My own staff profile |
| POST | `/me/staff/change-requests` | `signed-in` | Asks for a correction |
| GET | `/job-openings` | `job-applicants:read` | Lists |
| POST | `/job-openings` | `job-openings:manage` | Creates |
| PATCH | `/job-openings/[id]` | `job-openings:manage` | Edits, opens, holds, closes |
| GET | `/job-applicants` | `job-applicants:read` | Lists; filter by opening and stage |
| POST | `/job-applicants` | `job-applicants:manage` | Adds an applicant by hand |
| GET | `/job-applicants/[id]` | `job-applicants:read` | One applicant with interviews |
| PATCH | `/job-applicants/[id]` | `job-applicants:manage` | Edits; moves stage |
| POST | `/job-applicants/[id]/interviews` | `job-applicants:manage` | Schedules an interview or demo lesson |
| PATCH | `/applicant-interviews/[id]` | `job-applicants:manage` | Records the result |
| POST | `/job-applicants/[id]/hire` | `job-applicants:manage` | Creates the staff record |
| GET | `/public/[school]/jobs` | `public` | Open public job openings |
| POST | `/public/[school]/jobs/[id]/apply` | `public` | Submits an application |

Idempotent: `POST /staff`, `POST /job-applicants/[id]/hire`, `POST /public/[school]/jobs/[id]/apply`.

## 8 · Client layer

Generated CRUD for departments, designations and job openings. Custom hooks: `useStaffDirectory`, `useStaffProfile`, `useCreateStaff`, `useStaffPrivate`, `useStaffDocuments`, `useTransferStaff`, `useStaffExit`, `useUpdateClearance`, `useMissingItems`, `useTeacherLoads`, `useApplicants(openingId)` (grouped by stage), `useMoveApplicant` (optimistic), `useHireApplicant`, `useMyStaffProfile`.

## 9 · Screens

Built in [Phase 7](../20-phases/phase-07-school-setup-and-people.md) (directory, needed by academics) and [Phase 10](../20-phases/phase-10-hr.md) (everything else).

| Screen | Pattern | Where |
|---|---|---|
| Staff | List | `/school/staff`: photo, name, designation, branch, status; filters; import |
| Add staff | Wizard | Identity (with duplicate check), job, contact and bank, documents, login invitation |
| Staff profile | Detail | Tabs: Overview, Personal, Job and history, Documents, Timetable, Attendance and leave, Salary, Appraisal. Tabs appear only for those allowed |
| Organisation chart | Tree | Reporting lines by branch |
| Missing items | List | Documents missing or expiring; probation and contracts ending |
| Exits | List + Detail | Clearance checklist with owners; settlement link |
| Recruitment | Board | `/school/staff/recruitment`: openings; applicants as cards in stage columns; drag between stages |
| Applicant | Detail in a sheet | CV beside the details; interviews and feedback; Hire |
| Departments and designations | Settings | `/school/settings/staff` |
| **Staff:** My profile | Detail | Own details; request a correction |

## 10 · Notifications and jobs

Events: `staff.welcome` (with the invitation), `staff.probation-ending`, `staff.contract-ending`, `staff.document-expiring`, `staff.transferred`, `staff.exit-started` (to clearance owners), `staff.clearance-pending`, `staff.change-requested`, `staff.change-reviewed`, `staff.birthday` (optional, to the branch head), `applicant.received`, `applicant.interview-scheduled` (to the applicant and the panel), `applicant.rejected` (optional, polite).

Jobs: `staff.apply-movements` (daily 00:15, applies transfers and exits on their effective date), `staff.reminders` (daily 08:00), `staff.close-openings` (daily).

Documents: appointment letter, contract, confirmation letter, transfer order, experience letter, relieving letter, staff ID card ([M08](m08-certificates-id-cards.md)), staff list.

## 11 · Offline

The staff directory of one's branch is available offline in the teacher's app for substitutions and contact.

## 12 · AI

- Reading a CNIC photo into name, number and dates when adding staff (A7).
- Summarising a CV against the opening's requirements for the shortlisting screen; a summary only, never a ranking or a decision.

## 13 · Failure cases

- **F-staff-1** HR adds someone whose CNIC belongs to a person who left in 2024 → "This person worked here before" with a Rejoin button.
- **F-staff-2** A transfer is approved for the 1st and the teacher has lessons at the old branch → on the 1st those lessons show "teacher transferred"; the coordinator was told at approval.
- **F-staff-3** A staff member leaves with a library book and an unpaid advance → clearance items stay open; the settlement cannot be approved until they are done or waived.
- **F-staff-4** A bank account is changed after payroll for the month was calculated → the change applies from the next run; the payroll officer sees a notice.
- **F-staff-5** Someone tries to make A report to B while B reports to A → refused.
- **F-staff-6** A resignation is withdrawn after the login was already scheduled for suspension → withdrawal cancels the scheduled changes.
- **F-staff-7** The public application form receives 50 submissions from one address in a minute → rate limit; the rest get a "try later" page.
- **F-staff-8** A class teacher goes on long leave → status `on_leave`; the section shows "class teacher on leave" and asks for an acting class teacher.
- **F-staff-9** An applicant applies twice for the same opening with the same phone → the second updates the first.

## 14 · Seed data

Eight departments, about 30 designations. Per branch, staff in proportion to its size (about 60 at Main Campus and 30 at City Campus) covering every built-in role, with private details, bank accounts and qualifications (documents come with the phase that builds uploads); two on probation ending soon, two on contract, one suspended, one on notice with a clearance in progress, three who left (one rejoined). Movements history for ten staff. Five job openings (two public) with 40 applicants across every stage and several interviews.

## 15 · Tests

- **T-staff-1** Create writes both records in one transaction; employee number is unique under concurrency.
- **T-staff-2** CNIC uniqueness among current staff; rejoin keeps the number.
- **T-staff-3** A user without the `hr` capability gets no rows from `staff_private`, `staff_bank_accounts`, `staff_documents`, `staff_experience` or `employment_contracts` except their own, even with a direct query under their claims.
- **T-staff-4** Movements: each action writes a row; effective-dated changes apply on the day.
- **T-staff-5** Status transitions allowed and refused.
- **T-staff-6** Exit: clearance owners; last-day effects on login, discount and timetable.
- **T-staff-7** Reporting line loops refused.
- **T-staff-8** Self-service change request: allowed fields only; bank change needs approval.
- **T-staff-9** Recruitment: stage moves, hire prefill, opening filled.
- **T-staff-10** Public application: only open public openings; rate limit; duplicate merge.
- **T-staff-11** The directory response never contains private fields.
- **T-staff-12** Row-level security across organisations.

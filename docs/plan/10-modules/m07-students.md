# M07 · Students

## 1 · Purpose

The student record from admission to leaving: the child, the family, the guardians, the class they sit in each year, their documents, and the three big movements — promotion, transfer between branches, and withdrawal. Every other module reads from here.

## 2 · Depends on

[M02](m02-organisation-branches.md), [M03](m03-identity-roles-audit.md), [M04](m04-school-setup.md), [M11](m11-academic-structure.md) (`grades`, `sections`, `subject_groups`). `houses` come from [M20](m20-behaviour-houses.md).

## 3 · Tables

#### `families` · org +household(id)
A household. Siblings share one family, which is what sibling discounts and family billing use.

| Column | Type | Rules |
|---|---|---|
| family_code | text | required; from the `family` sequence |
| primary_guardian_id | uuid → guardians | optional until the first guardian is added |
| address | text | optional |
| city | text | optional |
| home_phone | text | optional |
| is_tax_filer | bool | default false; used by advance tax on fees |
| income_band | enum(not_stated, under_50k, 50k_100k, 100k_250k, over_250k) | default not_stated |
| notes | text | optional |

Policy: staff of the organisation; a guardian or student may read their own family's row.
Unique: (org_id, family_code) among live rows.

#### `guardians` · org

| Column | Type | Rules |
|---|---|---|
| family_id | uuid → families | required |
| full_name | text | required |
| full_name_ur | text | optional |
| cnic | text | optional; sensitive |
| phone | text | required; E.164 |
| whatsapp_phone | text | optional; defaults to `phone` |
| phone_alt | text | optional |
| email | text | optional |
| occupation | text | optional |
| employer | text | optional |
| education | text | optional |
| is_deceased | bool | default false |
| photo_file_id | uuid → files | optional |
| preferred_locale | enum(en, ur) | default ur |
| custom | jsonb | default `{}` |

Policy: staff; a guardian may read and request changes to their own row.
Unique: (org_id, cnic) among live rows where set.
Index: (org_id, phone); trigram on `full_name`.

#### `students` · branch +family(id)

| Column | Type | Rules |
|---|---|---|
| family_id | uuid → families | required |
| admission_no | text | required; from the `admission` sequence |
| full_name | text | required |
| full_name_ur | text | optional |
| father_name | text | required |
| gender | enum(male, female) | required |
| date_of_birth | date | required; not in the future |
| place_of_birth | text | optional |
| b_form_no | text | optional; sensitive; 13 digits with dashes |
| religion | enum(islam, christianity, hinduism, sikhism, other) | default islam; decides Islamiyat or Ethics |
| mother_tongue | text | optional |
| blood_group | enum(a_pos, a_neg, b_pos, b_neg, ab_pos, ab_neg, o_pos, o_neg, unknown) | default unknown |
| photo_file_id | uuid → files | optional |
| phone | text | optional; the student's own |
| address | text | optional; when different from the family's |
| previous_school | text | optional |
| previous_class | text | optional |
| admitted_on | date | required |
| admission_grade_id | uuid → grades | required |
| status | enum(active, on_leave, suspended, left, transferred, graduated, expelled) | default active |
| left_on | date | optional; required once status is left, transferred, graduated or expelled |
| leaving_reason | text | optional |
| house_id | uuid → houses | optional |
| is_orphan | bool | default false |
| staff_parent_id | uuid → staff | optional; marks a staff child |
| medical_alert | text | optional; one line teachers always see (asthma, nut allergy) |
| special_needs | text | optional |
| board_registration_no | text | optional |
| source_application_id | uuid → admission_applications | optional |
| custom | jsonb | default `{}` |

Unique: (org_id, admission_no) among live rows; (org_id, b_form_no) among live rows where set.
Index: (org_id, branch_id, status); (org_id, family_id); trigram on `full_name`, `father_name`, `admission_no`.

#### `student_guardians` · org +family

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| guardian_id | uuid → guardians | required |
| relation | enum(father, mother, grandfather, grandmother, uncle, aunt, brother, sister, guardian, other) | required |
| is_primary | bool | default false |
| can_pickup | bool | default true |
| receives_messages | bool | default true |
| is_emergency_contact | bool | default false |
| lives_with_student | bool | default true |

Unique: (student_id, guardian_id); one primary per student (partial unique index).

#### `enrollments` · branch +family
One row per student per academic year: which class they sit in.

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| academic_year_id | uuid → academic_years | required |
| grade_id | uuid → grades | required |
| section_id | uuid → sections | required |
| roll_no | int | optional; > 0 |
| subject_group_id | uuid → subject_groups | optional; Grades 9 and 10 |
| status | enum(active, promoted, detained, left, transferred, graduated) | default active |
| joined_on | date | required |
| left_on | date | optional |
| outcome_note | text | optional |

Unique: (org_id, student_id, academic_year_id) among live rows that are not `left` or `transferred`; (section_id, roll_no) among live active rows.
Index: (org_id, section_id, status).

#### `section_changes` · branch append-only

| Column | Type | Rules |
|---|---|---|
| enrollment_id | uuid → enrollments | required |
| from_section_id | uuid → sections | required |
| to_section_id | uuid → sections | required |
| changed_on | date | required |
| reason | text | optional |

#### `student_documents` · branch +family

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| kind | enum(b_form, birth_certificate, previous_result, leaving_certificate, guardian_cnic, vaccination_card, photo, other) | required |
| file_id | uuid → files | required |
| document_no | text | optional |
| is_verified | bool | default false |
| verified_by | uuid → profiles | optional |
| verified_at | timestamptz | optional |
| note | text | optional |

#### `student_status_history` · branch append-only

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| from_status | text | required |
| to_status | text | required |
| effective_on | date | required |
| reason | text | optional |
| detail | jsonb | default `{}` |

#### `promotion_batches` · branch

| Column | Type | Rules |
|---|---|---|
| from_academic_year_id | uuid → academic_years | required |
| to_academic_year_id | uuid → academic_years | required |
| grade_id | uuid → grades | required |
| section_id | uuid → sections | optional; empty means the whole grade |
| status | enum(draft, committed, reversed, cancelled) | default draft |
| committed_at | timestamptz | optional |
| committed_by | uuid → profiles | optional |
| summary | jsonb | default `{}`; counts by decision |

#### `promotion_items` · branch

| Column | Type | Rules |
|---|---|---|
| batch_id | uuid → promotion_batches | required |
| student_id | uuid → students | required |
| enrollment_id | uuid → enrollments | required |
| decision | enum(promote, detain, graduate, leave) | required |
| suggested_decision | enum(promote, detain, graduate, leave) | required; from the promotion rules |
| to_grade_id | uuid → grades | optional |
| to_section_id | uuid → sections | optional |
| reason | text | optional; required when the decision differs from the suggestion |
| new_enrollment_id | uuid → enrollments | optional; set on commit |
| status | enum(pending, done, failed) | default pending |
| error | text | optional |

Unique: (batch_id, student_id).

#### `transfer_requests` · org
Moving a student from one branch to another.

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| from_branch_id | uuid → branches | required |
| to_branch_id | uuid → branches | required; different from `from_branch_id` |
| to_section_id | uuid → sections | optional until approved |
| effective_on | date | required |
| reason | text | required |
| status | enum(requested, approved, completed, rejected, cancelled) | default requested |
| decided_by | uuid → profiles | optional |
| decided_at | timestamptz | optional |
| decision_note | text | optional |

Unique: (org_id, student_id) where status is requested or approved.

#### `student_withdrawals` · branch

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| requested_on | date | required |
| last_attendance_on | date | required |
| reason | enum(relocation, financial, academic, other_school, health, expelled, completed, other) | required |
| detail | text | optional |
| status | enum(requested, clearance, approved, completed, cancelled) | default requested |
| clearance | jsonb | default `{}`; `{ fees, library, inventory, transport, hostel }` each `pending`, `clear` or `waived` |
| dues_outstanding | paisa | default 0; snapshot at approval |
| security_refund | paisa | default 0 |
| approved_by | uuid → profiles | optional |
| completed_at | timestamptz | optional |

Unique: (org_id, student_id) where status is requested, clearance or approved.

#### `profile_change_requests` · org +family
A guardian asks for a correction; staff decide.

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | optional |
| guardian_id | uuid → guardians | optional; one of the two is required |
| changes | jsonb | required; `{ field: newValue }`, only fields on the allowed list |
| note | text | optional |
| status | enum(pending, approved, rejected) | default pending |
| decided_by | uuid → profiles | optional |
| decision_note | text | optional |

Policy: a guardian may insert for their own children and read their own requests.

## 4 · Contracts

`packages/contracts/src/modules/students/`: `students`, `guardians`, `families`, `student-guardians`, `enrollments`, `student-documents`, `promotions`, `transfers`, `withdrawals`, `profile-change-requests`.

- `CreateStudent` carries the child plus either `familyId` or a new family with guardians, and `sectionId`. It is used by the admission conversion and by direct entry.
- `ListStudents` filters: `branchId`, `gradeId`, `sectionId`, `status`, `gender`, `houseId`, `academicYearId`, `hasDues`, `isStaffChild`, `admittedFrom`, `admittedTo`; sort by `fullName`, `admissionNo`, `rollNo`, `admittedOn`.
- `Student` (entity) includes the current enrollment (`grade`, `section`, `rollNo`) and masks `bFormNo` unless the caller holds `students:read-sensitive`.
- `StudentSummary`: the small shape used in pickers, lists and the offline streams.
- `DuplicateCheck`: `{ bFormNo?, fullName, fatherName, dateOfBirth }` → possible matches with a score.
- Allowed fields for `profile_change_requests`: guardian phone, WhatsApp number, email, address, occupation; student photo, address, blood group, medical alert.

## 5 · Rules

- **R-students-1** A student is created in one transaction with: a family (new or existing), at least one guardian, exactly one primary guardian, an active enrollment and an admission number.
- **R-students-2** Before creating, a duplicate check runs. A match on B-Form number is refused. A match on name, father's name and date of birth warns and needs an explicit `confirmNotDuplicate`.
- **R-students-3** Age on the academic year's cut-off date must fit the grade's range in `academics.age_rules`. Outside the range warns; more than two years outside is refused unless the user holds `students:override-age`.
- **R-students-4** A guardian is matched before being created: same CNIC, else same phone within the organisation. A match links the existing guardian (and family) rather than creating a second.
- **R-students-5** A student has at most one enrollment per academic year that is not `left` or `transferred`, and exactly one `active` enrollment in the active year while their status is `active`. A transfer between branches, or a re-admission in the same year, closes the old enrollment and opens a new one, so a year can hold more than one row for the same student.
- **R-students-6** A section cannot exceed its capacity. A user with `enrollments:override-capacity` may exceed it with a reason.
- **R-students-7** Roll numbers are unique within a section. "Renumber" assigns them by the section's rule (alphabetical, admission order, or girls then boys) and is refused once an exam's roll-number slips are issued for the term.
- **R-students-8** Changing section mid-year updates the enrollment, records a `section_changes` row, and moves the student in every later attendance session; past attendance and marks stay with the old section.
- **R-students-9** Status machine: `active → on_leave, suspended, left, transferred, graduated, expelled`; `on_leave → active, left`; `suspended → active, expelled, left`; `left → active` (re-admission); the rest are final.
- **R-students-10** Leaving (`left`, `expelled`) goes through a withdrawal: every clearance must be `clear` or `waived`; waiving fees needs `withdrawals:waive-dues`. On completion the enrollment closes, future vouchers are cancelled, transport and hostel allocations end, and the security deposit refund is created.
- **R-students-11** Re-admission keeps the old admission number or issues a new one, by the setting `students.readmission_number`. History is always kept on the same student record.
- **R-students-12** Promotion works on a batch per grade: rules suggest a decision per student (pass in the final result, minimum attendance, no pending dues if the school requires it); staff may change any decision with a reason; commit creates next-year enrollments and closes this year's. A student in Grade 10 can only `graduate`, `detain` or `leave`.
- **R-students-13** A committed promotion batch can be reversed only while none of its new enrollments has attendance, marks or vouchers.
- **R-students-14** A transfer between branches needs approval from a user with access to the destination branch. On the effective date the old enrollment becomes `transferred`, a new one opens in the destination, `students.branch_id` changes, and open vouchers stay payable at the origin unless the fee service moves them.
- **R-students-15** A student with any attendance, marks, vouchers or payments cannot be deleted, only withdrawn. A student created by mistake with none of those can be deleted within 7 days.
- **R-students-16** Merging two student records (a confirmed duplicate) moves every dependent row to the kept record in one transaction, keeps the older admission number, and is audited with both ids.
- **R-students-17** A teacher sees only students enrolled in sections they teach or are class teacher of. A teacher never sees B-Form, CNIC, family income or fee data.
- **R-students-18** A guardian sees their own children and their own family only. They cannot edit; they raise a `profile_change_request`.
- **R-students-19** Changing a guardian's phone ends that guardian's sessions and requires the new number to be verified at next sign-in.
- **R-students-20** `staff_parent_id` is cleared, and the staff-child discount ended, when that staff member's employment ends.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `students:read` | See students in scope | ALL_STAFF |
| `students:read-sensitive` | See B-Form and CNIC unmasked, family income | ADMINS, admissions_officer, accountant |
| `students:create` | Add a student directly | ADMINS, admissions_officer |
| `students:update` | Edit student, guardian and family details | ADMINS, admissions_officer, section_head |
| `students:delete` | Delete a student created by mistake; merge duplicates | ADMINS |
| `students:export` | Export student lists | ADMINS, ACADEMIC, admissions_officer |
| `students:override-age` | Admit outside the age rule | principal |
| `enrollments:update` | Change section, roll numbers, subject group | ADMINS, section_head, coordinator |
| `enrollments:override-capacity` | Exceed a section's capacity | principal |
| `student-documents:update` | Upload and verify documents | ADMINS, admissions_officer |
| `promotions:read` | See promotion batches | LEADERS, ACADEMIC |
| `promotions:update` | Prepare and commit promotions | principal, academic_head, section_head, coordinator |
| `transfers:create` | Request a transfer to another branch | ADMINS |
| `transfers:approve` | Approve an incoming transfer | ADMINS |
| `withdrawals:read` | See withdrawals | LEADERS, ACCOUNTS, admissions_officer |
| `withdrawals:update` | Start, clear and complete a withdrawal | ADMINS, admissions_officer |
| `withdrawals:waive-dues` | Complete a withdrawal with dues outstanding | principal, finance_head |
| `profile-change-requests:update` | Approve or reject a guardian's correction | ADMINS, admissions_officer |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/students` | `students:read` | Lists students with filters |
| POST | `/students` | `students:create` | Creates a student with family, guardians and enrollment |
| POST | `/students/duplicate-check` | `students:read` | Returns possible duplicates |
| GET | `/students/export` | `students:export` | Exports the filtered list |
| GET | `/students/[id]` | `students:read` | One student with guardians and current enrollment |
| PATCH | `/students/[id]` | `students:update` | Edits the student |
| DELETE | `/students/[id]` | `students:delete` | Deletes a mistaken record |
| POST | `/students/[id]/merge` | `students:delete` | Merges another record into this one |
| POST | `/students/[id]/status` | `students:update` | Changes status (on leave, suspended, back to active) |
| GET | `/students/[id]/timeline` | `students:read` | Enrollment, status and section history |
| GET | `/students/[id]/siblings` | `students:read` | Other children of the family |
| GET | `/students/[id]/reveal` | `students:read-sensitive` | Returns masked fields unmasked; audited |
| GET | `/students/[id]/guardians` | `students:read` | The student's guardians |
| POST | `/students/[id]/guardians` | `students:update` | Links or creates a guardian |
| PATCH | `/student-guardians/[id]` | `students:update` | Changes relation, pickup, messages, primary |
| DELETE | `/student-guardians/[id]` | `students:update` | Unlinks, if another primary remains |
| GET | `/guardians` | `students:read` | Lists guardians |
| GET | `/guardians/[id]` | `students:read` | One guardian with their children |
| PATCH | `/guardians/[id]` | `students:update` | Edits a guardian |
| GET | `/families` | `students:read` | Lists families |
| GET | `/families/[id]` | `students:read` | One family with guardians and children |
| PATCH | `/families/[id]` | `students:update` | Edits a family |
| POST | `/families/[id]/merge` | `students:update` | Merges another family into this one |
| GET | `/enrollments` | `students:read` | Lists enrollments for a year, grade or section |
| PATCH | `/enrollments/[id]` | `enrollments:update` | Changes section, roll number or subject group |
| POST | `/enrollments/renumber` | `enrollments:update` | Reassigns roll numbers for a section |
| POST | `/enrollments/bulk-move` | `enrollments:update` | Moves several students to another section |
| GET | `/student-documents` | `students:read` | A student's documents |
| POST | `/student-documents` | `student-documents:update` | Adds a document |
| PATCH | `/student-documents/[id]` | `student-documents:update` | Edits or verifies |
| DELETE | `/student-documents/[id]` | `student-documents:update` | Removes |
| GET | `/promotions` | `promotions:read` | Lists batches |
| POST | `/promotions` | `promotions:update` | Creates a draft batch with suggested decisions |
| GET | `/promotions/[id]` | `promotions:read` | One batch with its items |
| PATCH | `/promotions/[id]/items` | `promotions:update` | Changes decisions and destinations |
| POST | `/promotions/[id]/commit` | `promotions:update` | Commits the batch |
| POST | `/promotions/[id]/reverse` | `promotions:update` | Reverses a committed batch, if allowed |
| DELETE | `/promotions/[id]` | `promotions:update` | Cancels a draft |
| GET | `/transfers` | `students:read` | Lists transfer requests |
| POST | `/transfers` | `transfers:create` | Requests a transfer |
| POST | `/transfers/[id]/approve` | `transfers:approve` | Approves and sets the destination section |
| POST | `/transfers/[id]/reject` | `transfers:approve` | Rejects |
| POST | `/transfers/[id]/cancel` | `transfers:create` | Withdraws the request |
| GET | `/withdrawals` | `withdrawals:read` | Lists withdrawals |
| POST | `/withdrawals` | `withdrawals:update` | Starts a withdrawal |
| GET | `/withdrawals/[id]` | `withdrawals:read` | One withdrawal with live clearance |
| PATCH | `/withdrawals/[id]/clearance` | `withdrawals:update` | Marks a clearance item |
| POST | `/withdrawals/[id]/complete` | `withdrawals:update` | Completes |
| POST | `/withdrawals/[id]/cancel` | `withdrawals:update` | Cancels |
| GET | `/profile-change-requests` | `profile-change-requests:update` | Lists requests |
| POST | `/profile-change-requests/[id]/approve` | `profile-change-requests:update` | Applies the change |
| POST | `/profile-change-requests/[id]/reject` | `profile-change-requests:update` | Rejects with a note |
| GET | `/family/children` | `signed-in` | A guardian's own children with class and photo |
| GET | `/family/children/[id]` | `signed-in` | One of their children's profile |
| GET | `/family/profile` | `signed-in` | The guardian's own details and family |
| POST | `/family/profile-change-requests` | `signed-in` | A guardian asks for a correction |
| GET | `/family/profile-change-requests` | `signed-in` | Their own requests |
| GET | `/learn/profile` | `signed-in` | A student's own profile |

Idempotent: `POST /students`, `POST /promotions/[id]/commit`, `POST /transfers/[id]/approve`, `POST /withdrawals/[id]/complete`, `POST /students/[id]/merge`.

## 8 · Client layer

Generated CRUD for `students`, `guardians`, `families`, `student-documents`. Custom hooks: `useStudent` (with guardians and enrollment), `useDuplicateCheck`, `useRevealSensitive`, `useChangeStudentStatus`, `useMoveSection`, `useRenumber`, `usePromotionBatch`, `useCommitPromotion`, `useTransfer*`, `useWithdrawal*`, `useMyChildren`, `useActiveChild` (the child selected in the parent portal), `useRequestProfileChange`.

## 9 · Screens

| Screen | Pattern | Where |
|---|---|---|
| Students | List | `/school/students`: StatStrip (active, new this year, left this year), filters, bulk actions (move section, invite guardians, export, print ID cards) |
| Student | Detail | Tabs: Profile, Family, Academics, Attendance, Fees, Results, Behaviour, Health, Documents, Notes, Activity. Each tab is supplied by its own module and hidden without permission |
| New student | Wizard | Child, family and guardians (with matching), class, documents, review. Duplicate warning before the last step |
| Edit student | Form page | |
| Families | List + Detail | Children, guardians, merge |
| Class lists | List | By section with roll numbers; renumber; print class list |
| Promotion | Wizard | Pick grade, review suggestions in a grid, adjust, confirm, result |
| Transfers | List + Dialog form | Incoming and outgoing tabs |
| Withdrawal | Wizard | Reason, clearance checklist (live), settlement, complete |
| Change requests | List | Before and after side by side; approve or reject |
| **Teacher:** My classes | List | `/teach/classes`: students of each section with photo, roll number and medical alert |
| **Parent:** Children | Dashboard | `/family`: child switcher; profile card; request a correction |
| **Student:** My profile | Detail | `/learn/profile` |

## 10 · Notifications and jobs

Events: `student.admitted`, `student.section-changed`, `student.status-changed`, `student.withdrawn`, `student.transferred`, `promotion.committed`, `profile-change.requested`, `profile-change.decided`.

Jobs: `students.commit-promotion` (large batches), `students.complete-transfers` (daily, on the effective date), `students.birthday-list` (daily, optional greeting).

## 11 · Offline

Read-only in the `teacher.sections`, `cashier.students` and `family.children` streams (`StudentSummary` only: id, names, class, roll number, photo thumbnail, medical alert). No offline writes.

## 12 · AI

- Reading a scanned admission form or B-Form into the new-student wizard (A7).
- "At risk" score shown on the student page (S1), computed in [M44](m44-ai-suite.md).

## 13 · Failure cases

- **F-students-1** Two staff admit the same child at the same moment → the B-Form unique index lets one win; the other sees "A student with this B-Form already exists" with a link.
- **F-students-2** The photo upload fails → the student is saved without a photo.
- **F-students-3** A guardian's phone already belongs to another family → the wizard shows the existing guardian and asks whether to link this child to that family.
- **F-students-4** The section fills while the form is open → `RULE` "8-B is full (40 of 40)"; other sections with space are suggested.
- **F-students-5** Promotion commit fails for 3 of 120 students → the 117 are promoted; the 3 are listed with their errors and can be retried.
- **F-students-6** Promotion is committed twice → the idempotency key and item statuses prevent double enrollments.
- **F-students-7** A transfer is approved but the destination section is deleted before the effective date → the transfer job marks it failed and tells both branches.
- **F-students-8** A withdrawal is completed while a fee payment is being recorded → the withdrawal locks the student's vouchers first; whichever commits second sees the new state.
- **F-students-9** A student is withdrawn by mistake → status `left → active` re-admits them into a section, restoring the enrollment for the current year.
- **F-students-10** An import contains 12 students whose admission numbers already exist → those rows are skipped and reported; the rest import.
- **F-students-11** A date of birth is typed as 2061 → refused at the form and at the API.
- **F-students-12** Two records are merged and it was wrong → merges are audited with a full snapshot; a platform-assisted unmerge is documented in the runbook, not offered in the UI.

## 14 · Seed data

720 students at Main Campus across Grades 1 to 10 and 432 at City Campus across Grades 1 to 8, in about 930 families (so siblings exist), realistic Pakistani names in English and Urdu, about 65% with B-Form numbers, 30 staff children, about 20 orphans, 41 students who left this year, about 20 transferred between branches and two transfers still open, last year's promotion committed grade by grade with a few students kept back, one withdrawal finished and two in progress, five pending profile change requests. Documents are seeded with the phase that builds uploads.

## 15 · Tests

- **T-students-1** Create with a new family; create into an existing family; guardian matching by CNIC and by phone.
- **T-students-2** Duplicate rules: B-Form refused; name match warns and proceeds with confirmation.
- **T-students-3** Age rule: inside, warned, refused, overridden.
- **T-students-4** One active enrollment; capacity; override.
- **T-students-5** Roll number uniqueness and renumbering by each rule.
- **T-students-6** Section change: later attendance moves, earlier stays.
- **T-students-7** Every status transition allowed and refused.
- **T-students-8** Withdrawal: clearance blocks completion; waiver permission; effects on vouchers, transport and deposit.
- **T-students-9** Promotion: suggestions follow the rules; commit creates enrollments; reversal allowed then refused after attendance exists; Grade 10 graduates.
- **T-students-10** Transfer: approval by destination; effective-date job; vouchers stay at origin.
- **T-students-11** Merge moves every dependent table (checked against the foreign-key registry).
- **T-students-12** Teacher scope; guardian scope; sensitive masking and audited reveal.
- **T-students-13** Profile change request: only allowed fields; approval applies; phone change ends sessions.
- **T-students-14** Row-level security: other organisation, other branch, guardian of another child.

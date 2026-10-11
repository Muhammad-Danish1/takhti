# Phase 7 · School setup and people

**Goal.** A new school can be set up completely and can admit students: its profile and branches, academic year, classes and subjects, staff, users and roles, admissions from first enquiry to enrolled student, the student record, certificates and ID cards. Everything later phases build on is on screen.

**Depends on.** [Phase 6](phase-06-platform-console.md).

**Portal.** `/school`: the groups Home, Admissions and students, Academics (structure only), Staff (directory only) and Settings.

**Modules.** [M02](../10-modules/m02-organisation-branches.md), [M03](../10-modules/m03-identity-roles-audit.md), [M04](../10-modules/m04-school-setup.md), [M00](../10-modules/m00-shared-kernel.md) (approvals, imports, custom fields, jobs, data checks), [M11](../10-modules/m11-academic-structure.md), [M26](../10-modules/m26-staff-recruitment.md) (directory and adding staff), [M07](../10-modules/m07-students.md), [M06](../10-modules/m06-admissions.md), [M08](../10-modules/m08-certificates-id-cards.md), [M10](../10-modules/m10-alumni.md).

## Read first

Sections 5, 9 and 13 of each module above; the [navigation map](../30-reference/navigation.md); [building a screen](../30-reference/building-a-screen.md).

## Work packages

The order follows what a new school must do first.

### 7.1 · The `/school` shell and its dashboard

- [ ] Sidebar groups from the navigation map; the branch switcher and academic-year switcher working for real.
- [ ] The dashboard grid ([M42](../10-modules/m42-dashboards-reports.md)) with the widgets that have data by the end of this phase: enrolment by grade, admissions funnel, approvals waiting, my tasks, upcoming holidays, birthdays, setup checklist. Role layouts for principal, branch admin, admissions officer and receptionist. Other widgets are added by their own phases.
- [ ] **My account** and the "My work" menu skeleton.

### 7.2 · Settings: school, branches, year

| Screen | Path | Pattern | Module |
|---|---|---|---|
| School profile; letterhead and signatures; general and security settings | `/school/settings` | Settings | M02 |
| Branches; branch; new branch; rooms | `/school/settings/branches` | List, Detail, Form page | M02 |
| Academic years; year; new year (rollover); close year | `/school/settings/academics` | List, Detail, Wizard | M04 |
| Holidays | `/school/settings/academics/holidays` | Calendar + List | M04 |
| Shifts | `/school/settings/academics/shifts` | List + Dialog form | M04 |
| Grading schemes; scheme | `/school/settings/academics/grading` | List, Grid editor | M04 |
| Academic rules | `/school/settings/academics/rules` | Settings | M04 |

The IBCC 10-point scale and the older 7-grade scale appear as seeded schemes; the editor shows band boundaries and refuses gaps and overlaps.

### 7.3 · Settings: people and control

| Screen | Path | Pattern | Module |
|---|---|---|---|
| Users and access; user access | `/school/settings/users` | List, Detail | M03 |
| Roles; role | `/school/settings/users/roles` | List, Grid editor | M03 |
| Invitations | `/school/settings/users/invitations` | List | M03 |
| Audit log | `/school/settings/audit-log` | List | M03 |
| Approval policies | `/school/settings/approvals` | Settings | M00 |
| Approvals inbox | `/school/approvals` | List with a detail sheet | M00 |
| Custom fields | `/school/settings/custom-fields` | Settings | M00 |
| Imports; import wizard | `/school/settings/imports` | List, Wizard | M00 |
| Background jobs; data checks; recently deleted; my exports | `/school/settings/jobs` and beside it | List | M00 |

The role editor is the permission matrix grouped by module, with sensitive permissions flagged and a "what changed" summary before saving. The **Activity** tab and the **Notes** tab appear on every detail page from here on.

### 7.4 · Classes and subjects

| Screen | Path | Pattern | Module |
|---|---|---|---|
| Classes; section | `/school/academics/structure` | List grouped by grade, Detail | M11 |
| Subjects; subject groups | `…/structure/subjects` | List + Dialog form | M11 |
| Curriculum | `…/structure/curriculum` | Grid editor | M11 |
| Teacher assignments; teacher load | `…/structure/teachers` | Grid editor, List | M11 |

### 7.5 · Staff directory

| Screen | Path | Pattern | Module |
|---|---|---|---|
| Staff | `/school/staff` | List | M26 |
| Add staff | `/school/staff/new` | Wizard | M26 |
| Staff profile (Overview, Personal, Job and history, Documents tabs) | `/school/staff/[id]` | Detail | M26 |
| Departments and designations | `/school/settings/staff` | Settings | M26 |
| Staff import | through the import wizard | Wizard | M26 |

Leave, payroll, recruitment, exits and appraisal tabs are added in [Phase 10](phase-10-hr.md).

### 7.6 · Admissions

| Screen | Path | Pattern | Module |
|---|---|---|---|
| Admissions home | `/school/admissions` | Dashboard | M06 |
| Enquiries; enquiry; new enquiry | `/school/admissions/enquiries` | Board and List, Detail in a side sheet, Dialog form | M06 |
| Applications; application; new application | `/school/admissions/applications` | List, Detail, Wizard | M06 |
| Decide | on the application | Dialog form | M06 |
| Enrol | on the application | Wizard | M06 |
| Seats and sources | `/school/settings/admissions` | Settings | M06 |

Enrol hands over to [M07](../10-modules/m07-students.md) and requests the admission voucher from [M21](../10-modules/m21-fees.md); the fee screens themselves are [Phase 9](phase-09-finance.md).

### 7.7 · Students

| Screen | Path | Pattern | Module |
|---|---|---|---|
| Students | `/school/students` | List | M07 |
| Student (Overview, Family, Enrolment, Documents, Activity; other tabs join in later phases) | `/school/students/[id]` | Detail | M07 |
| New student; edit student | `/school/students/new` | Wizard, Form page | M07 |
| Families | `/school/students/families` | List + Detail | M07 |
| Class lists | `/school/students/class-lists` | List | M07 |
| Promotion | `/school/students/promotion` | Wizard | M07 |
| Transfers | `/school/students/promotion/transfers` | List + Dialog form | M07 |
| Withdrawal | `/school/students/withdrawals` | List, Wizard | M07 |
| Change requests | `/school/students/change-requests` | List | M07 |
| Student import | through the import wizard | Wizard | M07 |

The student detail page is the most visited page in the product. Its header (photo, name in English and Urdu, father's name, class, roll number, status, medical alert) is fixed here; each later phase adds a tab: Attendance, Fees, Results, Behaviour, Health, Transport, Library.

### 7.8 · Certificates, ID cards, alumni

| Screen | Path | Pattern | Module |
|---|---|---|---|
| Certificates; new certificate; certificate; templates | `/school/certificates` | List, Wizard, Detail, List + Form page | M08 |
| ID cards; print cards; card templates | `/school/id-cards` | List, Wizard, Form page | M08 |
| Alumni; alumnus; send update links | `/school/alumni` | List, Detail, Dialog form | M10 |

The certificate and card **records, numbering, approval and clearance rules** are complete here. The printed designs are produced in [Phase 16](phase-16-documents-and-printing.md); until then "Print" shows the placeholder document.

## Journeys to automate

| Journey | Role | Steps |
|---|---|---|
| Set up a school | Owner, then principal | From the checklist: profile → a second branch with rooms → academic year with three terms → holidays → grading scheme → grades and sections → subjects and curriculum → checklist complete |
| Staff and logins | HR manager | Add a teacher (duplicate CNIC is caught) → invite → the teacher accepts and lands on `/teach` |
| A custom role | Principal | Copy "Receptionist" to "Front desk lead", add two permissions, assign it → that user sees the new menu item within a minute |
| Enquiry to enrolled | Admissions officer, principal | New enquiry → follow-up → application with documents → test result → offer (principal) → enrol into 6-B → the student exists with a family, a guardian invitation is sent |
| Capacity | Admissions officer | Enrol into a full section → refused; the principal overrides with a reason |
| Sibling | Admissions officer | A second child whose guardian's CNIC already exists → joins the existing family |
| Import | Branch admin | Upload 200 students with 12 bad rows → preview shows the 12 with reasons → commit the 188 → fix and re-upload the 12 |
| Promotion | Principal | Promotion wizard for Grade 5 → 3 detained → commit → new enrolments in the next year |
| Transfer | Branch admin of one branch, principal of another | Request → approve → the student moves on the date; history kept |
| Withdrawal | Branch admin | Withdrawal with clearance pending → cannot complete → clearance waived by the principal → leaving certificate becomes possible |
| Audit | Principal | Change a student's date of birth → the Activity tab and the audit log show who, when, before and after |
| Branch isolation | City Campus accountant | Cannot see a Main Campus student by list, by search or by direct link |

## Exit checks

1. Every screen above meets "Done when" in [building a screen](../30-reference/building-a-screen.md).
2. All twelve journeys pass in the browser, in English; the first four also in Urdu.
3. A new organisation created in Phase 6 can be taken from empty to "first student enrolled" using only the screens, by someone following the setup checklist.
4. The role matrix now covers every page built so far for all 32 roles.
5. Each module's list pages answer in under a second on the `--large` seed (5,000 students).
6. `pnpm check`, `pnpm test:db`, `pnpm test:e2e`.

## Left for later, on purpose

- Printed certificates, cards and admission forms: [Phase 16](phase-16-documents-and-printing.md).
- The public admission pages: [Phase 20](phase-20-public-website.md).
- Reading scanned admission forms: [Phase 19](phase-19-ai.md).

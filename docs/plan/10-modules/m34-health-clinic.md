# M34 · Health and clinic

## 1 · Purpose

The school nurse's record: each child's health profile, visits to the sick room, medicines given, vaccinations and screening camps, and accidents. It makes sure a teacher knows about a serious allergy, a parent hears the same hour that their child was unwell, and nobody else reads medical details.

Health records are behind the `health` capability. Teachers see only the one-line medical alert on the student record ([M07](m07-students.md)).

## 2 · Depends on

[M07](m07-students.md), [M26](m26-staff-recruitment.md) (`staff`), [M09](m09-front-office.md) (gate pass when a child is sent home), [M32](m32-inventory-assets.md) (the clinic's medicine stock), [M00](m00-shared-kernel.md) (files).

## 3 · Tables

#### `health_profiles` · org +cap(health) +family
One per student.

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required; unique |
| allergies | jsonb | default `[]`; `{ substance, reaction, severity: mild \| moderate \| severe }[]` |
| conditions | jsonb | default `[]`; `{ name, since?, note? }[]`: asthma, diabetes, epilepsy |
| regular_medicines | jsonb | default `[]`; `{ name, dose, when }[]` |
| disabilities | text | optional |
| dietary_needs | text | optional |
| vision_note | text | optional |
| hearing_note | text | optional |
| family_doctor_name | text | optional |
| family_doctor_phone | text | optional |
| emergency_consent | enum(not_asked, given, refused) | default not_asked; consent to first aid and to being taken to hospital |
| consent_by | uuid → profiles | optional; the guardian |
| consent_at | timestamptz | optional |
| reviewed_on | date | optional; when the nurse last confirmed it with the family |
| note | text | optional; for the nurse only |

Policy: a guardian may read their own child's row except `note`, and submits changes through the family route.

#### `clinic_visits` · branch +cap(health) +family

| Column | Type | Rules |
|---|---|---|
| visit_no | text | required; from the `clinic_visit` sequence |
| student_id | uuid → students | optional; one of student and staff is required |
| staff_id | uuid → staff | optional |
| arrived_at | timestamptz | required |
| left_at | timestamptz | optional; after `arrived_at` |
| sent_by_staff_id | uuid → staff | optional; the teacher who sent them |
| complaint | text | required |
| temperature_c | numeric(4,1) | optional; 30 to 45 |
| vitals | jsonb | default `{}`; pulse, blood pressure, oxygen |
| assessment | text | optional |
| treatment | text | optional |
| outcome | enum(back_to_class, rested, sent_home, referred, emergency) | optional until closed |
| guardian_informed_at | timestamptz | optional |
| gate_pass_id | uuid → gate_passes | optional; when sent home |
| follow_up_on | date | optional |
| attended_by | uuid → profiles | required |
| share_with_family | bool | default true |
| status | enum(open, closed) | default open |

Policy: a guardian may read their own child's visits that are shared, without `assessment` when it is marked private.
Index: (org_id, branch_id, arrived_at); (org_id, student_id, arrived_at).

#### `medication_plans` · branch +cap(health) +family
A parent's instruction to give a child a medicine at school.

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| medicine | text | required |
| dose | text | required |
| times | text[] | required; "10:30", "after lunch" |
| from_date | date | required |
| to_date | date | required; ≥ `from_date` |
| prescription_file_id | uuid → files | optional |
| requested_by | uuid → profiles | required; the guardian, or the nurse on their behalf |
| status | enum(requested, active, declined, ended) | default requested |
| decided_by | uuid → profiles | optional |
| note | text | optional |

Policy: a guardian may insert for their own child and read their own.

#### `medication_log` · branch +cap(health) +family append-only

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | optional |
| staff_id | uuid → staff | optional |
| plan_id | uuid → medication_plans | optional |
| visit_id | uuid → clinic_visits | optional |
| medicine | text | required |
| dose | text | required |
| given_at | timestamptz | required |
| given_by | uuid → profiles | required |
| item_id | uuid → inventory_items | optional; when it came from clinic stock |
| note | text | optional |

#### `health_campaigns` · branch
A vaccination drive or a screening camp.

| Column | Type | Rules |
|---|---|---|
| name | text | required; "Typhoid vaccination, October 2026" |
| kind | enum(vaccination, general_checkup, vision, dental, hearing, deworming, growth) | required |
| held_on | date | required |
| ends_on | date | optional |
| grade_ids | uuid[] | default empty; empty means all |
| provider | text | optional; the health department or a partner clinic |
| consent_required | bool | default true |
| consent_due_on | date | optional |
| details | text | optional; what the parent reads |
| status | enum(planned, consent_open, in_progress, completed, cancelled) | default planned |

Policy: staff of the branch; families of the grades it covers may read.

#### `health_consents` · branch +family

| Column | Type | Rules |
|---|---|---|
| campaign_id | uuid → health_campaigns | required |
| student_id | uuid → students | required |
| decision | enum(pending, given, refused) | default pending |
| decided_by | uuid → profiles | optional; the guardian, or staff recording a signed paper form |
| decided_at | timestamptz | optional |
| paper_form_file_id | uuid → files | optional |
| note | text | optional |

Policy: a guardian may update the decision for their own child while the campaign's consent is open.
Unique: (campaign_id, student_id).

#### `vaccinations` · org +cap(health) +family

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| vaccine | text | required |
| dose_no | int | default 1 |
| given_on | date | required; not in the future |
| campaign_id | uuid → health_campaigns | optional |
| source | enum(school_campaign, family_record) | required |
| batch_no | text | optional |
| given_by | text | optional |
| next_due_on | date | optional |
| card_file_id | uuid → files | optional; a photo of the vaccination card |

Unique: (student_id, vaccine, dose_no).

#### `health_screenings` · branch +cap(health) +family

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| campaign_id | uuid → health_campaigns | optional |
| screened_on | date | required |
| height_cm | numeric(5,1) | optional; 50 to 220 |
| weight_kg | numeric(5,1) | optional; 8 to 200 |
| bmi | numeric(4,1) | generated from height and weight |
| vision_left | text | optional; "6/6" |
| vision_right | text | optional |
| hearing | enum(normal, refer) | optional |
| dental | enum(normal, refer) | optional |
| findings | text | optional |
| needs_referral | bool | default false |
| referral_note | text | optional; what the parent is asked to do |
| screened_by | text | optional |

Unique: (student_id, campaign_id) where a campaign is set.

#### `incident_reports` · branch +family
An accident or injury. Any staff member can file one, so it is not behind the capability; it holds what happened, not medical history.

| Column | Type | Rules |
|---|---|---|
| incident_no | text | required; from the `incident` sequence |
| student_id | uuid → students | optional |
| staff_id | uuid → staff | optional |
| occurred_at | timestamptz | required; not in the future |
| place | text | required |
| kind | enum(fall, sports_injury, cut_or_bruise, collision, fight, allergic_reaction, illness, other) | required |
| severity | enum(minor, moderate, serious) | required |
| description | text | required |
| first_aid | text | optional |
| witnesses | text | optional |
| reported_by | uuid → profiles | required |
| visit_id | uuid → clinic_visits | optional |
| guardian_informed_at | timestamptz | optional |
| guardian_summary | text | optional; what the family sees |
| follow_up | text | optional |
| status | enum(open, reviewed, closed) | default open |
| reviewed_by | uuid → profiles | optional |

Policy: a guardian may read `incident_no`, time, place, kind and `guardian_summary` of their own child's incidents.

## 4 · Contracts

`packages/contracts/src/modules/health/`: `health-profiles`, `clinic-visits`, `medication`, `health-campaigns`, `vaccinations`, `health-screenings`, `incident-reports`.

- `ClinicBoard`: who is in the sick room now, medicines due in the next hour, follow-ups due today.
- `StudentHealth` (nurse): profile, alert, visits, medicines, vaccinations, screenings with a growth chart, incidents.
- `ChildHealth` (family): the same without nurse-only notes and private assessments.
- `CampaignRoster`: students of the campaign's grades with consent, and whether they were vaccinated or screened.
- `HealthSummary` (leaders, counts only): visits by complaint and by class per week, incidents by place and kind, consent rates. No names.

Settings: `health.notify_on_visit` (`always` | `sent_home_only`, default always), `health.fever_threshold_c` (default 38.0), `health.profile_review_months` (default 12), `health.frequent_visit_count` (default 3 in 14 days).

## 5 · Rules

- **R-health-1** Health tables are readable only by staff with the `health` capability, the person the record is about, and a student's guardians. Leaders without the capability see counts only.
- **R-health-2** The one-line `medical_alert` on the student ([M07](m07-students.md)) is the only health information teachers, drivers and the canteen see. When the nurse saves a profile with a severe allergy or a listed condition and the alert is empty, she is prompted to write one.
- **R-health-3** A guardian can submit changes to the profile; they take effect when the nurse accepts them. They are stored as `profile_change_requests` ([M07](m07-students.md)) whose `changes` keys start with `health.` (`health.allergies`, `health.conditions`, `health.regular_medicines`, `health.dietary_needs`, `health.family_doctor_name`, `health.family_doctor_phone`, `health.emergency_consent`); only the nurse decides those, and other staff see that a request exists but not its content. Emergency consent is recorded only by a guardian in the app or from a signed paper form, never assumed.
- **R-health-4** A visit is opened when the person arrives and closed with an outcome. A temperature at or above `health.fever_threshold_c` highlights the visit and suggests sending the child home.
- **R-health-5** The guardian is told about a visit according to `health.notify_on_visit`, with the complaint and outcome in plain words and no clinical assessment.
- **R-health-6** Outcome `sent_home` creates a gate pass request of kind `medical` ([M09](m09-front-office.md)) with the nurse as requester; the child leaves only through that pass. Attendance for the rest of the day follows the gate pass.
- **R-health-7** Outcome `emergency` alerts the principal and the guardian at once, and shows the profile's consent, allergies and doctor on one screen for whoever accompanies the child.
- **R-health-8** No medicine is given to a student without either an active medication plan from the guardian, or emergency consent on the profile. Every dose is logged with the time and who gave it. A medicine the profile lists as an allergy is refused.
- **R-health-9** A medication plan requested by a guardian becomes active when the nurse accepts it. Doses due appear on the clinic board; a dose not logged 30 minutes after its time is flagged.
- **R-health-10** A campaign that requires consent cannot record a vaccination for a student whose consent is not `given`. A screening that only observes (height, weight, vision) follows the school's setting on the campaign.
- **R-health-11** A screening that needs referral sends the guardian the referral note and creates a follow-up for the nurse in 30 days.
- **R-health-12** A student with `health.frequent_visit_count` visits in 14 days is listed for the nurse and, as a count only, for the counsellor.
- **R-health-13** An incident report can be filed by any staff member. A `serious` one alerts the principal at once. The family sees only the summary written for them. Reports are reviewed by a leader before closing.
- **R-health-14** Medicine taken from clinic stock is issued through [M32](m32-inventory-assets.md) when an item is chosen on the log; stock below its reorder level appears on the board.
- **R-health-15** Health records are excluded from general search, exports and the AI assistant, and kept after the student leaves for the period in [10 · Security and privacy](../00-foundation/10-security-and-privacy.md).
- **R-health-16** Staff may visit the clinic; their visits are visible only to the nurse and themselves.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `health:read` | See health profiles, visits, vaccinations and screenings | nurse, principal |
| `clinic:manage` | Record visits, medicines, vaccinations and screenings; edit profiles; decide medication plans | nurse |
| `health-campaigns:manage` | Plan campaigns; record paper consents | nurse, branch_admin, vice_principal |
| `health-summary:read` | See health counts without names | LEADERS, counsellor |
| `incidents:create` | File an incident report | ALL_STAFF |
| `incidents:read` | See incident reports in scope | LEADERS, nurse, section_head, class_teacher |
| `incidents:review` | Review and close incident reports | LEADERS |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/clinic/board` | `clinic:manage` | The clinic board |
| GET | `/students/[id]/health` | `health:read` | A student's health record |
| PUT | `/students/[id]/health-profile` | `clinic:manage` | Saves the profile |
| GET | `/health-profiles/pending-changes` | `clinic:manage` | Changes guardians have submitted |
| POST | `/health-profiles/changes/[id]/decide` | `clinic:manage` | Accepts or declines |
| GET | `/clinic-visits` | `health:read` | Lists; filter by date, class, outcome |
| POST | `/clinic-visits` | `clinic:manage` | Opens a visit |
| GET | `/clinic-visits/[id]` | `health:read` | One visit |
| PATCH | `/clinic-visits/[id]` | `clinic:manage` | Updates |
| POST | `/clinic-visits/[id]/close` | `clinic:manage` | Closes with an outcome |
| GET | `/medication-plans` | `health:read` | Lists; requested first |
| POST | `/medication-plans` | `clinic:manage` | Creates on a guardian's behalf |
| POST | `/medication-plans/[id]/decide` | `clinic:manage` | Accepts or declines |
| POST | `/medication-log` | `clinic:manage` | Logs a dose |
| GET | `/medication-log` | `health:read` | Lists |
| GET | `/health-campaigns` | `health-campaigns:manage` | Lists |
| POST | `/health-campaigns` | `health-campaigns:manage` | Creates |
| PATCH | `/health-campaigns/[id]` | `health-campaigns:manage` | Edits; opens consent; completes |
| GET | `/health-campaigns/[id]/roster` | `health-campaigns:manage` | The roster with consent |
| PUT | `/health-campaigns/[id]/consents` | `health-campaigns:manage` | Records paper consents |
| PUT | `/health-campaigns/[id]/vaccinations` | `clinic:manage` | Records vaccinations for many students |
| PUT | `/health-campaigns/[id]/screenings` | `clinic:manage` | Records screenings for many students |
| POST | `/students/[id]/vaccinations` | `clinic:manage` | Adds one from a family record |
| GET | `/health/summary` | `health-summary:read` | Counts without names |
| GET | `/incident-reports` | `incidents:read` | Lists |
| POST | `/incident-reports` | `incidents:create` | Files one |
| GET | `/incident-reports/[id]` | `incidents:read` | One report |
| PATCH | `/incident-reports/[id]` | `incidents:create` | Edits one's own open report |
| POST | `/incident-reports/[id]/review` | `incidents:review` | Reviews and closes |
| GET | `/family/children/[id]/health` | `signed-in` | A child's health as the family sees it |
| POST | `/family/children/[id]/health/changes` | `signed-in` | Submits profile changes or emergency consent |
| POST | `/family/children/[id]/medication-plans` | `signed-in` | Asks the nurse to give a medicine |
| GET | `/family/health-consents` | `signed-in` | Campaigns waiting for a decision |
| PUT | `/family/health-consents/[id]` | `signed-in` | Gives or refuses consent |
| GET | `/me/health` | `signed-in` | A staff member's own clinic visits |

## 8 · Client layer

Custom hooks: `useClinicBoard` (refreshes every minute), `useStudentHealth`, `useSaveHealthProfile`, `useOpenVisit`, `useCloseVisit`, `useMedicationDue`, `useLogDose`, `useCampaignRoster`, `useRecordCampaign` (saves a class at a time), `useHealthSummary`, `useFileIncident`, `useChildHealth`, `useGiveConsent`.

## 9 · Screens

Built in [Phase 11](../20-phases/phase-11-front-office-and-operations.md) and [Phase 14](../20-phases/phase-14-family-portals.md).

| Screen | Pattern | Where |
|---|---|---|
| **Clinic** | Dashboard | `/school/clinic`: in the sick room now; medicines due; follow-ups; "New visit" by student search or card scan |
| Visit | Form in a sheet | The student's alert and allergies pinned at the top; complaint, temperature, treatment, outcome; a medicine is checked against allergies as it is typed |
| Student health | Detail | Tabs: Profile, Visits, Medicines, Vaccinations, Screenings (growth chart), Incidents |
| Campaigns | List + Detail | Consent progress; a class-by-class entry grid |
| Health summary | Report | Counts by week, class and complaint; no names |
| Incidents | List + Form in a sheet | File from a phone in under a minute; review queue |
| **Parent:** Health | Detail | Profile with "Request a change"; visits; vaccinations; consent requests; ask the nurse to give a medicine |

## 10 · Notifications and jobs

Events: `clinic.visit` (to the guardian), `clinic.sent-home` (to the guardian and class teacher), `clinic.emergency` (urgent, to the guardian and principal), `medication.plan-requested` (to the nurse), `medication.plan-decided`, `medication.dose-missed` (to the nurse), `campaign.consent-requested`, `campaign.consent-reminder`, `screening.referral`, `incident.serious` (urgent, to the principal), `incident.filed` (to the guardian, with the summary, once reviewed or at once when minor), `health.profile-review-due`.

Jobs: `health.dose-check` (every 10 minutes in school hours), `health.consent-reminders` (daily), `health.profile-reviews` (monthly), `health.follow-ups` (daily 08:00).

Documents: sick-room slip for the parent, incident report, vaccination record, screening result letter, consent form (to print for families without the app).

## 11 · Offline

None. The clinic needs a connection; the medical alert on the student summary is available offline in the teacher's app.

## 12 · AI

None. Health records are never sent to a model, and the assistant has no tool that reads them.

## 13 · Failure cases

- **F-health-1** The nurse logs paracetamol for a child whose profile lists a paracetamol allergy → refused with the allergy shown.
- **F-health-2** A child needs a medicine and has no plan and no emergency consent → the dose cannot be logged; the screen offers "Call the guardian" with the numbers.
- **F-health-3** A child is sent home but nobody comes → the gate pass stays `approved`, the visit stays open, and at the end of the day both are listed for the nurse and the class teacher.
- **F-health-4** Consent closes with 40 undecided → those students are listed as "no consent" and are skipped; the parents were reminded twice.
- **F-health-5** A guardian refuses consent, then changes their mind on the day → staff record a signed paper form; the decision and who recorded it are kept.
- **F-health-6** A teacher opens a student's health tab → the tab is absent; a direct request returns `NOT_FOUND`.
- **F-health-7** An incident is filed for the wrong student → the reporter corrects it while it is open; after review it needs a leader, and the change is audited.
- **F-health-8** Height is typed as 1400 cm → refused by range.
- **F-health-9** The nurse is absent → a staff member given `clinic:manage` for the day can record visits; they still cannot see other students' history without `health:read`.

## 14 · Seed data

Health profiles for every student: about 12% with an allergy or condition and a matching medical alert, emergency consent given by 80%. Two months of clinic visits (4 to 10 a day at a large branch) with every outcome, including two emergencies. Six medication plans. Last year's vaccination and screening campaigns with results and referrals, and one campaign with consent open. Twenty-five incident reports across kinds and severities.

## 15 · Tests

- **T-health-1** A staff user without the `health` capability reads no row of the capability tables by direct query; a nurse does; a guardian reads only their child's.
- **T-health-2** The family view never contains the nurse's note or a private assessment.
- **T-health-3** A dose needs a plan or consent; an allergy blocks it.
- **T-health-4** `sent_home` creates a medical gate pass; attendance follows it.
- **T-health-5** Emergency alerts go to the principal and guardian.
- **T-health-6** Vaccination refused without consent; paper consent recorded by staff.
- **T-health-7** Guardian profile changes wait for the nurse.
- **T-health-8** Frequent-visit list and the count-only view.
- **T-health-9** Incident visibility: reporter, leaders, family summary only.
- **T-health-10** Health data is absent from search, exports and the assistant's tools.
- **T-health-11** Row-level security and branch scope.

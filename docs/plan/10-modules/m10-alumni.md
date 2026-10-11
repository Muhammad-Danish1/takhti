# M10 · Alumni

## 1 · Purpose

A light directory of students who completed Grade 10: where they went next and how to reach them, so the school can invite them to events, show its results over the years, and answer verification requests. Optional module.

## 2 · Depends on

[M07](m07-students.md), [M18](m18-results-report-cards.md) (board results), [M37](m37-messaging-hub.md), [M39](m39-notices-events-calendar.md).

## 3 · Tables

#### `alumni` · org

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required; unique |
| branch_id | uuid → branches | required; the branch they graduated from |
| graduation_year | int | required |
| last_grade_id | uuid → grades | required |
| board_result_summary | text | optional; "SSC 1,045/1,200, A+" |
| current_status | enum(studying, working, both, other, unknown) | default unknown |
| institution | text | optional; college or university |
| field_of_study | text | optional |
| occupation | text | optional |
| city | text | optional |
| phone | text | optional |
| email | text | optional |
| consent_to_contact | enum(not_asked, yes, no) | default not_asked |
| consent_to_showcase | bool | default false; name and achievement may appear on the school website |
| achievements | text | optional |
| notes | text | optional |

Unique: (org_id, student_id) among live rows.
Index: (org_id, graduation_year).

#### `alumni_updates` · org append-only
A history of what an alumnus told the school, and when.

| Column | Type | Rules |
|---|---|---|
| alumni_id | uuid → alumni | required |
| changes | jsonb | required |
| source | enum(staff, form) | required |

## 4 · Contracts

`packages/contracts/src/modules/alumni/`: `alumni`, `public-alumni-update`.

- `ListAlumni` filters: `graduationYear`, `branchId`, `currentStatus`, `consentToContact`, `city`.
- `PublicAlumniUpdate`: `{ token, currentStatus?, institution?, fieldOfStudy?, occupation?, city?, phone?, email?, consentToContact, consentToShowcase }`.

## 5 · Rules

- **R-alumni-1** An alumni record is created automatically when a student's status becomes `graduated`, copying the contact details the school holds and setting consent to `not_asked`.
- **R-alumni-2** A message or invitation is sent only to alumni whose consent is `yes`.
- **R-alumni-3** Once a year an alumnus with a phone number may be sent one "keep in touch" message with a personal link to update their details and consent. A `no` is final until they change it themselves.
- **R-alumni-4** The update link is single use, valid 30 days, and edits only the alumnus's own record.
- **R-alumni-5** A name or achievement appears on the school website only with `consent_to_showcase`.
- **R-alumni-6** Deleting a student is never allowed while an alumni record exists.
- **R-alumni-7** An alumnus may ask for their contact details to be removed; the record keeps the academic facts and clears phone, email, institution and occupation.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `alumni:read` | See the alumni directory | LEADERS, admissions_officer, counsellor |
| `alumni:update` | Edit alumni records; send the yearly update link | ADMINS, admissions_officer, counsellor |
| `alumni:export` | Export the directory | ADMINS |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/alumni` | `alumni:read` | Lists with filters |
| GET | `/alumni/stats` | `alumni:read` | Counts by year and by current status |
| GET | `/alumni/export` | `alumni:export` | Exports |
| GET | `/alumni/[id]` | `alumni:read` | One record with its update history |
| PATCH | `/alumni/[id]` | `alumni:update` | Edits |
| POST | `/alumni/[id]/clear-contact` | `alumni:update` | Removes contact details on request |
| POST | `/alumni/send-update-links` | `alumni:update` | Sends the yearly link to a filtered set |
| GET | `/public/alumni-update/[token]` | `public` | The alumnus's current details for the form |
| POST | `/public/alumni-update` | `public` | Saves the alumnus's update |

## 8 · Client layer

Generated list, detail and update for `alumni`. Custom hooks: `useAlumniStats`, `useSendUpdateLinks`, `usePublicAlumniForm`, `useSubmitAlumniUpdate`.

## 9 · Screens

Under `/school/alumni`. Built in [Phase 11](../20-phases/phase-11-front-office-and-operations.md).

| Screen | Pattern | Notes |
|---|---|---|
| Alumni | List | Filters by year and status; StatStrip by year |
| Alumnus | Detail | School record link, current details, consent, history |
| Send update links | Dialog form | Shows how many will receive it and how many are excluded by consent |
| **Public:** Update my details | Form page | `/alumni/[token]` |

## 10 · Notifications and jobs

Events: `alumni.created`, `alumni.update-requested`, `alumni.updated`.
Jobs: `alumni.send-update-links` (fan-out).

## 11 · Offline

None.

## 12 · AI

None.

## 13 · Failure cases

- **F-alumni-1** The phone number on file no longer belongs to the alumnus → the message invites the reader to ignore it; no personal detail is shown without the token.
- **F-alumni-2** The update link is opened twice → the second visit shows "already updated" with a way to ask the school for a new link.
- **F-alumni-3** A graduated student is re-admitted (repeating a year) → the alumni record is archived, not deleted, and restored at the next graduation.
- **F-alumni-4** The module is switched off → records are kept and no messages are sent.

## 14 · Seed data

180 alumni over three graduation years with a spread of statuses and consents; 20 with showcase consent.

## 15 · Tests

- **T-alumni-1** Graduation creates the record once.
- **T-alumni-2** Messages go only to `yes` consent.
- **T-alumni-3** Update link: single use, expiry, edits only its own record.
- **T-alumni-4** Clearing contact keeps academic facts.
- **T-alumni-5** Website showcase respects consent.
- **T-alumni-6** Row-level security.

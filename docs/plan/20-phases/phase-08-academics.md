# Phase 8 · Academics

**Goal.** The school's teaching year runs on screen: timetable, syllabus and lesson plans, daily attendance, diary and homework, learning resources and quizzes, exams from date sheet to locked marks, results and report cards, the question bank, and behaviour. This phase builds the **office side** in `/school`; the teacher's phone screens are [Phase 13](phase-13-teacher-portal.md) and the family's are [Phase 14](phase-14-family-portals.md).

**Depends on.** [Phase 7](phase-07-school-setup-and-people.md).

**Portal.** `/school`: the groups Academics and Exams, plus Behaviour under students.

**Modules.** [M12](../10-modules/m12-timetable.md), [M13](../10-modules/m13-syllabus-lesson-plans.md), [M14](../10-modules/m14-student-attendance.md), [M15](../10-modules/m15-homework-diary.md), [M16](../10-modules/m16-lms.md), [M17](../10-modules/m17-exams-marks.md), [M18](../10-modules/m18-results-report-cards.md), [M19](../10-modules/m19-question-bank-papers.md), [M20](../10-modules/m20-behaviour-houses.md).

## Read first

Sections 5, 9 and 13 of each module; [12 · Pakistan domain rules](../00-foundation/12-pakistan-domain-rules.md) ("Grading and passing"); the `GridEditor` and `CalendarView` in the gallery.

## Work packages

### 8.1 · Timetable — [M12](../10-modules/m12-timetable.md)

| Screen | Path | Pattern |
|---|---|---|
| Bell schedules | `/school/academics/timetable/bells` | List + Grid editor |
| Timetables | `/school/academics/timetable` | List |
| **Timetable editor** | `…/timetable/[id]` | Grid editor |
| Publish | on the editor | Dialog form |
| Today | `…/timetable/today` | Calendar (day) |
| Substitutions | `…/timetable/substitutions` | List |
| Teacher availability | `…/timetable/availability` | Grid editor |

The editor is the hardest screen of the phase. Sections down or one section at a time; days and lessons across; drag a subject from a tray that shows lessons still to place; every conflict from the spec shown as it happens, hard ones in red with words, soft ones as warnings; views by section, by teacher and by room; auto-fill for what is left (S6). Publishing is refused while a hard conflict remains.

### 8.2 · Syllabus and lesson plans — [M13](../10-modules/m13-syllabus-lesson-plans.md)

Syllabus (a tree editor), Scheme of work (weeks against units), Pace (dashboard), Coverage (list), Lesson plan review (list and detail), Submission status. Under `/school/academics/syllabus`.

### 8.3 · Attendance — [M14](../10-modules/m14-student-attendance.md)

| Screen | Path | Pattern |
|---|---|---|
| Attendance today | `/school/academics/attendance` | Dashboard |
| Not marked | `…/attendance/unmarked` | List |
| Mark attendance | `…/attendance/mark` | Grid editor |
| Absentees | `…/attendance/absentees` | List |
| Section month | `…/attendance/month` | Grid, read-only |
| Shortage | `…/attendance/shortage` | List |
| Leave requests; corrections | `…/attendance/leave`, `…/corrections` | List |
| Reports | `…/attendance/reports` | Report |
| Student attendance | a tab on the student | Detail tab |

### 8.4 · Diary, homework and learning — [M15](../10-modules/m15-homework-diary.md), [M16](../10-modules/m16-lms.md)

Diary overview and Homework overview under `/school/academics/diary`; the resource library, quiz list and quiz results under `/school/academics/learning`. These are oversight screens; teachers create the content in Phase 13.

### 8.5 · Exams and marks — [M17](../10-modules/m17-exams-marks.md)

| Screen | Path | Pattern |
|---|---|---|
| Exams | `/school/exams` | List |
| Exam (Overview, Date sheet, Seating, Invigilation, Eligibility, Marking, Result tabs) | `/school/exams/[id]` | Detail |
| **Date sheet planner** | the Date sheet tab | Grid editor |
| Marking progress | the Marking tab | Grid |
| Marks sheet (for the exam controller and coordinators) | `/school/exams/marks/[paperSectionId]` | Grid editor |
| Verify marks | the same sheet, read-only with outliers | Grid |
| Seating | the Seating tab | Grid editor |
| Eligibility | the Eligibility tab | List |
| Exam types | `/school/settings/results` | Settings |

The **marks sheet** component is shared with the teacher portal: roll order, Enter moves down, the maximum enforced as typed, status per row, autosave with a visible "saved" state, question columns when used.

### 8.6 · Results and report cards — [M18](../10-modules/m18-results-report-cards.md)

| Screen | Path | Pattern |
|---|---|---|
| Results | `/school/exams/results` | List |
| Result set | `/school/exams/results/[id]` | Wizard then Detail |
| Tabulation sheet | the Sheet tab | Grid |
| Result analysis | the Analysis tab | Report |
| Withheld | the Withheld tab | List |
| Report cards | the Report cards tab | List with progress |
| Report card templates | `/school/settings/results/templates` | List + Form page |
| Policies and co-scholastic areas | `/school/settings/results` | Settings |
| Board registrations | `/school/exams/board` | List |
| Student results | a tab on the student | Detail tab |

Report cards are generated as placeholder documents until [Phase 16](phase-16-documents-and-printing.md); the job, progress, retry and withheld behaviour are all real now.

### 8.7 · Question bank and papers — [M19](../10-modules/m19-question-bank-papers.md)

Question bank, question editor (with the equation and Urdu tools), review queue, coverage, blueprints, **paper builder**, paper preview, papers. Under `/school/exams/questions`. Confidential papers are invisible to everyone but their author, approver and the exam controller; a browser test tries to open one as another teacher.

### 8.8 · Behaviour and houses — [M20](../10-modules/m20-behaviour-houses.md)

Behaviour list, patterns, concerns, categories, houses (the house table as bars), counselling (visible only to those allowed), and the Behaviour tab on the student.

### 8.9 · Dashboard widgets and reports

Add to the dashboard: attendance today, sections not marked, substitutions needed, marks due, syllabus pace, behaviour this week. Register the academic reports in the library ([M42](../10-modules/m42-dashboards-reports.md)): attendance summaries and shortage; homework completion; marks and result sheets; teacher load; syllabus coverage.

## Journeys to automate

| Journey | Role | Steps |
|---|---|---|
| Build and publish a timetable | Coordinator | Bell schedule → place lessons for one grade → a teacher clash is shown and fixed → auto-fill the rest → publish → teachers and parents can see it |
| Cover an absent teacher | Coordinator | A teacher's leave is approved → substitutions needed appear → assign substitutes from suggestions → the substitute's Today shows the lesson |
| A day of attendance | Class teacher (office screen), principal | Mark a class → the dashboard updates → an absent child's guardian message is in `/dev/outbox` → a correction is requested next day and approved |
| Attendance on a holiday | Class teacher | Marking is refused with the holiday's name |
| Run an exam | Exam controller, teacher, section head | Create exam → generate papers → plan the date sheet (a clash is caught) → publish → generate seating → eligibility check blocks two students, one allowed → teacher enters marks → 85 out of 75 is refused → submit → verify (returned once, resubmitted) → lock |
| Results | Exam controller, class teacher, principal | Preview shows one unlocked paper → lock it → compute → remarks written → review → withhold one result for dues → publish → the guardian's view shows the result, the withheld one shows the note |
| Correction after publishing | Teacher, exam controller | Request a mark correction → approve → that student's result is revised, the card superseded, positions updated |
| A question paper | Teacher, academic head | Build from a blueprint → the check fails on totals → fix → submit → the author cannot approve → approve → print placeholder; another teacher cannot open it |
| Behaviour | Teacher, section head | Record "Fighting" → under review → confirm → guardian told → three negatives in two weeks raise a suggestion → open a concern → suspension needs the principal |

## Exit checks

1. Every screen meets "Done when".
2. All nine journeys pass in the browser.
3. The timetable editor stays responsive with 40 sections and 60 teachers; the marks sheet with 60 students and 10 question columns; the month grid with 60 students.
4. Result arithmetic shown on screen equals `compute.ts` for every seeded student (a test compares the tabulation sheet with the stored results).
5. A guardian's account sees nothing of an unpublished or withheld result on any of these screens' data routes.
6. `pnpm check`, `pnpm test:db`, `pnpm test:e2e`.

## Left for later, on purpose

- Teachers' own screens (marking attendance on a phone, diary, homework, lesson plans, marks): [Phase 13](phase-13-teacher-portal.md).
- Printed date sheets, admit cards, award lists, report cards and papers: [Phase 16](phase-16-documents-and-printing.md).
- AI drafts (lesson plans, papers, remarks): [Phase 19](phase-19-ai.md).

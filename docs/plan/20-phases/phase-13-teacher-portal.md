# Phase 13 · Teacher portal

**Goal.** A teacher does their whole day from a phone in the classroom: sees today's lessons, marks attendance in a few taps, writes the diary and homework, enters marks, records behaviour, plans lessons, messages parents, and looks after their own leave and salary.

**Depends on.** [Phase 8](phase-08-academics.md) and [Phase 12](phase-12-communication.md). The office side of everything here already exists.

**Portal.** `/teach`: phone first, a bottom bar of five, large touch targets. It must also be comfortable on a laptop in the staff room.

**Modules, teacher side.** [M07](../10-modules/m07-students.md), [M11](../10-modules/m11-academic-structure.md), [M12](../10-modules/m12-timetable.md), [M13](../10-modules/m13-syllabus-lesson-plans.md), [M14](../10-modules/m14-student-attendance.md), [M15](../10-modules/m15-homework-diary.md), [M16](../10-modules/m16-lms.md), [M17](../10-modules/m17-exams-marks.md), [M18](../10-modules/m18-results-report-cards.md), [M19](../10-modules/m19-question-bank-papers.md), [M20](../10-modules/m20-behaviour-houses.md), [M09](../10-modules/m09-front-office.md), [M38](../10-modules/m38-chat-ptm.md), [M39](../10-modules/m39-notices-events-calendar.md), [M36](../10-modules/m36-maintenance-helpdesk.md), [M27](../10-modules/m27-staff-attendance-leave.md), [M28](../10-modules/m28-payroll.md), [M29](../10-modules/m29-appraisal-training.md).

## Read first

The rows marked **Teacher:** in section 9 of each module above; [16](../00-foundation/16-frontend-architecture.md) ("Shells and their character"); [14 · Offline design](../00-foundation/14-offline-design.md), because every screen marked offline-capable there is built now through `useOfflineMutation` so that [Phase 17](phase-17-offline.md) changes no screen.

## Design rules for this portal

- **One hand, one thumb.** The main action of each screen is at the bottom. Rows are at least 48 px. Nothing important needs a long press or a hover.
- **Two taps to the day's most common task.** Open the app → Today → tap the current lesson → attendance is on screen.
- **Slow networks.** Every screen shows cached data first and refreshes behind it. A save shows "Saving… Saved" or "Not saved — retry" beside the thing saved, never only a toast.
- **A teacher sees only their own sections**, plus the whole class as class teacher. This is enforced by the services (`teacherSectionIds`); the screens simply never offer anything else.
- **Substitutes.** A teacher covering a lesson today gets that section for that lesson on Today, with attendance and diary enabled for it.

## Screens, in build order

| # | Screen | Path | Pattern | Module |
|---|---|---|---|---|
| 1 | **Today** | `/teach` | Dashboard | M12: today's lessons as cards in time order, the current one highlighted; each card opens attendance, diary and the lesson plan; substitutions; what is due (marks, plans, remarks); notices |
| 2 | **Mark attendance** | `/teach/attendance` | Grid editor, phone-first | M14: everyone present by default; tap to change; counts at the bottom; Submit; yesterday's absentees flagged |
| 3 | Timetable | `/teach/timetable` | Calendar (week) | M12 |
| 4 | **Classes** | `/teach/classes` | List | M07, M11: my sections; students with photo, roll number, medical alert; a student card with attendance, recent marks, behaviour and guardian contact through chat only |
| 5 | Quick behaviour record | a sheet from the class list | Form in a sheet | M20 |
| 6 | **Diary** | `/teach/diary` | Form page | M15: today's lessons as cards, a text box each, "Add homework" inside the card, one Publish |
| 7 | Homework; check homework | `/teach/homework` | List, Grid editor | M15 |
| 8 | **Marks**: marking queue | `/teach/marks` | List | M17 |
| 9 | **Marks sheet** | `/teach/marks/[paperSectionId]` | Grid editor | M17: the component built in Phase 8, in its phone layout: one student per row, a number pad, swipe or Enter to the next |
| 10 | Remarks | `/teach/remarks` | Grid editor | M18 |
| 11 | Lesson plans (week view); lesson plan | `/teach/plans` | Calendar (week), Form page | M13 |
| 12 | Coverage | `/teach/sections` | List | M13: tick topics taught |
| 13 | Resources | `/teach/resources` | List + Form page | M16 |
| 14 | Quiz builder; quiz results | `/teach/quizzes` | Wizard, Report | M16 |
| 15 | Question bank; paper builder; my papers | `/teach/questions` | List, Grid editor | M19 (best on a laptop; usable on a phone) |
| 16 | Invigilation | `/teach/invigilation` | List | M17 |
| 17 | **Messages**; class broadcast | `/teach/messages` | Chat | M38 |
| 18 | Parent–teacher meetings: my schedule, notes | `/teach/ptm` | List | M38 |
| 19 | Notices; calendar; events for my class | `/teach/notices`, `/teach/calendar` | List, Calendar | M39 |
| 20 | Passes and meetings | `/teach/more` | List | M09: approve gate passes for my class; my appointments |
| 21 | Student leave requests for my class | `/teach/attendance/leave` | List | M14 |
| 22 | Library: my class's books | `/teach/library` | List | M31 |
| 23 | Report a problem | `/teach/problems` | Form in a sheet | M36 |
| 24 | My leave, attendance, salary, growth, tax | `/teach/me/…` | as in `/school/me` | M27, M28, M29, M25: the same components as the staff self-service pages, in the phone shell |
| 25 | More | `/teach/more` | List | Everything not on the bottom bar, grouped |

## Work packages

- [ ] **13.1** The `/teach` shell: bottom bar, the More page, the top bar with notifications and the offline indicator; the laptop layout with a slim sidebar instead of the bottom bar.
- [ ] **13.2** Screens 1 to 5: the day and the class.
- [ ] **13.3** Screens 6 and 7: diary and homework.
- [ ] **13.4** Screens 8 to 10: marks and remarks.
- [ ] **13.5** Screens 11 to 16: planning, learning, papers, duties.
- [ ] **13.6** Screens 17 to 25: communication, requests and self-service.
- [ ] **13.7** Wrap every offline-capable write in `useOfflineMutation` (attendance, marks, diary, homework checking, behaviour, problem reports) and give each its "queued" state in the UI, even though the queue is not live until Phase 17.
- [ ] **13.8** Role matrix and browser tests for `class_teacher` and `subject_teacher`, at 360 px and at laptop width.

## Journeys to automate

| Journey | Steps |
|---|---|
| Morning | Sign in on a phone → Today → the first lesson → mark two absent, one late → Submit → the dashboard in `/school` shows the section marked |
| Not my class | A subject teacher cannot mark the daily register of a section they are not class teacher of; cannot open another section's student |
| Covering | A substitution assigned this morning appears on Today; attendance and diary work for that lesson only |
| Diary | Write three lesson entries and one piece of homework due on a holiday → warned, moved → Publish → the parent's diary shows them; the digest is in the outbox once |
| Marks | Open the queue → enter 30 marks with the number pad → one above the maximum is refused → close the tab mid-way → reopen: everything typed is there → Submit → locked for the teacher |
| Returned marks | The coordinator returns the sheet with a reason → the teacher sees it at the top of the queue |
| Behaviour | From the class list tick three students → "Helped a classmate" → saved in two taps |
| A lesson plan | Plan next week's lessons from the scheme → submit → approved by the coordinator |
| A quiz | Build a five-question quiz from the bank → preview as a student → publish |
| Chat | Reply to a parent; post to the class broadcast; a parent's private reply shows under the post |
| Leave | Ask for leave from the phone with the live quote → approved → Today for those dates shows "on leave" |
| Slow network | With the network throttled to slow 3G, Today opens from cache in under a second and attendance can be marked and saved |

## Exit checks

1. Every screen meets "Done when", checked at 360 px, 400 px and 1280 px.
2. All twelve journeys pass in the browser on a phone profile.
3. Marking attendance for a class of 40 with three exceptions takes under 20 seconds for a first-time tester, measured in a hallway test with two real teachers; their comments are recorded and the top three problems fixed.
4. On a mid-range Android profile with slow 3G, Today is usable in under 3 seconds on a repeat visit.
5. A teacher's account reaches no data outside their own sections on any route this portal calls.
6. `pnpm check`, `pnpm test:db`, `pnpm test:e2e`.

## Left for later, on purpose

- True offline use: [Phase 17](phase-17-offline.md).
- AI drafts for lesson plans, papers, remarks and marking: [Phase 19](phase-19-ai.md).
- The installable teacher app: [Phase 23](phase-23-mobile-apps.md).

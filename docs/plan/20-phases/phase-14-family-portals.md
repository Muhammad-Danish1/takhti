# Phase 14 · Parent and student portals

**Goal.** A parent with an ordinary phone and patchy internet can see how each of their children is doing, pay fees, read the diary, message a teacher and deal with the school's requests, in Urdu or English. A student can see their timetable, homework, results and study material.

**Depends on.** [Phase 12](phase-12-communication.md) and [Phase 9](phase-09-finance.md). The school side of everything here already exists.

**Portals.** `/family` and `/learn`. Phone first; both must be excellent at 360 px.

**Modules, family side.** Every module with a row marked **Parent:** or **Student:** in its section 9: [M07](../10-modules/m07-students.md), [M08](../10-modules/m08-certificates-id-cards.md), [M09](../10-modules/m09-front-office.md), [M12](../10-modules/m12-timetable.md), [M14](../10-modules/m14-student-attendance.md), [M15](../10-modules/m15-homework-diary.md), [M16](../10-modules/m16-lms.md), [M17](../10-modules/m17-exams-marks.md), [M18](../10-modules/m18-results-report-cards.md), [M20](../10-modules/m20-behaviour-houses.md), [M21](../10-modules/m21-fees.md), [M22](../10-modules/m22-online-payments-reconciliation.md), [M25](../10-modules/m25-tax-compliance.md), [M30](../10-modules/m30-transport.md), [M31](../10-modules/m31-library.md), [M33](../10-modules/m33-shop-canteen.md), [M34](../10-modules/m34-health-clinic.md), [M35](../10-modules/m35-hostel.md), [M38](../10-modules/m38-chat-ptm.md), [M39](../10-modules/m39-notices-events-calendar.md), [M40](../10-modules/m40-complaints-surveys.md).

## Read first

The family rows of each module's Screens, Rules and Failure cases; [12 · Pakistan domain rules](../00-foundation/12-pakistan-domain-rules.md) ("Language", "Connectivity and devices"); the family columns of the [navigation map](../30-reference/navigation.md).

## Design rules for these portals

- **Urdu is a first language here, not a translation.** Every screen is designed and reviewed in Urdu as well as English. Many parents will use only Urdu.
- **Plain words.** "Fees due", not "Outstanding receivables". No school jargon, no status codes.
- **The child first.** A switcher at the top shows each child's photo and class. "All children" is the default on Home and Fees; every other page is about one child.
- **Answers before navigation.** Home shows, for each child, today's attendance, anything due, anything new. Most visits should end on Home.
- **One clear action per card**: Pay, Acknowledge, Reply, Give consent.
- **Light pages.** Under 200 KB of script for the first page; images lazy; works on a slow connection; the last loaded data is always readable offline with "as of" times.
- **Nothing a parent should not see.** Staff notes, other families' data, teachers' phone numbers and unpublished results are not in any response these portals receive; the browser tests check responses, not only screens.
- **Students** get simpler, friendlier wording and no money screens except their own wallet.

## Parent screens, in build order

| # | Screen | Path | Pattern | Module |
|---|---|---|---|---|
| 1 | **Home** | `/family` | Dashboard | Per child: today's attendance, what is due (fees, homework, consent, acknowledgements), latest result, notices; requests waiting for the parent at the top |
| 2 | **Fees** | `/family/fees` | Dashboard | M21: total due with **Pay**; each child's vouchers; history; download challan and receipts; statement; upload proof of transfer |
| 3 | **Pay** | `/family/fees/pay` | Wizard | M22: amount (total prefilled, editable), method tiles, the provider's page or a 1BILL number with steps, a waiting screen that updates itself, the receipt |
| 4 | **Attendance** | `/family/attendance` | Calendar | M14: the month with colours and words; percentage; request leave |
| 5 | Leave request | `/family/leave` | Form page + List | M14 |
| 6 | **Results** | `/family/results` | List + Detail | M18: the card on screen, download, acknowledge; a withheld result shows why |
| 7 | Exams | `/family/exams` | Detail | M17: date sheet, syllabus notes, admit card |
| 8 | **Diary** | `/family/diary` | Dashboard | M15: the day as a page; "I have read this" |
| 9 | Homework | `/family/homework` | List + Detail | M15: due soon first; submit where allowed |
| 10 | Timetable | `/family/timetable` | Calendar (week) | M12 |
| 11 | Learning | `/family/learning` | List | M16 |
| 12 | Messages | `/family/messages` | Chat | M38: pick a child, then a teacher or the office |
| 13 | Notices; calendar | `/family/notices`, `/family/calendar` | List, Calendar | M39 |
| 14 | Events | `/family/events` | List + Detail | M39: register, consent, pay |
| 15 | Parent–teacher meetings | `/family/ptm` | Wizard | M38 |
| 16 | Early pickup; meet a teacher | `/family/pickup`, `/family/appointments` | Form page + List | M09 |
| 17 | Behaviour | `/family/behaviour` | List | M20 |
| 18 | Transport | `/family/transport` | Detail | M30: route, stop, today's trip, the bus on a map during a trip |
| 19 | Library | `/family/library` | List | M31 |
| 20 | Wallet | `/family/wallet` | Detail | M33: balance, top up, purchases, limits, blocked items, menu |
| 21 | Health | `/family/health` | Detail | M34: profile with "Request a change", visits, consents, medicine requests |
| 22 | Hostel | `/family/hostel` | Detail | M35 |
| 23 | Certificates | `/family/certificates` | List | M08: request and download |
| 24 | Raise a concern; my concerns | `/family/concerns` | Form page, List + Detail | M40 |
| 25 | Surveys | `/family/surveys` | Wizard | M40 |
| 26 | Family profile | `/family/profile` | Detail | M07: details with "Request a change"; guardians; who receives messages |
| 27 | My tax | `/family/tax` | Detail | M25 |
| 28 | More | `/family/more` | List | Only the items that apply to this family |

## Student screens, in build order

| # | Screen | Path | Pattern | Module |
|---|---|---|---|---|
| 1 | **Home** | `/learn` | Dashboard | Today's lessons, homework due, quizzes open, latest marks, notices |
| 2 | Timetable | `/learn/timetable` | Calendar (week) | M12 |
| 3 | Homework | `/learn/homework` | List + Detail | M15 |
| 4 | Results | `/learn/results` | List + Detail | M18, with a subject trend chart |
| 5 | Subjects and resources | `/learn/resources` | Dashboard | M16 |
| 6 | **Take a quiz**; quiz result | `/learn/quizzes` | Wizard, Detail | M16: one question per screen, a clock from the server's deadline, a question palette, an autosave mark, confirm before submit |
| 7 | Diary; attendance; exams | `/learn/diary`, `/learn/attendance`, `/learn/exams` | as for parents, read-only | M15, M14, M17 |
| 8 | Library; wallet | `/learn/library`, `/learn/wallet` | List, Detail | M31, M33 |
| 9 | Notices and calendar; surveys | `/learn/notices`, `/learn/surveys` | List, Wizard | M39, M40 |
| 10 | Profile | `/learn/profile` | Detail | M07 |

## Work packages

- [ ] **14.1** The two shells: bottom bars, the child switcher (remembered), More built from what applies, language switch on first use.
- [ ] **14.2** Parent screens 1 to 7: Home, fees and paying, attendance, results.
- [ ] **14.3** Parent screens 8 to 16: daily school life and communication.
- [ ] **14.4** Parent screens 17 to 28: services, requests and profile.
- [ ] **14.5** Student screens.
- [ ] **14.6** A response audit: a test signs in as a guardian and as a student, calls every route these portals use, and checks each response against a list of fields that must never appear (staff notes, internal comments, other students' ids, phone numbers of staff, risk scores, unpublished or withheld marks).
- [ ] **14.7** Urdu review of both portals by a native reader, screen by screen, on a phone.
- [ ] **14.8** Role matrix and browser tests for `guardian` and `student`.

## Journeys to automate

| Journey | Steps |
|---|---|
| First visit | A guardian accepts an invitation by phone code → chooses Urdu → confirms their two children → Home shows both |
| Pay fees | Home shows Rs 17,000 due → Fees → Pay → pay Rs 10,000 by the fake provider → receipt → the balance is Rs 7,000; close the browser mid-payment and return: the payment is there |
| Bank transfer | Upload a screenshot as proof → "waiting for the school to check" → after verification the receipt appears |
| Absent today | The child is marked absent → the notification arrives → the attendance calendar shows it → the guardian requests leave for tomorrow |
| Diary | Read today's diary → acknowledge → homework due tomorrow is listed |
| Result day | A result is published → the card opens → download → acknowledge; the second child's result is withheld for dues with a link to Fees |
| Talk to the teacher | Message the class teacher; cannot find a teacher who does not teach the child |
| A trip | Register a child, give consent, pay the trip fee |
| Meeting | Book two teachers for the PTM; the second booking warns of a clash |
| Early pickup | Request a pass → the code appears when approved |
| Two schools | A guardian with children in two organisations switches between them |
| A custody case | A guardian marked as having no custody for one child sees nothing of that child |
| Offline | Open the portal, go offline, reopen: Home, fees and the diary are readable with "as of" times; Pay says a connection is needed |
| A student's day | A student signs in with a PIN → sees today → submits homework → takes a timed quiz; refresh mid-quiz resumes with the same clock; the answer key is not in any response before it is allowed |

## Exit checks

1. Every screen meets "Done when" at 360 px and 400 px, in English and Urdu.
2. All fourteen journeys pass in the browser on a phone profile.
3. The response audit (14.6) passes for every route.
4. The Urdu review is done and its findings fixed; the reviewer and date are recorded.
5. A hallway test with three parents (at least one using Urdu only, one on a low-cost Android phone): each can find what is due and what their child did today without help. The top problems are fixed.
6. First load of `/family` on a mid-range phone profile with slow 3G is under 4 seconds; a repeat visit under 2.
7. `pnpm check`, `pnpm test:db`, `pnpm test:e2e`.

## Left for later, on purpose

- Real payment providers: [Phase 18](phase-18-integrations.md).
- The WhatsApp chatbot and study help: [Phase 19](phase-19-ai.md).
- The installable parent and student apps with push notifications: [Phase 23](phase-23-mobile-apps.md).

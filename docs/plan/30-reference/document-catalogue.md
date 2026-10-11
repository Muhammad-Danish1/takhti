# Document catalogue

Every document the product prints or produces as a PDF. This is the backlog of [Phase 16](../20-phases/phase-16-documents-and-printing.md); how a document is made is in [13](../00-foundation/13-notifications-jobs-and-files.md), section 4.

**Kind** is the key passed to `requestDocument(ctx, kind, params)` and the folder name under `apps/web/app/print/`. **Lang** is the languages it can be issued in. **Verify** means it carries a number and a QR code that opens the public verification page. **Batch** means it is commonly printed for many people at once.

Paper: A4 portrait unless stated. `A4-L` is landscape. `CR80` is the ID card size, 85.6 × 54 mm. `T80` is an 80 mm thermal roll.

## Rules shared by all

Letterhead from the school's settings; the document's own number and date; who issued it; page numbers when it can run over; black on white first; square corners; amounts and numbers in a monospaced face; a reprint marked "Duplicate". Details in [Phase 16](../20-phases/phase-16-documents-and-printing.md).

## Fees and finance

| Document | Kind | Module | Paper | Lang | Verify | Batch |
|---|---|---|---|---|---|---|
| Three-copy fee challan (bank, school, parent) | `fee-challan` | M21 | A4-L, three panels with cut lines | en, ur, both | — | Yes |
| Family challan | `fee-challan-family` | M21 | A4-L | en, ur, both | — | Yes |
| Fee receipt | `fee-receipt` | M21 | A5 or T80 | en, ur, both | Yes | — |
| Family statement | `fee-statement` | M21 | A4 | en, ur | — | — |
| Defaulter notice | `fee-defaulter-notice` | M21 | A4 or A5 | en, ur, both | — | Yes |
| Fee-paid certificate | `fee-paid-certificate` | M21 | A4 | en | Yes | — |
| Refund voucher | `fee-refund-voucher` | M21 | A5 | en | — | — |
| Cash session summary | `cash-session-summary` | M21 | A4 | en | — | — |
| Fee reports (register, aging, collection) | through the report view | M21 | A4 or A4-L | en | — | — |
| Bank reconciliation statement | `bank-reconciliation` | M22 | A4 | en | — | — |
| Journal voucher | `journal-voucher` | M23 | A5 | en | — | — |
| Trial balance, income statement, balance sheet, ledger, cash book, bank book | through the report view | M23 | A4 or A4-L | en | — | — |
| Expense voucher, payment voucher | `expense-voucher`, `payment-voucher` | M24 | A5 | en | — | — |
| Purchase order | `purchase-order` | M24 | A4 | en | — | — |
| Goods received note | `goods-received-note` | M24 | A4 | en | — | — |
| Comparative statement of quotes | `quotes-comparison` | M24 | A4-L | en | — | — |
| Vendor statement | `vendor-statement` | M24 | A4 | en | — | — |
| Withholding certificate (salary, fees, vendor) | `tax-certificate` | M25 | A4 | en | Yes | Yes |
| Tax and contribution schedules | through the report view | M25 | A4-L | en | — | — |

## Admissions, students, certificates

| Document | Kind | Module | Paper | Lang | Verify | Batch |
|---|---|---|---|---|---|---|
| Admission form (blank and filled) | `admission-form` | M06 | A4 | en, ur, both | — | — |
| Offer letter | `admission-offer` | M06 | A4 | en, ur | — | — |
| Student profile sheet | `student-profile` | M07 | A4 | en | — | — |
| Class list | `class-list` | M07 | A4 | en, ur | — | Yes |
| Leaving certificate | `certificate-leaving` | M08 | A4 | en, ur, both | Yes | — |
| Character certificate | `certificate-character` | M08 | A4 | en, ur, both | Yes | — |
| Bonafide certificate | `certificate-bonafide` | M08 | A4 | en, ur | Yes | — |
| Provisional certificate | `certificate-provisional` | M08 | A4 | en | Yes | — |
| Fee clearance certificate | `certificate-fee-clearance` | M08 | A4 | en | Yes | — |
| Date of birth certificate | `certificate-date-of-birth` | M08 | A4 | en, ur | Yes | — |
| Merit certificate | `certificate-merit` | M08 | A4-L | en, ur, both | Yes | Yes |
| Experience letter (staff) | `certificate-experience` | M08 | A4 | en | Yes | — |
| Student ID card, front and back | `id-card-student` | M08 | CR80; eight to an A4 sheet, or one per card | en, ur, both | Yes | Yes |
| Staff ID card | `id-card-staff` | M08 | CR80 | en, ur, both | Yes | Yes |
| Gate pass | `gate-pass` | M09 | A6 or T80 | en, ur | — | — |
| Visitor slip | `visitor-slip` | M09 | T80 | en | — | — |

## Academics and exams

| Document | Kind | Module | Paper | Lang | Verify | Batch |
|---|---|---|---|---|---|---|
| Timetable (section, teacher, room) | `timetable` | M12 | A4-L | en, ur | — | Yes |
| Scheme of work | `scheme-of-work` | M13 | A4-L | en, ur | — | — |
| Lesson plan | `lesson-plan` | M13 | A4 | en, ur, both | — | — |
| Attendance register (month) | `attendance-register` | M14 | A4-L | en | — | Yes |
| Shortage notice | `attendance-shortage-notice` | M14 | A5 | en, ur, both | — | Yes |
| Date sheet | `exam-datesheet` | M17 | A4 | en, ur, both | — | Yes |
| Admit card | `exam-admit-card` | M17 | Four to an A4 sheet | en, ur | — | Yes |
| Seating chart per room; attendance sheet per room | `exam-seating`, `exam-room-attendance` | M17 | A4 | en | — | Yes |
| Award list (blank and filled) | `exam-award-list` | M17 | A4 | en | — | Yes |
| Invigilation roster | `exam-invigilation` | M17 | A4-L | en | — | — |
| Tabulation sheet | `result-tabulation` | M18 | A4-L or A3-L | en | — | Yes |
| **Report card**: standard, compact, primary descriptive, board style, cumulative | `report-card` with a `layout` | M18 | A4 | en, ur, both | Yes | Yes |
| Result analysis | `result-analysis` | M18 | A4 | en | — | — |
| Board registration list | `board-registration-list` | M18 | A4-L | en | — | — |
| Question paper (one or two columns) | `question-paper` | M19 | A4 | en, ur, both | — | — |
| Answer key; marking scheme | `question-paper-key` | M19 | A4 | en, ur | — | — |
| Behaviour letter to parents | `behaviour-letter` | M20 | A4 | en, ur, both | — | — |

## Staff and payroll

| Document | Kind | Module | Paper | Lang | Verify | Batch |
|---|---|---|---|---|---|---|
| Appointment letter, contract | `staff-appointment`, `staff-contract` | M26 | A4 | en | — | — |
| Confirmation letter, transfer order | `staff-confirmation`, `staff-transfer-order` | M26 | A4 | en | — | — |
| Relieving letter | `staff-relieving` | M26 | A4 | en | Yes | — |
| Staff list | `staff-list` | M26 | A4-L | en | — | — |
| Staff attendance register (month) | `staff-attendance-register` | M27 | A4-L | en | — | — |
| Leave application form; leave balance statement | `leave-form`, `leave-balance` | M27 | A4 | en, ur | — | — |
| **Payslip** | `payslip` | M28 | A4 or A5 | en, ur, both | — | Yes |
| Salary register | `salary-register` | M28 | A4-L | en | — | — |
| Bank advice letter | `salary-bank-advice` | M28 | A4 | en | — | — |
| Cash salary sheet with signature column | `salary-cash-sheet` | M28 | A4-L | en | — | — |
| Salary certificate | `salary-certificate` | M28 | A4 | en | Yes | — |
| Loan agreement | `staff-loan-agreement` | M28 | A4 | en, ur | — | — |
| Final settlement statement | `final-settlement` | M28 | A4 | en | — | — |
| Appraisal form (completed); observation report | `appraisal-form`, `observation-report` | M29 | A4 | en | — | — |
| Training certificate; training record | `training-certificate`, `training-record` | M29 | A4-L, A4 | en | — | Yes |

## Operations

| Document | Kind | Module | Paper | Lang | Verify | Batch |
|---|---|---|---|---|---|---|
| Route sheet with riders; vehicle rider list | `transport-route-sheet` | M30 | A4 | en, ur | — | Yes |
| Transport tag | `transport-tag` | M30 | CR80 | en | — | Yes |
| Fleet cost report | through the report view | M30 | A4-L | en | — | — |
| Barcode and spine labels | `library-labels` | M31 | Label sheet | — | — | Yes |
| Library card | `library-card` | M31 | CR80 | en | — | Yes |
| Overdue notice | `library-overdue-notice` | M31 | A5 | en, ur, both | — | Yes |
| Stock check report; accession register | `library-stock-check`, `library-accession-register` | M31 | A4-L | en | — | — |
| Stock issue note; transfer note | `stock-issue-note`, `stock-transfer-note` | M32 | A5 | en | — | — |
| Stock count sheet; stock valuation | `stock-count-sheet`, through the report view | M32 | A4 | en | — | — |
| Asset tags (QR) | `asset-tags` | M32 | Label sheet | — | — | Yes |
| Asset register; custodian handover form | `asset-register`, `asset-handover` | M32 | A4-L, A4 | en | — | — |
| Sale receipt; return note | `shop-receipt`, `shop-return-note` | M33 | T80 or A5 | en, ur | — | — |
| Shop session summary; wallet statement | `shop-session-summary`, `wallet-statement` | M33 | A4 | en | — | — |
| Sick-room slip for the parent | `clinic-slip` | M34 | A5 | en, ur, both | — | — |
| Incident report | `incident-report` | M34 | A4 | en | — | — |
| Vaccination record; screening result letter | `vaccination-record`, `screening-letter` | M34 | A4 | en, ur, both | — | Yes |
| Health consent form (for families without the app) | `health-consent-form` | M34 | A4 | en, ur, both | — | Yes |
| Hostel admission form; room list; roll-call sheet | `hostel-admission-form`, `hostel-room-list`, `hostel-roll-call` | M35 | A4 | en | — | — |
| Hostel leave pass; boarder tag | `hostel-leave-pass`, `boarder-tag` | M35 | A6, CR80 | en, ur | — | — |
| Job card for a vendor; monthly maintenance report | `maintenance-job-card`, through the report view | M36 | A5, A4 | en | — | — |

## Communication and head office

| Document | Kind | Module | Paper | Lang | Verify | Batch |
|---|---|---|---|---|---|---|
| Notice as a circular | `notice-circular` | M39 | A4 or A5 | en, ur, both | — | — |
| Event roster; trip sheet | `event-roster`, `trip-sheet` | M39 | A4 | en | — | — |
| Event consent form | `event-consent-form` | M39 | A4 | en, ur, both | — | Yes |
| Parent–teacher meeting schedule; appointment slip; summary | `ptm-schedule`, `ptm-slip`, `ptm-summary` | M38 | A4, A6, A4 | en, ur | — | Yes |
| Complaint record | `complaint-record` | M40 | A4 | en | — | — |
| Survey results | through the report view | M40 | A4 | en | — | — |
| Branch scorecard; branch comparison; weekly digest | `branch-scorecard`, `branch-comparison`, `weekly-digest` | M43 | A4, A4-L, A4 | en | — | — |
| Any report in the library | through the report view | M42 | A4 or A4-L by its definition | en | — | — |

## Layout variants a school can choose

| Document | Variants |
|---|---|
| Fee challan | Three panels across a landscape page (default); three stacked on a portrait page; with or without the fee structure breakdown; with or without previous balance shown separately |
| Receipt | A5 with letterhead; half-A5; 80 mm thermal |
| Report card | The five layouts, each with options: positions, attendance, co-scholastic areas, a subject bar chart, earlier terms, the grading key, signature labels |
| Certificates | A formal bordered layout and a plain letter layout for each type |
| ID card | Portrait or landscape; photo left or top; with or without a barcode; the back with emergency contact and the school's address |
| Payslip | Full A4; half-page (two to a sheet) |

## What every document needs before it is called done

- It renders from seeded data and matches its stored reference image.
- It has been printed on paper and checked by a person.
- It is correct in each language it offers, including right-to-left layout for Urdu.
- A long version breaks across pages sensibly.
- Its batch, where it has one, reports progress and names any failure.
- It appears from the screen's Print button with no placeholder.

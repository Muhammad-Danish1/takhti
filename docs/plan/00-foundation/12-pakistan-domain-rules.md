# 12 · Pakistan domain rules

How schools in Pakistan actually work, as far as it shapes the software. Anything a government body can change is **data with an effective date**, never code.

Facts marked **(verified)** were checked against a source on 9–10 Oct 2026. Facts marked **(confirm)** must be confirmed with the named authority or the school's adviser before the values are seeded for production.

## School structure

| Stage | Grades | Notes |
|---|---|---|
| Primary | 1 to 5 | One class teacher often teaches most subjects |
| Middle | 6 to 8 | Subject teachers |
| Secondary (Matric) | 9 and 10 | Board examinations: SSC Part I at the end of Grade 9, Part II at the end of Grade 10 |

- A **class** is a grade plus a section: "8-B". Sections may be separated by gender, shift or medium of instruction.
- Many groups run separate boys' and girls' campuses or wings. A section carries a gender setting (`boys`, `girls`, `mixed`).
- **Shifts** (morning, afternoon) are common in crowded campuses. A section belongs to one shift.

## Academic calendar

- The academic year usually starts in **April** in Punjab, Khyber Pakhtunkhwa and federal schools, and in **August** for some Sindh and Cambridge-pattern schools. It is a setting per school group.
- A year has two or three **terms**, plus monthly tests in most schools.
- **Summer vacation** runs roughly June to mid-August. Fees are still charged, usually as one voucher covering the vacation months, so a voucher can span more than one month.
- The **working week** is Monday to Friday or Monday to Saturday. Friday is often a short day. It is a setting per branch.
- **Timings change with the season**: summer, winter and Ramadan each have their own bell schedule with start and end dates.
- **Holidays**: gazetted public holidays plus local ones. Eid dates depend on moon sighting and are announced late, so a holiday can be marked *tentative* and moved.

## Boards and curriculum

- Grades 9 and 10 register with an examination board: a provincial BISE (nine in Punjab alone), the Federal Board (FBISE), or the Aga Khan University Examination Board. The catalogue of boards is seeded as data.
- Board registration happens in Grade 9. The school holds each student's board registration number, and later the board roll number for each part.
- **Punjab, Grades 5 and 8**: board-style examinations are run by PECTAA, the authority formed in 2025 from the Punjab Examination Commission, the textbook board and the teacher-training academy. Schools register candidates through PECTAA's portal. Grades 1 to 8 otherwise follow school-based assessment. **(verified)**
- Compulsory subjects through Grade 10 include English, Urdu, Mathematics, Islamiyat and Pakistan Studies. Non-Muslim students take **Ethics** in place of Islamiyat, so a subject can have an alternative per student.
- Quran teaching (Nazra in the primary years, translation later) is compulsory in most provinces and is tracked as a subject with its own progress record.
- Grades 9 and 10 choose a **group**: Science with Biology, Science with Computer Science, or Humanities. Science subjects have a theory paper and a practical.
- Textbooks come from the provincial textbook boards. Syllabus content is organised by unit, chapter and student learning outcome (SLO).

## Grading and passing

**The national scale from 2026 (verified).** The Inter Boards Coordination Commission requires every board to use a 10-point scale from the first annual examination of 2026, introduced in phases. Result slips carry grades and grade points. The pass mark is 40%, raised from 33%.

| Grade | Marks | Description |
|---|---|---|
| A++ | 96–100% | Extraordinary |
| A+ | 91–95% | Exceptional |
| A | 86–90% | Outstanding |
| B++ | 81–85% | Excellent |
| B+ | 76–80% | Very good |
| B | 71–75% | Good |
| C+ | 61–70% | Fairly good |
| C | 51–60% | Above average |
| D | 40–50% | Emerging |
| U | below 40% | Unsatisfactory |

What this means for the software:

1. A **grading scheme** is data: bands, pass percentage, grade points, and the date from which it applies. A school can hold several (one for Grades 1 to 5, one for the board classes).
2. The old seven-grade scale (A-1 to F, pass 33%) is also seeded, because past results must print as they were issued.
3. A published result **freezes** the scheme it was graded with.
4. Bands are matched on their lower bound, highest first, because real percentages are fractional (79.4%).
5. Pass rules are settings: pass in every subject, pass in theory and practical separately, minimum aggregate, grace marks.
6. Grade points per band are entered per board **(confirm with the board's notification)**.

Positions (1st, 2nd, 3rd in class) are still printed by most schools. Ties share a position.

## Identity

| Item | Format | Notes |
|---|---|---|
| CNIC (adult) | `12345-1234567-1` | 13 digits |
| B-Form / child registration number | Same 13-digit pattern | Asked for at admission; boards require it for registration |
| Mobile number | `03XX XXXXXXX`, stored as `+923XXXXXXXXX` | Almost every parent has one; many do not have email |
| Name | Given name plus father's name is how a child is identified | `father_name` is a first-class field, printed on every document |

Duplicates are detected by B-Form number first, then by name, father's name and date of birth together.

## Fees

How fee collection really works, and what the software must therefore do:

1. **Monthly vouchers.** Issued on a set day (commonly the 1st), due on another (commonly the 10th).
2. **Fee heads.** Admission fee and security deposit once; tuition monthly; annual charges yearly; examination, computer, laboratory, transport and hostel charges as they apply; fines and miscellaneous items.
3. **The three-copy challan.** Bank copy, school copy, parent copy on one sheet. This is the document banks accept. **(verified as market expectation)**
4. **Arrears carry forward** onto the next voucher automatically.
5. **Late fine**: a fixed amount, a daily amount or a percentage, after the due date, with an optional cap.
6. **Discounts**: sibling (second and third child), staff child, merit, need-based, orphan. Each needs approval and an end date.
7. **Family billing.** Many schools want one voucher for all of a family's children. Billing by student or by family is a setting.
8. **Part payment and advance payment** are normal. An overpayment becomes credit for the family.
9. **Channels**: cash at the school counter, deposit at the school's bank with the challan, 1BILL through any banking app, JazzCash, Easypaisa, and direct bank transfer.
10. **Proof of transfer.** A parent who pays by bank transfer sends a screenshot. The app lets them upload it against the voucher; the accountant verifies it and only then is the payment recorded.
11. **Security deposit** is refundable when the student leaves, after deducting dues.
12. **Leaving.** A leaving certificate is normally withheld until dues are cleared.
13. **Fee increases.** Provincial regulators cap the yearly increase (commonly 5%) **(confirm per province)**. When a new fee structure exceeds the configured cap against last year's, the system warns and requires a reason.

## Tax on fees

- Section 236I of the Income Tax Ordinance has required schools to collect advance income tax on fees above an annual threshold, with sources differing on whether it currently applies to all payers or only those not on the active taxpayer list. **(confirm with the school's tax adviser)**
- It is therefore a setting: on or off, annual threshold, rate, and whether it applies only when the guardian is not marked as a filer. When on, the tax is its own line on the voucher and its own ledger account, and a yearly certificate can be printed for the parent.
- The school's NTN is printed on receipts.

## Payroll

- Salaries are monthly. Common components: basic pay, house rent, medical, conveyance and utility allowances.
- Common deductions: income tax, EOBI, provincial social security, provident fund, loan and advance instalments, and unpaid absence.
- **Income tax** on salary follows slabs that change with each Finance Act. The tax year is 1 July to 30 June. Slabs are a table with an effective tax year. **(confirm each July)**
- **EOBI** and **provincial social security** contributions are based on the minimum wage and on rates that change. Both are tables with effective dates. **(confirm with EOBI and the provincial institution)**
- A teacher's own child often studies at a reduced fee. That is a fee discount of type *staff child*, linked to the staff record so it ends when the employment ends.
- Salaries are paid by bank transfer (a file in the bank's format) or in cash.

## Money and numbers

- Currency is the Pakistani rupee, written `Rs 8,500`. Paisa are stored but rarely shown.
- Large numbers can be abbreviated internationally (`Rs 9.84M`) or in lakh and crore (`Rs 98.4 lakh`). It is a display setting per user; the default is international.
- The fiscal year is commonly 1 July to 30 June. It is a setting.

## Language

- The interface is in English and Urdu. A user chooses their language.
- Urdu is written in **Nastaliq**. Readers find the Naskh style used for Arabic hard to read as Urdu. **(verified)**
- Nastaliq needs more vertical room: Urdu text is set larger with a line height of about 2.1.
- Urdu is right-to-left. Numbers, dates and codes inside Urdu text stay left-to-right.
- Report cards, notices, certificates and messages can be issued in English, Urdu or both.
- Many parents type Urdu in Roman letters. Search and the AI assistant accept Roman Urdu.

## Communication

- **WhatsApp is the main channel.** Parents read it; they often ignore SMS and do not have email.
- Sending through unofficial WhatsApp tools gets numbers banned. Only the official WhatsApp Business API is used. **(verified as market practice)**
- **SMS still matters** for parents without smartphones and for one-time codes. A branded sender name must be registered with the telecom regulator.
- Messages go out between 8 am and 9 pm unless marked urgent.

## Connectivity and devices

- Internet and power cuts are routine. Screens used at the classroom door and the fee counter must work offline ([14](14-offline-design.md)).
- Staff often use low-cost Android phones and older office PCs. Pages must be light and usable at 360px width.
- Almost all phones are Android.

## Regulators

A school holds a registration with its provincial private-schools regulator, and an affiliation with a board for Grades 9 and 10. Both numbers and their expiry dates are stored on the branch and can be printed on documents. Reminders are raised before they expire.

## What is deliberately configurable

| Setting | Level |
|---|---|
| Academic year start, terms, working week, bell schedules by season | Organisation, branch |
| Boards, grading schemes, pass rules, position rules | Organisation |
| Fee heads, voucher day, due day, late fine, discounts, billing by student or family | Organisation, with branch overrides |
| Advance tax on fees | Organisation |
| Salary components, tax slabs, EOBI and social security tables | Organisation |
| Fiscal year | Organisation |
| Number formats for admission, voucher, receipt and employee numbers | Organisation |
| Message channels and quiet hours | Organisation |
| Languages offered | Organisation |

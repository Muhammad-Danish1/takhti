# Glossary

Words used in this plan, in two groups: the school and money terms of Pakistan, and the technical terms of the project.

## School, money and law

| Term | Meaning |
|---|---|
| **Takhti** | The wooden slate children in Pakistan learn to write on. The product's name |
| **Branch, campus** | One school site of a school group. The plan says "branch" |
| **Wing** | A part of a branch with its own head: primary, middle, secondary; or boys' and girls' |
| **Class** | A grade plus a section: "8-B" |
| **Section** | One group of students within a grade, with a class teacher |
| **Shift** | Morning or afternoon session of a branch |
| **Matric, SSC** | The Secondary School Certificate. Part I is examined at the end of Grade 9, Part II at the end of Grade 10, by a board |
| **Board, BISE** | A Board of Intermediate and Secondary Education, which registers and examines Grades 9 and 10. There are several per province |
| **FBISE** | The Federal Board |
| **IBCC** | The Inter Boards Coordination Commission, which sets common rules such as the grading scale used from 2026 |
| **PECTAA** | The Punjab authority that runs the Grade 5 and Grade 8 examinations |
| **SLO** | Student learning outcome: what a pupil should be able to do after a topic. Syllabuses are organised by them |
| **Nazra** | Reading the Quran, taught in the primary years |
| **Islamiyat, Ethics** | Islamiyat is compulsory for Muslim students; non-Muslim students take Ethics in its place |
| **Hafiz** | A student who has memorised the Quran; some schools give a fee concession |
| **Date sheet** | The examination timetable |
| **Admit card, roll number slip** | The slip a student brings to an examination, with roll number, seat and date sheet |
| **Award list** | The sheet on which a teacher records marks for one paper and section |
| **Tabulation sheet** | The class result as a grid: students down, subjects across |
| **Diary** | The daily record of classwork and homework that goes home with a child |
| **PTM** | Parent–teacher meeting |
| **Leaving certificate** | The School Leaving Certificate a student needs to join another school |
| **Bonafide certificate** | A letter confirming someone is a student of the school |
| **B-Form** | The child registration certificate issued by NADRA, with a 13-digit number |
| **CNIC** | The Computerised National Identity Card of an adult, with a 13-digit number |
| **NADRA** | The national identity authority |
| **Voucher** | A fee bill for a student for a period |
| **Challan** | The printed form taken to a bank to pay a voucher. The three-copy challan has a bank copy, a school copy and a parent copy on one sheet |
| **Arrears** | Unpaid fees from earlier periods |
| **Security deposit** | A refundable amount taken at admission |
| **Paisa** | One hundredth of a rupee. All money is stored in paisa |
| **Lakh, crore** | 100,000 and 10,000,000 |
| **1BILL** | The national bill payment scheme; a parent pays by entering a consumer number in any banking app |
| **JazzCash, Easypaisa** | The two large mobile wallets |
| **IBAN** | The 24-character bank account number format used in Pakistan |
| **NTN, STRN** | National Tax Number; Sales Tax Registration Number |
| **Filer, non-filer** | Whether a person is on the tax authority's active taxpayer list. Several withholding rates depend on it |
| **Section 236I** | The provision of the Income Tax Ordinance on advance tax collected with school fees. Whether and how it applies must be confirmed with a tax adviser |
| **Withholding** | Tax a payer deducts from a payment and deposits with the tax authority on the payee's behalf |
| **CPR** | Computerised Payment Receipt: the tax authority's proof that a deposit was made |
| **EOBI** | The Employees' Old-Age Benefits Institution; employers and employees contribute monthly |
| **Social security** | The provincial employees' social security institution; an employer contribution |
| **Provident fund, gratuity** | Retirement savings with matching contributions; a lump sum paid on leaving after a qualifying period |
| **Iddat** | The waiting period observed by a widow; a kind of leave |
| **Imprest** | A petty cash float topped back up to a fixed amount |
| **PO, GRN** | Purchase order; goods received note |
| **Three-way match** | Checking a vendor's bill against the order and what was received |
| **Nastaliq** | The script style in which Urdu is written and read |
| **Roman Urdu** | Urdu typed in Latin letters, common in messages |
| **Eid, moon sighting** | Religious holidays whose dates are confirmed only shortly before; hence "tentative" holidays |

## Project terms

| Term | Meaning |
|---|---|
| **Organisation (org)** | A school group: the tenant. Everything belongs to one |
| **Membership** | A person's link to an organisation, of kind staff, guardian or student, with roles |
| **Role, permission** | A role is a named set of permissions. A permission is `resource:action` |
| **Role group** | A shorthand in the specs for several roles, such as `FINANCE` |
| **Capability** | A short flag derived from permissions (`hr`, `payroll`, `health`, `counselling`) that row-level security can check on sensitive tables |
| **Scope** | Who may reach a table's rows: `global`, `platform`, `org`, `branch`, with `+family`, `+household`, `+self`, `+cap`, `append-only` |
| **Row-level security (RLS)** | Rules in Postgres that decide which rows a database user may see or change |
| **Actor** | The signed-in user as the server sees them: ids, roles, permissions, branches, children |
| **`ctx`** | The first argument of every service function: the transaction, the actor, the request id, the time |
| **Contract** | The Zod schemas and types for a resource, shared by server and client |
| **The seven layers** | Contract, table, db-service, service, route, api-service, hooks |
| **Kernel** | The reusable files every module is built on |
| **Module** | One of the 45 parts of the product, M00 to M44 |
| **Wave** | A group of modules whose tables are created together in [Phase 1](../20-phases/phase-01-database.md) |
| **Phase** | A stage of the build, 0 to 23 |
| **Rule, failure case, test id** | `R-…`, `F-…`, `T-…`: numbered statements in a module spec. Each has a test named with its id |
| **Envelope** | The shape of every API answer: `{ data }` or `{ error }` |
| **Idempotency key** | A value sent with a request so that sending it twice has the effect of sending it once |
| **`STALE`** | The error when a record changed since the person loaded it |
| **Soft delete** | Marking a row deleted instead of removing it |
| **Domain event** | A recorded fact such as `fee.payment-received`, from which notifications and jobs follow |
| **Job, worker** | Work done in the background by a separate process, from a queue in Postgres |
| **Stand-in** | A local replacement for an outside service: `log` for messages, `fake` for payments and AI |
| **Posting** | Writing a journal entry to the ledger |
| **Control account** | A ledger account only the system posts to, such as fee receivable |
| **Family credit** | Money a family has paid that is not yet allocated to a voucher |
| **Cash session** | A cashier's shift at a counter, opened and closed with a count |
| **Sync stream** | The slice of data sent to a device for offline use |
| **Outbox** | A small queue on a device, or the developer page listing messages the stand-ins "sent" |
| **Conflict policy** | What happens when an offline change meets a newer change on the server |
| **Draft (AI)** | Something a model wrote, held apart until a person accepts it |
| **Preview (AI)** | An action the assistant proposes; nothing happens until the person confirms |
| **KPI snapshot** | A figure stored nightly per branch so trends are fast |
| **Kashi** | The approved visual theme: cobalt, turquoise and marigold, with square corners |
| **Portal, shell** | A portal is a part of the product for one kind of user; its shell is the frame of navigation around its pages |

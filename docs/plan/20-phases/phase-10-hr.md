# Phase 10 · HR and payroll

**Goal.** Staff are managed and paid on screen: the full staff record, attendance from the biometric feed, leave with balances and approvals, payroll from structure to bank file, loans, final settlement, recruitment, appraisal and training.

**Depends on.** [Phase 9](phase-09-finance.md) (payroll posts to the ledger and uses the tax rules).

**Portal.** `/school`: the Staff group and its settings; "My work" for every staff member.

**Modules.** [M26](../10-modules/m26-staff-recruitment.md) (the rest), [M27](../10-modules/m27-staff-attendance-leave.md), [M28](../10-modules/m28-payroll.md), [M29](../10-modules/m29-appraisal-training.md).

## Read first

Each module in full; [06](../00-foundation/06-tenancy-roles-and-access.md) ("Capabilities for sensitive tables"); the six finance screen rules in [Phase 9](phase-09-finance.md), which apply to payroll unchanged.

## Privacy rules for these screens

- A tab or menu item that needs the `hr` or `payroll` capability is absent, not disabled, for everyone else.
- Salary figures are never in a list visible to people without `payroll:read`, never in a notification, never in a page title or a URL.
- A staff member sees their own records under **My work**, and only those.

## Work packages

### 10.1 · The full staff record — [M26](../10-modules/m26-staff-recruitment.md)

Complete the staff profile tabs: Personal (private details, behind `staff-private:read`), Job and history (movements, with Confirm, Transfer, Promote, Suspend, Rejoin actions), Documents (with expiry), Contracts (with letters). Organisation chart. Missing items. Exits with the clearance checklist, each item ticked by its owner. Staff change requests. **My profile** for every staff member.

### 10.2 · Recruitment

Openings; the applicant board with stage columns; applicant sheet with the CV beside it; interviews; Hire, which prefills **Add staff**. Under `/school/staff/recruitment`.

### 10.3 · Staff attendance — [M27](../10-modules/m27-staff-attendance-leave.md)

| Screen | Path | Pattern |
|---|---|---|
| Staff attendance today | `/school/staff/attendance` | Grid |
| Month sheet | `…/attendance/month` | Grid |
| Corrections | `…/attendance/corrections` | List |
| Work schedules | `/school/settings/leave/schedules` | Settings |
| **Staff:** My attendance | `/school/me/attendance` | Calendar |

The biometric feed is simulated locally: a development page posts sample punches in the device's own format to the `/iclock` route, so the whole path from punch to attendance row is exercised before a real machine is connected in [Phase 18](phase-18-integrations.md).

### 10.4 · Leave

Leave requests with the approval trail; the leave calendar; balances with adjustment; leave types and policies (`/school/settings/leave`); **My leave** with the live quote (days counted, balance after, lessons affected). Decisions are made in the approvals inbox.

### 10.5 · Payroll — [M28](../10-modules/m28-payroll.md)

| Screen | Path | Pattern |
|---|---|---|
| Payroll | `/school/payroll` | List |
| **Run payroll** | `/school/payroll/run` | Wizard |
| Review | `/school/payroll/[id]` | Grid |
| Payslip | a side sheet | Detail |
| Pay | the run's Pay tab | Detail |
| Salary structure | the Salary tab on a staff member | Form page |
| Increments | `/school/payroll/increments` | Grid editor |
| Loans and advances | `/school/payroll/loans` | List + Detail |
| Adjustments | `/school/payroll/adjustments` | List + Form in a sheet |
| Final settlement | `/school/payroll/settlements` | Form page |
| Payroll reports | `/school/payroll/reports` | Report |
| Components | `/school/settings/payroll` | Settings |
| **Staff:** My salary | `/school/me/salary` | List + Detail |

The review grid shows last month beside this month with the reason for every change over 10%, and opens a payslip with "How was this worked out" under each line. The bank transfer file is produced in a generic layout and two bank-style layouts kept in `packages/core/src/modules/payroll/bank-layouts/`; adding a bank is adding a layout file.

### 10.6 · Appraisal and training — [M29](../10-modules/m29-appraisal-training.md)

Cycles with progress; the appraisal form with self and manager columns and the scorecard beside it; calibration; templates and rubrics; observations; the teacher scorecard; training programmes with attendance and feedback; training records; **My growth**.

### 10.7 · Tax for staff — [M25](../10-modules/m25-tax-compliance.md)

Salary tax schedule and certificates from the payroll runs; **My tax** for staff. EOBI and social security schedules.

### 10.8 · Dashboard and reports

Widgets: staff present today, on leave, late; leave requests waiting; probation and contracts ending; documents expiring; payroll status for the month. Role layouts for HR manager and payroll officer. HR and payroll reports registered in the library.

## Journeys to automate

| Journey | Role | Steps |
|---|---|---|
| A new teacher | HR manager | Add staff → private details → salary structure drafted → approved by the finance head → invitation accepted |
| A working day | System, HR | Post punches → present, late and half-day rows appear → no punch by noon marks absent → a forgotten punch is corrected by request and approval |
| Leave | Teacher, section head | Ask for 3 days with 2 available → the quote shows one unpaid → confirm → approve → attendance shows leave, substitutions needed appear, the balance moves |
| Leave cancelled | Teacher | Cancel before it starts → balance restored, substitutions removed |
| Payroll | Payroll officer, finance head, director | Preview → calculate → review shows the new joiner, the unpaid day and a loan instalment → hold one payslip → submit → the calculator cannot approve → approve → ledger entry posted → bank file total equals bank payslips → mark paid → payslips published |
| No tax rule | Payroll officer | Run payroll for a month with no confirmed rule → stopped with the reason; nothing saved |
| Loan | Teacher, payroll officer | Request an advance → approve → disburse → next payslip recovers it |
| Leaving | HR, librarian, accountant | Resignation → clearance items by their owners → settlement blocked until clear → settle → last day ends the login |
| Privacy | Teacher, principal | A teacher cannot open any salary page or route; a principal without `payroll:read` sees totals only |
| Appraisal | Teacher, coordinator, HR | Open a cycle → self-assessment → manager's assessment (hidden from the teacher) → shared → acknowledged |

## Exit checks

1. Every screen meets "Done when".
2. All ten journeys pass in the browser.
3. A browser test signs in as each role without the `payroll` capability and requests every payroll page and route: none returns salary data.
4. Six months of seeded payroll re-calculated through the screens equals the seeded payslips to the paisa.
5. After the suite, the integrity job reports no finding for payroll, leave or loans.
6. `pnpm check`, `pnpm test:db`, `pnpm test:e2e`.

## Left for later, on purpose

- Printed payslips, letters and the bank advice: [Phase 16](phase-16-documents-and-printing.md).
- A real biometric machine: [Phase 18](phase-18-integrations.md).
- The public job page: [Phase 20](phase-20-public-website.md).

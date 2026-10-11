// Wave 4 · Finance: M23 accounting, M25 tax, M21 fees, M22 payments, M24 expenses and purchasing.
// See scaffold-hints.mjs for what each field means.

const live = '${t.deletedAt} is null';

export const wave4 = {
  // ------------------------------------------------------------------ M21 · Fees

  fee_structures: {
    // What counts as "above the cap" is a setting; the service checks it when a structure is saved.
    columns: { increase_reason: { accounted: 'service' } },
    // A structure without a branch is the group's; there is one of those per year and date.
    lines: [{ match: '(academic_year_id, branch_id, effective_from)', nulls: 'same' }],
  },
  student_fee_items: { columns: { reason: { neededWhen: { mode: 'replace' } } } },
  // Whether a discount is the staff-child one is a property of its type; the service reads it.
  student_discounts: { columns: { staff_id: { accounted: 'service' } } },
  fee_vouchers: {
    columns: { balance: { generated: '${t.total} - ${t.paid}' } },
    lines: [
      {
        match: '(student_id, billing_month, kind)',
        where: "${t.status} <> 'cancelled' and ${t.kind} = 'regular'",
      },
    ],
  },
  fee_voucher_lines: {
    lines: [
      // A fine for a day is assessed once: two fine lines of a voucher never share a date.
      { match: '(voucher_id, kind, fine_date)', where: "${t.kind} = 'fine'", nulls: 'same' },
      { match: 'Lines are only ever inserted', note: true },
    ],
  },
  cash_sessions: {
    columns: {
      // Counted less than expected is a shortage.
      difference: { signed: true },
      difference_note: {
        accounted: 'check',
        checks: [
          {
            suffix: 'needed',
            sql: 'coalesce(${t.difference}, 0) = 0 or ${t.differenceNote} is not null',
          },
        ],
      },
    },
    lines: [{ match: '(cashier_id) among sessions', where: "${t.status} = 'open'" }],
  },
  fee_payments: {
    columns: {
      unallocated: { generated: '${t.amount} - ${t.allocated} - ${t.refunded}' },
      // An imported or offline payment may lack what a counter payment must have; the service
      // decides by source as well as by method.
      reference: { accounted: 'service' },
      bank_account_id: { accounted: 'service' },
      cash_session_id: { accounted: 'service' },
    },
    lines: [
      { match: '(org_id, channel, reference)', where: "${t.method} = 'online'", nulls: 'distinct' },
      // Most receipts are not issued offline and carry no device code.
      { match: '(org_id, device_receipt_code)', nulls: 'distinct' },
    ],
  },
  fee_payment_allocations: {
    lines: [{ match: 'Rows are only ever inserted', note: true }],
  },
  // A guardian uploads the proof of a transfer or a deposit, and can do nothing more to it.
  payment_proofs: {
    meta: { householdRule: { read: true, insert: { status: 'submitted' } } },
  },
  fee_followups: { columns: { promised_date: { neededWhen: { outcome: 'promised' } } } },

  // ------------------------------------------------------------------ M22 · Online payments and banking

  // A guardian starts a payment; the provider's answer moves it on through the service.
  payment_intents: {
    meta: { householdRule: { read: true, insert: { status: 'created' } } },
    columns: { student_id: { neededWhen: { purpose: 'wallet_top_up' } } },
  },
  bank_statement_lines: { columns: { balance: { signed: true } } },
  bank_reconciliations: {
    columns: {
      // An overdrawn account has a negative balance, and a difference may fall either way.
      statement_balance: { signed: true },
      ledger_balance: { signed: true },
      difference: { signed: true },
    },
  },

  // ------------------------------------------------------------------ M23 · Accounting

  fiscal_years: {
    lines: [
      {
        match: 'no two years of an organisation overlap',
        sql: "alter table fiscal_years add constraint fiscal_years_no_overlap exclude using gist (org_id with =, daterange(starts_on, ends_on, '[]') with &&) where (deleted_at is null)",
      },
    ],
  },
  journal_lines: {
    // The database applies the organisation rule; which branches' lines a person sees is the service's
    // business, because a group accountant reads every branch and a branch accountant only their own.
    policy: 'service',
    columns: {
      credit: {
        accounted: 'check',
        checks: [{ suffix: 'one_side', sql: '(${t.debit} > 0) <> (${t.credit} > 0)' }],
      },
    },
    lines: [
      {
        match: 'A posted line is never changed or removed',
        sql: [
          `create or replace function app.journal_line_guard() returns trigger language plpgsql as $$
begin
  if old.is_posted then
    raise exception 'A posted journal line is a permanent record and cannot be changed or removed' using errcode = 'TK001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$`,
          'create trigger journal_lines_posted_fixed before update or delete on journal_lines for each row execute function app.journal_line_guard()',
        ],
      },
      {
        match: 'A deferred constraint trigger refuses to commit a posted entry',
        sql: [
          `create or replace function app.journal_entry_balances(entry uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from journal_entries e where e.id = entry and e.status = 'posted') then
    return;
  end if;
  if exists (
    select 1 from journal_lines l
    where l.entry_id = entry and l.deleted_at is null
    group by l.branch_id
    having sum(l.debit) <> sum(l.credit)
  ) or not exists (select 1 from journal_lines l where l.entry_id = entry and l.deleted_at is null) then
    raise exception 'Journal entry % does not balance: its debits and credits must be equal within each branch', entry
      using errcode = '23514';
  end if;
end $$`,
          // It reads every line of the entry, whoever is posting, so it runs with the owner's rights.
          'grant execute on function app.journal_entry_balances(uuid) to authenticated, service_role',
          `create or replace function app.journal_line_balance_check() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform app.journal_entry_balances(old.entry_id);
  else
    perform app.journal_entry_balances(new.entry_id);
  end if;
  return null;
end $$`,
          `create or replace function app.journal_entry_balance_check() returns trigger language plpgsql as $$
begin
  perform app.journal_entry_balances(new.id);
  return null;
end $$`,
          'create constraint trigger journal_lines_balanced after insert or update or delete on journal_lines deferrable initially deferred for each row execute function app.journal_line_balance_check()',
          'create constraint trigger journal_entries_balanced after insert or update on journal_entries deferrable initially deferred for each row execute function app.journal_entry_balance_check()',
        ],
      },
    ],
    fixture: '() => ({ debit: 100, credit: 0 })',
  },
  // A mapping without a branch is the group's default for that key.
  account_mappings: { lines: [{ match: '(key, branch_id)', nulls: 'same' }] },

  // ------------------------------------------------------------------ M24 · Expenses and purchasing

  expenses: {
    columns: {
      petty_cash_fund_id: { neededWhen: { paid_from: 'petty_cash' } },
      bank_account_id: { neededWhen: { paid_from: 'bank' } },
    },
  },
  budgets: {
    // One approved budget for a branch and year, and one for the group as a whole.
    lines: [
      { match: '(fiscal_year_id, branch_id)', where: "${t.status} = 'approved'", nulls: 'same' },
    ],
  },
  budget_lines: {
    columns: {
      monthly: {
        checks: [{ suffix: 'twelve', sql: 'cardinality(${t.monthly}) = 12' }],
      },
      annual: {
        generated:
          '${t.monthly}[1] + ${t.monthly}[2] + ${t.monthly}[3] + ${t.monthly}[4] + ${t.monthly}[5] + ${t.monthly}[6] + ${t.monthly}[7] + ${t.monthly}[8] + ${t.monthly}[9] + ${t.monthly}[10] + ${t.monthly}[11] + ${t.monthly}[12]',
      },
    },
    lines: [{ match: '(budget_id, account_id, cost_center_id)', nulls: 'same' }],
    fixture: '() => ({ monthly: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] })',
  },
  // Which quote is the lowest, and whether a receipt holds stock items, is known only across rows.
  purchase_quotes: { columns: { selection_reason: { accounted: 'service' } } },
  goods_receipts: { columns: { warehouse_id: { accounted: 'service' } } },
  vendor_bills: {
    columns: {
      // Worked out by the service from the bill date and the vendor's terms.
      due_date: { default: '' },
      balance: { generated: '${t.total} - ${t.paid}' },
    },
    lines: [{ match: '(org_id, vendor_id, bill_no)', where: "${t.status} <> 'void'" }],
  },

  // ------------------------------------------------------------------ M25 · Tax and statutory

  tax_rules: {
    lines: [
      {
        match: 'no two confirmed rules of one kind and province overlap in dates',
        sql: "alter table tax_rules add constraint tax_rules_no_overlap exclude using gist (org_id with =, kind with =, (coalesce(province, '')) with =, daterange(effective_from, effective_to, '[]') with &&) where (status = 'confirmed' and deleted_at is null)",
      },
    ],
  },
  tax_deductions: {
    // A reversal carries the same figures with the opposite sign.
    columns: { base_amount: { signed: true } },
    lines: [{ match: '(source_type, source_id, kind)', where: '${t.taxAmount} > 0' }],
  },
  // A filing without a branch covers the whole organisation.
  statutory_filings: { lines: [{ match: '(kind, branch_id, period_from)', nulls: 'same' }] },
};

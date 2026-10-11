// Wave 5 · People operations: M27 staff attendance and leave, M28 payroll, M29 appraisal and training.
// See scaffold-hints.mjs for what each field means.

const live = '${t.deletedAt} is null';

export const wave5 = {
  // ------------------------------------------------------------------ M27 · Staff attendance and leave

  work_schedules: {
    columns: { is_default: { accounted: 'index' } },
    // A schedule without a branch is usable anywhere and counts as a place of its own: one default
    // for the group, and one for each branch that has its own.
    extra: [
      "uniqueIndex('work_schedules_default_uq').on(t.orgId, sql`coalesce(${t.branchId}, '00000000-0000-0000-0000-000000000000'::uuid)`).where(sql`${t.isDefault} and " +
        live +
        '`)',
    ],
  },
  // Staff reach these tables as staff; that a person sees only their own rows unless they hold the
  // permission is the service's rule, applied with the staff id of the signed-in member.
  staff_attendance: { policy: 'service' },
  staff_attendance_corrections: { policy: 'service' },
  leave_balances: {
    policy: 'service',
    columns: {
      available: {
        generated:
          '${t.opening} + ${t.accrued} + ${t.adjusted} - ${t.used} - ${t.pending} - ${t.encashed}',
      },
    },
  },
  leave_requests: { policy: 'service' },

  // ------------------------------------------------------------------ M28 · Payroll

  salary_components: { columns: { system_key: { neededWhen: { calc: 'system' } } } },
  salary_structures: {
    lines: [
      {
        match: 'no two active structures of one staff member overlap',
        sql: "alter table salary_structures add constraint salary_structures_no_overlap exclude using gist (staff_id with =, daterange(effective_from, effective_to, '[]') with &&) where (status = 'active' and deleted_at is null)",
      },
    ],
  },
  increments: {
    columns: {
      percent: {
        generated:
          'case when ${t.oldGross} > 0 then round((${t.newGross} - ${t.oldGross}) * 100.0 / ${t.oldGross}, 2) end',
      },
    },
  },
  payroll_runs: {
    lines: [
      {
        match: '(branch_id, pay_month)',
        where: "${t.kind} = 'regular' and ${t.status} <> 'cancelled'",
      },
    ],
  },

  // ------------------------------------------------------------------ M29 · Appraisal and training

  // Who may read an appraisal depends on the reporting line, which only the service can follow.
  appraisal_forms: { policy: 'service' },
  staff_goals: { policy: 'service' },
  classroom_observations: { policy: 'service' },
  training_attendance: { policy: 'service' },
};

// Everything the scaffolder needs that the module specifications cannot say in their fixed notation.
// With the specs, this file fully decides the generated data layer: see scaffold.mjs.
//
// Per table (`tables`):
//   meta      extra fields of the table's registry entry: who may reach its rows (packages/db/src/registry.ts)
//   policy    'template' — the spec's Policy line says what the scope's template already does
//             'service'  — the Policy line is enforced by the module's service; the database applies the template
//   columns   per column:
//               checks     extra check constraints: a helper call, or { suffix, sql }
//               accounted  where a constraint-like sentence in the Rules cell is enforced: 'check', 'index', 'service'
//               signed     a money column that may be negative
//               neededWhen { other_column: 'value' | ['a', 'b'] | true }: the column must have a value when the
//                          other column holds one of those values (or is true); becomes a check constraint
//               default, notNull, builder, zod, generated, reference, unique, enum, note   overrides
//   lines     sentences under the table that are not in the fixed notation, each matched by a piece of its text:
//               { match, code }   a line for the table's extra config
//               { match, sql }    statements for the wave's hand-written SQL
//               { match, where }  the condition of a unique rule or an index, as the body of a `sql` template
//               { match, nulls }  'same' | 'distinct': whether two empty values clash in a unique rule
//               { match, forEver: true }  the unique rule holds against deleted rows too
//               { match, service: true } | { match, note: true }   enforced by the service | plain prose
//   extra     more lines for the table's extra config
//   sql       more statements for the wave's hand-written SQL
//   fixture   a row for the security tests, as the source of `(place, index, state) => ({ … })`, when the
//             generated one cannot satisfy a constraint
//   sample    { camelKey: 'code' }: values for single columns of that row, added to what the generator works out
//
// Inside `code`, `where` and check `sql`, columns are written `${t.camelCase}`; these are ordinary
// strings here (never template literals) and become `sql` templates in the generated file.

import { wave3 } from './hints-wave3.mjs';
import { wave4 } from './hints-wave4.mjs';
import { wave5 } from './hints-wave5.mjs';
import { wave6 } from './hints-wave6.mjs';
import { wave7 } from './hints-wave7.mjs';
import { wave8 } from './hints-wave8.mjs';

/** Waves 1 to this number are generated. Raise it when a wave lands. */
export const throughWave = 8;

export const waves = {
  0: ['M00', 'M01', 'M02', 'M03'],
  1: ['M04', 'M26', 'M11', 'M07'],
  2: ['M05', 'M06', 'M08', 'M09', 'M10'],
  3: ['M12', 'M13', 'M14', 'M15', 'M19', 'M16', 'M17', 'M18', 'M20'],
  4: ['M23', 'M25', 'M21', 'M22', 'M24'],
  5: ['M27', 'M28', 'M29'],
  6: ['M32', 'M30', 'M31', 'M33', 'M34', 'M35', 'M36'],
  7: ['M37', 'M38', 'M39', 'M40', 'M41'],
  8: ['M42', 'M43', 'M44'],
};

/**
 * Value lists that many tables share and that already exist in packages/contracts/src/kernel/primitives.ts.
 * A column whose allowed values are exactly one of these uses the shared list instead of getting its own.
 */
export const sharedLists = [
  { constName: 'genders', schema: 'Gender', values: ['male', 'female', 'other'] },
  { constName: 'studentGenders', schema: 'StudentGender', values: ['male', 'female'] },
  { constName: 'genderPolicies', schema: 'GenderPolicy', values: ['boys', 'girls', 'mixed'] },
  {
    constName: 'bloodGroups',
    schema: 'BloodGroup',
    values: ['a_pos', 'a_neg', 'b_pos', 'b_neg', 'ab_pos', 'ab_neg', 'o_pos', 'o_neg', 'unknown'],
  },
  {
    constName: 'religions',
    schema: 'Religion',
    values: ['islam', 'christianity', 'hinduism', 'sikhism', 'other'],
  },
  { constName: 'locales', schema: 'Locale', values: ['en', 'ur'] },
  {
    constName: 'provinces',
    schema: 'Province',
    values: ['punjab', 'sindh', 'kp', 'balochistan', 'ict', 'ajk', 'gb'],
  },
];

/** Table names whose singular the generator cannot work out. */
export const singular = {};

/** Actions that deserve a second look on the roles screen: they remove, export or go past a rule. */
export const sensitiveActions = [
  'delete',
  'export',
  'override',
  'waive',
  'unlock',
  'reopen',
  'reverse',
  'refund',
  'void',
  'purge',
  'erase',
  'merge',
  'impersonate',
  'read-sensitive',
  'write-off',
];

/** Per permission key: { sensitive: true | false } where the action's name does not settle it. */
export const permissions = {
  'academic-years:close': { sensitive: true },
  'staff-private:read': { sensitive: true },
  'staff-private:update': { sensitive: true },
  'staff:manage': { sensitive: true },
  'students:override-age': { sensitive: true },
  'enrollments:override-capacity': { sensitive: true },
  'withdrawals:waive-dues': { sensitive: true },
  'promotions:commit': { sensitive: true },
};

/** Hand-written SQL per wave that belongs to no single table. */
export const waveSql = {
  1: [
    // The token hook of Wave 0 could not know a guardian's children: the tables did not exist.
    // It gives the same answer as `resolveFamily` in packages/core/src/kernel/permissions.ts.
    `create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  wanted text := claims -> 'app_metadata' ->> 'membership_id';
  found_id uuid;
  matches integer;
  m record;
  branches jsonb;
  children jsonb := '[]'::jsonb;
  family uuid;
begin
  -- Claims from an earlier token must not survive a change of membership.
  claims := claims - 'org_id' - 'kind' - 'staff_id' - 'guardian_id' - 'family_id' - 'all_branches'
                   - 'branch_ids' - 'student_ids' - 'caps' - 'membership_id' - 'membership_version';

  select count(*), min(ms.id::text)::uuid
    into matches, found_id
  from public.memberships ms
  join public.orgs o on o.id = ms.org_id
  where ms.user_id = (event ->> 'user_id')::uuid
    and ms.deleted_at is null and ms.status = 'active'
    and o.deleted_at is null and o.status = 'active'
    and (wanted is null or wanted = '' or ms.id::text = wanted);

  if matches = 1 then
    select ms.id, ms.org_id, ms.kind, ms.staff_id, ms.guardian_id, ms.student_id, ms.all_branches, ms.token_version
      into m
    from public.memberships ms
    where ms.id = found_id;

    select coalesce(jsonb_agg(mb.branch_id), '[]'::jsonb)
      into branches
    from public.membership_branches mb
    where mb.membership_id = m.id and mb.deleted_at is null;

    -- A student reaches their own records; a guardian, those of the students they are linked to.
    if m.kind = 'student' and m.student_id is not null then
      select s.family_id into family
      from public.students s
      where s.id = m.student_id and s.org_id = m.org_id and s.deleted_at is null;
      if found then
        children := jsonb_build_array(m.student_id);
      end if;
    elsif m.kind = 'guardian' and m.guardian_id is not null then
      select g.family_id into family
      from public.guardians g
      where g.id = m.guardian_id and g.org_id = m.org_id and g.deleted_at is null;
      if found then
        select coalesce(jsonb_agg(s.id order by s.id), '[]'::jsonb)
          into children
        from public.student_guardians sg
        join public.students s on s.id = sg.student_id
        where sg.guardian_id = m.guardian_id and sg.deleted_at is null
          and s.org_id = m.org_id and s.deleted_at is null;
      end if;
    end if;

    claims := claims || jsonb_build_object(
      'org_id', m.org_id,
      'kind', m.kind,
      'membership_id', m.id,
      'membership_version', m.token_version,
      'all_branches', m.all_branches,
      'branch_ids', branches,
      'student_ids', children,
      'caps', '[]'::jsonb
    );
    if m.staff_id is not null then
      claims := claims || jsonb_build_object('staff_id', m.staff_id);
    end if;
    if m.guardian_id is not null then
      claims := claims || jsonb_build_object('guardian_id', m.guardian_id);
    end if;
    if family is not null then
      claims := claims || jsonb_build_object('family_id', family);
    end if;
  end if;

  return jsonb_set(event, '{claims}', claims);
exception when others then
  return event;
end
$$`,
  ],
};

const live = '${t.deletedAt} is null';

export const tables = {
  // ------------------------------------------------------------------ M04 · School setup

  academic_years: {
    // Families see the year and its terms on results, fees and the calendar.
    meta: { member: 'read' },
    columns: {
      end_date: {
        checks: [{ suffix: 'span', sql: "${t.endDate} <= (${t.startDate} + interval '15 months')" }],
      },
    },
    lines: [
      {
        match: 'At most one row with status `active`',
        code: "uniqueIndex('academic_years_active_uq').on(t.orgId).where(sql`${t.status} = 'active' and " + live + '`)',
      },
      {
        match: 'Date ranges of live rows must not overlap',
        sql: "alter table academic_years add constraint academic_years_no_overlap exclude using gist (org_id with =, daterange(start_date, end_date, '[]') with &&) where (deleted_at is null)",
      },
    ],
  },
  terms: {
    meta: { member: 'read' },
    columns: {
      sequence: { checks: ["positive('terms', t.sequence)"] },
      weight_percent: { checks: ["between('terms', t.weightPercent, 0, 100)"] },
    },
    lines: [
      {
        match: 'Terms of one year must not overlap',
        sql: "alter table terms add constraint terms_no_overlap exclude using gist (academic_year_id with =, daterange(start_date, end_date, '[]') with &&) where (deleted_at is null)",
      },
    ],
  },
  holidays: { meta: { member: 'read' } },
  // The times of the school day are shown with a child's class.
  shifts: { meta: { member: 'read' } },
  grade_bands: {
    columns: {
      min_percent: { checks: ["between('grade_bands', t.minPercent, 0, 100)"] },
      max_percent: { checks: ["between('grade_bands', t.maxPercent, 0, 100)"] },
    },
  },

  // ------------------------------------------------------------------ M26 · Staff and recruitment

  staff: {
    policy: 'template',
    columns: {
      reports_to_staff_id: {
        // "No loops" needs the whole chain and is checked by the service.
        accounted: 'check',
        checks: [{ suffix: 'not_self', sql: '${t.reportsToStaffId} <> ${t.id}' }],
      },
      probation_ends_on: {
        accounted: 'check',
        checks: [
          {
            suffix: 'needed',
            sql: "${t.employmentType} <> 'probation' or ${t.probationEndsOn} is not null",
          },
        ],
      },
      contract_ends_on: {
        accounted: 'check',
        checks: [
          {
            suffix: 'needed',
            sql: "${t.employmentType} <> 'contract' or ${t.contractEndsOn} is not null",
          },
        ],
      },
    },
    // Families need a teacher's name and photograph and nothing else about them, so they read this
    // view and never the table. It runs with its owner's rights and filters by organisation itself.
    sql: [
      `create view staff_directory with (security_barrier = true) as
  select id, org_id, full_name, full_name_ur, gender, photo_file_id, (status <> 'left') as is_active
  from staff
  where deleted_at is null and org_id = (select app.org_id())`,
      'revoke all on staff_directory from public, anon, authenticated',
      'grant select on staff_directory to authenticated',
      "comment on view staff_directory is 'What every member of an organisation, families included, may know about its staff: a name and a photograph.'",
    ],
    fixture: "() => ({ employmentType: 'permanent' })",
  },
  staff_private: {
    columns: {
      // A returning employee may get a new record while the old one is kept, so this cannot be an index.
      cnic: { accounted: 'service' },
      date_of_birth: { accounted: 'service' },
    },
  },
  staff_bank_accounts: {
    columns: {
      is_primary: { accounted: 'index' },
    },
    extra: [
      "uniqueIndex('staff_bank_accounts_primary_uq').on(t.staffId).where(sql`${t.isPrimary} and " + live + '`)',
    ],
  },
  // A request carries private details, so it sits behind the same wall as `staff_private`:
  // the person themselves, and holders of the `hr` capability.
  staff_change_requests: { policy: 'template' },
  staff_exits: {
    lines: [
      {
        match: 'one exit that is not `closed` or `withdrawn` per staff member',
        code: "uniqueIndex('staff_exits_open_uq').on(t.staffId).where(sql`${t.status} not in ('closed', 'withdrawn') and " + live + '`)',
      },
    ],
  },
  job_openings: {
    columns: {
      salary_max: {
        checks: [{ suffix: 'from', sql: '${t.salaryMax} >= ${t.salaryMin}' }],
      },
      closes_on: {
        checks: [{ suffix: 'from', sql: '${t.closesOn} >= ${t.opensOn}' }],
      },
    },
  },

  // ------------------------------------------------------------------ M11 · Academic structure

  // Families see their child's class, its subjects and who teaches them.
  grades: { meta: { member: 'read' } },
  sections: { meta: { member: 'read' } },
  subjects: { meta: { member: 'read' } },
  subject_groups: { meta: { member: 'read' } },
  grade_subjects: {
    meta: { member: 'read' },
    columns: {
      practical_marks: { checks: ["nonNegative('grade_subjects', t.practicalMarks)"] },
      pass_percent: { checks: ["between('grade_subjects', t.passPercent, 0, 100)"] },
    },
    lines: [
      // A subject taken by every stream has no group; it must still appear once only.
      { match: '(academic_year_id, grade_id, subject_id, subject_group_id)', nulls: 'same' },
    ],
  },
  section_subjects: {
    meta: { member: 'read' },
    columns: { periods_per_week: { checks: ["nonNegative('section_subjects', t.periodsPerWeek)"] } },
  },

  // ------------------------------------------------------------------ M07 · Students

  families: { policy: 'template' },
  guardians: {
    // "Request changes" is a row in `profile_change_requests`; the guardian never writes here.
    meta: { guardian: 'id' },
  },
  students: {
    columns: {
      address: { accounted: 'prose' },
      left_on: {
        accounted: 'check',
        checks: [
          {
            suffix: 'needed',
            sql: "${t.status} not in ('left', 'transferred', 'graduated', 'expelled') or ${t.leftOn} is not null",
          },
        ],
      },
    },
    fixture: "() => ({ leftOn: '2026-01-10' })",
  },
  student_guardians: {
    lines: [
      {
        match: 'one primary per student',
        code: "uniqueIndex('student_guardians_primary_uq').on(t.studentId).where(sql`${t.isPrimary} and " + live + '`)',
      },
    ],
  },
  enrollments: {
    lines: [
      // A transfer or a re-admission in the same year leaves the closed enrolment beside the new one.
      {
        match: '(org_id, student_id, academic_year_id)',
        where: "${t.status} not in ('left', 'transferred')",
      },
      // A student who has no roll number yet clashes with nobody.
      { match: '(section_id, roll_no)', nulls: 'distinct' },
    ],
  },
  promotion_items: {
    columns: {
      reason: {
        accounted: 'check',
        checks: [
          {
            suffix: 'needed',
            sql: '${t.decision} = ${t.suggestedDecision} or ${t.reason} is not null',
          },
        ],
      },
    },
  },
  transfer_requests: {
    columns: {
      to_branch_id: {
        accounted: 'check',
        checks: [{ suffix: 'differs', sql: '${t.toBranchId} <> ${t.fromBranchId}' }],
      },
    },
  },
  profile_change_requests: {
    // A guardian asks for a correction to a child's record or to their own; they may add a request
    // and follow it, never change or withdraw it.
    meta: { familyRule: 'append', guardian: 'guardianId', guardianRule: 'append' },
    columns: {
      guardian_id: {
        accounted: 'check',
        checks: [{ suffix: 'about', sql: 'num_nonnulls(${t.studentId}, ${t.guardianId}) >= 1' }],
      },
    },
  },

  // ================================================================== Wave 2 · Front door

  // ------------------------------------------------------------------ M05 · Integrations and API

  integration_connections: {
    lines: [
      {
        // An empty branch means the whole group and counts as a value: one default for the group,
        // and one for each branch that has its own.
        match: 'one default per (org_id, category, branch_id)',
        code:
          "uniqueIndex('integration_connections_default_uq').on(t.orgId, t.category, sql`coalesce(${t.branchId}, '00000000-0000-0000-0000-000000000000'::uuid)`).where(sql`${t.isDefault} and " +
          live +
          '`)',
      },
    ],
  },
  webhook_events: {
    // An outside service's event id is remembered for ever, so a repeat is recognised however old.
    lines: [{ match: '(provider, event_id)', forEver: true }],
  },
  webhook_endpoints: {
    columns: {
      url: { checks: [{ suffix: 'https', sql: "${t.url} like 'https://%'" }] },
      event_names: {
        accounted: 'check',
        checks: [{ suffix: 'some', sql: 'cardinality(${t.eventNames}) >= 1' }],
      },
    },
    fixture: "() => ({ url: 'https://example.test/hooks/takhti', eventNames: ['fee.paid'] })",
  },
  biometric_enrolments: {
    columns: { staff_id: { accounted: 'check' }, student_id: { accounted: 'check' } },
    extra: [
      "check('biometric_enrolments_person', sql`(${t.personKind} = 'staff' and ${t.staffId} is not null and ${t.studentId} is null) or (${t.personKind} = 'student' and ${t.studentId} is not null and ${t.staffId} is null)`)",
    ],
    fixture: "() => ({ personKind: 'staff', staffId: crypto.randomUUID() })",
  },

  // ------------------------------------------------------------------ M06 · Admissions

  admission_enquiries: {
    columns: {
      lost_reason: {
        accounted: 'check',
        checks: [{ suffix: 'needed', sql: "${t.status} <> 'lost' or ${t.lostReason} is not null" }],
      },
    },
  },
  admission_applications: {
    columns: {
      // The shape of each guardian, and "exactly one primary", are checked by the contract.
      guardians: {
        accounted: 'service',
        checks: [
          {
            suffix: 'list',
            sql: "jsonb_typeof(${t.guardians}) = 'array' and ${t.guardians} <> '[]'::jsonb",
          },
        ],
      },
    },
    fixture:
      "() => ({ guardians: [{ relation: 'father', fullName: 'Test Guardian', phone: '+923005550001', isPrimary: true }] })",
  },

  // ------------------------------------------------------------------ M08 · Certificates and ID cards

  certificate_templates: {
    lines: [
      {
        match: 'One default per (type_id, language) among active templates',
        code:
          "uniqueIndex('certificate_templates_default_uq').on(t.typeId, t.language).where(sql`${t.isDefault} and ${t.status} = 'active' and " +
          live +
          '`)',
      },
    ],
  },
  certificates: {
    // A family asks for a certificate from the portal: it may add a request and nothing more.
    meta: { familyRule: { read: true, insert: { status: 'requested' } } },
    columns: {
      student_id: { accounted: 'check' },
      staff_id: { accounted: 'check' },
      number: {
        checks: [{ suffix: 'needed', sql: "${t.status} <> 'issued' or ${t.number} is not null" }],
      },
    },
    extra: ["check('certificates_person', sql`num_nonnulls(${t.studentId}, ${t.staffId}) = 1`)"],
  },
  id_cards: {
    columns: {
      student_id: { accounted: 'check' },
      staff_id: { accounted: 'check' },
      valid_until: { checks: [{ suffix: 'from', sql: '${t.validUntil} >= ${t.issuedOn}' }] },
    },
    lines: [
      {
        match: 'One `active` card per person',
        code: [
          "uniqueIndex('id_cards_active_student_uq').on(t.studentId).where(sql`${t.status} = 'active' and ${t.studentId} is not null and " +
            live +
            '`)',
          "uniqueIndex('id_cards_active_staff_uq').on(t.staffId).where(sql`${t.status} = 'active' and ${t.staffId} is not null and " +
            live +
            '`)',
        ],
      },
    ],
    extra: [
      "check('id_cards_person', sql`(${t.issuedTo} = 'student' and ${t.studentId} is not null and ${t.staffId} is null) or (${t.issuedTo} = 'staff' and ${t.staffId} is not null and ${t.studentId} is null)`)",
    ],
    fixture: "() => ({ issuedTo: 'student' })",
  },

  // ------------------------------------------------------------------ M09 · Front office

  visitors: {
    columns: {
      checked_out_at: { checks: [{ suffix: 'from', sql: '${t.checkedOutAt} >= ${t.checkedInAt}' }] },
    },
  },
  gate_passes: {
    // A guardian asks for a pass from the portal; the school decides, and the gate records the rest.
    meta: { familyRule: { read: true, insert: { status: 'requested' } } },
    columns: {
      pickup_cnic: {
        accounted: 'check',
        checks: [
          {
            suffix: 'needed',
            sql: '${t.pickupGuardianId} is not null or ${t.pickupCnic} is not null',
          },
        ],
      },
    },
    fixture: "() => ({ pickupCnic: '90000-0000001-7' })",
  },
  appointments: {
    meta: { familyRule: { read: true, insert: { status: 'requested' } } },
  },

  // ------------------------------------------------------------------ M10 · Alumni

  // One alumni record per student: the table's own rule, (org_id, student_id), already says it.
  alumni: { columns: { student_id: { unique: false } } },

  // ================================================================== Wave 3 · Academics
  ...wave3,

  // ================================================================== Waves 4 to 8
  ...wave4,
  ...wave5,
  ...wave6,
  ...wave7,
  ...wave8,
};

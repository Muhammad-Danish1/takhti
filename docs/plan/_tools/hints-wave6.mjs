// Wave 6 · Operations: M32 inventory and assets, M30 transport, M31 library, M33 shop and canteen,
// M34 health, M35 hostel, M36 helpdesk. See scaffold-hints.mjs for what each field means.

const live = '${t.deletedAt} is null';

export const wave6 = {
  // ------------------------------------------------------------------ M30 · Transport

  vehicles: { columns: { contractor_vendor_id: { neededWhen: { ownership: 'contracted' } } } },
  // A family is shown the stops and trips of its child's route; the service picks the route.
  route_stops: { meta: { member: 'read' } },
  transport_assignments: {
    lines: [
      {
        match: 'one active assignment per student',
        code:
          "uniqueIndex('transport_assignments_active_student_uq').on(t.studentId).where(sql`${t.status} = 'active' and " +
          live +
          '`)',
      },
    ],
  },
  transport_requests: {
    // A guardian asks from the portal, and may withdraw the request while nobody has decided it.
    meta: {
      familyRule: { read: true, insert: { status: 'pending' }, update: { status: 'pending' } },
    },
    columns: { stop_id: { neededWhen: { kind: ['start', 'change_stop'] } } },
  },
  trips: { meta: { member: 'read' } },
  // Staff only. A family gets one position of one vehicle from the service, while its child's trip runs.
  vehicle_locations: { policy: 'template' },

  // ------------------------------------------------------------------ M31 · Library

  library_items: {
    meta: { member: 'read' },
    lines: [
      {
        // Authors and keywords are lists; joining a list is not something Postgres lets an index
        // do directly, so a small function that promises to give the same answer every time does it.
        match: 'full-text on',
        sql: [
          "create or replace function app.words(list text[]) returns text language sql immutable parallel safe as $$ select coalesce(array_to_string(list, ' '), '') $$",
          'grant execute on function app.words(text[]) to authenticated, service_role',
          "create index library_items_search on library_items using gin (to_tsvector('simple', coalesce(title, '') || ' ' || app.words(authors) || ' ' || app.words(keywords)))",
        ],
      },
    ],
  },
  // The catalogue route tells a family whether a title is on the shelf; copies themselves stay with staff.
  library_copies: { policy: 'service' },
  library_members: {
    columns: {
      student_id: { neededWhen: { member_kind: 'student' } },
      staff_id: { neededWhen: { member_kind: 'staff' } },
      blocked_reason: { neededWhen: { is_blocked: true } },
    },
    fixture: "() => ({ memberKind: 'student' })",
  },
  library_loans: {
    // Staff already reach loans as staff; showing a person only their own is the service's rule.
    policy: 'service',
    lines: [
      {
        match: 'one `on_loan` row per copy',
        code:
          "uniqueIndex('library_loans_copy_on_loan_uq').on(t.copyId).where(sql`${t.status} = 'on_loan' and " +
          live +
          '`)',
      },
      { match: '(org_id, branch_id, due_on)', where: "${t.status} = 'on_loan'" },
    ],
  },
  library_reservations: {
    meta: {
      familyRule: { read: true, insert: { status: 'waiting' }, update: { status: 'waiting' } },
    },
  },

  // ------------------------------------------------------------------ M32 · Inventory and assets

  stock_transfers: {
    columns: {
      to_warehouse_id: {
        accounted: 'check',
        checks: [{ suffix: 'differs', sql: '${t.toWarehouseId} <> ${t.fromWarehouseId}' }],
      },
    },
  },
  stock_count_lines: {
    columns: {
      reason: {
        accounted: 'check',
        checks: [
          {
            suffix: 'needed',
            sql: '${t.countedQuantity} is null or ${t.countedQuantity} = ${t.systemQuantity} or ${t.reason} is not null',
          },
        ],
      },
    },
  },
  // Stock going out has a negative quantity, and so a negative value.
  stock_movements: { columns: { value: { signed: true } } },
  assets: {
    columns: { book_value: { generated: '${t.cost} - ${t.accumulatedDepreciation}' } },
  },
  depreciation_runs: {
    columns: { fiscal_period_id: { accounted: 'index' } },
    extra: [
      "uniqueIndex('depreciation_runs_posted_period_uq').on(t.fiscalPeriodId).where(sql`${t.status} = 'posted' and " +
        live +
        '`)',
    ],
  },

  // ------------------------------------------------------------------ M33 · Shop and canteen

  shop_products: { meta: { member: { read: { isActive: true } } } },
  shop_sessions: {
    columns: {
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
    lines: [
      {
        match: 'one open session per cashier per outlet',
        code:
          "uniqueIndex('shop_sessions_open_uq').on(t.cashierId, t.outletId).where(sql`${t.status} = 'open' and " +
          live +
          '`)',
      },
    ],
  },
  shop_sales: {
    policy: 'template',
    columns: {
      student_id: {
        accounted: 'check',
        checks: [
          {
            suffix: 'needed',
            sql: '(${t.paidWallet} = 0 and ${t.chargedToFees} = 0) or ${t.studentId} is not null',
          },
        ],
      },
    },
    lines: [{ match: '(org_id, device_receipt_code)', nulls: 'distinct' }],
  },
  canteen_menus: { meta: { member: { read: { status: 'published' } } } },

  // ------------------------------------------------------------------ M34 · Health

  // A guardian reads their child's profile through the family route, which leaves the nurse's note out.
  health_profiles: { policy: 'service' },
  clinic_visits: {
    meta: { familyRule: { read: { shareWithFamily: true } } },
    columns: { student_id: { accounted: 'check' } },
    extra: ["check('clinic_visits_person', sql`num_nonnulls(${t.studentId}, ${t.staffId}) >= 1`)"],
  },
  // A guardian asks the nurse to give a medicine; the nurse decides.
  medication_plans: { meta: { familyRule: { read: true, insert: { status: 'requested' } } } },
  health_campaigns: {
    meta: { member: { read: { status: ['consent_open', 'in_progress', 'completed'] } } },
  },
  // A guardian gives or refuses consent; the service refuses a change once the campaign has started.
  health_consents: { meta: { familyRule: { read: true, update: true } } },
  health_screenings: {
    columns: {
      bmi: {
        generated:
          'round(${t.weightKg} / ((${t.heightCm} / 100.0) * (${t.heightCm} / 100.0)), 1)',
      },
    },
  },
  // The family route returns the few fields a guardian may see of an incident.
  incident_reports: { policy: 'service' },

  // ------------------------------------------------------------------ M35 · Hostel

  mess_menus: {
    meta: { member: { read: { status: 'published' } } },
    // A menu without a hostel is the one every hostel of the branch follows.
    lines: [{ match: '(branch_id, hostel_id, week_start)', nulls: 'same' }],
  },
  hostel_allocations: {
    lines: [
      {
        match: 'one active allocation per student',
        code:
          "uniqueIndex('hostel_allocations_active_student_uq').on(t.studentId).where(sql`${t.status} = 'active' and " +
          live +
          '`)',
      },
      {
        match: 'An exclusion constraint refuses two allocations of one bed',
        sql: "alter table hostel_allocations add constraint hostel_allocations_bed_no_overlap exclude using gist (bed_id with =, daterange(from_date, to_date, '[]') with &&) where (deleted_at is null)",
      },
    ],
  },
  hostel_authorised_people: {
    // A guardian may propose someone; the person counts only once the warden has confirmed them,
    // so a guardian can add a row only as not yet active. Removing one goes through the service.
    meta: { familyRule: { read: true, insert: { isActive: false } } },
    columns: {
      cnic: {
        accounted: 'check',
        checks: [{ suffix: 'needed', sql: '${t.guardianId} is not null or ${t.cnic} is not null' }],
      },
    },
    sample: { cnic: "'35202-1234567-1'" },
  },
  hostel_leave: {
    meta: {
      familyRule: {
        read: true,
        insert: { status: 'requested' },
        update: { status: ['requested', 'approved'] },
      },
    },
    // Whether the student travels alone is said by the kind of leave and the school's settings.
    columns: { going_with_id: { accounted: 'service' } },
  },

  // ------------------------------------------------------------------ M36 · Helpdesk and facilities

  // Staff of the branch reach tickets as staff; the service adds the reporter's own, wherever they work.
  maintenance_tickets: {
    policy: 'service',
    columns: { waiting_reason: { neededWhen: { status: 'waiting' } } },
  },
  facility_bookings: {
    lines: [
      {
        match: 'An exclusion constraint refuses two approved bookings',
        sql: "alter table facility_bookings add constraint facility_bookings_no_overlap exclude using gist (room_id with =, tstzrange(starts_at, ends_at) with &&) where (status = 'approved' and deleted_at is null)",
      },
    ],
  },
};

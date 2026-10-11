// Wave 7 · Communication: M37 notifications and messaging, M38 chat and parent–teacher meetings,
// M39 notices and events, M40 complaints and surveys, M41 school website.
// See scaffold-hints.mjs for what each field means.

const live = '${t.deletedAt} is null';
const sameOrg = '${t.orgId} = (select app.org_id())';
/** The signed-in user is in the thread, and has not left it. */
const inThread = (threadColumn, extra = '') =>
  `exists (select 1 from chat_participants p where p.thread_id = \${t.${threadColumn}} and p.user_id = (select app.user_id()) and p.left_at is null and p.deleted_at is null${extra})`;

export const wave7 = {
  // ------------------------------------------------------------------ M37 · Notifications and messaging

  // Only the in-app channel starts switched on; provisioning sets that row.
  channel_settings: { columns: { is_enabled: { default: '.default(false)' } } },
  notification_rules: { lines: [{ match: 'A rule marked compulsory', service: true }] },
  whatsapp_templates: {
    columns: { name: { accounted: 'index' } },
    extra: [
      "uniqueIndex('whatsapp_templates_name_language_uq').on(t.orgId, t.name, t.language).where(sql`" +
        live +
        '`)',
    ],
  },
  notifications: { lines: [{ match: 'Rows older than 180 days', note: true }] },
  message_campaigns: {
    columns: {
      body_en: {
        accounted: 'check',
        checks: [{ suffix: 'some', sql: '${t.bodyEn} is not null or ${t.bodyUr} is not null' }],
      },
      whatsapp_template_id: {
        accounted: 'check',
        checks: [
          {
            suffix: 'needed',
            sql: "not ('whatsapp' = any (${t.channels})) or ${t.whatsappTemplateId} is not null",
          },
        ],
      },
    },
    sample: { bodyEn: "'The school will remain closed tomorrow.'" },
  },
  // Staff see what credit was bought and used; only the platform and the delivery job write.
  message_credit_ledger: { meta: { staff: 'read' } },

  // ------------------------------------------------------------------ M38 · Chat and parent–teacher meetings

  // A conversation belongs to the people in it. Nobody reaches a thread through being staff: the
  // only way in is a row in chat_participants. Oversight by a leader goes through the service.
  chat_threads: {
    meta: { staff: 'none', custom: true },
    columns: {
      student_id: { neededWhen: { kind: 'parent_teacher' } },
      section_id: { neededWhen: { kind: 'class_broadcast' } },
      teacher_staff_id: { neededWhen: { kind: 'parent_teacher' } },
    },
    lines: [
      {
        match: '(student_id, teacher_staff_id)',
        where: "${t.kind} = 'parent_teacher' and ${t.status} = 'open'",
        nulls: 'distinct',
      },
      { match: '(section_id) for', where: "${t.kind} = 'class_broadcast'", nulls: 'distinct' },
    ],
    extra: [
      "customPolicy('chat_threads_participant_read', { for: 'select', using: sql`" +
        sameOrg +
        ' and ' +
        inThread('id') +
        '` })',
    ],
    fixture: "() => ({ kind: 'parent_office' })",
  },
  // Being in a thread is what lets a person read it, so nobody may add themselves: a participant
  // reads their own row and nothing more. Joining, leaving, muting and marking as read all go
  // through the service.
  chat_participants: { meta: { staff: 'none', selfAccess: 'read' } },
  // A message is read by the people in its thread; a private reply only by its sender and the person
  // it was sent to. A participant who may post adds messages as themselves.
  chat_messages: {
    meta: { staff: 'none', custom: true },
    columns: { body: { neededWhen: { kind: 'text' } } },
    extra: [
      "customPolicy('chat_messages_participant_read', { for: 'select', using: sql`" +
        sameOrg +
        ' and ' +
        inThread('threadId') +
        ' and (${t.privateToUserId} is null or (select app.user_id()) in (${t.senderId}, ${t.privateToUserId}))` })',
      "customPolicy('chat_messages_participant_insert', { for: 'insert', withCheck: sql`" +
        sameOrg +
        ' and ${t.senderId} = (select app.user_id()) and ' +
        inThread('threadId', ' and p.can_post') +
        '` })',
    ],
  },
  // A report is filed through the service, which checks that the reporter can read the message.
  chat_reports: { policy: 'service' },
  ptm_events: { meta: { member: { read: { status: ['published', 'completed'] } } } },
  // The service shows a guardian the slots of the teachers who teach their children.
  ptm_slots: { meta: { member: 'read' } },
  ptm_bookings: {
    meta: {
      familyRule: { read: true, insert: { status: 'booked' }, update: { status: 'booked' } },
    },
    lines: [
      {
        match: 'one `booked` or `attended` row per slot',
        code:
          "uniqueIndex('ptm_bookings_slot_taken_uq').on(t.slotId).where(sql`${t.status} in ('booked', 'attended') and " +
          live +
          '`)',
      },
      {
        match: 'one per (event_id, student_id, teacher_staff_id)',
        code:
          "uniqueIndex('ptm_bookings_event_student_teacher_uq').on(t.eventId, t.studentId, t.teacherStaffId).where(sql`${t.status} <> 'cancelled' and " +
          live +
          '`)',
      },
    ],
  },
  // A guardian reads a note the teacher shared; the rating and comment are written through the
  // service, which never returns the private note.
  ptm_notes: { meta: { familyRule: { read: { shareWithFamily: true } } } },

  // ------------------------------------------------------------------ M39 · Notices and events

  // Families reach notices and events through their recipient rows and the service.
  notices: { policy: 'service' },
  events: {
    policy: 'service',
    columns: {
      fee_head_id: {
        accounted: 'check',
        checks: [{ suffix: 'needed', sql: '${t.fee} = 0 or ${t.feeHeadId} is not null' }],
      },
    },
  },
  event_registrations: {
    meta: {
      familyRule: {
        read: true,
        insert: { status: ['registered', 'waitlisted'] },
        update: { status: ['registered', 'waitlisted'] },
      },
    },
  },

  // ------------------------------------------------------------------ M40 · Complaints and surveys

  // Whoever raised a complaint may read it. Which staff may is decided by the service.
  complaints: { meta: { selfAccess: 'read' } },
  complaint_updates: { policy: 'service' },
  // A person invited for themselves, not about a child, has no student on the invitation.
  survey_invitations: { lines: [{ match: '(survey_id, user_id, student_id)', nulls: 'same' }] },
  // Answers may be anonymous. Nobody reads them from the tables: results come from the service,
  // which counts and never names.
  survey_responses: { meta: { staff: 'none' } },
  survey_answers: {
    meta: { staff: 'none' },
    lines: [{ match: '(response_id, question_id, about_staff_id)', nulls: 'same' }],
  },

  // ------------------------------------------------------------------ M41 · School website

  site_settings: {
    columns: {
      languages: { default: ".default(sql`'{en}'::text[]`)" },
      seo: { default: '.default({})' },
    },
  },
  // The public reads published pages through the public route, never from the table.
  site_pages: { policy: 'service' },
};

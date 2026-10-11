// Wave 8 · Insight: M42 dashboards and reports, M43 alerts, M44 the AI suite.
// See scaffold-hints.mjs for what each field means.

export const wave8 = {
  // ------------------------------------------------------------------ M42 · Dashboards and reports

  kpi_snapshots: {
    columns: { dims_key: { generated: '(${t.dims})::text' } },
    // A figure for the whole group has no branch; there is still only one of it for a day.
    lines: [{ match: '(org_id, kpi_key, branch_id, snapshot_date, dims_key)', nulls: 'same' }],
  },
  // The owner reaches their own; sharing with a role is applied by the service.
  saved_reports: { policy: 'service' },
  report_schedules: {
    columns: {
      recipient_user_ids: {
        accounted: 'check',
        checks: [{ suffix: 'some', sql: 'cardinality(${t.recipientUserIds}) >= 1' }],
      },
    },
    sample: { recipientUserIds: '[crypto.randomUUID()]' },
  },
  // Staff read the layouts set for roles; a person reads and writes their own.
  dashboard_layouts: {
    meta: { staff: 'read', selfAccess: 'write' },
    columns: {
      user_id: {
        accounted: 'check',
        checks: [{ suffix: 'one_owner', sql: '(${t.roleKey} is null) <> (${t.userId} is null)' }],
      },
    },
  },
  report_runs: { lines: [{ match: 'Rows older than one year', note: true }] },

  // ------------------------------------------------------------------ M43 · Alerts

  // An alert about the whole group has no branch.
  alerts: { lines: [{ match: '(rule_id, branch_id, raised_on)', nulls: 'same' }] },

  // ------------------------------------------------------------------ M44 · AI suite

  ai_settings: { columns: { languages: { default: ".default(sql`'{en,ur}'::text[]`)" } } },
  // A conversation with the assistant is private to the person who had it. Staff do not reach it
  // as staff; supervision of the study helper goes through the service.
  ai_conversations: { meta: { staff: 'none', selfAccess: 'read' } },
  // Messages are written by the service as the conversation goes on; their owner reads them.
  ai_messages: { meta: { staff: 'none', selfAccess: 'read' } },
  ai_outputs: { policy: 'service' },
  knowledge_chunks: {
    columns: {
      search: {
        builder: 'tsvector()',
        zod: 'z.string()',
        generated: "to_tsvector('simple', coalesce(${t.heading}, '') || ' ' || ${t.content})",
      },
      // See `vector` in packages/db/src/kernel/columns.ts for why this is not pgvector's type yet.
      embedding: { builder: 'vector()', zod: 'z.array(z.number())' },
    },
    lines: [{ match: 'a vector index on', note: true }],
  },
  // Scores are for staff who hold the permission; the service checks it. Families never see them.
  risk_scores: { policy: 'service' },
  defaulter_scores: { policy: 'service' },
  // A family reads a child's mastery through the results route, once results are published.
  topic_mastery: {
    policy: 'service',
    // The row without a student is the section's own figure for the topic.
    lines: [{ match: '(section_id, unit_id, student_id)', nulls: 'same' }],
  },
  // That nobody sees a flag about themselves is the service's rule.
  activity_flags: { policy: 'service' },
};

import { z } from 'zod';
import { defineEvent } from '../../kernel/events';

/*
 * The events of the shared kernel: docs/plan/10-modules/m00-shared-kernel.md, section 10.
 * Who is told and how follows docs/plan/30-reference/notification-catalogue.md: these all go to
 * staff, who have the app open, so they ring the bell and send nothing outside.
 *
 * The Urdu wording is reviewed by a native reader in Phase 12.
 */

export const approvalRequested = defineEvent({
  key: 'approval.requested',
  category: 'approvals',
  payload: z.object({
    requestId: z.uuid(),
    entityType: z.string(),
    entityId: z.uuid(),
    summary: z.string(),
    /** The step that is waiting, counting from 1. */
    step: z.int(),
    /** The people who may decide that step, worked out when the request reached it. */
    approverUserIds: z.array(z.uuid()),
  }),
  variables: ['summary'],
  rules: [{ audience: 'approvers-of-request', channels: [] }],
  templates: {
    in_app: {
      en: { title: 'Approval needed', body: '{{summary}}' },
      ur: { title: 'منظوری درکار ہے', body: '{{summary}}' },
    },
  },
});

export const approvalApproved = defineEvent({
  key: 'approval.approved',
  category: 'approvals',
  payload: z.object({
    requestId: z.uuid(),
    entityType: z.string(),
    entityId: z.uuid(),
    summary: z.string(),
    requestedBy: z.uuid(),
  }),
  variables: ['summary'],
  rules: [{ audience: 'requester', channels: [] }],
  templates: {
    in_app: {
      en: { title: 'Approved', body: '{{summary}}' },
      ur: { title: 'منظور ہو گیا', body: '{{summary}}' },
    },
  },
});

export const approvalRejected = defineEvent({
  key: 'approval.rejected',
  category: 'approvals',
  payload: z.object({
    requestId: z.uuid(),
    entityType: z.string(),
    entityId: z.uuid(),
    summary: z.string(),
    requestedBy: z.uuid(),
    note: z.string(),
  }),
  variables: ['summary', 'note'],
  rules: [{ audience: 'requester', channels: [] }],
  templates: {
    in_app: {
      en: { title: 'Not approved', body: '{{summary}}. Reason: {{note}}' },
      ur: { title: 'منظور نہیں ہوا', body: '{{summary}}۔ وجہ: {{note}}' },
    },
  },
});

export const importCompleted = defineEvent({
  key: 'import.completed',
  category: 'system',
  payload: z.object({
    batchId: z.uuid(),
    kind: z.string(),
    /** The person who started the import. */
    userId: z.uuid(),
    created: z.int(),
    failed: z.int(),
  }),
  variables: ['kind', 'created', 'failed'],
  rules: [{ audience: 'user', channels: [] }],
  templates: {
    in_app: {
      en: {
        title: 'Import finished',
        body: '{{created}} added, {{failed}} could not be added.',
      },
      ur: { title: 'درآمد مکمل', body: '{{created}} شامل ہوئے، {{failed}} شامل نہ ہو سکے۔' },
    },
  },
});

export const exportReady = defineEvent({
  key: 'export.ready',
  category: 'system',
  payload: z.object({
    exportId: z.uuid(),
    kind: z.string(),
    /** The person who asked for the export. */
    userId: z.uuid(),
    rows: z.int(),
  }),
  variables: ['kind', 'rows'],
  rules: [{ audience: 'user', channels: [] }],
  templates: {
    in_app: {
      en: { title: 'Your export is ready', body: '{{rows}} rows. Open My exports to download it.' },
      ur: { title: 'آپ کی فائل تیار ہے', body: '{{rows}} سطریں۔ ڈاؤن لوڈ کے لیے "میری فائلیں" کھولیں۔' },
    },
  },
});

export const jobFailed = defineEvent({
  key: 'job.failed',
  category: 'system',
  payload: z.object({ jobId: z.uuid(), jobName: z.string(), error: z.string() }),
  variables: ['jobName', 'error'],
  rules: [{ audience: 'role-in-org', roleKeys: ['it_admin'], channels: [] }],
  templates: {
    in_app: {
      en: { title: 'A background task failed', body: '{{jobName}}: {{error}}' },
      ur: { title: 'پس منظر کا ایک کام ناکام ہوا', body: '{{jobName}}: {{error}}' },
    },
  },
});

export const integrityFinding = defineEvent({
  key: 'integrity.finding',
  category: 'system',
  payload: z.object({
    findingId: z.uuid(),
    checkName: z.string(),
    severity: z.enum(['info', 'warning', 'critical']),
  }),
  variables: ['checkName'],
  rules: [{ audience: 'role-in-org', roleKeys: ['finance_head', 'it_admin'], channels: [] }],
  templates: {
    in_app: {
      en: { title: 'A data check found a difference', body: '{{checkName}}' },
      ur: { title: 'ڈیٹا کی جانچ میں فرق ملا', body: '{{checkName}}' },
    },
  },
});

export const sharedEvents = [
  approvalRequested,
  approvalApproved,
  approvalRejected,
  importCompleted,
  exportReady,
  jobFailed,
  integrityFinding,
] as const;

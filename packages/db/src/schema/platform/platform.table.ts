import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  announcementAudiences,
  announcementSeverities,
  billingCycles,
  demoRequestStatuses,
  orgModuleSources,
  platformRoles,
  studentBands,
  subscriptionInvoiceStatuses,
  subscriptionPaymentMethods,
  subscriptionStatuses,
  supportAccessLevels,
  supportSessionStatuses,
} from '@takhti/contracts';
import { baseColumns } from '../../kernel/base-columns';
import {
  auditColumns,
  dateStr,
  enumChecks,
  enumText,
  idColumn,
  live,
  nonNegative,
  paisa,
  percent,
  table,
  timestamptz,
} from '../../kernel/columns';
import { customPolicy, globalRead, platformOnly, policySql } from '../../kernel/policies';
import { registerTable } from '../../registry';
import { profiles } from '../identity/identity.table';
import { orgs } from '../organisation/orgs.table';
import { files } from '../shared/files.table';

/*
 * Platform tables (M01). They have no automatic `org_id`; where one is needed it is an explicit column.
 * `platform` tables are reachable only through the privileged connection, inside `runAsPlatform`.
 */

export const plans = table(
  'plans',
  {
    id: idColumn(),
    ...auditColumns,
    /** `starter`, `standard`, `enterprise`. */
    key: text().notNull(),
    name: text().notNull(),
    description: text(),
    /** Per month. */
    pricePerStudent: paisa().notNull(),
    minimumMonthly: paisa().notNull().default(0),
    /** Empty means unlimited. */
    maxStudents: integer(),
    maxBranches: integer(),
    trialDays: integer().notNull().default(14),
    aiMonthlyBudget: paisa().notNull().default(0),
    /** Per month. */
    smsIncluded: integer().notNull().default(0),
    /** Shown on the pricing page. */
    isPublic: boolean().notNull().default(true),
    isActive: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [
    nonNegative('plans', t.pricePerStudent),
    nonNegative('plans', t.minimumMonthly),
    nonNegative('plans', t.aiMonthlyBudget),
    nonNegative('plans', t.trialDays),
    uniqueIndex('plans_key_uq').on(t.key).where(live(t)),
    ...globalRead('plans'),
  ],
);
registerTable(plans, 'plans', { module: 'M01', scope: 'global' });

export const planModules = table(
  'plan_modules',
  {
    id: idColumn(),
    createdAt: timestamptz().notNull().defaultNow(),
    planId: uuid()
      .notNull()
      .references(() => plans.id),
    /** A key from the module list. */
    moduleKey: text().notNull(),
  },
  (t) => [uniqueIndex('plan_modules_uq').on(t.planId, t.moduleKey), ...globalRead('plan_modules')],
);
registerTable(planModules, 'plan_modules', { module: 'M01', scope: 'global' });

export const subscriptions = table(
  'subscriptions',
  {
    id: idColumn(),
    ...auditColumns,
    /** One live subscription per organisation. */
    orgId: uuid()
      .notNull()
      .references(() => orgs.id),
    planId: uuid()
      .notNull()
      .references(() => plans.id),
    status: enumText(subscriptionStatuses).notNull(),
    billingCycle: enumText(billingCycles).notNull().default('monthly'),
    /** Copied from the plan when agreed, so a plan price change does not alter existing customers. */
    pricePerStudent: paisa().notNull(),
    discountPercent: percent().notNull().default(0),
    startedOn: dateStr().notNull(),
    trialEndsOn: dateStr(),
    currentPeriodStart: dateStr().notNull(),
    currentPeriodEnd: dateStr().notNull(),
    graceDays: integer().notNull().default(10),
    cancelledOn: dateStr(),
    notes: text(),
  },
  (t) => [
    ...enumChecks('subscriptions', t),
    nonNegative('subscriptions', t.pricePerStudent),
    check('subscriptions_discount_range', sql`${t.discountPercent} between 0 and 100`),
    check('subscriptions_period_chk', sql`${t.currentPeriodEnd} >= ${t.currentPeriodStart}`),
    uniqueIndex('subscriptions_org_uq').on(t.orgId).where(live(t)),
    index('subscriptions_plan_idx').on(t.planId),
    index('subscriptions_status_idx').on(t.status, t.currentPeriodEnd),
    ...platformOnly('subscriptions'),
  ],
);
registerTable(subscriptions, 'subscriptions', { module: 'M01', scope: 'platform' });

export const subscriptionInvoices = table(
  'subscription_invoices',
  {
    id: idColumn(),
    ...auditColumns,
    orgId: uuid()
      .notNull()
      .references(() => orgs.id),
    subscriptionId: uuid()
      .notNull()
      .references(() => subscriptions.id),
    /** `TK-{yyyy}-{00000}` */
    number: text().notNull(),
    periodStart: dateStr().notNull(),
    periodEnd: dateStr().notNull(),
    /** Active students counted on the billing day. */
    studentCount: integer().notNull(),
    amount: paisa().notNull(),
    discount: paisa().notNull().default(0),
    tax: paisa().notNull().default(0),
    /** `amount - discount + tax` */
    total: paisa().notNull(),
    status: enumText(subscriptionInvoiceStatuses).notNull(),
    issuedOn: dateStr(),
    dueOn: dateStr(),
    paidOn: dateStr(),
    paymentMethod: enumText(subscriptionPaymentMethods),
    paymentReference: text(),
    /** The invoice PDF. */
    fileId: uuid().references(() => files.id),
  },
  (t) => [
    ...enumChecks('subscription_invoices', t),
    nonNegative('subscription_invoices', t.studentCount),
    nonNegative('subscription_invoices', t.amount),
    nonNegative('subscription_invoices', t.discount),
    nonNegative('subscription_invoices', t.tax),
    check(
      'subscription_invoices_total_chk',
      sql`${t.total} = ${t.amount} - ${t.discount} + ${t.tax}`,
    ),
    uniqueIndex('subscription_invoices_number_uq').on(t.number),
    uniqueIndex('subscription_invoices_period_uq')
      .on(t.subscriptionId, t.periodStart)
      .where(live(t)),
    index('subscription_invoices_org_idx').on(t.orgId, t.status),
    ...platformOnly('subscription_invoices'),
  ],
);
registerTable(subscriptionInvoices, 'subscription_invoices', { module: 'M01', scope: 'platform' });

/** Which modules an organisation has. Members read it; only platform services write it. */
export const orgModules = table(
  'org_modules',
  {
    ...baseColumns,
    moduleKey: text().notNull(),
    isEnabled: boolean().notNull(),
    source: enumText(orgModuleSources).notNull(),
    note: text(),
  },
  (t) => [
    ...enumChecks('org_modules', t),
    uniqueIndex('org_modules_uq').on(t.orgId, t.moduleKey).where(live(t)),
    // Read-only for the organisation: there is deliberately no write policy.
    customPolicy('org_modules_member_read', { for: 'select', using: policySql.sameOrg(t.orgId) }),
  ],
);
registerTable(orgModules, 'org_modules', {
  module: 'M01',
  scope: 'org',
  staff: 'read',
  member: 'read',
});

export const platformAdmins = table(
  'platform_admins',
  {
    id: idColumn(),
    ...auditColumns,
    userId: uuid()
      .notNull()
      .references(() => profiles.id),
    role: enumText(platformRoles).notNull(),
    isActive: boolean().notNull().default(true),
    /** Access is refused while empty. */
    mfaEnrolledAt: timestamptz(),
  },
  (t) => [
    ...enumChecks('platform_admins', t),
    uniqueIndex('platform_admins_user_uq').on(t.userId).where(live(t)),
    ...platformOnly('platform_admins'),
  ],
);
registerTable(platformAdmins, 'platform_admins', { module: 'M01', scope: 'platform' });

/** Every action Takhti's own staff take. Rows are only ever added. */
export const platformAuditLog = table(
  'platform_audit_log',
  {
    id: idColumn(),
    createdAt: timestamptz().notNull().defaultNow(),
    adminUserId: uuid()
      .notNull()
      .references(() => profiles.id),
    action: text().notNull(),
    targetOrgId: uuid().references(() => orgs.id),
    entityType: text(),
    entityId: uuid(),
    detail: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ip: text(),
    requestId: text().notNull(),
  },
  (t) => [
    index('platform_audit_log_admin_idx').on(t.adminUserId, t.createdAt),
    index('platform_audit_log_org_idx').on(t.targetOrgId, t.createdAt),
    ...platformOnly('platform_audit_log'),
  ],
);
registerTable(platformAuditLog, 'platform_audit_log', {
  module: 'M01',
  scope: 'platform',
  appendOnly: true,
});

/** Time-boxed access by Takhti staff to one organisation. */
export const supportSessions = table(
  'support_sessions',
  {
    id: idColumn(),
    ...auditColumns,
    orgId: uuid()
      .notNull()
      .references(() => orgs.id),
    adminUserId: uuid()
      .notNull()
      .references(() => profiles.id),
    reason: text().notNull(),
    access: enumText(supportAccessLevels).notNull().default('read'),
    status: enumText(supportSessionStatuses).notNull(),
    /** The organisation's owner; required for write access. */
    approvedBy: uuid().references(() => profiles.id),
    startsAt: timestamptz(),
    /** At most 60 minutes after the start. */
    endsAt: timestamptz(),
  },
  (t) => [
    ...enumChecks('support_sessions', t),
    check('support_sessions_reason_chk', sql`char_length(${t.reason}) >= 10`),
    check(
      'support_sessions_length_chk',
      sql`${t.endsAt} is null or ${t.startsAt} is null or ${t.endsAt} <= ${t.startsAt} + interval '60 minutes'`,
    ),
    index('support_sessions_org_idx').on(t.orgId, t.status),
    index('support_sessions_admin_idx').on(t.adminUserId, t.status),
    ...platformOnly('support_sessions'),
  ],
);
registerTable(supportSessions, 'support_sessions', { module: 'M01', scope: 'platform' });

export const featureFlags = table(
  'feature_flags',
  {
    id: idColumn(),
    ...auditColumns,
    key: text().notNull(),
    description: text().notNull(),
    defaultEnabled: boolean().notNull().default(false),
    enabledOrgIds: uuid()
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    disabledOrgIds: uuid()
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
  },
  (t) => [
    uniqueIndex('feature_flags_key_uq').on(t.key).where(live(t)),
    ...platformOnly('feature_flags'),
  ],
);
registerTable(featureFlags, 'feature_flags', { module: 'M01', scope: 'platform' });

export const platformAnnouncements = table(
  'platform_announcements',
  {
    id: idColumn(),
    ...auditColumns,
    title: text().notNull(),
    body: text().notNull(),
    audience: enumText(announcementAudiences).notNull().default('staff'),
    severity: enumText(announcementSeverities).notNull().default('info'),
    startsAt: timestamptz().notNull(),
    endsAt: timestamptz().notNull(),
  },
  (t) => [
    ...enumChecks('platform_announcements', t),
    check('platform_announcements_period_chk', sql`${t.endsAt} > ${t.startsAt}`),
    index('platform_announcements_time_idx').on(t.startsAt, t.endsAt),
    ...globalRead('platform_announcements'),
  ],
);
registerTable(platformAnnouncements, 'platform_announcements', { module: 'M01', scope: 'global' });

export const usageDaily = table(
  'usage_daily',
  {
    id: idColumn(),
    createdAt: timestamptz().notNull().defaultNow(),
    orgId: uuid()
      .notNull()
      .references(() => orgs.id),
    usageDate: dateStr().notNull(),
    activeStudents: integer().notNull().default(0),
    activeUsers: integer().notNull().default(0),
    smsSent: integer().notNull().default(0),
    whatsappSent: integer().notNull().default(0),
    storageBytes: bigint({ mode: 'number' }).notNull().default(0),
    aiCost: paisa().notNull().default(0),
    apiRequests: integer().notNull().default(0),
  },
  (t) => [uniqueIndex('usage_daily_uq').on(t.orgId, t.usageDate), ...platformOnly('usage_daily')],
);
registerTable(usageDaily, 'usage_daily', { module: 'M01', scope: 'platform' });

/** Enquiries from the marketing site. */
export const demoRequests = table(
  'demo_requests',
  {
    id: idColumn(),
    ...auditColumns,
    schoolName: text().notNull(),
    contactName: text().notNull(),
    phone: text().notNull(),
    email: text(),
    city: text(),
    studentBand: enumText(studentBands),
    message: text(),
    /** Campaign or referrer. */
    source: text(),
    status: enumText(demoRequestStatuses).notNull().default('new'),
    assignedTo: uuid().references(() => profiles.id),
    notes: text(),
  },
  (t) => [
    ...enumChecks('demo_requests', t),
    index('demo_requests_status_idx').on(t.status, t.createdAt),
    ...platformOnly('demo_requests'),
  ],
);
registerTable(demoRequests, 'demo_requests', { module: 'M01', scope: 'platform' });

export const platformSettings = table(
  'platform_settings',
  {
    id: idColumn(),
    ...auditColumns,
    key: text().notNull(),
    value: jsonb().notNull(),
  },
  (t) => [
    uniqueIndex('platform_settings_key_uq').on(t.key).where(live(t)),
    ...platformOnly('platform_settings'),
  ],
);
registerTable(platformSettings, 'platform_settings', { module: 'M01', scope: 'platform' });

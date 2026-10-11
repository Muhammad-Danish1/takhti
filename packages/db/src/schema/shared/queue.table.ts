import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { changeSources, jobStatuses, scheduleFanOuts } from '@takhti/contracts';
import { appendColumns, baseColumns } from '../../kernel/base-columns';
import { enumChecks, enumText, idColumn, positive, table, timestamptz } from '../../kernel/columns';
import {
  appendOnly,
  customPolicy,
  platformOnly,
  policySql,
  selfOwned,
} from '../../kernel/policies';
import { registerTable } from '../../registry';
import { profiles } from '../identity/identity.table';
import { branches } from '../organisation/branches.table';
import { orgs } from '../organisation/orgs.table';

/**
 * Counters behind human-facing numbers. One row per number kind, branch and period.
 * Any member's action may take a number (a guardian raising a complaint), so the policy is not staff-only;
 * nobody reaches this table except through `kernel/sequences.ts`.
 */
export const numberSequences = table(
  'number_sequences',
  {
    ...baseColumns,
    /** `admission`, `fee_voucher`, `receipt`, … */
    key: text().notNull(),
    branchId: uuid().references(() => branches.id),
    /** Empty text when the sequence never resets. */
    period: text().notNull().default(''),
    nextValue: integer().notNull().default(1),
  },
  (t) => [
    positive('number_sequences', t.nextValue),
    // NULLS NOT DISTINCT: a sequence with no branch is one row, not many.
    unique('number_sequences_uq').on(t.orgId, t.key, t.branchId, t.period).nullsNotDistinct(),
    customPolicy('number_sequences_member', {
      for: 'all',
      using: policySql.sameOrg(t.orgId),
      withCheck: policySql.sameOrg(t.orgId),
    }),
  ],
);
registerTable(numberSequences, 'number_sequences', {
  module: 'M00',
  scope: 'org',
  member: 'write',
});

/**
 * The background job queue. A job is inserted in the same transaction as the change that needs it.
 * `org_id` is empty for platform jobs, which only the privileged connection can reach.
 * The worker claims and finishes jobs through the privileged connection.
 */
export const jobs = table(
  'jobs',
  {
    id: idColumn(),
    orgId: uuid().references(() => orgs.id),
    createdAt: timestamptz().notNull().defaultNow(),
    updatedAt: timestamptz().notNull().defaultNow(),
    createdBy: uuid(),
    name: text().notNull(),
    payload: jsonb().notNull(),
    status: enumText(jobStatuses).notNull().default('queued'),
    priority: integer().notNull().default(0),
    runAt: timestamptz().notNull().defaultNow(),
    attempts: integer().notNull().default(0),
    maxAttempts: integer().notNull().default(5),
    timeoutSeconds: integer().notNull().default(120),
    /** Jobs sharing a key never run together. */
    concurrencyKey: text(),
    dedupeKey: text(),
    /** The worker that holds it. */
    lockedBy: text(),
    lockedAt: timestamptz(),
    startedAt: timestamptz(),
    finishedAt: timestamptz(),
    lastError: text(),
    parentJobId: uuid().references((): AnyPgColumn => jobs.id),
    /** `{ done, total }` */
    progress: jsonb(),
  },
  (t) => [
    ...enumChecks('jobs', t),
    uniqueIndex('jobs_dedupe_uq')
      .on(t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null and ${t.status} in ('queued', 'running')`),
    index('jobs_claim_idx').on(t.status, t.runAt, t.priority),
    index('jobs_org_name_idx').on(t.orgId, t.name, t.createdAt),
    // The database's own guarantee that two jobs sharing a key never run together.
    uniqueIndex('jobs_concurrency_uq')
      .on(t.concurrencyKey)
      .where(sql`${t.concurrencyKey} is not null and ${t.status} = 'running'`),
    // Any member's action may queue a job for their organisation; only staff see the queue.
    customPolicy('jobs_insert', { for: 'insert', withCheck: policySql.sameOrg(t.orgId) }),
    customPolicy('jobs_read', {
      for: 'select',
      using: sql`${policySql.sameOrg(t.orgId)} and ${policySql.isStaff}`,
    }),
  ],
);
registerTable(jobs, 'jobs', { module: 'M00', scope: 'org', staff: 'append', member: 'insert' });

/** Recurring jobs. */
export const jobSchedules = table(
  'job_schedules',
  {
    id: idColumn(),
    createdAt: timestamptz().notNull().defaultNow(),
    updatedAt: timestamptz().notNull().defaultNow(),
    name: text().notNull(),
    /** Evaluated in Pakistan time. */
    cron: text().notNull(),
    jobName: text().notNull(),
    payload: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),
    fanOut: enumText(scheduleFanOuts).notNull(),
    isEnabled: boolean().notNull().default(true),
    lastEnqueuedFor: timestamptz(),
  },
  (t) => [
    ...enumChecks('job_schedules', t),
    uniqueIndex('job_schedules_name_uq').on(t.name),
    ...platformOnly('job_schedules'),
  ],
);
registerTable(jobSchedules, 'job_schedules', { module: 'M00', scope: 'platform' });

/** Every business event, in the transaction that caused it. */
export const domainEvents = table(
  'domain_events',
  {
    ...appendColumns,
    /** The event key, for example `fee.payment-received`. */
    name: text().notNull(),
    payload: jsonb().notNull(),
    entityType: text(),
    entityId: uuid(),
    requestId: text().notNull(),
    source: enumText(changeSources).notNull(),
  },
  (t) => [
    ...enumChecks('domain_events', t),
    index('domain_events_name_idx').on(t.orgId, t.name, t.createdAt),
    index('domain_events_entity_idx').on(t.orgId, t.entityType, t.entityId),
    ...appendOnly('domain_events', t, { insertBy: 'member', readBy: 'staff' }),
  ],
);
registerTable(domainEvents, 'domain_events', {
  module: 'M00',
  scope: 'org',
  staff: 'append',
  member: 'insert',
  appendOnly: true,
});

/**
 * Stored results of requests that must not run twice.
 * Only the user who made the request can reach its row: a stored response may hold another person's data.
 */
export const idempotencyKeys = table(
  'idempotency_keys',
  {
    id: idColumn(),
    orgId: uuid()
      .notNull()
      .references(() => orgs.id),
    createdAt: timestamptz().notNull().defaultNow(),
    userId: uuid()
      .notNull()
      .references((): AnyPgColumn => profiles.id),
    key: text().notNull(),
    route: text().notNull(),
    requestHash: text().notNull(),
    /** Empty while the first request is still running. */
    responseStatus: integer(),
    responseBody: jsonb(),
    expiresAt: timestamptz().notNull(),
  },
  (t) => [
    uniqueIndex('idempotency_keys_uq').on(t.orgId, t.userId, t.key),
    index('idempotency_keys_expiry_idx').on(t.expiresAt),
    ...selfOwned('idempotency_keys', t.userId, { orgId: t.orgId }),
  ],
);
registerTable(idempotencyKeys, 'idempotency_keys', {
  module: 'M00',
  scope: 'org',
  staff: 'none',
  self: 'userId',
});

export const rateLimits = table(
  'rate_limits',
  {
    key: text().notNull(),
    windowStart: timestamptz().notNull(),
    count: integer().notNull(),
  },
  (t) => [
    uniqueIndex('rate_limits_uq').on(t.key, t.windowStart),
    index('rate_limits_window_idx').on(t.windowStart),
    ...platformOnly('rate_limits'),
  ],
);
registerTable(rateLimits, 'rate_limits', { module: 'M00', scope: 'platform' });

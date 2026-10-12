import { and, count, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  Finding,
  integrityFinding,
  type FindingSeverity,
  type ListFindings,
  type ModuleKey,
  type Page,
  type ResolveFinding,
} from '@takhti/contracts';
import { integrityFindings, profiles } from '@takhti/db';
import { audit } from '../../kernel/audit';
import { stampOf, type Ctx } from '../../kernel/context';
import { notFound, rule } from '../../kernel/errors';
import { emit } from '../../kernel/events';
import { newId } from '../../kernel/ids';
import { defineJob, defineSchedule } from '../../kernel/jobs';
import { isModuleEnabled } from '../../kernel/modules';
import { assertPermission } from '../../kernel/permissions';

/*
 * The nightly data checks and what they find: docs/plan/00-foundation/09-reliability-and-error-proofing.md,
 * section 7, and docs/plan/10-modules/m00-shared-kernel.md.
 *
 * A check states something that must always hold (a voucher's total is the sum of its lines) and
 * returns each place where it does not. Nothing is ever put right by the system: a difference is
 * written down, the people responsible are told, and a person looks.
 *
 * A module registers its checks beside its service:
 *
 *   registerIntegrityCheck({
 *     name: 'accounting.entries-balance', module: 'accounting',
 *     run: (ctx) => ledgerDb.unbalanced(ctx).then((rows) => rows.map(toDifference)),
 *   });
 */

/** One place where what must hold does not. */
export interface Difference {
  /** The record it is about, by its resource name (`fee-vouchers`), when it is about one. */
  entityType?: string;
  entityId?: string;
  /** The figures that differ, for the person who will look. */
  detail: Readonly<Record<string, unknown>>;
  severity: FindingSeverity;
}

export interface IntegrityCheck {
  /** `<module>.<what-must-hold>`: `fees.voucher-totals`. */
  name: string;
  /** A module that is off for the school is not checked. */
  module: ModuleKey;
  run: (ctx: Ctx) => Promise<readonly Difference[]>;
}

const checks = new Map<string, IntegrityCheck>();

export function registerIntegrityCheck(check: IntegrityCheck): void {
  if (!/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(check.name))
    throw new Error(`Check name "${check.name}" must look like module.what-must-hold`);
  checks.set(check.name, check);
}

export const registeredIntegrityChecks = (): IntegrityCheck[] => [...checks.values()];

/** For tests: forgets a check registered by one. */
export function removeIntegrityCheck(name: string): void {
  checks.delete(name);
}

type FindingRow = typeof integrityFindings.$inferSelect;

/**
 * Writes a difference down and tells those responsible. A difference that is already written down
 * and not yet resolved is not written again, so a check that runs every night says a thing once.
 * Returns the id of the new finding, or null when it was already known.
 */
export async function reportFinding(
  ctx: Ctx,
  checkName: string,
  difference: Difference,
): Promise<string | null> {
  const entityType = difference.entityType ?? null;
  const entityId = difference.entityId ?? null;
  const [known] = await ctx.db
    .select({ id: integrityFindings.id })
    .from(integrityFindings)
    .where(
      and(
        eq(integrityFindings.checkName, checkName),
        ne(integrityFindings.status, 'resolved'),
        isNull(integrityFindings.deletedAt),
        entityType === null
          ? isNull(integrityFindings.entityType)
          : eq(integrityFindings.entityType, entityType),
        entityId === null
          ? isNull(integrityFindings.entityId)
          : eq(integrityFindings.entityId, entityId),
      ),
    )
    .limit(1);
  if (known) return null;

  const id = newId();
  await ctx.db.insert(integrityFindings).values({
    id,
    orgId: ctx.actor.orgId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    createdBy: stampOf(ctx),
    updatedBy: stampOf(ctx),
    checkName,
    entityType,
    entityId,
    detail: difference.detail as never,
    severity: difference.severity,
  });
  await emit(
    ctx,
    integrityFinding,
    { findingId: id, checkName, severity: difference.severity },
    { entityType: 'integrity-findings', entityId: id },
  );
  return id;
}

/** Runs every registered check of the modules the school has, and writes down what is new. */
export async function runIntegrityChecks(
  ctx: Ctx,
): Promise<{ checks: number; differences: number; reported: number }> {
  let ran = 0;
  let differences = 0;
  let reported = 0;
  for (const check of checks.values()) {
    if (!(await isModuleEnabled(ctx, check.module))) continue;
    ran++;
    for (const difference of await check.run(ctx)) {
      differences++;
      if (await reportFinding(ctx, check.name, difference)) reported++;
    }
  }
  return { checks: ran, differences, reported };
}

export const integrityJob = defineJob({
  name: 'shared.integrity',
  payload: z.object({ scheduledFor: z.string().optional() }),
  retries: 2,
  timeoutSeconds: 900,
  handler: async (ctx) => {
    const outcome = await runIntegrityChecks(ctx);
    ctx.log.info(outcome, 'data checks finished');
  },
});

/** 02:00 in Pakistan, for each school. */
export const integritySchedule = defineSchedule({
  name: 'shared.integrity.nightly',
  cron: '0 2 * * *',
  job: integrityJob,
  fanOut: 'per_org',
});

async function toFindings(ctx: Ctx, rows: readonly FindingRow[]): Promise<Finding[]> {
  const closers = [...new Set(rows.flatMap((row) => row.resolvedBy ?? []))];
  const names =
    closers.length === 0
      ? []
      : await ctx.db
          .select({ id: profiles.id, fullName: profiles.fullName })
          .from(profiles)
          .where(inArray(profiles.id, closers));
  const nameOf = new Map(names.map((row) => [row.id, row.fullName]));
  return rows.map((row) =>
    Finding.parse({
      ...row,
      resolvedByName: row.resolvedBy ? (nameOf.get(row.resolvedBy) ?? null) : null,
    }),
  );
}

async function locked(ctx: Ctx, id: string): Promise<FindingRow> {
  const [row] = await ctx.db
    .select()
    .from(integrityFindings)
    .where(and(eq(integrityFindings.id, id), isNull(integrityFindings.deletedAt)))
    .limit(1)
    .for('update');
  if (!row) throw notFound('Finding');
  return row;
}

export const integrityFindingsService = {
  /** What the checks found: open before acknowledged before resolved, the most serious first, then the newest. */
  async list(ctx: Ctx, query: ListFindings): Promise<Page<Finding>> {
    assertPermission(ctx, 'integrity:read');
    const where = and(
      isNull(integrityFindings.deletedAt),
      query.status ? eq(integrityFindings.status, query.status) : undefined,
      query.severity ? eq(integrityFindings.severity, query.severity) : undefined,
      query.checkName ? eq(integrityFindings.checkName, query.checkName) : undefined,
    );
    const rows = await ctx.db
      .select()
      .from(integrityFindings)
      .where(where)
      .orderBy(
        sql`case ${integrityFindings.status} when 'open' then 0 when 'acknowledged' then 1 else 2 end`,
        sql`case ${integrityFindings.severity} when 'critical' then 0 when 'warning' then 1 else 2 end`,
        desc(integrityFindings.createdAt),
        desc(integrityFindings.id),
      )
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const [counted] = await ctx.db.select({ total: count() }).from(integrityFindings).where(where);
    return {
      items: await toFindings(ctx, rows),
      page: query.page,
      pageSize: query.pageSize,
      total: counted?.total ?? 0,
    };
  },

  /** Somebody has seen it and is looking into it. The finding stays until it is resolved. */
  async acknowledge(ctx: Ctx, id: string): Promise<Finding> {
    assertPermission(ctx, 'integrity:update');
    const current = await locked(ctx, id);
    if (current.status === 'acknowledged') return (await toFindings(ctx, [current]))[0] as Finding;
    if (current.status === 'resolved') throw rule('This finding has already been resolved');
    const [row] = await ctx.db
      .update(integrityFindings)
      .set({
        status: 'acknowledged',
        version: current.version + 1,
        updatedAt: ctx.now,
        updatedBy: stampOf(ctx),
      })
      .where(eq(integrityFindings.id, id))
      .returning();
    await audit(ctx, 'integrity-findings', 'acknowledge', id, {
      before: current,
      after: row as FindingRow,
      summary: `Acknowledged a finding of the check ${current.checkName}`,
    });
    return (await toFindings(ctx, [row as FindingRow]))[0] as Finding;
  },

  /** Closes a finding, with what was wrong and what was done. If the difference is still there, the next run reports it afresh. */
  async resolve(ctx: Ctx, id: string, input: ResolveFinding): Promise<Finding> {
    assertPermission(ctx, 'integrity:update');
    const current = await locked(ctx, id);
    if (current.status === 'resolved') throw rule('This finding has already been resolved');
    const [row] = await ctx.db
      .update(integrityFindings)
      .set({
        status: 'resolved',
        resolvedBy: ctx.actor.userId,
        resolvedNote: input.note,
        version: current.version + 1,
        updatedAt: ctx.now,
        updatedBy: stampOf(ctx),
      })
      .where(eq(integrityFindings.id, id))
      .returning();
    await audit(ctx, 'integrity-findings', 'resolve', id, {
      before: current,
      after: row as FindingRow,
      summary: `Resolved a finding of the check ${current.checkName}`,
    });
    return (await toFindings(ctx, [row as FindingRow]))[0] as Finding;
  },
};

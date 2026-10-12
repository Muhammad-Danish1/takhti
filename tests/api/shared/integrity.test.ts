import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Finding, Page } from '@takhti/contracts';
import {
  claimJobs,
  enqueue,
  findJob,
  integrityJob,
  integritySchedule,
  registerIntegrityCheck,
  registeredIntegrityChecks,
  removeIntegrityCheck,
  runAsSystem,
  runClaimedJob,
  runIntegrityChecks,
  type Actor,
  type Difference,
} from '@takhti/core';
import { adminDb, auditLog, domainEvents, integrityFindings } from '@takhti/db';
import * as acknowledge from '../../../apps/web/app/api/v1/integrity-findings/[id]/acknowledge/route';
import * as resolve from '../../../apps/web/app/api/v1/integrity-findings/[id]/resolve/route';
import * as findings from '../../../apps/web/app/api/v1/integrity-findings/route';
import { callRoute } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { seedOrg, type TestOrg } from '../../helpers/world';

/*
 * The nightly data checks and what they find: docs/plan/00-foundation/09-reliability-and-error-proofing.md,
 * section 7, and docs/plan/10-modules/m00-shared-kernel.md.
 * The checks here are made up for the tests; each module's real ones come with the module.
 */

let db: TestDb;
let school: TestOrg;
let other: TestOrg;
let principal: Actor;
let financeHead: Actor;
let itAdmin: Actor;
let teacher: Actor;
let outsider: Actor;

const voucherId = randomUUID();
const CHECKS = ['tests.voucher-totals', 'tests.trial-balance', 'tests.always-fine'];
/** What the made-up checks find, by school: changed by the tests as "the data" changes. */
const state = new Map<string, Record<string, Difference[]>>();
const differencesOf = (orgId: string, check: string): Difference[] => state.get(orgId)?.[check] ?? [];

const list = (actor: Actor, query = '') =>
  callRoute<Page<Finding>>(findings.GET, { as: actor, url: `/api/v1/integrity-findings${query}` });
const act = (route: typeof acknowledge | typeof resolve, actor: Actor, id: string, body?: unknown) =>
  callRoute<Finding>(route.POST, {
    as: actor,
    method: 'POST',
    url: '/x',
    params: { id },
    ...(body !== undefined && { body }),
  });
const run = (orgId = school.orgId) => runAsSystem(orgId, {}, (ctx) => runIntegrityChecks(ctx));

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  other = await seedOrg();
  principal = await school.actor('principal');
  financeHead = await school.actor('finance_head');
  itAdmin = await school.actor('it_admin');
  teacher = await school.actor('class_teacher');
  outsider = await other.actor('principal');
  for (const name of CHECKS)
    registerIntegrityCheck({
      name,
      module: 'fees',
      run: (ctx) => Promise.resolve(differencesOf(ctx.actor.orgId, name)),
    });
  state.set(school.orgId, {
    'tests.voucher-totals': [
      {
        entityType: 'fee-vouchers',
        entityId: voucherId,
        detail: { total: 450000, sumOfLines: 440000 },
        severity: 'critical',
      },
    ],
    'tests.trial-balance': [{ detail: { debits: 1000, credits: 990 }, severity: 'warning' }],
  });
});
afterAll(async () => {
  for (const name of CHECKS) removeIntegrityCheck(name);
  await db.destroy();
});

describe('the nightly data checks', () => {
  it('each difference a check finds is written down once and those responsible are told; nothing is put right', async () => {
    expect(await run()).toMatchObject({ differences: 2, reported: 2 });
    // The same differences the next night are already known.
    expect(await run()).toMatchObject({ differences: 2, reported: 0 });
    // Another school has none.
    expect(await run(other.orgId)).toMatchObject({ differences: 0, reported: 0 });

    const rows = await adminDb()
      .select()
      .from(integrityFindings)
      .where(eq(integrityFindings.orgId, school.orgId));
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.checkName === 'tests.voucher-totals')).toMatchObject({
      entityType: 'fee-vouchers',
      entityId: voucherId,
      detail: { total: 450000, sumOfLines: 440000 },
      severity: 'critical',
      status: 'open',
    });
    const told = await adminDb()
      .select()
      .from(domainEvents)
      .where(and(eq(domainEvents.orgId, school.orgId), eq(domainEvents.name, 'integrity.finding')));
    expect(told).toHaveLength(2);
    expect(() => registerIntegrityCheck({ name: 'Not a name', module: 'fees', run: () => Promise.resolve([]) })).toThrow(
      /must look like/,
    );
    expect(registeredIntegrityChecks().map((check) => check.name)).toEqual(expect.arrayContaining(CHECKS));
  });

  it('the checks run each night for every school, as the job `shared.integrity`', async () => {
    expect(findJob('shared.integrity')).toBe(integrityJob);
    expect(integritySchedule).toMatchObject({ cron: '0 2 * * *', fanOut: 'per_org' });
    state.set(other.orgId, {
      'tests.trial-balance': [{ detail: { debits: 5, credits: 4 }, severity: 'info' }],
    });
    await runAsSystem(other.orgId, {}, (ctx) => enqueue(ctx, integrityJob, {}));
    const claimed = (await claimJobs({ limit: 20, workerId: 'test', perOrgLimit: 20 })).filter(
      (job) => job.name === 'shared.integrity',
    );
    expect(claimed).toHaveLength(1);
    expect(await runClaimedJob(claimed[0]!)).toBe('succeeded');
    const rows = await adminDb()
      .select()
      .from(integrityFindings)
      .where(eq(integrityFindings.orgId, other.orgId));
    expect(rows.map((row) => [row.checkName, row.severity])).toEqual([['tests.trial-balance', 'info']]);
  });
});

describe('integrity findings', () => {
  it('those permitted see them: the open and the most serious first', async () => {
    const listed = await list(itAdmin);
    expect(listed.status).toBe(200);
    expect(listed.data.items.map((item) => [item.checkName, item.severity, item.status])).toEqual([
      ['tests.voucher-totals', 'critical', 'open'],
      ['tests.trial-balance', 'warning', 'open'],
    ]);
    expect(listed.data.items[0]).toMatchObject({
      entityType: 'fee-vouchers',
      entityId: voucherId,
      detail: { total: 450000, sumOfLines: 440000 },
      resolvedBy: null,
      resolvedByName: null,
      resolvedNote: null,
    });
    expect((await list(financeHead, '?severity=warning')).data.total).toBe(1);
    expect((await list(financeHead, '?checkName=tests.voucher-totals')).data.total).toBe(1);
    expect((await list(financeHead, '?status=resolved')).data.total).toBe(0);
    expect((await list(teacher)).status).toBe(403);
    // Another school sees its own, never this one's.
    expect((await list(outsider)).data.items.map((item) => item.severity)).toEqual(['info']);
    expect((await list(principal, '?severity=fatal')).status).toBe(422);
  });

  it('a finding is acknowledged, then resolved with a note of what was done', async () => {
    const [critical, warning] = (await list(principal)).data.items;
    // Someone who may only look cannot close.
    expect((await act(acknowledge, itAdmin, critical!.id)).status).toBe(403);
    expect((await act(acknowledge, outsider, critical!.id)).status).toBe(404);

    const seen = await act(acknowledge, financeHead, critical!.id);
    expect(seen.status).toBe(200);
    expect(seen.data).toMatchObject({ status: 'acknowledged', version: 2, resolvedBy: null });
    // Acknowledging again changes nothing.
    expect((await act(acknowledge, principal, critical!.id)).data.version).toBe(2);
    // An acknowledged finding gives way to one nobody has looked at yet.
    expect((await list(principal)).data.items.map((item) => item.status)).toEqual(['open', 'acknowledged']);

    const noNote = await act(resolve, financeHead, critical!.id, { note: '  ' });
    expect(noNote.status).toBe(422);
    expect(noNote.error?.fields).toEqual({ note: ['Say what was done about it'] });
    const closed = await act(resolve, financeHead, critical!.id, {
      note: 'A line was entered twice. The adjustment FA-0012 corrects it.',
    });
    expect(closed.data).toMatchObject({
      status: 'resolved',
      resolvedBy: financeHead.userId,
      resolvedByName: 'Group Finance Head',
      resolvedNote: 'A line was entered twice. The adjustment FA-0012 corrects it.',
    });
    // A finding may be resolved without having been acknowledged first.
    expect((await act(resolve, principal, warning!.id, { note: 'Rounding in the opening entry.' })).data.status).toBe(
      'resolved',
    );
    // What is closed stays closed.
    const again = await act(resolve, principal, critical!.id, { note: 'Once more' });
    expect(again.status).toBe(409);
    expect(again.error?.message).toBe('This finding has already been resolved');
    expect((await act(acknowledge, principal, critical!.id)).status).toBe(409);

    const entries = await adminDb().select().from(auditLog).where(eq(auditLog.entityId, critical!.id));
    expect(entries.map((entry) => entry.action).sort()).toEqual(['acknowledge', 'resolve']);
  });

  it('a difference that is still there after its finding was resolved is reported afresh', async () => {
    expect(await run()).toMatchObject({ differences: 2, reported: 2 });
    const listed = await list(principal, '?pageSize=10');
    expect(listed.data.items.map((item) => item.status)).toEqual(['open', 'open', 'resolved', 'resolved']);
    // And one that has gone is simply not reported again.
    state.set(school.orgId, {});
    expect(await run()).toMatchObject({ differences: 0, reported: 0 });
    expect((await list(principal)).data.total).toBe(4);
  });
});

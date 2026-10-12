import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ApprovalPolicy, ApprovalRequest, Page } from '@takhti/contracts';
import {
  actorFor,
  claimJobs,
  invalidateAccess,
  onApprovalDecided,
  requestApproval,
  runClaimedJob,
  type Actor,
} from '@takhti/core';
import {
  adminDb,
  approvalRequests,
  approvalSteps,
  jobs,
  membershipRoles,
  notifications,
} from '@takhti/db';
import * as policyItem from '../../../apps/web/app/api/v1/approval-policies/[id]/route';
import * as policyList from '../../../apps/web/app/api/v1/approval-policies/route';
import * as approveRoute from '../../../apps/web/app/api/v1/approvals/[id]/approve/route';
import * as cancelRoute from '../../../apps/web/app/api/v1/approvals/[id]/cancel/route';
import * as rejectRoute from '../../../apps/web/app/api/v1/approvals/[id]/reject/route';
import * as approvalItem from '../../../apps/web/app/api/v1/approvals/[id]/route';
import * as approvalList from '../../../apps/web/app/api/v1/approvals/route';
import { callRoute } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { as, seedOrg, type TestOrg } from '../../helpers/world';

/*
 * Approvals through their routes: the policies, the inbox and the decisions.
 * Rules, failure cases and tests: docs/plan/10-modules/m00-shared-kernel.md.
 */

let db: TestDb;
let school: TestOrg;
let accountant: Actor;
let principal: Actor;
let cityPrincipal: Actor;
let financeHead: Actor;
let academicHead: Actor;
let teacher: Actor;

const Rs = (rupees: number) => rupees * 100;
const KIND = 'tests-expenses';
const decided: { approved: string[]; rejected: [string, string][] } = { approved: [], rejected: [] };

const addPolicy = (actor: Actor, body: unknown) =>
  callRoute<ApprovalPolicy>(policyList.POST, {
    as: actor,
    method: 'POST',
    url: '/api/v1/approval-policies',
    body,
  });
const inbox = (actor: Actor, query = '') =>
  callRoute<Page<ApprovalRequest>>(approvalList.GET, {
    as: actor,
    url: `/api/v1/approvals${query}`,
  });
const open = (actor: Actor, id: string) =>
  callRoute<ApprovalRequest>(approvalItem.GET, {
    as: actor,
    url: `/api/v1/approvals/${id}`,
    params: { id },
  });
const decide = (
  route: typeof approveRoute,
  actor: Actor,
  id: string,
  body: unknown = {},
  key: string | null = randomUUID(),
) =>
  callRoute<ApprovalRequest>(route.POST, {
    as: actor,
    method: 'POST',
    url: `/api/v1/approvals/${id}/decide`,
    params: { id },
    body,
    ...(key && { headers: { 'idempotency-key': key } }),
  });
const approve = (actor: Actor, id: string, body?: unknown, key?: string | null) =>
  decide(approveRoute, actor, id, body, key);
const reject = (actor: Actor, id: string, body?: unknown, key?: string | null) =>
  decide(rejectRoute, actor, id, body, key);
const withdraw = (actor: Actor, id: string) =>
  callRoute<ApprovalRequest>(cancelRoute.POST, {
    as: actor,
    method: 'POST',
    url: `/api/v1/approvals/${id}/cancel`,
    params: { id },
  });

/** The accountant asks for approval of an expense, as the expenses service will. */
async function ask(amount: number, branch: 'main' | 'city' = 'main', by: Actor = accountant) {
  const entityId = randomUUID();
  const started = await as(by, (ctx) =>
    requestApproval(ctx, {
      entityType: KIND,
      entityId,
      summary: `Expense of Rs ${amount / 100}`,
      amount,
      branchId: branch === 'main' ? school.mainBranchId : school.cityBranchId,
    }),
  );
  if (!started.needed) throw new Error('expected an approval request');
  return { requestId: started.requestId, entityId };
}

async function drain(): Promise<void> {
  for (let round = 0; round < 10; round++) {
    const claimed = await claimJobs({ workerId: 'test', limit: 50, perOrgLimit: 50 });
    if (claimed.length === 0) return;
    for (const job of claimed) await runClaimedJob(job);
  }
}
const bellOf = (actor: Actor) =>
  adminDb()
    .select()
    .from(notifications)
    .where(and(eq(notifications.orgId, school.orgId), eq(notifications.userId, actor.userId)));

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  accountant = await school.actor('accountant', { branch: 'both' });
  principal = await school.actor('principal');
  cityPrincipal = await school.actor('principal', { branch: 'city' });
  financeHead = await school.actor('finance_head');
  academicHead = await school.actor('academic_head');
  teacher = await school.actor('class_teacher');
  onApprovalDecided(KIND, {
    approved: async (_ctx, entityId) => {
      decided.approved.push(entityId);
    },
    rejected: async (_ctx, entityId, note) => {
      decided.rejected.push([entityId, note]);
    },
  });
});
afterAll(async () => {
  await db.destroy();
});
beforeEach(async () => {
  await adminDb().delete(jobs);
});

describe('approval policies', () => {
  it('a policy is created with its steps, listed by the kind of record it is for, changed and found by people who may read it', async () => {
    const small = await addPolicy(principal, {
      entityType: KIND,
      name: 'Expenses',
      steps: [{ roleKeys: ['principal'] }],
    });
    expect(small.status).toBe(201);
    expect(small.data).toMatchObject({
      entityType: KIND,
      name: 'Expenses',
      minAmount: null,
      isActive: true,
      steps: [{ roleKeys: ['principal'] }],
    });
    const large = await addPolicy(financeHead, {
      entityType: KIND,
      name: 'Large expenses',
      minAmount: Rs(50_000),
      steps: [{ roleKeys: ['principal'] }, { roleKeys: ['finance_head', 'director'] }],
    });
    expect(large.status).toBe(201);

    const listed = await callRoute<Page<ApprovalPolicy>>(policyList.GET, {
      as: financeHead,
      url: `/api/v1/approval-policies?entityType=${KIND}`,
    });
    expect(listed.data.items.map((policy) => policy.name).sort()).toEqual([
      'Expenses',
      'Large expenses',
    ]);

    const renamed = await callRoute<ApprovalPolicy>(policyItem.PATCH, {
      as: principal,
      method: 'PATCH',
      url: `/api/v1/approval-policies/${small.data.id}`,
      params: { id: small.data.id },
      body: { version: 1, name: 'Everyday expenses' },
    });
    expect(renamed.data).toMatchObject({ name: 'Everyday expenses', version: 2 });
  });

  it('a step must name roles the school has, held by staff; and only some people may write policies', async () => {
    const unknown = await addPolicy(principal, {
      entityType: KIND,
      name: 'x policy',
      steps: [{ roleKeys: ['headmaster_general'] }],
    });
    expect(unknown.status).toBe(422);
    expect(unknown.error?.fields).toEqual({
      steps: ['This school has no role named headmaster_general'],
    });
    const family = await addPolicy(principal, {
      entityType: KIND,
      name: 'x policy',
      steps: [{ roleKeys: ['guardian'] }],
    });
    expect(family.error?.fields).toEqual({
      steps: ['A step is decided by staff, not by a guardian or a student'],
    });
    const none = await addPolicy(principal, { entityType: KIND, name: 'x policy', steps: [] });
    expect(none.error?.fields).toHaveProperty('steps');
    expect(
      (await addPolicy(teacher, { entityType: KIND, name: 'x policy', steps: [{ roleKeys: ['principal'] }] }))
        .status,
    ).toBe(403);
  });
});

describe('T-shared-4 which policy applies', () => {
  it('R-shared-4 the active policy with the highest threshold the amount reaches; with no policy, no approval is needed', async () => {
    const small = await ask(Rs(10_000));
    expect((await open(accountant, small.requestId)).data.stepCount).toBe(1);
    const large = await ask(Rs(80_000));
    expect((await open(accountant, large.requestId)).data.stepCount).toBe(2);
    const exact = await ask(Rs(50_000));
    expect((await open(accountant, exact.requestId)).data.stepCount).toBe(2);

    const none = await as(accountant, (ctx) =>
      requestApproval(ctx, { entityType: 'tests-nothing', entityId: randomUUID(), summary: 'x' }),
    );
    expect(none).toEqual({ needed: false });
  });
});

describe('T-shared-3 a request with two steps', () => {
  it('waits for the first step’s people, then the second’s; the owning module is told once, at the end', async () => {
    const { requestId, entityId } = await ask(Rs(120_000));

    // In the inbox of the principal of that branch, and of nobody at the second step yet.
    const first = await inbox(principal);
    const waiting = first.data.items.find((item) => item.id === requestId);
    expect(waiting).toMatchObject({
      summary: 'Expense of Rs 120000',
      amount: Rs(120_000),
      status: 'pending',
      currentStep: 1,
      stepCount: 2,
      canDecide: true,
      requestedBy: accountant.userId,
      requestedByName: 'Imran Sheikh',
    });
    expect((await inbox(financeHead)).data.items.map((item) => item.id)).not.toContain(requestId);
    // The person who asked sees it among their own, not among what waits for them.
    expect((await inbox(accountant)).data.items.map((item) => item.id)).not.toContain(requestId);
    expect((await inbox(accountant, '?scope=mine')).data.items.map((item) => item.id)).toContain(
      requestId,
    );

    const afterFirst = await approve(principal, requestId, { note: 'Within budget' });
    expect(afterFirst.status).toBe(200);
    expect(afterFirst.data).toMatchObject({ status: 'pending', currentStep: 2, canDecide: false });
    expect(decided.approved).not.toContain(entityId);

    expect((await inbox(principal)).data.items.map((item) => item.id)).not.toContain(requestId);
    expect((await inbox(financeHead)).data.items.map((item) => item.id)).toContain(requestId);

    const done = await approve(financeHead, requestId);
    expect(done.data).toMatchObject({ status: 'approved', canDecide: false });
    expect(done.data.steps).toMatchObject([
      {
        stepOrder: 1,
        roleKeys: ['principal'],
        status: 'approved',
        decidedBy: principal.userId,
        decidedByName: 'Rubina Qureshi',
        note: 'Within budget',
      },
      {
        stepOrder: 2,
        roleKeys: ['finance_head', 'director'],
        status: 'approved',
        decidedBy: financeHead.userId,
      },
    ]);
    // R-shared-7: the owning module reacted, once.
    expect(decided.approved.filter((id) => id === entityId)).toHaveLength(1);
    expect((await approve(financeHead, requestId)).status).toBe(409);
  });

  it('R-shared-5 the person who asked can never decide their own request', async () => {
    // A principal asks; she holds the role of the step, and still may not approve it.
    const { requestId } = await ask(Rs(5_000), 'main', principal);
    const own = await approve(principal, requestId);
    expect(own.status).toBe(409);
    expect(own.error?.message).toBe('You cannot approve your own request');
    expect((await inbox(principal)).data.items.map((item) => item.id)).not.toContain(requestId);
    expect((await open(principal, requestId)).data.canDecide).toBe(false);
  });

  it('R-shared-6 someone without the step’s role, or who does not work at the request’s branch, cannot decide it', async () => {
    const { requestId } = await ask(Rs(5_000));
    const wrongRole = await approve(teacher, requestId);
    expect(wrongRole.status).toBe(403);
    // The principal of City Campus holds the role, but the request is Main Campus's.
    expect((await inbox(cityPrincipal)).data.items.map((item) => item.id)).not.toContain(requestId);
    const wrongBranch = await approve(cityPrincipal, requestId);
    expect(wrongBranch.status).toBe(403);
    expect(wrongBranch.error?.message).toBe('This request belongs to a branch you do not work at');
    // And she decides City Campus's own.
    const city = await ask(Rs(5_000), 'city');
    expect((await approve(cityPrincipal, city.requestId)).data.status).toBe('approved');
  });

  it('R-shared-7 a rejection needs a note, ends the request, and tells the owning module why', async () => {
    const { requestId, entityId } = await ask(Rs(90_000));
    const silent = await reject(principal, requestId, {});
    expect(silent.status).toBe(422);
    expect(silent.error?.fields).toEqual({ note: ['Say why this is rejected'] });

    const refused = await reject(principal, requestId, { note: 'No quotation attached' });
    expect(refused.data.status).toBe('rejected');
    expect(refused.data.steps?.map((step) => step.status)).toEqual(['rejected', 'skipped']);
    expect(decided.rejected).toContainEqual([entityId, 'No quotation attached']);
    expect((await approve(financeHead, requestId)).status).toBe(409);
  });
});

describe('deciding once', () => {
  it('a decision sent twice with the same key is taken once and answered the same', async () => {
    const { requestId, entityId } = await ask(Rs(5_000));
    const key = randomUUID();
    const first = await approve(principal, requestId, {}, key);
    const again = await approve(principal, requestId, {}, key);
    expect(first.status).toBe(200);
    expect(again.status).toBe(200);
    expect(again.headers.get('idempotent-replayed')).toBe('true');
    expect(again.data.status).toBe('approved');
    expect(decided.approved.filter((id) => id === entityId)).toHaveLength(1);
  });

  it('a decision without a key is refused before anything is decided', async () => {
    const { requestId } = await ask(Rs(5_000));
    const response = await approve(principal, requestId, {}, null);
    expect(response.status).toBe(422);
    expect(response.error?.fields).toHaveProperty('Idempotency-Key');
    expect((await open(principal, requestId)).data.status).toBe('pending');
  });
});

describe('who sees a request', () => {
  it('the person who asked, those who may decide or decided, and those who may read all; to anyone else it does not exist', async () => {
    const { requestId } = await ask(Rs(5_000));
    expect((await open(accountant, requestId)).status).toBe(200);
    expect((await open(principal, requestId)).status).toBe(200);
    expect((await open(academicHead, requestId)).status).toBe(200);
    expect((await open(teacher, requestId)).status).toBe(404);
    expect((await open(teacher, randomUUID())).status).toBe(404);

    expect((await inbox(teacher, '?scope=all')).status).toBe(403);
    const all = await inbox(academicHead, `?scope=all&status=pending&entityType=${KIND}`);
    expect(all.status).toBe(200);
    expect(all.data.items.map((item) => item.id)).toContain(requestId);
    expect(all.data.items.every((item) => item.status === 'pending')).toBe(true);
    expect(all.data.total).toBeGreaterThanOrEqual(all.data.items.length);
    expect((await inbox(principal, '?scope=nonsense')).status).toBe(422);
  });

  it('the person who asked may withdraw a waiting request; nobody else may', async () => {
    const { requestId } = await ask(Rs(5_000));
    expect((await withdraw(teacher, requestId)).status).toBe(404);
    expect((await withdraw(academicHead, requestId)).status).toBe(403);
    const withdrawn = await withdraw(accountant, requestId);
    expect(withdrawn.data.status).toBe('cancelled');
    expect((await approve(principal, requestId)).status).toBe(409);
    const [row] = await adminDb()
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, requestId));
    expect(row?.status).toBe('cancelled');
    const steps = await adminDb()
      .select()
      .from(approvalSteps)
      .where(eq(approvalSteps.requestId, requestId));
    expect(steps.map((step) => step.status)).toEqual(['skipped']);
  });

  it('F-shared-3 when one holder of the step’s role loses it, the request stays waiting for the others', async () => {
    const second = await school.member({ role: 'principal' });
    const deputy = await actorFor({ userId: second.userId, membershipId: second.membershipId });
    const { requestId } = await ask(Rs(5_000));
    expect((await inbox(deputy)).data.items.map((item) => item.id)).toContain(requestId);

    await adminDb()
      .delete(membershipRoles)
      .where(eq(membershipRoles.membershipId, second.membershipId));
    invalidateAccess(second.membershipId);
    expect((await inbox(deputy)).data.items.map((item) => item.id)).not.toContain(requestId);
    expect((await approve(deputy, requestId)).status).toBe(403);
    expect((await inbox(principal)).data.items.map((item) => item.id)).toContain(requestId);
    expect((await open(principal, requestId)).data.status).toBe('pending');
  });
});

describe('telling people', () => {
  it('those who may decide are told a request is waiting; the person who asked is told how it ended', async () => {
    const { requestId } = await ask(Rs(120_000));
    await drain();
    const forPrincipal = (await bellOf(principal)).filter((row) => row.entityId === requestId);
    expect(forPrincipal).toHaveLength(1);
    expect(forPrincipal[0]).toMatchObject({
      eventKey: 'approval.requested',
      category: 'approvals',
      title: 'Approval needed',
      body: 'Expense of Rs 120000',
      entityType: 'approval-requests',
    });
    // Not the person who asked, not someone of another branch, not the second step yet.
    for (const person of [accountant, cityPrincipal, financeHead])
      expect((await bellOf(person)).filter((row) => row.entityId === requestId)).toEqual([]);

    await approve(principal, requestId);
    await drain();
    expect(
      (await bellOf(financeHead)).filter((row) => row.entityId === requestId).map((row) => row.eventKey),
    ).toEqual(['approval.requested']);

    await reject(financeHead, requestId, { note: 'Over the term budget' });
    await drain();
    const forRequester = (await bellOf(accountant)).filter((row) => row.entityId === requestId);
    expect(forRequester).toHaveLength(1);
    expect(forRequester[0]).toMatchObject({
      eventKey: 'approval.rejected',
      title: 'Not approved',
      body: 'Expense of Rs 120000. Reason: Over the term budget',
    });
  });

  it('a policy with requests still waiting cannot be deleted', async () => {
    const policy = await addPolicy(principal, {
      entityType: 'tests-leave',
      name: 'Leave',
      steps: [{ roleKeys: ['principal'] }],
    });
    const entityId = randomUUID();
    await as(accountant, (ctx) =>
      requestApproval(ctx, { entityType: 'tests-leave', entityId, summary: 'Three days of leave' }),
    );
    const remove = () =>
      callRoute(policyItem.DELETE, {
        as: principal,
        method: 'DELETE',
        url: `/api/v1/approval-policies/${policy.data.id}`,
        params: { id: policy.data.id },
      });
    const refused = await remove();
    expect(refused.status).toBe(409);
    expect(refused.error?.message).toContain('Requests are waiting under this policy');
    await adminDb()
      .update(approvalRequests)
      .set({ status: 'cancelled' })
      .where(eq(approvalRequests.entityId, entityId));
    expect((await remove()).status).toBe(204);
  });
});

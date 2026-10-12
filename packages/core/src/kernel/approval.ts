import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { approvalApproved, approvalRejected, approvalRequested } from '@takhti/contracts';
import {
  approvalPolicies,
  approvalRequests,
  approvalSteps,
  membershipBranches,
  membershipRoles,
  memberships,
  roles,
} from '@takhti/db';
import { audit } from './audit';
import { stampOf, type Ctx } from './context';
import { conflict, forbidden, invalid, notFound, rule } from './errors';
import { emit } from './events';
import { newId } from './ids';
import { assertNotSelf, hasAnyRole, hasBranch } from './scope';

/*
 * Approvals: a change that needs a second person before it takes effect (a large discount, an
 * expense, a leave request). Each school decides who approves what, and above which amount, with
 * approval policies. The person who asks can never be the person who approves.
 *
 * The module that owns the record registers what happens when a request is decided; the decision
 * and its effect are saved in one transaction.
 */

const Steps = z.array(z.object({ roleKeys: z.array(z.string().min(1)).min(1) })).min(1);
export type ApprovalSteps = z.output<typeof Steps>;

export interface ApprovalEffect {
  /** Applies the change that was waiting. Runs in the deciding user's transaction. */
  approved(ctx: Ctx, entityId: string): Promise<void>;
  /** Marks the record as refused. */
  rejected(ctx: Ctx, entityId: string, note: string): Promise<void>;
}

const effects = new Map<string, ApprovalEffect>();

/** Registered once by the module that owns `entityType`. */
export function onApprovalDecided(entityType: string, effect: ApprovalEffect): void {
  effects.set(entityType, effect);
}

export interface ApprovalAsk {
  /** The resource name, for example `student-discounts`. */
  entityType: string;
  entityId: string;
  /** One line shown to the approver. */
  summary: string;
  /** In paisa. Decides which policy applies. */
  amount?: number;
  branchId?: string;
}

export type ApprovalStart = { needed: false } | { needed: true; requestId: string };

/** The steps of a policy, or undefined when what is stored cannot be read as steps. */
export const stepsOf = (stored: unknown): ApprovalSteps | undefined => {
  const parsed = Steps.safeParse(stored);
  return parsed.success ? parsed.data : undefined;
};

/**
 * R-shared-6: who may decide a step. Staff holding one of its roles (the owner may stand in at any
 * step) who work at the request's branch; never the person who asked.
 */
export async function approversOf(
  ctx: Ctx,
  roleKeys: readonly string[],
  branchId: string | null,
  requestedBy: string,
): Promise<string[]> {
  const holders = await ctx.db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      allBranches: memberships.allBranches,
    })
    .from(membershipRoles)
    .innerJoin(roles, eq(roles.id, membershipRoles.roleId))
    .innerJoin(memberships, eq(memberships.id, membershipRoles.membershipId))
    .where(
      and(
        inArray(roles.key, [...roleKeys, 'owner']),
        eq(memberships.status, 'active'),
        eq(memberships.kind, 'staff'),
        isNull(membershipRoles.deletedAt),
        isNull(memberships.deletedAt),
        isNull(roles.deletedAt),
      ),
    );
  let reaching = holders;
  const limited = holders.filter((holder) => !holder.allBranches).map((row) => row.membershipId);
  if (branchId && limited.length > 0) {
    const atBranch = await ctx.db
      .select({ membershipId: membershipBranches.membershipId })
      .from(membershipBranches)
      .where(
        and(
          inArray(membershipBranches.membershipId, limited),
          eq(membershipBranches.branchId, branchId),
          isNull(membershipBranches.deletedAt),
        ),
      );
    const here = new Set(atBranch.map((row) => row.membershipId));
    reaching = holders.filter((holder) => holder.allBranches || here.has(holder.membershipId));
  }
  return [...new Set(reaching.map((holder) => holder.userId))].filter((id) => id !== requestedBy);
}

/** Tells the people who may decide the step that is now waiting. */
async function announce(
  ctx: Ctx,
  request: {
    id: string;
    entityType: string;
    entityId: string;
    summary: string;
    branchId: string | null;
    requestedBy: string;
  },
  step: number,
  roleKeys: readonly string[],
): Promise<void> {
  await emit(
    ctx,
    approvalRequested,
    {
      requestId: request.id,
      entityType: request.entityType,
      entityId: request.entityId,
      summary: request.summary,
      step,
      approverUserIds: await approversOf(ctx, roleKeys, request.branchId, request.requestedBy),
    },
    { entityType: 'approval-requests', entityId: request.id },
  );
}

/**
 * Asks for approval if a policy says this change needs it.
 * `{ needed: false }` means no policy applies and the caller should apply the change now.
 */
export async function requestApproval(ctx: Ctx, ask: ApprovalAsk): Promise<ApprovalStart> {
  const amount = ask.amount ?? 0;
  // The policy with the highest threshold that this amount reaches.
  const [policy] = await ctx.db
    .select()
    .from(approvalPolicies)
    .where(
      and(
        eq(approvalPolicies.entityType, ask.entityType),
        eq(approvalPolicies.isActive, true),
        isNull(approvalPolicies.deletedAt),
        or(isNull(approvalPolicies.minAmount), lte(approvalPolicies.minAmount, amount)),
      ),
    )
    .orderBy(sql`${approvalPolicies.minAmount} desc nulls last`, desc(approvalPolicies.createdAt))
    .limit(1);
  if (!policy) return { needed: false };

  const steps = Steps.safeParse(policy.steps);
  if (!steps.success)
    throw rule(
      `The approval policy "${policy.name}" has no valid steps. Ask an administrator to correct it.`,
    );

  const [waiting] = await ctx.db
    .select({ id: approvalRequests.id })
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.entityType, ask.entityType),
        eq(approvalRequests.entityId, ask.entityId),
        eq(approvalRequests.status, 'pending'),
        isNull(approvalRequests.deletedAt),
      ),
    )
    .limit(1);
  if (waiting) throw conflict('This is already waiting for approval');

  const requestId = newId();
  const stamps = {
    orgId: ctx.actor.orgId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    createdBy: stampOf(ctx),
    updatedBy: stampOf(ctx),
  };
  await ctx.db.insert(approvalRequests).values({
    id: requestId,
    ...stamps,
    entityType: ask.entityType,
    entityId: ask.entityId,
    branchId: ask.branchId ?? null,
    policyId: policy.id,
    summary: ask.summary.slice(0, 500),
    amount: ask.amount ?? null,
    status: 'pending',
    currentStep: 1,
    requestedBy: ctx.actor.userId,
  });
  await ctx.db.insert(approvalSteps).values(
    steps.data.map((_step, index) => ({
      id: newId(),
      ...stamps,
      requestId,
      stepOrder: index + 1,
      status: 'pending' as const,
    })),
  );
  await audit(ctx, 'approval-requests', 'create', requestId, {
    summary: `Asked for approval: ${ask.summary}`,
    branchId: ask.branchId ?? null,
  });
  await announce(
    ctx,
    {
      id: requestId,
      entityType: ask.entityType,
      entityId: ask.entityId,
      summary: ask.summary.slice(0, 500),
      branchId: ask.branchId ?? null,
      requestedBy: ctx.actor.userId,
    },
    1,
    steps.data[0]?.roleKeys ?? [],
  );
  return { needed: true, requestId };
}

export interface ApprovalOutcome {
  requestId: string;
  status: 'pending' | 'approved' | 'rejected';
  /** The step now waiting, when the request is still pending. */
  currentStep?: number;
}

/**
 * Approves or rejects the step that is waiting. Refused when the actor asked for it themself, or
 * does not hold one of the roles the step names. A rejection needs a note.
 */
export async function decideApproval(
  ctx: Ctx,
  requestId: string,
  decision: 'approve' | 'reject',
  note?: string,
): Promise<ApprovalOutcome> {
  const [request] = await ctx.db
    .select()
    .from(approvalRequests)
    .where(and(eq(approvalRequests.id, requestId), isNull(approvalRequests.deletedAt)))
    .limit(1)
    .for('update');
  if (!request) throw notFound('Approval request');
  if (request.status !== 'pending') throw rule(`This request was already ${request.status}`);
  assertNotSelf(ctx, request.requestedBy, 'You cannot approve your own request');

  const [policy] = await ctx.db
    .select()
    .from(approvalPolicies)
    .where(eq(approvalPolicies.id, request.policyId))
    .limit(1);
  const steps = Steps.safeParse(policy?.steps);
  const step = steps.success ? steps.data[request.currentStep - 1] : undefined;
  if (!steps.success || !step)
    throw rule(
      'The approval policy behind this request is no longer valid. Ask an administrator to correct it.',
    );
  // The owner holds every permission, so may stand in at any step.
  if (!hasAnyRole(ctx, [...step.roleKeys, 'owner']))
    throw forbidden('This step is waiting for someone with a different role');
  // R-shared-6: with access to the request's branch.
  if (request.branchId && ctx.actor.kind !== 'system' && !hasBranch(ctx, request.branchId))
    throw forbidden('This request belongs to a branch you do not work at');

  const trimmed = note?.trim() ?? '';
  if (decision === 'reject' && trimmed.length < 3)
    throw invalid({ note: ['Say why this is rejected'] });

  const stamp = { updatedAt: ctx.now, updatedBy: stampOf(ctx) };
  await ctx.db
    .update(approvalSteps)
    .set({
      status: decision === 'approve' ? 'approved' : 'rejected',
      decidedBy: ctx.actor.userId,
      decidedAt: ctx.now,
      note: trimmed || null,
      version: sql`${approvalSteps.version} + 1`,
      ...stamp,
    })
    .where(
      and(
        eq(approvalSteps.requestId, requestId),
        eq(approvalSteps.stepOrder, request.currentStep),
        isNull(approvalSteps.deletedAt),
      ),
    );

  const effect = effects.get(request.entityType);
  const bump = { version: sql`${approvalRequests.version} + 1`, ...stamp };
  const subject = { entityType: 'approval-requests', entityId: requestId };
  const told = {
    requestId,
    entityType: request.entityType,
    entityId: request.entityId,
    summary: request.summary,
    requestedBy: request.requestedBy,
  };

  if (decision === 'reject') {
    await ctx.db
      .update(approvalRequests)
      .set({ status: 'rejected', decidedAt: ctx.now, ...bump })
      .where(eq(approvalRequests.id, requestId));
    // Steps that will now never be reached are marked, so the trail reads truthfully.
    await ctx.db
      .update(approvalSteps)
      .set({ status: 'skipped', version: sql`${approvalSteps.version} + 1`, ...stamp })
      .where(
        and(
          eq(approvalSteps.requestId, requestId),
          eq(approvalSteps.status, 'pending'),
          isNull(approvalSteps.deletedAt),
        ),
      );
    await effect?.rejected(ctx, request.entityId, trimmed);
    await audit(ctx, 'approval-requests', 'reject', requestId, {
      summary: `Rejected: ${request.summary}`,
      branchId: request.branchId,
    });
    await emit(ctx, approvalRejected, { ...told, note: trimmed }, subject);
    return { requestId, status: 'rejected' };
  }

  if (request.currentStep < steps.data.length) {
    await ctx.db
      .update(approvalRequests)
      .set({ currentStep: request.currentStep + 1, ...bump })
      .where(eq(approvalRequests.id, requestId));
    await audit(ctx, 'approval-requests', 'approve', requestId, {
      summary: `Approved step ${request.currentStep} of ${steps.data.length}: ${request.summary}`,
      branchId: request.branchId,
    });
    // The next step's people are told it is now waiting for them.
    await announce(
      ctx,
      request,
      request.currentStep + 1,
      steps.data[request.currentStep]?.roleKeys ?? [],
    );
    return { requestId, status: 'pending', currentStep: request.currentStep + 1 };
  }

  await ctx.db
    .update(approvalRequests)
    .set({ status: 'approved', decidedAt: ctx.now, ...bump })
    .where(eq(approvalRequests.id, requestId));
  // R-shared-7: the owning module applies the change in this same transaction.
  await effect?.approved(ctx, request.entityId);
  await audit(ctx, 'approval-requests', 'approve', requestId, {
    summary: `Approved: ${request.summary}`,
    branchId: request.branchId,
  });
  await emit(ctx, approvalApproved, told, subject);
  return { requestId, status: 'approved' };
}

/**
 * Withdraws a waiting request, when the record it was for is withdrawn or changed. Only the
 * requester or a system job; or, with `recordDeleted`, whoever was allowed to delete the record
 * (F-shared-4: there is nothing left to approve).
 */
export async function cancelApproval(
  ctx: Ctx,
  entityType: string,
  entityId: string,
  options: { recordDeleted?: boolean } = {},
): Promise<boolean> {
  const [request] = await ctx.db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.entityType, entityType),
        eq(approvalRequests.entityId, entityId),
        eq(approvalRequests.status, 'pending'),
        isNull(approvalRequests.deletedAt),
      ),
    )
    .limit(1)
    .for('update');
  if (!request) return false;
  if (
    !options.recordDeleted &&
    ctx.actor.kind !== 'system' &&
    request.requestedBy !== ctx.actor.userId
  )
    throw forbidden('Only the person who asked can withdraw this request');
  const stamp = { updatedAt: ctx.now, updatedBy: stampOf(ctx) };
  await ctx.db
    .update(approvalRequests)
    .set({
      status: 'cancelled',
      decidedAt: ctx.now,
      version: sql`${approvalRequests.version} + 1`,
      ...stamp,
    })
    .where(eq(approvalRequests.id, request.id));
  await ctx.db
    .update(approvalSteps)
    .set({ status: 'skipped', version: sql`${approvalSteps.version} + 1`, ...stamp })
    .where(
      and(
        eq(approvalSteps.requestId, request.id),
        eq(approvalSteps.status, 'pending'),
        isNull(approvalSteps.deletedAt),
      ),
    );
  await audit(ctx, 'approval-requests', 'cancel', request.id, {
    summary: options.recordDeleted
      ? `Cancelled, because the record was deleted: ${request.summary}`
      : `Withdrew: ${request.summary}`,
    branchId: request.branchId,
  });
  return true;
}

/** The steps of a request with who decided each, oldest first. For the record's own screen. */
export async function approvalTrail(ctx: Ctx, requestId: string) {
  return ctx.db
    .select({
      stepOrder: approvalSteps.stepOrder,
      status: approvalSteps.status,
      decidedBy: approvalSteps.decidedBy,
      decidedAt: approvalSteps.decidedAt,
      note: approvalSteps.note,
    })
    .from(approvalSteps)
    .where(and(eq(approvalSteps.requestId, requestId), isNull(approvalSteps.deletedAt)))
    .orderBy(asc(approvalSteps.stepOrder));
}

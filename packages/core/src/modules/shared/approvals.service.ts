import { and, asc, count, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import type {
  ApprovalRequest,
  ApprovalStepView,
  Decision,
  ListApprovals,
  Page,
} from '@takhti/contracts';
import { approvalPolicies, approvalRequests, profiles } from '@takhti/db';
import {
  approvalTrail,
  cancelApproval,
  decideApproval,
  stepsOf,
} from '../../kernel/approval';
import type { Ctx } from '../../kernel/context';
import { forbidden, notFound } from '../../kernel/errors';
import { assertPermission, holds } from '../../kernel/permissions';
import { hasAnyRole, hasBranch } from '../../kernel/scope';

/*
 * The approvals inbox: docs/plan/10-modules/m00-shared-kernel.md, rules R-shared-5 to 7.
 * The kernel (`kernel/approval.ts`) starts and decides requests; this service is what a person
 * sees: what is waiting for them, what they asked for, and one request with its steps.
 */

/** The most pending requests looked through to find those waiting for one person. */
const MAX_WAITING = 500;

type RequestRow = typeof approvalRequests.$inferSelect;

/** R-shared-5 and R-shared-6, as a yes or no: may this person decide the step that is waiting? */
function mayDecide(ctx: Ctx, request: RequestRow, steps: unknown): boolean {
  const current = stepsOf(steps)?.[request.currentStep - 1];
  return (
    request.status === 'pending' &&
    current !== undefined &&
    request.requestedBy !== ctx.actor.userId &&
    hasAnyRole(ctx, [...current.roleKeys, 'owner']) &&
    (request.branchId === null || hasBranch(ctx, request.branchId))
  );
}

async function namesOf(ctx: Ctx, userIds: readonly (string | null)[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => id !== null))];
  if (ids.length === 0) return new Map();
  const rows = await ctx.db
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .where(inArray(profiles.id, ids));
  return new Map(rows.map((row) => [row.id, row.fullName]));
}

function view(
  ctx: Ctx,
  request: RequestRow,
  steps: unknown,
  names: Map<string, string>,
): ApprovalRequest {
  return {
    id: request.id,
    version: request.version,
    entityType: request.entityType,
    entityId: request.entityId,
    branchId: request.branchId,
    summary: request.summary,
    amount: request.amount,
    status: request.status,
    currentStep: request.currentStep,
    stepCount: stepsOf(steps)?.length ?? 0,
    requestedBy: request.requestedBy,
    requestedByName: names.get(request.requestedBy) ?? null,
    decidedAt: request.decidedAt,
    createdAt: request.createdAt,
    canDecide: mayDecide(ctx, request, steps),
  };
}

async function load(ctx: Ctx, id: string) {
  const [found] = await ctx.db
    .select({ request: approvalRequests, steps: approvalPolicies.steps })
    .from(approvalRequests)
    .innerJoin(approvalPolicies, eq(approvalPolicies.id, approvalRequests.policyId))
    .where(and(eq(approvalRequests.id, id), isNull(approvalRequests.deletedAt)))
    .limit(1);
  if (!found) throw notFound('Approval request');
  return found;
}

export const approvalsService = {
  /**
   * `waiting`: what the person may decide now, oldest first. `mine`: what they asked for.
   * `all`: every request of the school, for those who hold `approvals:read`.
   */
  async list(ctx: Ctx, query: ListApprovals): Promise<Page<ApprovalRequest>> {
    if (query.scope === 'all') assertPermission(ctx, 'approvals:read');
    const base = and(
      isNull(approvalRequests.deletedAt),
      query.entityType ? eq(approvalRequests.entityType, query.entityType) : undefined,
    );
    const from = (query.page - 1) * query.pageSize;

    if (query.scope === 'waiting') {
      const pending = await ctx.db
        .select({ request: approvalRequests, steps: approvalPolicies.steps })
        .from(approvalRequests)
        .innerJoin(approvalPolicies, eq(approvalPolicies.id, approvalRequests.policyId))
        .where(
          and(
            base,
            eq(approvalRequests.status, 'pending'),
            ne(approvalRequests.requestedBy, ctx.actor.userId),
          ),
        )
        .orderBy(asc(approvalRequests.createdAt), asc(approvalRequests.id))
        .limit(MAX_WAITING);
      const mine = pending.filter((row) => mayDecide(ctx, row.request, row.steps));
      const shown = mine.slice(from, from + query.pageSize);
      const names = await namesOf(
        ctx,
        shown.map((row) => row.request.requestedBy),
      );
      return {
        items: shown.map((row) => view(ctx, row.request, row.steps, names)),
        page: query.page,
        pageSize: query.pageSize,
        total: mine.length,
      };
    }

    const where = and(
      base,
      query.status ? eq(approvalRequests.status, query.status) : undefined,
      query.scope === 'mine' ? eq(approvalRequests.requestedBy, ctx.actor.userId) : undefined,
    );
    const rows = await ctx.db
      .select({ request: approvalRequests, steps: approvalPolicies.steps })
      .from(approvalRequests)
      .innerJoin(approvalPolicies, eq(approvalPolicies.id, approvalRequests.policyId))
      .where(where)
      .orderBy(desc(approvalRequests.createdAt), desc(approvalRequests.id))
      .limit(query.pageSize)
      .offset(from);
    const [counted] = await ctx.db.select({ total: count() }).from(approvalRequests).where(where);
    const names = await namesOf(
      ctx,
      rows.map((row) => row.request.requestedBy),
    );
    return {
      items: rows.map((row) => view(ctx, row.request, row.steps, names)),
      page: query.page,
      pageSize: query.pageSize,
      total: counted?.total ?? 0,
    };
  },

  /**
   * One request with its steps. Open to the person who asked, to anyone who may decide the step
   * that is waiting or who decided an earlier one, and to those who hold `approvals:read`.
   * To anyone else it does not exist.
   */
  async get(ctx: Ctx, id: string): Promise<ApprovalRequest> {
    const { request, steps } = await load(ctx, id);
    const trail = await approvalTrail(ctx, id);
    const involved =
      request.requestedBy === ctx.actor.userId ||
      holds(ctx, 'approvals:read') ||
      mayDecide(ctx, request, steps) ||
      trail.some((step) => step.decidedBy === ctx.actor.userId);
    if (!involved) throw notFound('Approval request');

    const names = await namesOf(ctx, [request.requestedBy, ...trail.map((step) => step.decidedBy)]);
    const defined = stepsOf(steps) ?? [];
    const stepViews: ApprovalStepView[] = trail.map((step) => ({
      stepOrder: step.stepOrder,
      roleKeys: defined[step.stepOrder - 1]?.roleKeys ?? [],
      status: step.status,
      decidedBy: step.decidedBy,
      decidedByName: step.decidedBy ? (names.get(step.decidedBy) ?? null) : null,
      decidedAt: step.decidedAt,
      note: step.note,
    }));
    return { ...view(ctx, request, steps, names), steps: stepViews };
  },

  /** Approves the step that is waiting. */
  async approve(ctx: Ctx, id: string, decision: Decision): Promise<ApprovalRequest> {
    await decideApproval(ctx, id, 'approve', decision.note);
    return approvalsService.get(ctx, id);
  },

  /** Rejects the request. The note says why, and is required. */
  async reject(ctx: Ctx, id: string, decision: Decision): Promise<ApprovalRequest> {
    await decideApproval(ctx, id, 'reject', decision.note);
    return approvalsService.get(ctx, id);
  },

  /** The person who asked withdraws the request while it is still waiting. */
  async cancel(ctx: Ctx, id: string): Promise<ApprovalRequest> {
    const { request } = await load(ctx, id);
    if (request.requestedBy !== ctx.actor.userId)
      throw holds(ctx, 'approvals:read')
        ? forbidden('Only the person who asked can withdraw this request')
        : notFound('Approval request');
    await cancelApproval(ctx, request.entityType, request.entityId);
    return approvalsService.get(ctx, id);
  },
};

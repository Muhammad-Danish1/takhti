import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  approvalPoliciesContract,
  type ListApprovalPoliciesParams,
} from '@takhti/contracts';
import { approvalPolicies, approvalRequests, roles } from '@takhti/db';
import type { Ctx } from '../../kernel/context';
import { createCrudService } from '../../kernel/crud-service';
import { createDbService } from '../../kernel/db-service';
import { invalid, rule } from '../../kernel/errors';

/*
 * Approval policies: who must approve what, and above which amount.
 * docs/plan/10-modules/m00-shared-kernel.md, rule R-shared-4.
 */

export const approvalPoliciesDb = createDbService<
  typeof approvalPolicies,
  ListApprovalPoliciesParams
>(approvalPolicies, {
  label: 'Approval policy',
  search: [approvalPolicies.name, approvalPolicies.entityType],
  sort: {
    entityType: approvalPolicies.entityType,
    name: approvalPolicies.name,
    createdAt: approvalPolicies.createdAt,
  },
  filters: (params) => [
    params.entityType && eq(approvalPolicies.entityType, params.entityType),
    params.isActive !== undefined && eq(approvalPolicies.isActive, params.isActive),
  ],
});

/** Every role a step names must be a role this school has, so no step waits for nobody. */
async function assertRolesExist(
  ctx: Ctx,
  steps: readonly { roleKeys: readonly string[] }[] | undefined,
): Promise<void> {
  if (!steps) return;
  const wanted = [...new Set(steps.flatMap((step) => step.roleKeys))];
  const held = await ctx.db
    .select({ key: roles.key })
    .from(roles)
    .where(and(inArray(roles.key, wanted), isNull(roles.deletedAt)));
  const known = new Set(held.map((role) => role.key));
  const unknown = wanted.filter((key) => !known.has(key));
  if (unknown.length > 0)
    throw invalid({ steps: [`This school has no role named ${unknown.join(', ')}`] });
  // A family cannot approve: a step is decided by staff.
  if (wanted.some((key) => key === 'guardian' || key === 'student'))
    throw invalid({ steps: ['A step is decided by staff, not by a guardian or a student'] });
}

export const approvalPoliciesService = createCrudService({
  contract: approvalPoliciesContract,
  db: approvalPoliciesDb,
  // One permission covers creating, changing and deleting a policy.
  actions: { create: 'update', update: 'update', delete: 'update' },
  summary: (row, action) =>
    action === 'create'
      ? `Added approval policy ${row.name}`
      : action === 'delete'
        ? `Deleted approval policy ${row.name}`
        : `Changed approval policy ${row.name}`,
  rules: {
    beforeCreate: (ctx, input) => assertRolesExist(ctx, input.steps),
    beforeUpdate: (ctx, _current, input) => assertRolesExist(ctx, input.steps),
    async beforeRemove(ctx, current) {
      // A request that is waiting was started under this policy and is decided by its steps.
      const [waiting] = await ctx.db
        .select({ id: approvalRequests.id })
        .from(approvalRequests)
        .where(
          and(
            eq(approvalRequests.policyId, current.id),
            eq(approvalRequests.status, 'pending'),
            isNull(approvalRequests.deletedAt),
          ),
        )
        .limit(1);
      if (waiting)
        throw rule(
          'Requests are waiting under this policy. Switch it off instead, and delete it when they are decided.',
        );
    },
  },
});

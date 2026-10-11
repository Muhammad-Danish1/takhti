import { auditLog } from '@school/db';
import type { Ctx } from './context';

/**
 * Records a change in the audit log. It runs inside the caller's transaction,
 * so a change and its audit entry are saved together or not at all.
 */
export async function audit(
  ctx: Ctx,
  entity: string,
  action: string,
  entityId: string,
  change: { before?: unknown; after?: unknown } = {},
): Promise<void> {
  await ctx.db.insert(auditLog).values({
    orgId: ctx.actor.orgId,
    actorId: ctx.actor.userId,
    source: ctx.source,
    requestId: ctx.requestId,
    entity,
    entityId,
    action,
    before: change.before ?? null,
    after: change.after ?? null,
  });
}

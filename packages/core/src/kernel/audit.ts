import { auditLog } from '@takhti/db';
import type { Ctx } from './context';
import { newId } from './ids';

/*
 * Every change, by whom, when and how. An entry is written inside the caller's transaction, so a
 * change and its audit entry are saved together or not at all.
 *
 * Only the fields that changed are stored, as `{ field: [before, after] }`. Values of sensitive
 * fields are replaced by a mask: the log says that a CNIC changed, not what it changed to.
 */

/** Columns the kernel maintains; a change to them alone is not worth recording. */
const managed = new Set([
  'version',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'deletedAt',
  'orgId',
]);

/** Field names whose values never enter the log. Matched without regard to case. */
const sensitive = [
  /cnic/i,
  /bform/i,
  /passport/i,
  /^ntn$/i,
  /accountno/i,
  /accountnumber/i,
  /iban/i,
  /password/i,
  /secret/i,
  /token/i,
  /hash$/i,
  /otp/i,
  /^pin$/i,
  /credential/i,
  /apikey/i,
];

export const MASK = '•••';

const isSensitive = (field: string) => sensitive.some((pattern) => pattern.test(field));

const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined)
    return (a ?? null) === (b ?? null);
  if (typeof a === 'object' || typeof b === 'object')
    return JSON.stringify(a) === JSON.stringify(b);
  return false;
};

/** `{ field: [before, after] }` for every field whose value differs, with sensitive values masked. */
export function diff(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): Record<string, [unknown, unknown]> {
  const changes: Record<string, [unknown, unknown]> = {};
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const field of fields) {
    if (managed.has(field)) continue;
    const from = before?.[field] ?? null;
    const to = after?.[field] ?? null;
    if (same(from, to)) continue;
    changes[field] = isSensitive(field)
      ? [from === null ? null : MASK, to === null ? null : MASK]
      : [from, to];
  }
  return changes;
}

export interface AuditDetail {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  /** One readable line, for the activity feed: "Collected Rs 12,500 from the Ahmed family". */
  summary?: string;
  /** The branch the record belongs to, so a branch's log can be filtered. */
  branchId?: string | null;
}

/**
 * Records one change.
 * `action` is `create`, `update`, `delete`, `restore`, or the verb of a named action (`collect`, `approve`).
 */
export async function audit(
  ctx: Ctx,
  entity: string,
  action: string,
  entityId: string,
  detail: AuditDetail = {},
): Promise<void> {
  const branchId =
    detail.branchId ??
    (detail.after?.branchId as string | undefined) ??
    (detail.before?.branchId as string | undefined) ??
    null;
  // No `returning`: a family user may add an entry but not read the log.
  await ctx.db.insert(auditLog).values({
    id: newId(),
    orgId: ctx.actor.orgId,
    createdAt: ctx.now,
    createdBy:
      ctx.actor.kind === 'system' || ctx.actor.kind === 'platform' ? null : ctx.actor.userId,
    actorId: ctx.actor.kind === 'system' ? null : ctx.actor.userId,
    actorKind: ctx.actor.kind,
    source: ctx.source,
    requestId: ctx.requestId,
    branchId,
    entity,
    entityId,
    action,
    changes: action === 'delete' ? {} : diff(detail.before, detail.after),
    summary: detail.summary ?? null,
    ip: ctx.ip ?? null,
    userAgent: ctx.userAgent ? ctx.userAgent.slice(0, 300) : null,
    deviceId: ctx.deviceId ?? null,
    supportSessionId: ctx.actor.supportSessionId ?? null,
  });
}

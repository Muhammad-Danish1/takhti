import { withUserTx, type Tx } from '@school/db';

/** Who is acting. Built once per request from the verified sign-in token. */
export interface Actor {
  userId: string;
  /** The school group. */
  orgId: string;
  roleKey: string;
  branchIds: readonly string[];
  /** True for owners and head-office staff, who see every branch. */
  allBranches: boolean;
  /** Granted `resource:action` pairs, e.g. "students:create". */
  permissions: ReadonlySet<string>;
}

/**
 * Passed as the first argument to every db-service and service function.
 * It carries the open transaction, so any set of calls made with the same `ctx`
 * succeeds or fails together.
 */
export interface Ctx {
  db: Tx;
  actor: Actor;
  /** Printed in logs, saved in the audit log and returned with errors. */
  requestId: string;
  /** Who is calling: an API route, the offline sync upload, a background job or an AI tool. */
  source: 'api' | 'sync' | 'job' | 'ai';
}

/** Opens the transaction for one unit of work and runs it as the given user. */
export function runAs<T>(
  actor: Actor,
  meta: Pick<Ctx, 'requestId' | 'source'>,
  work: (ctx: Ctx) => Promise<T>,
): Promise<T> {
  return withUserTx(
    {
      sub: actor.userId,
      role: 'authenticated',
      org_id: actor.orgId,
      role_key: actor.roleKey,
      branch_ids: actor.branchIds,
      all_branches: actor.allBranches,
    },
    (db) => work({ db, actor, ...meta }),
  );
}

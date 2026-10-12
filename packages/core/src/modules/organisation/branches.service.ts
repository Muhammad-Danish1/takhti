import {
  branchCreated,
  branchDeactivated,
  branchesContract,
  branchStatusMachine,
  type Branch,
  type CreateBranch,
} from '@takhti/contracts';
import { audit } from '../../kernel/audit';
import type { Ctx } from '../../kernel/context';
import { createCrudService } from '../../kernel/crud-service';
import { invalid, registerConstraintMessages, rule } from '../../kernel/errors';
import { emit } from '../../kernel/events';
import { assertCan } from '../../kernel/permissions';
import { assertBranch } from '../../kernel/scope';
import { assertTransition } from '../../kernel/state-machine';
import { branchesDb } from './branches.db-service';

/*
 * Layer 4 for branches. Rules: docs/plan/10-modules/m02-organisation-branches.md, section 5.
 * A branch is never deleted: it is deactivated, and its history stays readable.
 */

registerConstraintMessages({
  branches_code_uq: { message: 'Another branch already uses this code', field: 'code' },
});

/**
 * Something that stops a branch from being deactivated: active students, open vouchers.
 * The module that owns the blocking records registers the check; it returns a sentence, or nothing.
 */
export type BranchBlocker = (ctx: Ctx, branchId: string) => Promise<string | undefined>;

const blockers: BranchBlocker[] = [];

export function registerBranchBlocker(blocker: BranchBlocker): void {
  blockers.push(blocker);
}

const crud = createCrudService({
  contract: branchesContract,
  db: branchesDb,
  // Deactivating is its own action below; nothing ever deletes a branch.
  actions: { delete: false },
  // What to copy into a new branch is an instruction for other modules, not a column of the branch.
  toInsert: ({ copyBellSchedule: _bell, copyFeeStructuresFrom: _fees, ...columns }) => columns,
  summary: (row, action) =>
    action === 'create'
      ? `Added branch ${row.name} (${row.code})`
      : action === 'update'
        ? `Changed branch ${row.name}`
        : undefined,
  rules: {
    async beforeUpdate(ctx, current, input) {
      // R-org-6: an inactive branch is read-only until it is activated again.
      if (current.status !== 'active')
        throw rule('This branch is inactive. Activate it before changing it.');
      // R-org-3: numbers already printed carry the code, so it is fixed once one has been issued.
      if (
        input.code !== undefined &&
        input.code !== current.code &&
        (await branchesDb.hasIssuedNumbers(ctx, current.id))
      ) {
        throw rule(
          'The branch code cannot change now: admission numbers, vouchers or receipts have already been issued with it',
        );
      }
    },
  },
});

async function setStatus(
  ctx: Ctx,
  id: string,
  to: Branch['status'],
  version: number,
): Promise<Branch> {
  assertCan(ctx, 'branches', 'update');
  assertBranch(ctx, id);
  const current = await branchesDb.get(ctx, id);
  assertTransition(branchStatusMachine, current.status, to, 'Branch');
  if (current.status === to) return branchesContract.entity.parse(current);

  if (to === 'inactive') {
    // R-org-4: a group always has at least one active branch.
    if ((await branchesDb.countActive(ctx)) <= 1)
      throw rule('A school group needs at least one active branch');
    // R-org-5: the message says what blocks it.
    const reasons = (await Promise.all(blockers.map((blocker) => blocker(ctx, id)))).filter(
      (reason): reason is string => Boolean(reason),
    );
    if (reasons.length > 0)
      throw rule(`This branch cannot be deactivated yet: ${reasons.join('; ')}`);
  }

  const row = await branchesDb.update(ctx, id, { status: to }, version);
  await audit(ctx, 'branches', to === 'inactive' ? 'deactivate' : 'activate', id, {
    before: current,
    after: row,
    summary: `${to === 'inactive' ? 'Deactivated' : 'Activated'} branch ${row.name}`,
  });
  if (to === 'inactive')
    await emit(
      ctx,
      branchDeactivated,
      { branchId: id, code: row.code, name: row.name },
      { entityType: 'branches', entityId: id },
    );
  return branchesContract.entity.parse(row);
}

export const branchesService = {
  ...crud,
  /**
   * Adds a branch. R-org-11: it starts with the group's values for every setting, since it has
   * none of its own; the bell schedule and, if asked, another branch's fee structures are copied
   * by the modules that own them, which listen for `branch.created`.
   */
  async create(ctx: Ctx, input: CreateBranch): Promise<Branch> {
    if (input.copyFeeStructuresFrom && !(await branchesDb.find(ctx, input.copyFeeStructuresFrom)))
      throw invalid({ copyFeeStructuresFrom: ['Choose a branch of this school group'] });
    const branch = await crud.create(ctx, input);
    await emit(
      ctx,
      branchCreated,
      {
        branchId: branch.id,
        code: branch.code,
        name: branch.name,
        copyBellSchedule: input.copyBellSchedule ?? true,
        copyFeeStructuresFrom: input.copyFeeStructuresFrom ?? null,
      },
      { entityType: 'branches', entityId: branch.id },
    );
    return branch;
  },
  /** Deactivates a branch, if nothing blocks it. */
  deactivate: (ctx: Ctx, id: string, version: number) => setStatus(ctx, id, 'inactive', version),
  /** Makes an inactive branch usable again. */
  activate: (ctx: Ctx, id: string, version: number) => setStatus(ctx, id, 'active', version),
};

/** For other modules: refuses a write into a branch that is inactive or out of the actor's reach. */
export async function assertBranchOpen(ctx: Ctx, branchId: string): Promise<void> {
  assertBranch(ctx, branchId);
  const branch = await branchesDb.find(ctx, branchId);
  // An id from another school is, to this user, simply not a branch: the field is wrong.
  if (!branch) throw invalid({ branchId: ['Choose a branch of this school group'] });
  if (branch.status !== 'active')
    throw rule(`${branch.name} is inactive, so nothing can be added or changed there`);
}

import { wingsContract, type GenderPolicy } from '@takhti/contracts';
import type { Ctx } from '../../kernel/context';
import { createCrudService } from '../../kernel/crud-service';
import { invalid, registerConstraintMessages, rule } from '../../kernel/errors';
import { assertBranchOpen } from './branches.service';
import { wingsDb } from './wings.db-service';

/* Layer 4 for wings. Rules: docs/plan/10-modules/m02-organisation-branches.md, section 5. */

registerConstraintMessages({
  wings_name_uq: { message: 'This branch already has a wing with this name', field: 'name' },
});

interface Span {
  branchId: string;
  gradeFrom: number;
  gradeTo: number;
  gender: GenderPolicy;
  exceptId?: string;
}

/**
 * R-org-9: within a branch every grade belongs to one wing. The one exception is a branch that
 * teaches boys and girls apart: a boys' wing and a girls' wing may cover the same grades.
 */
async function assertNoOverlap(ctx: Ctx, wing: Span): Promise<void> {
  const apart = (a: GenderPolicy, b: GenderPolicy) =>
    (a === 'boys' && b === 'girls') || (a === 'girls' && b === 'boys');
  const clash = (await wingsDb.sharingGrades(ctx, wing)).find(
    (other) => !apart(wing.gender, other.gender),
  );
  if (clash)
    throw rule(
      `These grades overlap the wing ${clash.name} (Grades ${clash.gradeFrom} to ${clash.gradeTo}). Only a boys' wing and a girls' wing may share grades.`,
    );
}

export const wingsService = createCrudService({
  contract: wingsContract,
  db: wingsDb,
  // One permission covers creating, changing and deleting a wing.
  actions: { create: 'update', update: 'update', delete: 'update' },
  summary: (row, action) =>
    action === 'create'
      ? `Added wing ${row.name}`
      : action === 'delete'
        ? `Deleted wing ${row.name}`
        : `Changed wing ${row.name}`,
  rules: {
    async beforeCreate(ctx, input) {
      await assertBranchOpen(ctx, input.branchId);
      await assertNoOverlap(ctx, {
        branchId: input.branchId,
        gradeFrom: input.gradeFrom,
        gradeTo: input.gradeTo,
        gender: input.gender ?? 'mixed',
      });
    },
    async beforeUpdate(ctx, current, input) {
      await assertBranchOpen(ctx, current.branchId);
      const gradeFrom = input.gradeFrom ?? current.gradeFrom;
      const gradeTo = input.gradeTo ?? current.gradeTo;
      // The contract can compare the two only when both are sent.
      if (gradeTo < gradeFrom)
        throw invalid({ gradeTo: ['The last grade cannot be before the first'] });
      await assertNoOverlap(ctx, {
        branchId: current.branchId,
        gradeFrom,
        gradeTo,
        gender: input.gender ?? current.gender,
        exceptId: current.id,
      });
    },
    beforeRemove: (ctx, current) => assertBranchOpen(ctx, current.branchId),
  },
});

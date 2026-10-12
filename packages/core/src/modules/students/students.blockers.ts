import { and, count, eq, isNull } from 'drizzle-orm';
import { students } from '@takhti/db';
import { registerBranchBlocker } from '../organisation/branches.service';

/*
 * What students stop the organisation module from doing:
 * docs/plan/10-modules/m02-organisation-branches.md, rule R-org-5.
 * This file only registers; it exports nothing.
 */

// A branch with active students cannot be deactivated.
registerBranchBlocker(async (ctx, branchId) => {
  const [row] = await ctx.db
    .select({ total: count() })
    .from(students)
    .where(
      and(eq(students.branchId, branchId), eq(students.status, 'active'), isNull(students.deletedAt)),
    );
  const total = row?.total ?? 0;
  if (total === 0) return undefined;
  return `${total} active ${total === 1 ? 'student' : 'students'} must be transferred or withdrawn first`;
});

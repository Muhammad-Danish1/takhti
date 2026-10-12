import { and, count, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { feeVouchers } from '@takhti/db';
import type { Ctx } from '../../kernel/context';
import { startOfMonth } from '../../kernel/dates';
import { registerBranchBlocker } from '../organisation/branches.service';
import { registerBillingModeBlocker } from '../organisation/org.service';

/*
 * What open vouchers stop the organisation module from doing:
 * docs/plan/10-modules/m02-organisation-branches.md, rules R-org-5 and R-org-7.
 * This file only registers; it exports nothing.
 */

/** A voucher somebody still owes on. */
const open = and(inArray(feeVouchers.status, ['unpaid', 'partial']), isNull(feeVouchers.deletedAt));

async function openVouchers(ctx: Ctx, where: SQL | undefined): Promise<number> {
  const [row] = await ctx.db
    .select({ total: count() })
    .from(feeVouchers)
    .where(and(open, where));
  return row?.total ?? 0;
}

// R-org-5: a branch with open vouchers cannot be deactivated.
registerBranchBlocker(async (ctx, branchId) => {
  const total = await openVouchers(ctx, eq(feeVouchers.branchId, branchId));
  if (total === 0) return undefined;
  return `${total} open ${total === 1 ? 'voucher' : 'vouchers'} must be paid or cancelled first`;
});

// R-org-7: the way of billing changes only when none of this month's vouchers is open.
registerBillingModeBlocker(async (ctx) => {
  const total = await openVouchers(ctx, eq(feeVouchers.billingMonth, startOfMonth(ctx.today)));
  if (total === 0) return undefined;
  return `${total} of this month's ${total === 1 ? 'voucher is' : 'vouchers are'} still open`;
});

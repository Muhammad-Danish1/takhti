import { and, desc, eq, exists, isNull, sql } from 'drizzle-orm';
import { enrollments, feeVouchers, students } from '@takhti/db';
import { branchFilter } from '../../kernel/scope';
import { enrollmentReach } from '../academics/scope';
import { matches, registerSearchSource } from '../shared/search.service';

/*
 * Fee vouchers in global search, by the number printed on them: docs/plan/10-modules/m00-shared-kernel.md,
 * rule R-shared-14. A voucher is found by its own number or by that of its challan; to find the
 * vouchers of a family, find the student.
 *
 * A class teacher may see dues, to follow them up with the families of the class: they find only
 * the vouchers of students in their own sections.
 */

registerSearchSource({
  kind: 'vouchers',
  module: 'fees',
  permission: 'fee-vouchers:read',
  async search(ctx, term) {
    const reach = await enrollmentReach(ctx);
    const rows = await ctx.db
      .select({
        id: feeVouchers.id,
        voucherNo: feeVouchers.voucherNo,
        periodLabel: feeVouchers.periodLabel,
        status: feeVouchers.status,
        branchId: feeVouchers.branchId,
        studentName: students.fullName,
      })
      .from(feeVouchers)
      .innerJoin(students, eq(students.id, feeVouchers.studentId))
      .where(
        and(
          isNull(feeVouchers.deletedAt),
          branchFilter(ctx, feeVouchers.branchId),
          matches(term, [feeVouchers.voucherNo, feeVouchers.challanNo]),
          reach &&
            exists(
              ctx.db
                .select({ one: sql`1` })
                .from(enrollments)
                .where(
                  and(
                    eq(enrollments.studentId, feeVouchers.studentId),
                    eq(enrollments.status, 'active'),
                    isNull(enrollments.deletedAt),
                    reach,
                  ),
                ),
            ),
        ),
      )
      .orderBy(desc(feeVouchers.billingMonth), desc(feeVouchers.voucherNo))
      .limit(term.limit);
    return rows.map((row) => ({
      id: row.id,
      title: row.voucherNo,
      titleUr: null,
      subtitle: `${row.studentName} · ${row.periodLabel}`,
      status: row.status,
      branchId: row.branchId,
    }));
  },
});

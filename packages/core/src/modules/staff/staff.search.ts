import { and, asc, isNull, or, sql } from 'drizzle-orm';
import { staff } from '@takhti/db';
import { matches, matchesPhone, registerSearchSource } from '../shared/search.service';

/* Staff in global search: docs/plan/10-modules/m00-shared-kernel.md, rule R-shared-14. */

registerSearchSource({
  kind: 'staff',
  module: 'staff',
  permission: 'staff:read',
  async search(ctx, term) {
    const rows = await ctx.db
      .select({
        id: staff.id,
        title: staff.fullName,
        titleUr: staff.fullNameUr,
        employeeNo: staff.employeeNo,
        status: staff.status,
        branchId: staff.homeBranchId,
      })
      .from(staff)
      .where(
        and(
          isNull(staff.deletedAt),
          or(
            matches(term, [staff.fullName, staff.fullNameUr, staff.employeeNo]),
            matchesPhone(term, [staff.workPhone]),
          ),
        ),
      )
      // Those still working at the school first, then by name.
      .orderBy(sql`${staff.status} <> 'active'`, asc(staff.fullName), asc(staff.id))
      .limit(term.limit);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      titleUr: row.titleUr,
      subtitle: row.employeeNo,
      status: row.status,
      branchId: row.branchId,
    }));
  },
});

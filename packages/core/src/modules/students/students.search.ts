import { and, asc, eq, exists, isNull, or, sql } from 'drizzle-orm';
import { enrollments, guardians, studentGuardians, students } from '@takhti/db';
import { holds } from '../../kernel/permissions';
import { branchFilter } from '../../kernel/scope';
import { enrollmentReach } from '../academics/scope';
import { matches, matchesPhone, registerSearchSource } from '../shared/search.service';

/*
 * Students and guardians in global search: docs/plan/10-modules/m00-shared-kernel.md, rule
 * R-shared-14, and docs/plan/10-modules/m07-students.md, rule R-students-17.
 *
 * A teacher finds only the students of their sections and those students' guardians. A B-Form or
 * CNIC number finds a person only for someone who may see such numbers.
 */

const currentlyEnrolled = and(eq(enrollments.status, 'active'), isNull(enrollments.deletedAt));

registerSearchSource({
  kind: 'students',
  module: 'students',
  permission: 'students:read',
  async search(ctx, term) {
    const reach = await enrollmentReach(ctx);
    const rows = await ctx.db
      .select({
        id: students.id,
        title: students.fullName,
        titleUr: students.fullNameUr,
        admissionNo: students.admissionNo,
        fatherName: students.fatherName,
        status: students.status,
        branchId: students.branchId,
      })
      .from(students)
      .where(
        and(
          isNull(students.deletedAt),
          branchFilter(ctx, students.branchId),
          or(
            matches(term, [
              students.fullName,
              students.fullNameUr,
              students.admissionNo,
              students.fatherName,
            ]),
            matchesPhone(term, [students.phone]),
            holds(ctx, 'students:read-sensitive') ? matches(term, [students.bFormNo]) : undefined,
          ),
          reach &&
            exists(
              ctx.db
                .select({ one: sql`1` })
                .from(enrollments)
                .where(and(eq(enrollments.studentId, students.id), currentlyEnrolled, reach)),
            ),
        ),
      )
      // Those still at the school first, then by name.
      .orderBy(sql`${students.status} <> 'active'`, asc(students.fullName), asc(students.id))
      .limit(term.limit);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      titleUr: row.titleUr,
      subtitle: `${row.admissionNo} · ${row.fatherName}`,
      status: row.status,
      branchId: row.branchId,
    }));
  },
});

registerSearchSource({
  kind: 'guardians',
  module: 'students',
  permission: 'students:read',
  async search(ctx, term) {
    const reach = await enrollmentReach(ctx);
    const rows = await ctx.db
      .select({
        id: guardians.id,
        title: guardians.fullName,
        titleUr: guardians.fullNameUr,
        phone: guardians.phone,
      })
      .from(guardians)
      .where(
        and(
          isNull(guardians.deletedAt),
          or(
            matches(term, [guardians.fullName, guardians.fullNameUr]),
            matchesPhone(term, [guardians.phone, guardians.whatsappPhone, guardians.phoneAlt]),
            holds(ctx, 'students:read-sensitive') ? matches(term, [guardians.cnic]) : undefined,
          ),
          // A teacher: only the guardians of the students they teach.
          reach &&
            exists(
              ctx.db
                .select({ one: sql`1` })
                .from(studentGuardians)
                .innerJoin(enrollments, eq(enrollments.studentId, studentGuardians.studentId))
                .where(
                  and(
                    eq(studentGuardians.guardianId, guardians.id),
                    isNull(studentGuardians.deletedAt),
                    currentlyEnrolled,
                    reach,
                  ),
                ),
            ),
        ),
      )
      .orderBy(asc(guardians.fullName), asc(guardians.id))
      .limit(term.limit);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      titleUr: row.titleUr,
      subtitle: row.phone,
      status: null,
      branchId: null,
    }));
  },
});

import { and, count, eq, isNull } from 'drizzle-orm';
import type { ListStudentsParams } from '@school/contracts';
import { students } from '@school/db';
import { createDbService, type Ctx } from '../../kernel';

/**
 * Reusable student queries. This layer only reads and writes rows:
 * no permission checks and no business rules, so any service can call it safely inside its own transaction.
 */
export const studentsDb = {
  ...createDbService<typeof students, ListStudentsParams>(students, {
    label: 'Student',
    search: [students.fullName, students.fatherName, students.admissionNo],
    sort: {
      fullName: students.fullName,
      admissionNo: students.admissionNo,
      admittedOn: students.admittedOn,
      createdAt: students.createdAt,
    },
    filters: (params) => [
      params.branchId && eq(students.branchId, params.branchId),
      params.sectionId && eq(students.sectionId, params.sectionId),
      params.status && eq(students.status, params.status),
    ],
  }),

  // Queries only this module needs sit next to the generated ones.

  async findByAdmissionNo(ctx: Ctx, admissionNo: string) {
    const [row] = await ctx.db
      .select()
      .from(students)
      .where(and(eq(students.admissionNo, admissionNo), isNull(students.deletedAt)))
      .limit(1);
    return row;
  },

  async countActiveInSection(ctx: Ctx, sectionId: string) {
    const [row] = await ctx.db
      .select({ total: count() })
      .from(students)
      .where(and(eq(students.sectionId, sectionId), eq(students.status, 'active'), isNull(students.deletedAt)));
    return row?.total ?? 0;
  },
};

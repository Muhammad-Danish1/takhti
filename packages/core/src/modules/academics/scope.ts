import { and, between, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { roleGroups } from '@takhti/contracts';
import { enrollments, grades, sectionSubjects, sections, wings } from '@takhti/db';
import type { Ctx } from '../../kernel/context';

/*
 * Scoping that row-level security does not do, for the people who teach:
 * docs/plan/00-foundation/06-tenancy-roles-and-access.md ("Scoping that row-level security does not do").
 *
 *   A teacher sees only the sections they teach or are class teacher of.
 *   A section head sees only the grades of their wing.
 *
 * A person is limited by these only when every role they hold is one of the limited ones: a class
 * teacher who is also a coordinator sees what a coordinator sees. A school's own (custom) role
 * counts as a wider role.
 */

const TEACHING: readonly string[] = roleGroups.TEACHERS;
const WING: readonly string[] = [...roleGroups.TEACHERS, 'section_head'];

const onlyHolds = (ctx: Ctx, keys: readonly string[]): boolean =>
  ctx.actor.kind === 'staff' &&
  ctx.actor.roleKeys.length > 0 &&
  ctx.actor.roleKeys.every((key) => keys.includes(key));

/** The sections the person is class teacher of or teaches a subject in. */
async function ownSectionIds(ctx: Ctx): Promise<string[]> {
  const staffId = ctx.actor.staffId;
  if (!staffId) return [];
  const [asClassTeacher, asSubjectTeacher] = await Promise.all([
    ctx.db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.classTeacherId, staffId), isNull(sections.deletedAt))),
    ctx.db
      .select({ id: sectionSubjects.sectionId })
      .from(sectionSubjects)
      .where(and(eq(sectionSubjects.teacherId, staffId), isNull(sectionSubjects.deletedAt))),
  ]);
  return [...new Set([...asClassTeacher, ...asSubjectTeacher].map((row) => row.id))];
}

/**
 * The sections a teacher is limited to, or null for a person who is not limited to sections.
 * An empty list is a teacher with no class yet: they see no student.
 */
export async function teacherSectionIds(ctx: Ctx): Promise<string[] | null> {
  if (!onlyHolds(ctx, TEACHING)) return null;
  return ownSectionIds(ctx);
}

/**
 * The grades of the wings a section head leads, or null for a person who is not limited to a wing
 * (including a plain teacher, whose limit is `teacherSectionIds`).
 */
export async function wingGradeIds(ctx: Ctx): Promise<string[] | null> {
  if (!onlyHolds(ctx, WING) || !ctx.actor.roleKeys.includes('section_head')) return null;
  const staffId = ctx.actor.staffId;
  if (!staffId) return [];
  const led = await ctx.db
    .select({ gradeFrom: wings.gradeFrom, gradeTo: wings.gradeTo })
    .from(wings)
    .where(and(eq(wings.headStaffId, staffId), isNull(wings.deletedAt)));
  if (led.length === 0) return [];
  const rows = await ctx.db
    .select({ id: grades.id })
    .from(grades)
    .where(
      and(
        isNull(grades.deletedAt),
        or(...led.map((wing) => between(grades.level, wing.gradeFrom, wing.gradeTo))),
      ),
    );
  return rows.map((row) => row.id);
}

/**
 * R-students-17 as a condition on `enrollments`: the classes whose students the person may see.
 * Undefined for a person with neither limit. A section head who also teaches sees their wing and
 * the sections they teach outside it.
 */
export async function enrollmentReach(ctx: Ctx): Promise<SQL | undefined> {
  const sectionIds = await teacherSectionIds(ctx);
  if (sectionIds)
    return sectionIds.length > 0 ? inArray(enrollments.sectionId, sectionIds) : sql`false`;
  const gradeIds = await wingGradeIds(ctx);
  if (!gradeIds) return undefined;
  const taught = await ownSectionIds(ctx);
  const parts = [
    gradeIds.length > 0 ? inArray(enrollments.gradeId, gradeIds) : undefined,
    taught.length > 0 ? inArray(enrollments.sectionId, taught) : undefined,
  ].filter((part): part is SQL => part !== undefined);
  return parts.length > 0 ? or(...parts) : sql`false`;
}

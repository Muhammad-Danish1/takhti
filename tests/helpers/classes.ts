import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import {
  academicYears,
  enrollments,
  gradeSubjects,
  grades,
  gradingSchemes,
  sectionSubjects,
  sections,
  subjects,
  wings,
  type Tx,
} from '@takhti/db';

/*
 * The least a class needs to exist: a year, a grade, a section, and students sitting in it.
 * Like `people.ts`, everything runs on the privileged connection and no service is involved.
 * For tests of what a teacher or a section head may see.
 */

interface Base {
  orgId: string;
  now: string;
}

const stamps = (input: Base) => ({
  orgId: input.orgId,
  createdAt: input.now,
  updatedAt: input.now,
});

/** The school's active academic year, made on first use. */
export async function activeYear(tx: Tx, input: Base): Promise<string> {
  const [existing] = await tx
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(
      and(
        eq(academicYears.orgId, input.orgId),
        eq(academicYears.status, 'active'),
        isNull(academicYears.deletedAt),
      ),
    )
    .limit(1);
  if (existing) return existing.id;
  const id = randomUUID();
  await tx.insert(academicYears).values({
    id,
    ...stamps(input),
    name: '2026–27',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    status: 'active',
  });
  return id;
}

/** The grade of that level (1 to 10), made on first use. */
export async function gradeAt(tx: Tx, input: Base & { level: number }): Promise<string> {
  const [existing] = await tx
    .select({ id: grades.id })
    .from(grades)
    .where(
      and(eq(grades.orgId, input.orgId), eq(grades.level, input.level), isNull(grades.deletedAt)),
    )
    .limit(1);
  if (existing) return existing.id;
  let [scheme] = await tx
    .select({ id: gradingSchemes.id })
    .from(gradingSchemes)
    .where(and(eq(gradingSchemes.orgId, input.orgId), isNull(gradingSchemes.deletedAt)))
    .limit(1);
  if (!scheme) {
    scheme = { id: randomUUID() };
    await tx.insert(gradingSchemes).values({
      id: scheme.id,
      ...stamps(input),
      name: 'Test scheme',
      passPercent: 40,
      appliesFrom: '2024-04-01',
      status: 'active',
    });
  }
  const id = randomUUID();
  await tx.insert(grades).values({
    id,
    ...stamps(input),
    level: input.level,
    name: `Grade ${input.level}`,
    shortName: String(input.level),
    stage: input.level <= 5 ? 'primary' : input.level <= 8 ? 'middle' : 'secondary',
    gradingSchemeId: scheme.id,
  });
  return id;
}

export interface MadeSection {
  sectionId: string;
  gradeId: string;
  academicYearId: string;
  branchId: string;
}

/** A section of the active year: `Grade <level> – <name>`, with a class teacher when one is given. */
export async function makeSection(
  tx: Tx,
  input: Base & { branchId: string; level: number; name: string; classTeacherId?: string },
): Promise<MadeSection> {
  const academicYearId = await activeYear(tx, input);
  const gradeId = await gradeAt(tx, input);
  const sectionId = randomUUID();
  await tx.insert(sections).values({
    id: sectionId,
    ...stamps(input),
    branchId: input.branchId,
    academicYearId,
    gradeId,
    name: input.name,
    ...(input.classTeacherId && { classTeacherId: input.classTeacherId }),
  });
  return { sectionId, gradeId, academicYearId, branchId: input.branchId };
}

/** Seats a student in a section, as an active enrolment of the section's year. */
export async function enrol(
  tx: Tx,
  input: Base & { studentId: string; section: MadeSection },
): Promise<string> {
  const id = randomUUID();
  await tx.insert(enrollments).values({
    id,
    ...stamps(input),
    branchId: input.section.branchId,
    studentId: input.studentId,
    academicYearId: input.section.academicYearId,
    gradeId: input.section.gradeId,
    sectionId: input.section.sectionId,
    joinedOn: '2026-04-01',
  });
  return id;
}

/** Makes a member of staff the teacher of one subject in a section. */
export async function assignSubjectTeacher(
  tx: Tx,
  input: Base & { section: MadeSection; teacherId: string; subjectCode?: string },
): Promise<void> {
  const code = input.subjectCode ?? 'MATH';
  let [subject] = await tx
    .select({ id: subjects.id })
    .from(subjects)
    .where(and(eq(subjects.orgId, input.orgId), eq(subjects.code, code), isNull(subjects.deletedAt)))
    .limit(1);
  if (!subject) {
    subject = { id: randomUUID() };
    await tx.insert(subjects).values({ id: subject.id, ...stamps(input), code, name: code });
  }
  let [gradeSubject] = await tx
    .select({ id: gradeSubjects.id })
    .from(gradeSubjects)
    .where(
      and(
        eq(gradeSubjects.academicYearId, input.section.academicYearId),
        eq(gradeSubjects.gradeId, input.section.gradeId),
        eq(gradeSubjects.subjectId, subject.id),
        isNull(gradeSubjects.deletedAt),
      ),
    )
    .limit(1);
  if (!gradeSubject) {
    gradeSubject = { id: randomUUID() };
    await tx.insert(gradeSubjects).values({
      id: gradeSubject.id,
      ...stamps(input),
      academicYearId: input.section.academicYearId,
      gradeId: input.section.gradeId,
      subjectId: subject.id,
      periodsPerWeek: 5,
      theoryMarks: 100,
    });
  }
  await tx.insert(sectionSubjects).values({
    id: randomUUID(),
    ...stamps(input),
    branchId: input.section.branchId,
    sectionId: input.section.sectionId,
    gradeSubjectId: gradeSubject.id,
    teacherId: input.teacherId,
  });
}

/** A wing of a branch covering the given grade levels, led by the given member of staff. */
export async function makeWing(
  tx: Tx,
  input: Base & {
    branchId: string;
    name: string;
    gradeFrom: number;
    gradeTo: number;
    headStaffId?: string;
  },
): Promise<string> {
  const id = randomUUID();
  await tx.insert(wings).values({
    id,
    ...stamps(input),
    branchId: input.branchId,
    name: input.name,
    gradeFrom: input.gradeFrom,
    gradeTo: input.gradeTo,
    ...(input.headStaffId && { headStaffId: input.headStaffId }),
  });
  return id;
}

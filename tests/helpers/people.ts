import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import {
  designations,
  families,
  grades,
  gradingSchemes,
  guardians,
  staff,
  studentGuardians,
  students,
  type Tx,
} from '@takhti/db';

/*
 * The least a person needs to exist. A membership points at a staff, guardian or student record,
 * so a test that only needs "someone signed in as a cashier" still needs that record.
 * Everything runs on the privileged connection, like the seed: no service is involved.
 */

let serial = 0;
const next = () => String(++serial).padStart(5, '0');

interface Base {
  orgId: string;
  now: string;
}

const stamps = (input: Base) => ({
  orgId: input.orgId,
  createdAt: input.now,
  updatedAt: input.now,
});

async function designationOf(tx: Tx, input: Base): Promise<string> {
  const [existing] = await tx
    .select({ id: designations.id })
    .from(designations)
    .where(and(eq(designations.orgId, input.orgId), isNull(designations.deletedAt)))
    .limit(1);
  if (existing) return existing.id;
  const id = randomUUID();
  await tx
    .insert(designations)
    .values({ id, ...stamps(input), name: 'Staff member', category: 'administration' });
  return id;
}

/** A staff record at the given branch. Returns its id. */
export async function makeStaff(
  tx: Tx,
  input: Base & { branchId: string; fullName: string; teaching?: boolean },
): Promise<string> {
  const id = randomUUID();
  await tx.insert(staff).values({
    id,
    ...stamps(input),
    employeeNo: `T-${next()}`,
    fullName: input.fullName,
    gender: 'female',
    designationId: await designationOf(tx, input),
    homeBranchId: input.branchId,
    staffType: input.teaching ? 'teaching' : 'non_teaching',
    employmentType: 'permanent',
    joinedOn: '2024-04-01',
  });
  return id;
}

/** A family with nobody in it yet. Returns its id. */
export async function makeFamily(tx: Tx, input: Base): Promise<string> {
  const id = randomUUID();
  await tx.insert(families).values({ id, ...stamps(input), familyCode: `TF-${next()}` });
  return id;
}

/** A guardian, in the given family or in a new one. */
export async function makeGuardian(
  tx: Tx,
  input: Base & { fullName: string; familyId?: string },
): Promise<{ guardianId: string; familyId: string }> {
  const familyId = input.familyId ?? (await makeFamily(tx, input));
  const guardianId = randomUUID();
  await tx.insert(guardians).values({
    id: guardianId,
    ...stamps(input),
    familyId,
    fullName: input.fullName,
    phone: `+92300${String(1000000 + ++serial).slice(-7)}`,
  });
  return { guardianId, familyId };
}

/** The first grade of the organisation, made on first use together with the grading scheme it needs. */
async function gradeOf(tx: Tx, input: Base): Promise<string> {
  const [existing] = await tx
    .select({ id: grades.id })
    .from(grades)
    .where(and(eq(grades.orgId, input.orgId), isNull(grades.deletedAt)))
    .limit(1);
  if (existing) return existing.id;
  const schemeId = randomUUID();
  await tx.insert(gradingSchemes).values({
    id: schemeId,
    ...stamps(input),
    name: 'Test scheme',
    passPercent: 40,
    appliesFrom: '2024-04-01',
    status: 'active',
  });
  const id = randomUUID();
  await tx.insert(grades).values({
    id,
    ...stamps(input),
    level: 1,
    name: 'Grade 1',
    shortName: '1',
    stage: 'primary',
    gradingSchemeId: schemeId,
  });
  return id;
}

/** A student at the given branch, in the given family or in a new one. */
export async function makeStudent(
  tx: Tx,
  input: Base & { branchId: string; fullName: string; familyId?: string },
): Promise<{ studentId: string; familyId: string }> {
  const familyId = input.familyId ?? (await makeFamily(tx, input));
  const studentId = randomUUID();
  await tx.insert(students).values({
    id: studentId,
    ...stamps(input),
    branchId: input.branchId,
    familyId,
    admissionNo: `TA-${next()}`,
    fullName: input.fullName,
    fatherName: 'Farhan Ahmed',
    gender: 'female',
    dateOfBirth: '2015-03-10',
    admittedOn: '2024-04-01',
    admissionGradeId: await gradeOf(tx, input),
  });
  return { studentId, familyId };
}

/** Records that the guardian is a guardian of the student. */
export async function linkGuardian(
  tx: Tx,
  input: Base & { studentId: string; guardianId: string; isPrimary?: boolean },
): Promise<void> {
  await tx.insert(studentGuardians).values({
    id: randomUUID(),
    ...stamps(input),
    studentId: input.studentId,
    guardianId: input.guardianId,
    relation: 'father',
    isPrimary: input.isPrimary ?? true,
  });
}

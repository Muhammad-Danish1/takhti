import { z } from 'zod';
import { baseEntity, defineResource, listQuery } from '../kernel/resource';

/** Allowed values live here once; the database table imports the same lists. */
export const studentStatuses = ['active', 'left', 'graduated', 'suspended'] as const;
export const genders = ['male', 'female'] as const;

export const StudentStatus = z.enum(studentStatuses);
export const Gender = z.enum(genders);

/** Fields a person can type in. Reused by the entity, the create body and the update body. */
const fields = {
  admissionNo: z.string().trim().min(1).max(30),
  fullName: z.string().trim().min(2).max(120),
  fatherName: z.string().trim().min(2).max(120),
  gender: Gender,
  /** Calendar dates are 'YYYY-MM-DD' text from the database to the screen, never a JS Date. */
  dateOfBirth: z.iso.date(),
  bFormNo: z
    .string()
    .regex(/^\d{5}-\d{7}-\d$/, { error: 'Use the format 12345-1234567-1' })
    .nullable(),
  sectionId: z.uuid().nullable(),
  admittedOn: z.iso.date(),
};

export const Student = z.object({
  ...baseEntity,
  branchId: z.uuid(),
  ...fields,
  status: StudentStatus,
});

export const CreateStudent = z.object({
  /** Optional so an offline device can create the id itself. */
  id: z.uuid().optional(),
  branchId: z.uuid(),
  ...fields,
});

/** Admission number and branch are fixed after admission. */
export const UpdateStudent = z
  .object(fields)
  .omit({ admissionNo: true })
  .partial()
  .extend({ version: z.int() });

export const ListStudents = listQuery({
  sortable: ['fullName', 'admissionNo', 'admittedOn', 'createdAt'],
  defaultSort: 'fullName',
  filters: {
    branchId: z.uuid().optional(),
    sectionId: z.uuid().optional(),
    status: StudentStatus.optional(),
  },
});

/** A custom action beyond plain create/update/delete. */
export const ChangeSection = z.object({
  sectionId: z.uuid(),
  version: z.int(),
});

export const studentsContract = defineResource({
  name: 'students',
  path: '/students',
  entity: Student,
  create: CreateStudent,
  update: UpdateStudent,
  list: ListStudents,
});

export type Student = z.output<typeof Student>;
export type CreateStudent = z.output<typeof CreateStudent>;
export type UpdateStudent = z.output<typeof UpdateStudent>;
export type ListStudentsParams = z.output<typeof ListStudents>;
export type ChangeSection = z.output<typeof ChangeSection>;

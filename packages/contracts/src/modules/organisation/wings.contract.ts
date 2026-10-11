import { z } from 'zod';
import { Name, NameUr } from '../../kernel/primitives';
import { baseEntity, defineResource, listQuery } from '../../kernel/resource';

const grade = z.int().min(1).max(10);

const fields = {
  name: Name,
  nameUr: NameUr.nullable(),
  gradeFrom: grade,
  gradeTo: grade,
  headStaffId: z.uuid().nullable(),
};

const rangeIsOrdered = (value: { gradeFrom?: number | undefined; gradeTo?: number | undefined }) =>
  value.gradeFrom === undefined || value.gradeTo === undefined || value.gradeTo >= value.gradeFrom;
const rangeError = { error: 'The last grade cannot be before the first', path: ['gradeTo'] };

export const Wing = z.object({ ...baseEntity, branchId: z.uuid(), ...fields });
export type Wing = z.output<typeof Wing>;

export const CreateWing = z
  .object({
    id: z.uuid().optional(),
    branchId: z.uuid(),
    name: fields.name,
    nameUr: fields.nameUr.optional(),
    gradeFrom: fields.gradeFrom,
    gradeTo: fields.gradeTo,
    headStaffId: fields.headStaffId.optional(),
  })
  .refine(rangeIsOrdered, rangeError);
export type CreateWing = z.output<typeof CreateWing>;

export const UpdateWing = z
  .object(fields)
  .partial()
  .extend({ version: z.int() })
  .refine(rangeIsOrdered, rangeError);
export type UpdateWing = z.output<typeof UpdateWing>;

export const ListWings = listQuery({
  sortable: ['name', 'gradeFrom', 'createdAt'],
  defaultSort: 'gradeFrom',
  filters: { branchId: z.uuid().optional() },
});
export type ListWingsParams = z.output<typeof ListWings>;

export const wingsContract = defineResource({
  name: 'wings',
  path: '/wings',
  entity: Wing,
  create: CreateWing,
  update: UpdateWing,
  list: ListWings,
});

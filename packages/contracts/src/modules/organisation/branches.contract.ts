import { z } from 'zod';
import { defineMachine } from '../../kernel/machine';
import {
  Code,
  DateStr,
  Email,
  GenderPolicy,
  Name,
  NameUr,
  PhoneAny,
  ShortText,
} from '../../kernel/primitives';
import { baseEntity, defineResource, listQuery } from '../../kernel/resource';

export const branchStatuses = ['active', 'inactive'] as const;
export const BranchStatus = z.enum(branchStatuses);
export type BranchStatus = (typeof branchStatuses)[number];

export const branchStatusMachine = defineMachine({
  active: ['inactive'],
  inactive: ['active'],
});

/** Fields a person can type in. Reused by the entity, the create body and the update body. */
const fields = {
  /** Used inside human-facing numbers such as admission numbers. Fixed once a number has been issued with it. */
  code: Code(2, 5),
  name: Name,
  nameUr: NameUr.nullable(),
  address: ShortText.min(1, { error: 'Enter the address' }),
  city: Name,
  phone: PhoneAny.nullable(),
  email: Email.nullable(),
  gender: GenderPolicy,
  principalStaffId: z.uuid().nullable(),
  regulatorName: ShortText.nullable(),
  regulatorRegistrationNo: ShortText.nullable(),
  regulatorExpiresOn: DateStr.nullable(),
  boardId: z.uuid().nullable(),
  boardAffiliationNo: ShortText.nullable(),
  boardAffiliationExpiresOn: DateStr.nullable(),
  capacity: z.int().min(1).max(100_000).nullable(),
  openedOn: DateStr.nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
};

export const Branch = z.object({
  ...baseEntity,
  ...fields,
  status: BranchStatus,
});
export type Branch = z.output<typeof Branch>;

/** Optional fields may be left out on create; they are stored as empty. */
export const CreateBranch = z.object({
  /** Optional so an offline device can create the id itself. */
  id: z.uuid().optional(),
  code: fields.code,
  name: fields.name,
  address: fields.address,
  city: fields.city,
  nameUr: fields.nameUr.optional(),
  phone: fields.phone.optional(),
  email: fields.email.optional(),
  gender: fields.gender.optional(),
  principalStaffId: fields.principalStaffId.optional(),
  regulatorName: fields.regulatorName.optional(),
  regulatorRegistrationNo: fields.regulatorRegistrationNo.optional(),
  regulatorExpiresOn: fields.regulatorExpiresOn.optional(),
  boardId: fields.boardId.optional(),
  boardAffiliationNo: fields.boardAffiliationNo.optional(),
  boardAffiliationExpiresOn: fields.boardAffiliationExpiresOn.optional(),
  capacity: fields.capacity.optional(),
  openedOn: fields.openedOn.optional(),
  latitude: fields.latitude.optional(),
  longitude: fields.longitude.optional(),
  /** R-org-11: give the new branch the group's bell schedule template. Yes, unless told otherwise. */
  copyBellSchedule: z.boolean().optional(),
  /** R-org-11: copy the fee structures of this branch of the group to the new one. */
  copyFeeStructuresFrom: z.uuid().nullable().optional(),
});
export type CreateBranch = z.output<typeof CreateBranch>;

/** Built from fields without defaults, so leaving a field out never resets it. */
export const UpdateBranch = z.object(fields).partial().extend({ version: z.int() });
export type UpdateBranch = z.output<typeof UpdateBranch>;

export const ListBranches = listQuery({
  sortable: ['name', 'code', 'city', 'createdAt'],
  defaultSort: 'name',
  filters: {
    status: BranchStatus.optional(),
    gender: GenderPolicy.optional(),
    city: z.string().trim().min(1).max(120).optional(),
  },
});
export type ListBranchesParams = z.output<typeof ListBranches>;

export const branchesContract = defineResource({
  name: 'branches',
  path: '/branches',
  entity: Branch,
  create: CreateBranch,
  update: UpdateBranch,
  list: ListBranches,
});

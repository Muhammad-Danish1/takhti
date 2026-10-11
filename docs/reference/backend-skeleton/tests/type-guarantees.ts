// Proves what the compiler catches. This file is never run; `pnpm typecheck` reads it.
// Each @ts-expect-error must really be an error, otherwise the compiler reports
// "Unused '@ts-expect-error' directive" and the type-check fails.
import { z } from 'zod';
import { studentsApi } from '@school/api-client';
import { CreateStudent, defineResource, studentsContract, type ListStudentsParams } from '@school/contracts';
import { createCrudService, createDbService, studentsDb, studentsService, type Ctx } from '@school/core';
import { students } from '@school/db';
import { useCreateStudent, useStudents, useUpdateStudent } from '@school/hooks';

declare const ctx: Ctx;

// 1. A sortable name in the contract with no column in the db-service.
createDbService<typeof students, ListStudentsParams>(students, {
  label: 'Student',
  // @ts-expect-error "createdAt" is missing
  sort: { fullName: students.fullName, admissionNo: students.admissionNo, admittedOn: students.admittedOn },
});

// 2. A contract whose create body does not fit the table must supply a mapper.
const badContract = defineResource({
  ...studentsContract,
  create: CreateStudent.extend({ gender: z.string() }),
});
// @ts-expect-error toInsert is required
createCrudService({ contract: badContract, db: studentsDb });
// ...and is accepted once the mapper is given.
createCrudService({
  contract: badContract,
  db: studentsDb,
  toInsert: (input) => ({ ...input, gender: input.gender === 'female' ? 'female' : 'male' }),
});

// 3. API client.
void studentsApi.list({ status: 'active', page: 2 });
// @ts-expect-error unknown status
void studentsApi.list({ status: 'expelled' });
// @ts-expect-error required fields missing
void studentsApi.create({ fullName: 'A' });

// 4. Service and db-service results.
export async function serverTypes() {
  const page = await studentsService.list(ctx, { page: 1, pageSize: 25, sort: 'fullName', order: 'asc' });
  const student = page.items[0]!;
  const name: string = student.fullName;
  // @ts-expect-error orgId is not part of the API entity
  void student.orgId;

  const row = await studentsDb.get(ctx, 'id');
  const orgId: string = row.orgId;
  const status: 'active' | 'left' | 'graduated' | 'suspended' = row.status;
  // @ts-expect-error a patch cannot touch a managed column
  await studentsDb.update(ctx, 'id', { orgId: 'other' });
  // @ts-expect-error not a column
  await studentsDb.update(ctx, 'id', { nickname: 'x' });
  return { name, orgId, status };
}

// 5. Hooks.
export function hookTypes() {
  const list = useStudents({ sectionId: 'x', sort: 'admissionNo' });
  const total: number | undefined = list.data?.total;
  const firstName: string | undefined = list.data?.items[0]?.fullName;

  // @ts-expect-error not a sortable field
  useStudents({ sort: 'fatherName' });

  const create = useCreateStudent();
  // @ts-expect-error required fields missing
  create.mutate({ fullName: 'A' });

  const update = useUpdateStudent();
  update.mutate({ id: 'x', version: 3, fullName: 'New name' });
  // @ts-expect-error version is required on every update
  update.mutate({ id: 'x', fullName: 'New name' });
  return { total, firstName };
}

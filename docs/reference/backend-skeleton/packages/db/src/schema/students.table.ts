import { sql } from 'drizzle-orm';
import { date, index, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { genders, studentStatuses } from '@school/contracts';
import { baseColumns, table } from '../kernel/columns';
import { branchScoped } from '../kernel/policies';
import { branches } from './org.table';

export const students = table(
  'students',
  {
    ...baseColumns,
    branchId: uuid()
      .notNull()
      .references(() => branches.id),
    admissionNo: text().notNull(),
    fullName: text().notNull(),
    fatherName: text().notNull(),
    gender: text({ enum: genders }).notNull(),
    dateOfBirth: date({ mode: 'string' }).notNull(),
    bFormNo: text(),
    /** References `sections.id` once the academics tables exist. */
    sectionId: uuid(),
    status: text({ enum: studentStatuses }).notNull().default('active'),
    admittedOn: date({ mode: 'string' }).notNull(),
  },
  (t) => [
    // An admission number is unique inside a school group, ignoring deleted rows.
    uniqueIndex('students_admission_no_uq')
      .on(t.orgId, t.admissionNo)
      .where(sql`${t.deletedAt} is null`),
    index('students_section_idx').on(t.orgId, t.sectionId),
    ...branchScoped('students', t),
  ],
);

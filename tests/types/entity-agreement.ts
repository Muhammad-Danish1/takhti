// Proves that `Agrees` (tests/types/helpers.ts) notices every way a record type can drift from its table.
// This file is never run; `pnpm typecheck` reads it. Each @ts-expect-error must really be an error.
import type { AcademicYear } from '@takhti/contracts';
import type { academicYears } from '@takhti/db';
import type { Agrees, Expect } from './helpers';

export type EntityAgreement = [
  Expect<Agrees<typeof academicYears, AcademicYear>>,
  // @ts-expect-error a field the table does not have
  Expect<Agrees<typeof academicYears, AcademicYear & { nickname: string }>>,
  // @ts-expect-error a field that may be empty in the table but not in the record
  Expect<Agrees<typeof academicYears, Omit<AcademicYear, 'closedAt'> & { closedAt: string }>>,
  // @ts-expect-error a value list wider than the table's
  Expect<Agrees<typeof academicYears, Omit<AcademicYear, 'status'> & { status: string }>>,
];

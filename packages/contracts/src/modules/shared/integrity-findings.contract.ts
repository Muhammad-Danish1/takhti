import { z } from 'zod';
import { LongText } from '../../kernel/primitives';
import { MAX_PAGE_SIZE } from '../../kernel/resource';
import { FindingSeverity, FindingStatus } from './shared.constants';

/*
 * What the nightly data checks found: docs/plan/10-modules/m00-shared-kernel.md and
 * docs/plan/00-foundation/09-reliability-and-error-proofing.md, section 7.
 * A finding is never fixed by the system. A person looks, puts the data right, and closes it.
 */

export const ListFindings = z.strictObject({
  status: FindingStatus.optional(),
  severity: FindingSeverity.optional(),
  /** The whole name of a check, such as `accounting.entries-balance`. */
  checkName: z.string().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});
export type ListFindings = z.output<typeof ListFindings>;

export const Finding = z.object({
  id: z.uuid(),
  version: z.int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  checkName: z.string(),
  /** The record it is about, when it is about one. */
  entityType: z.string().nullable(),
  entityId: z.uuid().nullable(),
  /** What differed, in the check's own figures. */
  detail: z.unknown(),
  severity: FindingSeverity,
  status: FindingStatus,
  resolvedBy: z.uuid().nullable(),
  resolvedByName: z.string().nullable(),
  resolvedNote: z.string().nullable(),
});
export type Finding = z.output<typeof Finding>;

export const ResolveFinding = z.object({
  /** What was wrong and what was done about it. */
  note: LongText.min(1, { error: 'Say what was done about it' }),
});
export type ResolveFinding = z.output<typeof ResolveFinding>;

import { z } from 'zod';

/*
 * Global search, the box at the top of every staff screen: docs/plan/10-modules/m00-shared-kernel.md,
 * section 4 and rule R-shared-14.
 */

export const searchKinds = ['students', 'guardians', 'staff', 'vouchers'] as const;
export const SearchKind = z.enum(searchKinds);
export type SearchKind = (typeof searchKinds)[number];

/** The most results of one kind. The box is for finding one record, not for listing them. */
export const MAX_SEARCH_HITS = 8;

const Kinds = z.preprocess(
  // A list in a query is written with commas: `?kinds=students,staff`.
  (value) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value),
  z.array(SearchKind).min(1).max(searchKinds.length),
);

export const GlobalSearch = z.strictObject({
  q: z
    .string()
    .trim()
    .min(2, { error: 'Type at least two characters' })
    .max(80),
  /** Only these kinds. Left out: every kind the person may search. */
  kinds: Kinds.optional(),
});
export type GlobalSearch = z.output<typeof GlobalSearch>;

export const SearchHit = z.object({
  kind: SearchKind,
  id: z.uuid(),
  /** The name of the record: a person's name, a voucher's number. */
  title: z.string(),
  /** The same in Urdu, where the record has it. */
  titleUr: z.string().nullable(),
  /** What tells it from another of the same name: an admission number, a phone number. */
  subtitle: z.string().nullable(),
  /** Its state as the record keeps it (`active`, `left`, `paid`), for a badge. */
  status: z.string().nullable(),
  branchId: z.uuid().nullable(),
});
export type SearchHit = z.output<typeof SearchHit>;

export const SearchResults = z.object({
  groups: z.array(z.object({ kind: SearchKind, hits: z.array(SearchHit) })),
});
export type SearchResults = z.output<typeof SearchResults>;

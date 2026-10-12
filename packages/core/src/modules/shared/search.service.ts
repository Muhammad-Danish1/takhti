import { ilike, or, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  MAX_SEARCH_HITS,
  searchKinds,
  type GlobalSearch,
  type ModuleKey,
  type PermissionKey,
  type SearchHit,
  type SearchKind,
  type SearchResults,
} from '@takhti/contracts';
import type { Ctx } from '../../kernel/context';
import { isModuleEnabled } from '../../kernel/modules';
import { holds } from '../../kernel/permissions';
import { escapeLike, normaliseQuery } from '../../kernel/search';

/*
 * Global search, the box at the top of every staff screen: docs/plan/10-modules/m00-shared-kernel.md,
 * rule R-shared-14.
 *
 * Each kind of record answers for itself, beside its own service, because only its module knows
 * who may open one:
 *
 *   registerSearchSource({
 *     kind: 'students', module: 'students', permission: 'students:read',
 *     search: (ctx, term) => …at most `term.limit` hits the person could open…
 *   });
 *
 * A source reads through the caller's `ctx`, so row-level security has already kept it to the
 * person's school and branches; the source adds what row-level security does not do (a teacher's
 * sections) and nothing a person could not read on the record's own page.
 */

export interface SearchTerm {
  /** What was typed, trimmed, with Urdu letter forms folded together. */
  text: string;
  /** The same as a LIKE pattern: contains, ignoring case. */
  pattern: string;
  /**
   * When what was typed is a phone number or part of one: a pattern for its digits as phone
   * numbers are stored, so `0300 123` finds `+92300123…`.
   */
  phonePattern: string | null;
  /** The most hits to return. */
  limit: number;
}

export type SearchHitInput = Omit<SearchHit, 'kind'>;

export interface SearchSource {
  kind: SearchKind;
  /** A module that is off for the school has nothing to find. */
  module: ModuleKey;
  /** Whoever lacks it is not shown this kind at all. */
  permission: PermissionKey;
  search: (ctx: Ctx, term: SearchTerm) => Promise<readonly SearchHitInput[]>;
}

const sources = new Map<SearchKind, SearchSource>();

export function registerSearchSource(source: SearchSource): void {
  sources.set(source.kind, source);
}

export const registeredSearchSources = (): SearchSource[] => [...sources.values()];

/** For a source: any of the columns contains what was typed. */
export function matches(term: SearchTerm, columns: readonly AnyPgColumn[]): SQL | undefined {
  return or(...columns.map((column) => ilike(column, term.pattern)));
}

/** For a source: any of the phone columns contains the digits typed. Undefined when no number was typed. */
export function matchesPhone(term: SearchTerm, columns: readonly AnyPgColumn[]): SQL | undefined {
  const pattern = term.phonePattern;
  if (!pattern) return undefined;
  return or(...columns.map((column) => ilike(column, pattern)));
}

/** A number typed the local way (`0300-1234567`) or the international way, as the digits both share. */
export function phonePatternOf(text: string): string | null {
  if (!/^[+\d][\d\s-]*$/.test(text)) return null;
  let digits = text.replace(/\D/g, '');
  if (digits.startsWith('0092')) digits = digits.slice(4);
  else if (digits.startsWith('92') && text.startsWith('+')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.length >= 4 ? `%${digits}%` : null;
}

export function toSearchTerm(q: string, limit = MAX_SEARCH_HITS): SearchTerm {
  const text = normaliseQuery(q);
  return { text, pattern: `%${escapeLike(text)}%`, phonePattern: phonePatternOf(text), limit };
}

export const searchService = {
  /**
   * R-shared-14: at most eight of each kind, and only records the person could open. A kind the
   * person may not search is left out of the answer; one they may search with nothing found is
   * there, empty.
   */
  async search(ctx: Ctx, query: GlobalSearch): Promise<SearchResults> {
    const term = toSearchTerm(query.q);
    const asked: readonly SearchKind[] = query.kinds ?? searchKinds;
    const groups: SearchResults['groups'] = [];
    for (const kind of searchKinds) {
      const source = sources.get(kind);
      if (!source || !asked.includes(kind)) continue;
      if (!holds(ctx, source.permission)) continue;
      if (!(await isModuleEnabled(ctx, source.module))) continue;
      const hits = await source.search(ctx, term);
      groups.push({ kind, hits: hits.slice(0, term.limit).map((hit) => ({ kind, ...hit })) });
    }
    return { groups };
  },
};

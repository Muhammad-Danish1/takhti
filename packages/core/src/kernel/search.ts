import { ilike, or, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/** Escapes the characters that mean "anything" in a LIKE pattern, so a search for `50%` finds `50%`. */
export const escapeLike = (text: string): string => text.replace(/[\\%_]/g, (char) => `\\${char}`);

/**
 * Different keyboards produce different code points for the same Urdu letter.
 * This folds the common pairs together so a search matches however the name was typed:
 * Arabic yeh and Farsi yeh, Arabic kaf and keheh, the forms of heh, and Arabic-Indic digits.
 */
export function normaliseUrdu(text: string): string {
  return text
    .replace(/[يى]/g, 'ی') // ي ى → ی
    .replace(/ك/g, 'ک') // ك → ک
    .replace(/[هہە]/g, 'ہ') // ه ە → ہ
    .replace(/[٠-٩]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) + 0x90)) // ٠-٩ → ۰-۹
    .replace(/[ً-ْٰ]/g, '') // drop short-vowel marks
    .replace(/ـ/g, ''); // drop the stretching mark
}

/** Trims, collapses spaces and normalises Urdu letter forms. Applied to `q` before it reaches a query. */
export const normaliseQuery = (q: string): string => normaliseUrdu(q.trim().replace(/\s+/g, ' '));

/**
 * The condition for a search box: any of the columns contains the text, ignoring case.
 * Returns undefined for an empty query or no columns, so it can be passed straight to `and(...)`.
 */
export function searchCondition(
  columns: readonly AnyPgColumn[],
  q: string | undefined,
): SQL | undefined {
  if (!q || columns.length === 0) return undefined;
  const term = normaliseQuery(q);
  if (!term) return undefined;
  const pattern = `%${escapeLike(term)}%`;
  return or(...columns.map((column) => ilike(column, pattern)));
}

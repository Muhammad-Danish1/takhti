import { sql } from 'drizzle-orm';
import { rowsOf } from '@takhti/db';
import { stampOf, type Ctx } from './context';
import { numberParts } from './dates';
import { newId } from './ids';

/*
 * Human-facing numbers: admission numbers, fee vouchers, receipts.
 *
 * One atomic statement takes the next value, so 50 people saving at the same moment get 50
 * different, consecutive numbers. It runs in the caller's transaction: if the save is rolled back
 * the number goes back too, and no gap is left.
 */

export interface NumberOptions {
  /** A separate run of numbers per branch. */
  branchId?: string;
  /** A separate run per period, for example `2610`: the counter starts again at 1 in a new period. */
  period?: string;
  /** For example `FV-{yymm}-{00000}`. See `formatNumber`. */
  format: string;
  /** Values for other placeholders in the format, such as `{branch}` or `{type}`. */
  values?: Record<string, string>;
}

/**
 * Fills a number format.
 *
 *   {0000}    the counter, zero-padded to that many digits (it grows past them rather than repeat)
 *   {yy} {yyyy} {mm} {yymm}   parts of the given date
 *   {name}    any key of `values`
 *
 * An unknown placeholder is an error: a number with a hole in it must never be issued.
 */
export function formatNumber(
  format: string,
  counter: number,
  date: string,
  values: Record<string, string> = {},
): string {
  if (!/\{0+\}/.test(format))
    throw new Error(`Number format "${format}" has no counter such as {0000}`);
  const parts: Record<string, string> = { ...numberParts(date), ...values };
  return format.replace(/\{([^{}]+)\}/g, (_whole, name: string) => {
    if (/^0+$/.test(name)) return String(counter).padStart(name.length, '0');
    const value = parts[name];
    if (value === undefined || value === '')
      throw new Error(`Number format "${format}" uses {${name}}, which was not supplied`);
    return value;
  });
}

/** Takes the next counter value for a key, without formatting it. */
export async function nextValue(
  ctx: Ctx,
  key: string,
  options: { branchId?: string; period?: string } = {},
): Promise<number> {
  const result = await ctx.db.execute(sql`
    insert into number_sequences (id, org_id, key, branch_id, period, next_value, created_at, updated_at, created_by, updated_by)
    values (${newId()}::uuid, ${ctx.actor.orgId}::uuid, ${key}, ${options.branchId ?? null}::uuid, ${options.period ?? ''}, 2,
            ${ctx.now}::timestamptz, ${ctx.now}::timestamptz, ${stampOf(ctx)}::uuid, ${stampOf(ctx)}::uuid)
    on conflict (org_id, key, branch_id, period) do update
      set next_value = number_sequences.next_value + 1,
          version = number_sequences.version + 1,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by
    returning next_value - 1 as value
  `);
  const value = rowsOf<{ value: number | string }>(result)[0]?.value;
  if (value === undefined) throw new Error(`Could not take a number for "${key}"`);
  return Number(value);
}

/** The next number for a key, formatted: `nextNumber(ctx, 'fee_voucher', { period: '2610', format: 'FV-{yymm}-{00000}' })`. */
export async function nextNumber(ctx: Ctx, key: string, options: NumberOptions): Promise<string> {
  // Checked before a number is taken, so a faulty format wastes none.
  formatNumber(options.format, 1, ctx.today, options.values);
  const value = await nextValue(ctx, key, options);
  return formatNumber(options.format, value, ctx.today, options.values);
}

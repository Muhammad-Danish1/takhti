import type { BulkResult } from '@takhti/contracts';
import type { Ctx } from './context';
import { toErrorResponse } from './errors';

/*
 * Runs each item in its own savepoint, so one bad row does not undo the good ones.
 * Used by promotions, bulk attendance, voucher generation and imports.
 *
 * An item that fails for a reason a person can fix (validation, a rule, a duplicate) is reported
 * in `failed`. An item that fails because of a bug stops the whole call: half-applying work that
 * hit a programming error would hide the error.
 */

class RollbackItem extends Error {
  constructor(readonly original: unknown) {
    super('bulk item failed');
  }
}

export interface BulkOptions {
  /** Stop at the first failure and undo everything, for calls that must be all-or-nothing. */
  allOrNothing?: boolean;
  /** The most items one call may carry. Default 1,000. */
  maxItems?: number;
}

export const MAX_BULK_ITEMS = 1_000;

export async function runBulk<TItem, TResult>(
  ctx: Ctx,
  items: readonly TItem[],
  work: (ctx: Ctx, item: TItem, index: number) => Promise<TResult>,
  options: BulkOptions = {},
): Promise<BulkResult<TResult>> {
  const result: BulkResult<TResult> = { succeeded: [], failed: [] };

  for (const [index, item] of items.entries()) {
    try {
      // A nested transaction is a savepoint: its own writes are undone on failure, earlier items stay.
      const value = await ctx.db.transaction(async (savepoint) => {
        try {
          return await work({ ...ctx, db: savepoint }, item, index);
        } catch (error) {
          throw new RollbackItem(error);
        }
      });
      result.succeeded.push(value);
    } catch (error) {
      const original = error instanceof RollbackItem ? error.original : error;
      const reply = toErrorResponse(original, ctx.requestId);
      if (reply.unexpected || options.allOrNothing) throw original;
      result.failed.push({
        index,
        code: reply.body.error.code,
        message: reply.body.error.message,
        ...(reply.body.error.fields && { fields: reply.body.error.fields }),
      });
    }
  }
  return result;
}

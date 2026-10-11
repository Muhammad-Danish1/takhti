import type { Machine } from '@takhti/contracts';
import { rule } from './errors';

/*
 * Machines are declared beside their contracts with `defineMachine`.
 * This is the server-side check that turns a forbidden move into a RULE error a person can read.
 */

/** Throws `RULE` "Voucher cannot go from paid to cancelled" when the move is not allowed. */
export function assertTransition<S extends string>(
  machine: Machine<S>,
  from: S,
  to: S,
  label: string,
): void {
  if (from === to) return;
  if (!machine.can(from, to)) {
    throw rule(`${label} cannot go from ${readable(from)} to ${readable(to)}`);
  }
}

/** Throws `RULE` when the record is not in one of the statuses an action needs. */
export function assertStatus<S extends string>(
  current: S,
  allowed: readonly S[],
  label: string,
  action: string,
): void {
  if (!allowed.includes(current)) {
    throw rule(`${label} is ${readable(current)}, so it cannot be ${action}`);
  }
}

const readable = (status: string) => status.replace(/_/g, ' ');

/*
 * A state machine for a status column: which status may follow which.
 * Every status column in the product has one, declared beside its contract.
 * The server-side `assert` that throws a RULE error is in `@takhti/core`.
 */

export interface Machine<S extends string> {
  /** Every status, in declaration order. */
  states: readonly S[];
  /** Statuses that `from` may move to. */
  next(from: S): readonly S[];
  can(from: S, to: S): boolean;
  /** True when nothing follows this status. */
  isFinal(state: S): boolean;
}

export function defineMachine<const T extends Record<string, readonly string[]>>(
  transitions: T & { [K in keyof T]: readonly (keyof T & string)[] },
): Machine<keyof T & string> {
  type S = keyof T & string;
  const table = transitions as Record<S, readonly S[]>;
  const states = Object.keys(table) as S[];
  return {
    states,
    next: (from) => table[from] ?? [],
    can: (from, to) => (table[from] ?? []).includes(to),
    isFinal: (state) => (table[state] ?? []).length === 0,
  };
}

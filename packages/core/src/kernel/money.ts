/*
 * Money is whole paisa, held in plain integers. Rs 8,500 is 850000.
 * This is the only file where money is multiplied or divided; a lint rule keeps it that way.
 * Every function here returns a whole number, so no fraction of a paisa can ever be stored.
 */

/** A whole number of paisa. */
export type Paisa = number;

const PAISA_PER_RUPEE = 100;

function assertWhole(value: number, name: string): void {
  if (!Number.isSafeInteger(value))
    throw new Error(`${name} must be a whole number of paisa, got ${value}`);
}

/** Rounds half away from zero, so Rs 0.5 becomes Rs 1 and Rs -0.5 becomes Rs -1. */
function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Rupees to paisa: `rupees(8500)` is 850000. Accepts at most two decimal places. */
export function rupees(amount: number): Paisa {
  const paisa = roundHalfUp(amount * PAISA_PER_RUPEE);
  if (Math.abs(paisa - amount * PAISA_PER_RUPEE) > 1e-6) {
    throw new Error(`An amount in rupees can have at most two decimal places, got ${amount}`);
  }
  assertWhole(paisa, 'amount');
  return paisa;
}

/** Paisa to a rupee number for display maths only: 850050 is 8500.5. */
export function toRupees(paisa: Paisa): number {
  assertWhole(paisa, 'amount');
  return paisa / PAISA_PER_RUPEE;
}

/** `Rs 8,500` or `Rs 8,500.50`. Paisa are shown only when they are not zero. */
export function formatRs(paisa: Paisa): string {
  assertWhole(paisa, 'amount');
  const negative = paisa < 0;
  const absolute = Math.abs(paisa);
  const whole = Math.trunc(absolute / PAISA_PER_RUPEE);
  const fraction = absolute % PAISA_PER_RUPEE;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const text = fraction === 0 ? grouped : `${grouped}.${String(fraction).padStart(2, '0')}`;
  return `${negative ? '-' : ''}Rs ${text}`;
}

/** Rounds to a whole rupee, half up: 850049 stays 850000, 850050 becomes 850100. */
export function roundToRupee(paisa: Paisa): Paisa {
  assertWhole(paisa, 'amount');
  return roundHalfUp(paisa / PAISA_PER_RUPEE) * PAISA_PER_RUPEE;
}

/** The paisa needed to bring an amount to a whole rupee; the value of a voucher's "rounding" line. */
export function roundingDifference(paisa: Paisa): Paisa {
  return roundToRupee(paisa) - paisa;
}

/**
 * A percentage of an amount, rounded half up to a whole paisa.
 * `percentOf(833300, 7.5)` is 62498 (Rs 624.98).
 * The percentage is scaled to an integer first, so the multiplication is exact.
 */
export function percentOf(paisa: Paisa, percent: number): Paisa {
  assertWhole(paisa, 'amount');
  const scaled = Math.round(percent * 10_000);
  if (Math.abs(scaled - percent * 10_000) > 1e-6)
    throw new Error(`A percentage can have at most four decimal places, got ${percent}`);
  // BigInt keeps the product exact even for very large amounts.
  const product = BigInt(paisa) * BigInt(scaled);
  const divisor = 1_000_000n;
  const negative = product < 0n;
  const absolute = negative ? -product : product;
  const rounded = (absolute + divisor / 2n) / divisor;
  return Number(negative ? -rounded : rounded);
}

/** An amount multiplied by a whole count. */
export function times(paisa: Paisa, count: number): Paisa {
  assertWhole(paisa, 'amount');
  if (!Number.isSafeInteger(count)) throw new Error(`count must be a whole number, got ${count}`);
  const result = paisa * count;
  assertWhole(result, 'result');
  return result;
}

/**
 * An amount multiplied by a fraction `numerator / denominator`, rounded half up.
 * Used for proration: `fraction(basicPay, daysWorked, daysInMonth)`.
 */
export function fraction(paisa: Paisa, numerator: number, denominator: number): Paisa {
  assertWhole(paisa, 'amount');
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    throw new Error(
      'A fraction needs whole numbers; scale decimals up first (half days as 1 of 2)',
    );
  }
  if (denominator <= 0) throw new Error(`The denominator must be above zero, got ${denominator}`);
  const product = BigInt(paisa) * BigInt(numerator);
  const divisor = BigInt(denominator);
  const negative = product < 0n;
  const absolute = negative ? -product : product;
  const rounded = (absolute * 2n + divisor) / (divisor * 2n);
  return Number(negative ? -rounded : rounded);
}

export function sum(amounts: readonly Paisa[]): Paisa {
  let total = 0;
  for (const amount of amounts) {
    assertWhole(amount, 'amount');
    total += amount;
  }
  assertWhole(total, 'total');
  return total;
}

/**
 * Splits a total across weights so that the parts always add up to the total exactly.
 * Rs 100 across three equal weights gives 3334, 3333, 3333 paisa: the leftover paisa go
 * to the parts with the largest remainders, earliest first.
 */
export function allocate(total: Paisa, weights: readonly number[]): Paisa[] {
  assertWhole(total, 'total');
  if (weights.length === 0) {
    // Money must never vanish: an amount with nobody to give it to is an error, not an empty answer.
    if (total !== 0) throw new Error('There is nothing to split the amount across');
    return [];
  }
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0))
    throw new Error('Weights cannot be negative');
  // Scale weights to integers so the arithmetic below is exact.
  const scaled = weights.map((weight) => BigInt(Math.round(weight * 1_000_000)));
  const weightSum = scaled.reduce((a, b) => a + b, 0n);
  if (weightSum === 0n) throw new Error('At least one weight must be above zero');

  const negative = total < 0;
  const absolute = BigInt(Math.abs(total));
  const parts = scaled.map((weight) => (absolute * weight) / weightSum);
  const remainders = scaled.map((weight, index) => ({
    index,
    remainder: (absolute * weight) % weightSum,
  }));
  let leftover = absolute - parts.reduce((a, b) => a + b, 0n);
  remainders.sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  );
  for (const { index } of remainders) {
    if (leftover === 0n) break;
    parts[index] = (parts[index] ?? 0n) + 1n;
    leftover -= 1n;
  }
  return parts.map((part) => Number(negative ? -part : part));
}

/** The smaller of two amounts; used when allocating a payment against a balance. */
export const least = (a: Paisa, b: Paisa): Paisa => (a < b ? a : b);

/** Never below zero. */
export const floorAtZero = (paisa: Paisa): Paisa => (paisa < 0 ? 0 : paisa);

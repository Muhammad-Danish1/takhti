import type { StockMovementKind } from '@takhti/contracts';
import { fraction, type Paisa } from '../../kernel/money';

/*
 * The arithmetic of stock, with no database and no clock:
 * docs/plan/10-modules/m32-inventory-assets.md, rules R-inventory-2 and R-inventory-3.
 *
 * A quantity has up to three decimal places (2.5 kg, 0.125 litre). It is worked on as a whole number
 * of thousandths, so adding and comparing quantities never meets a floating-point remainder.
 */

const SCALE = 1000;

/** A quantity as thousandths. More than three decimal places is a mistake in the caller. */
export function toThousandths(quantity: number): number {
  const scaled = Math.round(quantity * SCALE);
  if (!Number.isFinite(quantity) || Math.abs(scaled - quantity * SCALE) > 1e-6)
    throw new Error(`A quantity can have at most three decimal places, got ${quantity}`);
  return scaled;
}

export const fromThousandths = (thousandths: number): number => thousandths / SCALE;

/** `quantity × unit cost`, to the paisa. The sign follows the quantity. */
export const valueOf = (thousandths: number, unitCost: Paisa): Paisa =>
  fraction(unitCost, thousandths, SCALE);

/** Which way each kind moves stock. A count adjustment goes whichever way the count found. */
const directions: Record<StockMovementKind, 'in' | 'out' | 'either'> = {
  opening: 'in',
  receipt: 'in',
  transfer_in: 'in',
  sale_return: 'in',
  issue: 'out',
  transfer_out: 'out',
  sale: 'out',
  write_off: 'out',
  return_to_vendor: 'out',
  count_adjustment: 'either',
};

/**
 * The change a movement makes to its store, in thousandths: into the store is positive.
 * The caller gives a plain amount; only a count adjustment is signed (more found is positive).
 */
export function signedChange(kind: StockMovementKind, quantity: number): number {
  const thousandths = toThousandths(quantity);
  const direction = directions[kind];
  if (thousandths === 0) throw new Error('A stock movement needs a quantity');
  if (direction === 'either') return thousandths;
  if (thousandths < 0)
    throw new Error(`The quantity of a ${kind} movement is given as a plain amount, not negative`);
  return direction === 'in' ? thousandths : -thousandths;
}

/**
 * R-inventory-3: the weighted average cost after stock comes in.
 * (quantity held × its average + quantity received × its cost) ÷ the new quantity.
 * F-inventory-5: with nothing held, the cost of what came in becomes the average.
 */
export function averageAfterReceipt(input: {
  /** Held across the whole organisation before this receipt, in thousandths. */
  heldThousandths: number;
  average: Paisa;
  receivedThousandths: number;
  cost: Paisa;
}): Paisa {
  const { heldThousandths, average, receivedThousandths, cost } = input;
  if (heldThousandths <= 0) return cost;
  const total = heldThousandths + receivedThousandths;
  const worth = valueOf(heldThousandths, average) + valueOf(receivedThousandths, cost);
  // The worth of what is held, divided by how much is held: `fraction` rounds half up to the paisa.
  return fraction(worth, SCALE, total);
}

/** A quantity as a person reads it: no trailing zeros. `2.500` is "2.5". */
export const quantityText = (thousandths: number): string => String(fromThousandths(thousandths));

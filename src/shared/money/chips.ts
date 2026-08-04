/**
 * Chips — integer play-money units (CLAUDE.md §3.1, D33). Represented as `bigint` so a float
 * cannot exist in the type at all. The `no-float-in-money` lint rule guards this directory too.
 */
export type Chips = bigint & { readonly __brand: 'Chips' };

export function chips(value: number | bigint): Chips {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new RangeError(`Chips must be a whole number, got ${value}`);
    }
    return BigInt(value) as Chips;
  }
  return value as Chips;
}

export const ZERO: Chips = chips(0);

export function add(a: Chips, b: Chips): Chips {
  return (a + b) as Chips;
}

export function sub(a: Chips, b: Chips): Chips {
  return (a - b) as Chips;
}

/** Multiply chips by an integer factor (e.g. odds numerator). Never by a float. */
export function scale(a: Chips, factor: bigint): Chips {
  return (a * factor) as Chips;
}

export function gte(a: Chips, b: Chips): boolean {
  return a >= b;
}

export function isNonNegative(a: Chips): boolean {
  return a >= 0n;
}

export function format(a: Chips): string {
  return a.toString();
}

import { chips, Chips } from '../money';

/**
 * Decimal odds as a scaled integer, 4 dp: 2.5 → 25000 (CLAUDE.md §3.1 — no float, no exchange
 * ladder; cricket is operator-priced). Winnings round in the customer's favour (up).
 */
export const PRICE_SCALE = 10000n;
export type Price = bigint & { readonly __brand: 'Price' };

/** Build a Price from its already-scaled integer form (what the feed adapter yields). */
export function price(scaled: number | bigint): Price {
  if (typeof scaled === 'number' && !Number.isInteger(scaled)) {
    throw new RangeError(`Scaled price must be an integer, got ${scaled}`);
  }
  const v = typeof scaled === 'number' ? BigInt(scaled) : scaled;
  if (v <= PRICE_SCALE) {
    throw new RangeError(`Price must be > 1.0 (scaled > ${PRICE_SCALE}), got ${v}`);
  }
  return v as Price;
}

/** Parse decimal-odds text ("2.50") to a Price with no floating point. */
export function parsePrice(decimal: string): Price {
  const m = /^(\d+)(?:\.(\d{1,4}))?$/.exec(decimal.trim());
  if (!m) throw new RangeError(`Not a valid decimal price: "${decimal}"`);
  const whole = BigInt(m[1] ?? '0');
  const frac = BigInt((m[2] ?? '').padEnd(4, '0'));
  return price(whole * PRICE_SCALE + frac);
}

export function toDecimalString(p: Price): string {
  const whole = (p as bigint) / PRICE_SCALE;
  const frac = ((p as bigint) % PRICE_SCALE).toString().padStart(4, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/**
 * Winnings (profit) on a winning back-bet: stake × (price − 1), rounded UP.
 * Integer bigint arithmetic throughout — the ceil keeps the rounding in the customer's favour.
 */
export function winnings(stake: Chips, p: Price): Chips {
  const profit = (p as bigint) - PRICE_SCALE;
  const num = (stake as bigint) * profit;
  const ceilDiv = (num + (PRICE_SCALE - 1n)) / PRICE_SCALE;
  return chips(ceilDiv);
}

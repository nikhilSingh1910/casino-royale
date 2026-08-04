import * as fc from 'fast-check';
import { chips } from '../money';
import { parsePrice, price, PRICE_SCALE, toDecimalString, winnings } from './price';

describe('odds/price (M1)', () => {
  it('parses and round-trips decimal odds without float', () => {
    expect(parsePrice('2.5') as bigint).toBe(25000n);
    expect(parsePrice('2.37') as bigint).toBe(23700n);
    expect(parsePrice('10') as bigint).toBe(100000n);
    expect(toDecimalString(price(25000))).toBe('2.5');
    expect(toDecimalString(price(23700))).toBe('2.37');
    expect(toDecimalString(price(100000))).toBe('10');
  });

  it('rejects invalid prices', () => {
    expect(() => price(10000)).toThrow(); // exactly 1.0 — no profit
    expect(() => price(5000)).toThrow(); // < 1.0
    expect(() => price(2.5)).toThrow(); // not the scaled form
    expect(() => parsePrice('1.0')).toThrow();
  });

  it('computes winnings, rounding up (customer favour)', () => {
    expect(winnings(chips(100), price(25000)) as bigint).toBe(150n); // 100 @ 2.5 → 150 profit
    expect(winnings(chips(3), price(25000)) as bigint).toBe(5n); // 3 @ 2.5 → 4.5 → 5 (rounded up)
    expect(winnings(chips(10), price(20000)) as bigint).toBe(10n); // 10 @ 2.0 → 10
  });

  it('winnings are always >= the fair floor (never rounds against the customer)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), fc.integer({ min: 10001, max: 1_000_000 }), (s, sc) => {
        const w = winnings(chips(s), price(sc)) as bigint;
        const floor = (BigInt(s) * (BigInt(sc) - PRICE_SCALE)) / PRICE_SCALE;
        expect(w).toBeGreaterThanOrEqual(floor);
        expect(w - floor).toBeLessThanOrEqual(1n); // at most one chip of rounding
      }),
    );
  });
});

import { describe, expect, it } from 'vitest';
import { estimateProfit, formatMoney, formatOdds, formatRate, parseStakeToMinor } from './format';

describe('formatMoney — minor units → fiat (§5 rule 5, float-free)', () => {
  it('formats cents as euros', () => {
    expect(formatMoney('1000')).toBe('€10.00');
    expect(formatMoney('0')).toBe('€0.00');
    expect(formatMoney('5')).toBe('€0.05');
    expect(formatMoney(123456n)).toBe('€1,234.56');
  });
  it('keeps precision beyond 2^53 (integer path, no float)', () => {
    expect(formatMoney('900719925474099100')).toBe('€9,007,199,254,740,991.00');
  });
  it('handles negatives', () => {
    expect(formatMoney('-250')).toBe('-€2.50');
  });
});

describe('formatOdds — scaled integer → decimal', () => {
  it('formats to two decimals', () => {
    expect(formatOdds('19500')).toBe('1.95');
    expect(formatOdds('21000')).toBe('2.10');
    expect(formatOdds('19000')).toBe('1.90');
    expect(formatOdds(18500n)).toBe('1.85');
  });
});

describe('formatRate — scaled price → profit-per-100 (the prototype Rate column)', () => {
  it('maps decimal odds to a rate', () => {
    expect(formatRate('19000')).toBe('90'); // 1.90 → 90
    expect(formatRate('21000')).toBe('110'); // 2.10 → 110
    expect(formatRate('19500')).toBe('95');
  });
});

describe('estimateProfit — stake × (odds − 1), rounded up to match backend winnings', () => {
  it('computes profit at a scaled price', () => {
    expect(estimateProfit(1000n, '19500')).toBe(950n); // €10 @1.95 → €9.50
    expect(estimateProfit(1000n, '21000')).toBe(1100n); // €10 @2.10 → €11.00
    expect(estimateProfit(333n, '19000')).toBe(300n); // 333×0.9 = 299.7 → 300 (ceil, customer's favour — matches winnings)
  });
});

describe('parseStakeToMinor — euros → minor units (float-free)', () => {
  it('parses whole and fractional euros', () => {
    expect(parseStakeToMinor('10')).toBe(1000n);
    expect(parseStakeToMinor('1.5')).toBe(150n);
    expect(parseStakeToMinor('0.05')).toBe(5n);
  });
  it('rejects malformed, zero, and over-precise input', () => {
    expect(parseStakeToMinor('')).toBeNull();
    expect(parseStakeToMinor('0')).toBeNull();
    expect(parseStakeToMinor('1.234')).toBeNull();
    expect(parseStakeToMinor('abc')).toBeNull();
    expect(parseStakeToMinor('-5')).toBeNull();
  });
});

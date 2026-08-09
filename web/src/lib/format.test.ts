import { describe, expect, it } from 'vitest';
import { estimateProfit, formatMoney, formatOdds, formatRate, parseStake } from './format';

describe('formatMoney — credits as a grouped whole number (§5 rule 5, float-free)', () => {
  it('groups integers, no symbol, no decimals', () => {
    expect(formatMoney('1000')).toBe('1,000');
    expect(formatMoney('0')).toBe('0');
    expect(formatMoney('5')).toBe('5');
    expect(formatMoney(123456n)).toBe('123,456');
  });
  it('keeps precision beyond 2^53 (integer path, no float)', () => {
    expect(formatMoney('900719925474099100')).toBe('900,719,925,474,099,100');
  });
  it('handles negatives', () => {
    expect(formatMoney('-250')).toBe('-250');
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
    expect(estimateProfit(1000n, '19500')).toBe(950n); // 1000 @1.95 → 950
    expect(estimateProfit(1000n, '21000')).toBe(1100n); // 1000 @2.10 → 1100
    expect(estimateProfit(333n, '19000')).toBe(300n); // 333×0.9 = 299.7 → 300 (ceil, customer's favour)
  });
});

describe('parseStake — whole credits → chips (1:1, float-free)', () => {
  it('parses whole credits', () => {
    expect(parseStake('10')).toBe(10n);
    expect(parseStake('1000')).toBe(1000n);
    expect(parseStake('5')).toBe(5n);
  });
  it('rejects malformed, zero, negative, and fractional input', () => {
    expect(parseStake('')).toBeNull();
    expect(parseStake('0')).toBeNull();
    expect(parseStake('1.5')).toBeNull(); // no fractional credits
    expect(parseStake('1.234')).toBeNull();
    expect(parseStake('abc')).toBeNull();
    expect(parseStake('-5')).toBeNull();
  });
});

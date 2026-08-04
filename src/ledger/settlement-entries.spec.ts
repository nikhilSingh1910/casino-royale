import { chips } from '../shared/money';
import { Entry, reverseEntries, settlementEntries, SettleOutcome } from './core';

const sum = (e: readonly Entry[]): bigint => e.reduce((s, x) => s + (x.amount as bigint), 0n);

describe('settlement entries (pure, D35)', () => {
  const u = 'u1';
  const stake = chips(100);
  const win = chips(95);

  it.each<SettleOutcome>(['won', 'lost', 'void'])('each outcome balances to zero (%s)', (o) => {
    expect(sum(settlementEntries(o, u, stake, win))).toBe(0n);
  });

  it('reverseEntries negates every leg and still balances', () => {
    const e = settlementEntries('won', u, stake, win);
    const r = reverseEntries(e);
    expect(sum(r)).toBe(0n);
    expect(r.map((x) => x.amount as bigint)).toEqual(e.map((x) => -(x.amount as bigint)));
  });

  it('a resettlement (reverse old ⊕ new) sums to zero, so the ledger stays balanced', () => {
    const combined = [...reverseEntries(settlementEntries('lost', u, stake, win)), ...settlementEntries('won', u, stake, win)];
    expect(sum(combined)).toBe(0n);
  });
});

import * as fc from 'fast-check';
import { chips, ZERO } from '../shared/money';
import * as L from './core';

const USERS = ['a', 'b', 'c'] as const;
const g = (m: Map<string, bigint>, u: string): bigint => m.get(u) ?? 0n;

describe('ledger core — double-entry invariants (M1)', () => {
  it('holds every invariant over any valid operation sequence', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            user: fc.constantFrom(...USERS),
            op: fc.constantFrom('topUp', 'reserve', 'payout', 'capture', 'release') as fc.Arbitrary<
              'topUp' | 'reserve' | 'payout' | 'capture' | 'release'
            >,
            amount: fc.integer({ min: 1, max: 1000 }),
            win: fc.integer({ min: 0, max: 2000 }),
          }),
          { maxLength: 250 },
        ),
        (ops) => {
          let balances: L.Balances = new Map();
          const avail = new Map<string, bigint>();
          const reserved = new Map<string, bigint>();

          for (const s of ops) {
            const u = s.user;
            const amt = BigInt(s.amount);
            let entries: L.Entry[] | null = null;

            if (s.op === 'topUp') {
              entries = L.topUp(u, chips(s.amount));
              avail.set(u, g(avail, u) + amt);
            } else if (s.op === 'reserve' && g(avail, u) >= amt) {
              entries = L.reserve(u, chips(s.amount));
              avail.set(u, g(avail, u) - amt);
              reserved.set(u, g(reserved, u) + amt);
            } else if (s.op === 'payout' && g(reserved, u) >= amt) {
              entries = L.payout(u, chips(s.amount), chips(s.win));
              reserved.set(u, g(reserved, u) - amt);
              avail.set(u, g(avail, u) + amt + BigInt(s.win));
            } else if (s.op === 'capture' && g(reserved, u) >= amt) {
              entries = L.capture(u, chips(s.amount));
              reserved.set(u, g(reserved, u) - amt);
            } else if (s.op === 'release' && g(reserved, u) >= amt) {
              entries = L.release(u, chips(s.amount));
              reserved.set(u, g(reserved, u) - amt);
              avail.set(u, g(avail, u) + amt);
            }

            if (entries) balances = L.apply(balances, entries);

            // 1. the ledger always balances to zero
            expect(L.sumAll(balances)).toBe(0n);
            for (const uu of USERS) {
              const c = balances.get(L.userChips(uu)) ?? ZERO;
              const r = balances.get(L.userReserved(uu)) ?? ZERO;
              // 2. ledger matches an independent tally
              expect(c as bigint).toBe(g(avail, uu));
              expect(r as bigint).toBe(g(reserved, uu));
              // 3. no player balance ever goes negative
              expect(c as bigint).toBeGreaterThanOrEqual(0n);
              expect(r as bigint).toBeGreaterThanOrEqual(0n);
            }
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('rejects an unbalanced transaction', () => {
    expect(() => L.apply(new Map(), [{ account: L.HOUSE, amount: chips(5) }])).toThrow(/Unbalanced/);
  });

  it('rejects reserving more chips than available (no negative balance)', () => {
    let b: L.Balances = new Map();
    b = L.apply(b, L.topUp('a', chips(100)));
    expect(() => L.apply(b, L.reserve('a', chips(150)))).toThrow(/Insufficient/);
  });
});

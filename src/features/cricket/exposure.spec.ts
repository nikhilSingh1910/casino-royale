import { chips } from '../../shared/money';
import { BetPosition, calculateCustomerExposure, calculateOperatorLiability } from './exposure';

const back = (reserved: number, payout: number): BetPosition => ({
  side: 'back',
  reserved: chips(reserved),
  potentialPayout: chips(payout),
});
const lay = (reserved: number, payout: number): BetPosition => ({
  side: 'lay',
  reserved: chips(reserved),
  potentialPayout: chips(payout),
});

describe('exposure (CM3, pure)', () => {
  const bets = [back(60, 57), back(40, 38), lay(30, 15)];

  it('customer exposure is the worse-outcome loss', () => {
    // lossIfYes = lay reserved (30); lossIfNo = back reserved (100) → 100
    expect(calculateCustomerExposure(bets) as bigint).toBe(100n);
  });

  it('operator liability is the worse-outcome payout', () => {
    // payoutIfYes = back payouts (95); payoutIfNo = lay payouts (15) → 95
    expect(calculateOperatorLiability(bets) as bigint).toBe(95n);
  });

  it('the two are distinct quantities (CLAUDE.md §5 rules 2 vs 11)', () => {
    const one = [back(100, 95)];
    expect(calculateCustomerExposure(one) as bigint).toBe(100n); // user risks the stake
    expect(calculateOperatorLiability(one) as bigint).toBe(95n); // book risks the payout
  });
});

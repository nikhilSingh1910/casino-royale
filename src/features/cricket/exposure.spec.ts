import { chips } from '../../shared/money';
import { BetPosition, calculateCustomerExposure, calculateOperatorLiability, SESSION_OUTCOME, SESSION_SCENARIOS } from './exposure';

const back = (outcome: string, reserved: number, payout: number): BetPosition => ({ outcome, side: 'back', reserved: chips(reserved), potentialPayout: chips(payout) });
const lay = (outcome: string, reserved: number, payout: number): BetPosition => ({ outcome, side: 'lay', reserved: chips(reserved), potentialPayout: chips(payout) });

describe('exposure (pure — CM3 / audit C2)', () => {
  describe('binary session (fancy) market', () => {
    const bets = [back(SESSION_OUTCOME, 60, 57), back(SESSION_OUTCOME, 40, 38), lay(SESSION_OUTCOME, 30, 15)];

    it('customer exposure nets winnings against the worst resolution', () => {
      // line missed: backs lose 100, lay wins 15 → net down 85 (line reached is a net gain → ignored)
      expect(calculateCustomerExposure(bets, SESSION_SCENARIOS) as bigint).toBe(85n);
    });
    it('operator liability is the worse-resolution payout', () => {
      // line reached → pay both backs 95; line missed → pay the lay 15 → 95
      expect(calculateOperatorLiability(bets, SESSION_SCENARIOS) as bigint).toBe(95n);
    });
    it('the two are distinct quantities (CLAUDE.md §5 rules 2 vs 11)', () => {
      const one = [back(SESSION_OUTCOME, 100, 95)];
      expect(calculateCustomerExposure(one, SESSION_SCENARIOS) as bigint).toBe(100n); // user risks the stake
      expect(calculateOperatorLiability(one, SESSION_SCENARIOS) as bigint).toBe(95n); // book risks the payout
    });
  });

  describe('multi-runner market — where the old binary formula was wrong (C2)', () => {
    const [A, B, C] = ['runner-a', 'runner-b', 'runner-c'];
    const twoBacks = [back(A, 100, 90), back(B, 100, 110)];

    it('two-runner market: exposure is the worst single outcome, not the sum of stakes', () => {
      // A wins → +90 on A, −100 on B = down 10; B wins → up 10 → worst-case loss 10
      expect(calculateCustomerExposure(twoBacks, [A, B]) as bigint).toBe(10n);
      // the book pays whichever backed runner wins → max(90, 110)
      expect(calculateOperatorLiability(twoBacks, [A, B]) as bigint).toBe(110n);
    });

    it('three-runner market: an un-backed runner winning is the worst case (both backs lose)', () => {
      expect(calculateCustomerExposure(twoBacks, [A, B, C]) as bigint).toBe(200n);
      expect(calculateOperatorLiability(twoBacks, [A, B, C]) as bigint).toBe(110n);
    });

    it('a lay loses on its runner and wins on any other', () => {
      const l = [lay(A, 90, 100)];
      expect(calculateCustomerExposure(l, [A, B]) as bigint).toBe(90n); // A wins → lay loses its 90 liability
      expect(calculateOperatorLiability(l, [A, B]) as bigint).toBe(100n); // A loses → book pays the layer 100
    });
  });
});

import { chips } from '../../shared/money';
import { BetPosition, calculateCustomerExposure, calculateOperatorLiability, Resolution, SESSION_OUTCOME, sessionResolutions } from './exposure';

const back = (outcome: string, reserved: number, payout: number): BetPosition => ({ outcome, side: 'back', reserved: chips(reserved), potentialPayout: chips(payout) });
const lay = (outcome: string, reserved: number, payout: number): BetPosition => ({ outcome, side: 'lay', reserved: chips(reserved), potentialPayout: chips(payout) });
const fback = (line: number, reserved: number, payout: number): BetPosition => ({ outcome: SESSION_OUTCOME, side: 'back', reserved: chips(reserved), potentialPayout: chips(payout), line });
const flay = (line: number, reserved: number, payout: number): BetPosition => ({ outcome: SESSION_OUTCOME, side: 'lay', reserved: chips(reserved), potentialPayout: chips(payout), line });
const runners = (...ids: string[]): Resolution[] => ids.map((runner) => ({ runner }));

describe('exposure (pure — CM3 / audit C2 / H2)', () => {
  describe('single-line session (fancy) market', () => {
    const L = 40;
    const bets = [fback(L, 60, 57), fback(L, 40, 38), flay(L, 30, 15)];
    const scen = sessionResolutions(bets); // [{runs:0}, {runs:40}]

    it('customer exposure nets winnings against the worst resolution', () => {
      // line missed (runs 0): backs lose 100, lay wins 15 → net down 85 (line reached is a net gain → ignored)
      expect(calculateCustomerExposure(bets, scen) as bigint).toBe(85n);
    });
    it('operator liability is the worse-resolution payout', () => {
      // line reached → pay both backs 95; line missed → pay the lay 15 → 95
      expect(calculateOperatorLiability(bets, scen) as bigint).toBe(95n);
    });
    it('the two are distinct quantities (CLAUDE.md §5 rules 2 vs 11)', () => {
      const one = [fback(L, 100, 95)];
      const s = sessionResolutions(one);
      expect(calculateCustomerExposure(one, s) as bigint).toBe(100n); // user risks the stake
      expect(calculateOperatorLiability(one, s) as bigint).toBe(95n); // book risks the payout
    });
  });

  describe('heterogeneous struck lines — the binary-collapse bug (H2)', () => {
    // A back struck low and a lay struck high BOTH win for any runs between the lines — the old binary set could not represent this.
    const bets = [fback(10, 100, 90), flay(100, 100, 100)];
    const scen = sessionResolutions(bets); // [{runs:0},{runs:10},{runs:100}]

    it('operator liability counts both winners in the middle interval (not max of the two sides)', () => {
      // runs∈[10,100): back@10 wins (+90) AND lay@100 wins (+100) = 190. The old binary formula gave max(90,100)=100.
      expect(calculateOperatorLiability(bets, scen) as bigint).toBe(190n);
    });
    it('a single user holding both loses only above the high line', () => {
      // runs≥100: back@10 wins (−90), lay@100 loses (+100) → net loss 10; every lower region is a net gain.
      expect(calculateCustomerExposure(bets, scen) as bigint).toBe(10n);
    });
  });

  describe('multi-runner market — where the old binary formula was wrong (C2)', () => {
    const [A, B, C] = ['runner-a', 'runner-b', 'runner-c'];
    const twoBacks = [back(A, 100, 90), back(B, 100, 110)];

    it('two-runner market: exposure is the worst single outcome, not the sum of stakes', () => {
      // A wins → +90 on A, −100 on B = down 10; B wins → up 10 → worst-case loss 10
      expect(calculateCustomerExposure(twoBacks, runners(A, B)) as bigint).toBe(10n);
      // the book pays whichever backed runner wins → max(90, 110)
      expect(calculateOperatorLiability(twoBacks, runners(A, B)) as bigint).toBe(110n);
    });

    it('three-runner market: an un-backed runner winning is the worst case (both backs lose)', () => {
      expect(calculateCustomerExposure(twoBacks, runners(A, B, C)) as bigint).toBe(200n);
      expect(calculateOperatorLiability(twoBacks, runners(A, B, C)) as bigint).toBe(110n);
    });

    it('a lay loses on its runner and wins on any other', () => {
      const l = [lay(A, 90, 100)];
      expect(calculateCustomerExposure(l, runners(A, B)) as bigint).toBe(90n); // A wins → lay loses its 90 liability
      expect(calculateOperatorLiability(l, runners(A, B)) as bigint).toBe(100n); // A loses → book pays the layer 100
    });
  });
});

import { chips, Chips } from '../../shared/money';
import { BetSide } from '../../db';

/** A bet's risk shape on a binary (yes/no) session market. */
export interface BetPosition {
  side: BetSide;
  reserved: Chips;
  potentialPayout: Chips;
}

/**
 * CLAUDE.md §5 rule 2 — a *user's* worst-case loss on a market. Single implementation; the bet slip
 * and the risk console both call this, so they cannot disagree. Binary outcome: back loses on NO,
 * lay loses on YES; each bet's max loss is exactly its reserved amount.
 */
export function calculateCustomerExposure(bets: readonly BetPosition[]): Chips {
  let lossIfYes = 0n;
  let lossIfNo = 0n;
  for (const b of bets) {
    if (b.side === 'lay') lossIfYes += b.reserved as bigint;
    else lossIfNo += b.reserved as bigint;
  }
  return chips(lossIfYes > lossIfNo ? lossIfYes : lossIfNo);
}

/**
 * CLAUDE.md §5 rule 11 — the *book's* worst-case payout on a market. Distinct from customer
 * exposure (opposite side of the same positions). Operator pays winning backers on YES, winning
 * layers on NO.
 */
export function calculateOperatorLiability(bets: readonly BetPosition[]): Chips {
  let payoutIfYes = 0n;
  let payoutIfNo = 0n;
  for (const b of bets) {
    if (b.side === 'back') payoutIfYes += b.potentialPayout as bigint;
    else payoutIfNo += b.potentialPayout as bigint;
  }
  return chips(payoutIfYes > payoutIfNo ? payoutIfYes : payoutIfNo);
}

/**
 * Session-market integrity heuristics (XC5.4, D36) — pure. These *surface* patterns for a human to
 * review; they are not verdicts and block nothing. A flag is a prompt to look, never an accusation.
 */

export interface UserStake {
  userId: string;
  stake: bigint;
}
export interface IntegrityFlag {
  code: 'user-concentration';
  userId: string;
  shareBps: number; // basis points of the market's total stake this user holds
}

const CONCENTRATION_BPS = 6000n; // one user holding >60% of a session market's stake is worth a look

/** Flag any user whose share of a market's total open stake exceeds the concentration threshold. */
export function flagConcentration(stakes: readonly UserStake[], limit: number): IntegrityFlag[] {
  const total = stakes.reduce((s, x) => s + x.stake, 0n);
  if (total === 0n) return [];
  const flags: IntegrityFlag[] = [];
  for (const s of stakes) {
    const shareBps = (s.stake * 10000n) / total;
    if (shareBps > CONCENTRATION_BPS) {
      flags.push({ code: 'user-concentration', userId: s.userId, shareBps: Number(shareBps) });
    }
  }
  return flags.slice(0, limit);
}

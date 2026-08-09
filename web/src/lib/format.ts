// The one place money and odds are formatted for display (CLAUDE.md §5 rule 5). The UI does NO money
// arithmetic beyond the integer-only conversions here — no float ever touches a money value (§3.1).

const groupInt = new Intl.NumberFormat('en-IE'); // groups a bigint integer; never sees a float

/** Format credits (integer chips from the API) as a grouped whole number: "100000" → "100,000". Play-money credits, not fiat (D52). */
export function formatMoney(credits: string | bigint): string {
  const n = typeof credits === 'bigint' ? credits : BigInt(credits);
  const neg = n < 0n;
  return `${neg ? '-' : ''}${groupInt.format(neg ? -n : n)}`;
}

/** Format a scaled-integer odds price ("19500") as decimal: "1.95". */
export function formatOdds(scaled: string | bigint): string {
  const n = typeof scaled === 'bigint' ? scaled : BigInt(scaled);
  const whole = n / 10000n;
  const hundredths = (n % 10000n) / 100n;
  return `${whole}.${hundredths.toString().padStart(2, '0')}`;
}

/** Fancy "rate" (profit per 100 staked) from a scaled price: (price − 10000) / 100. Matches the prototype's Rate column. */
export function formatRate(scaled: string | bigint): string {
  const n = typeof scaled === 'bigint' ? scaled : BigInt(scaled);
  return ((n - 10000n) / 100n).toString();
}

/** Profit (back) / liability (lay) on a stake at a scaled price: stake × (odds − 1), rounded UP to match the
 *  backend's `winnings` (customer's favour, §3.1) — so the slip equals the placed bet's payout/reservation. */
export function estimateProfit(stake: bigint, priceScaled: string | bigint): bigint {
  const price = typeof priceScaled === 'bigint' ? priceScaled : BigInt(priceScaled);
  return (stake * (price - 10000n) + 9999n) / 10000n;
}

/** Parse a whole-credit stake ("1000") to chips (1 credit = 1 chip). No fractional credits; null if malformed or ≤ 0. */
export function parseStake(input: string): bigint | null {
  const t = input.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = BigInt(t);
  return n > 0n ? n : null;
}

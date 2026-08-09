// The one place money and odds are formatted for display (CLAUDE.md §5 rule 5). The UI does NO money
// arithmetic beyond the integer-only conversions here — no float ever touches a money value (§3.1).

const MINOR_PER_UNIT = 100n; // chips are integer minor units (cents)
const groupInt = new Intl.NumberFormat('en-IE'); // groups a bigint integer; never sees a float

/** Format integer minor units (string/bigint from the API) as fiat: "1000" → "€10.00". Play chips shown as fiat (PRD §4). */
export function formatMoney(minorUnits: string | bigint): string {
  const n = typeof minorUnits === 'bigint' ? minorUnits : BigInt(minorUnits);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = groupInt.format(abs / MINOR_PER_UNIT);
  const cents = (abs % MINOR_PER_UNIT).toString().padStart(2, '0');
  return `${neg ? '-' : ''}€${whole}.${cents}`;
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
export function estimateProfit(stakeMinor: bigint, priceScaled: string | bigint): bigint {
  const price = typeof priceScaled === 'bigint' ? priceScaled : BigInt(priceScaled);
  return (stakeMinor * (price - 10000n) + 9999n) / 10000n;
}

/** Parse a euro input ("1.50", "10") to integer minor units. Float-free; null if malformed. */
export function parseStakeToMinor(input: string): bigint | null {
  const t = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [wholePart, fracPart = ''] = t.split('.');
  const cents = (fracPart + '00').slice(0, 2);
  const minor = BigInt(wholePart ?? '0') * MINOR_PER_UNIT + BigInt(cents);
  return minor > 0n ? minor : null;
}

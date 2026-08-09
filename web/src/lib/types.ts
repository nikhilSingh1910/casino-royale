export type MarketType = 'match_odds' | 'bookmaker' | 'fancy' | 'ball_by_ball';
export type MarketStatus = 'open' | 'suspended' | 'settled';
export type Side = 'back' | 'lay';

export interface RunnerPriceDto {
  back: string;
  lay: string;
}
export interface MatchListDto {
  id: string;
  name: string;
  competition: string;
  status: string;
  startsAt: string;
  odds: { home: RunnerPriceDto | null; draw: RunnerPriceDto | null; away: RunnerPriceDto | null };
}
export interface RunnerDto {
  id: string;
  name: string;
  back: string;
  lay: string;
}
export interface FancyDto {
  line: number;
  overs: number;
  back: string;
  lay: string;
}
export interface MarketDto {
  id: string;
  type: MarketType;
  name: string;
  status: MarketStatus;
  runners: RunnerDto[];
  fancy: FancyDto | null;
}
export interface MatchViewDto {
  id: string;
  name: string;
  competition: string;
  status: string;
  markets: MarketDto[];
}
export interface BalanceDto {
  available: string;
  reserved: string;
}
export interface OverBallDto {
  runs: number;
  wicket: boolean;
}
export interface InningsDto {
  innings: number;
  team: string | null;
  runs: number;
  wickets: number;
  overs: string;
}
export interface RecentBallDto {
  symbol: string;
  kind: string;
}
export interface ScoreDto {
  matchId: string;
  status: string;
  innings: InningsDto[];
  currentOver: OverBallDto[];
  recent: RecentBallDto[];
  summary: string | null;
}
export interface PlacedBetDto {
  id: string;
  side: string;
  stake: string;
  reserved: string;
  potentialPayout: string;
  status: string;
}
export interface MeDto {
  id: string;
  email: string;
  status: string;
  role: string;
}
export interface BonusClaimDto {
  claimed: boolean;
  available: string;
  reserved: string;
  nextClaimAt: string;
}
export interface LeaderboardRowDto {
  rank: number;
  handle: string;
  pnl: string;
  you: boolean;
}
export interface PendingActionDto {
  id: string;
  kind: string;
  marketId: string;
  proposedBy: string;
  createdAt: string;
}
export interface AuditRowDto {
  actor: string;
  action: string;
  subject: string | null;
  at: string;
}
export interface StatementRowDto {
  account: string;
  amount: string;
  kind: string;
  at: string;
}
export interface BetHistoryDto {
  id: string;
  placedAt: string;
  match: string;
  market: string;
  marketType: string;
  selection: string;
  side: string;
  stake: string;
  price: string;
  status: string;
  pnl: string | null;
}

/** A pending bet-slip selection captured from what the user saw (seenPrice/seenLine drive the two-phase check). */
export interface Selection {
  kind: 'runner' | 'fancy';
  marketId: string;
  side: Side;
  price: string; // scaled seenPrice
  label: string;
  runnerId?: string;
  lineValue?: number;
}

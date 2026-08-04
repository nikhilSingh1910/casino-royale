export type MarketType = 'match_odds' | 'bookmaker' | 'fancy';
export type MarketStatus = 'open' | 'suspended' | 'settled';
export type Side = 'back' | 'lay';

export interface MatchSummary {
  id: string;
  name: string;
  competition: string;
  status: string;
  startsAt: string;
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
export interface PlacedBetDto {
  id: string;
  side: string;
  stake: string;
  reserved: string;
  potentialPayout: string;
  status: string;
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

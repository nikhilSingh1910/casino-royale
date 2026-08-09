import type { AuditRowDto, BalanceDto, BetHistoryDto, BonusClaimDto, LeaderboardRowDto, MatchListDto, MatchViewDto, MeDto, PendingActionDto, PlacedBetDto, ScoreDto, Side, StatementRowDto } from './types';

const BASE = '/api'; // dev-proxied to the Nest backend (vite.config)

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const e = (body ?? {}) as { error?: string; message?: string };
    throw new ApiError(res.status, e.error ?? 'error', e.message ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export interface PlaceFancy {
  marketId: string;
  side: Side;
  stake: string;
  seenLineValue: number;
  seenPrice: string;
  idempotencyKey: string;
}
export interface PlaceRunner {
  marketId: string;
  runnerId: string;
  side: Side;
  stake: string;
  seenPrice: string;
  idempotencyKey: string;
}

export const api = {
  signup: (email: string, password: string) => req<{ userId: string }>('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) => req<{ token: string; userId: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  demo: () => req<{ token: string; userId: string }>('/auth/demo', { method: 'POST' }),
  matches: () => req<MatchListDto[]>('/matches'),
  match: (id: string) => req<MatchViewDto>(`/matches/${id}`),
  score: (id: string) => req<ScoreDto>(`/matches/${id}/score`),
  balance: (token: string) => req<BalanceDto>('/me/balance', {}, token),
  me: (token: string) => req<MeDto>('/me', {}, token),
  statement: (token: string) => req<StatementRowDto[]>('/me/statement', {}, token),
  myBets: (token: string) => req<BetHistoryDto[]>('/me/bets', {}, token),
  claimBonus: (token: string) => req<BonusClaimDto>('/me/bonus/claim', { method: 'POST' }, token),
  leaderboard: (token: string) => req<LeaderboardRowDto[]>('/leaderboard', {}, token),
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    req<void>('/me/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }, token),
  placeBet: (token: string, dto: PlaceFancy) => req<PlacedBetDto>('/bets', { method: 'POST', body: JSON.stringify(dto) }, token),
  placeRunnerBet: (token: string, dto: PlaceRunner) => req<PlacedBetDto>('/runner-bets', { method: 'POST', body: JSON.stringify(dto) }, token),

  // operator console (role-gated to trader/admin — the backend enforces via RolesGuard)
  pendingActions: (token: string) => req<PendingActionDto[]>('/trading/actions', {}, token),
  auditLog: (token: string) => req<AuditRowDto[]>('/trading/audit', {}, token),
  exposureMatch: (token: string, matchId: string) => req<{ liability: string }>(`/trading/exposure/match/${matchId}`, {}, token),
  suspendMarket: (token: string, marketId: string) => req<void>(`/trading/markets/${marketId}/suspend`, { method: 'POST' }, token),
  reopenMarket: (token: string, marketId: string) => req<void>(`/trading/markets/${marketId}/reopen`, { method: 'POST' }, token),
  proposeAction: (token: string, body: { kind: 'void' | 'resettle'; marketId: string; reason: string; correctionId?: string }) =>
    req<{ id: string }>('/trading/actions', { method: 'POST', body: JSON.stringify(body) }, token),
  declareResult: (token: string, matchId: string, body: { winner: string; reason: string }) =>
    req<{ id: string }>(`/trading/matches/${matchId}/declare-result`, { method: 'POST', body: JSON.stringify(body) }, token),
  approveAction: (token: string, id: string) => req<{ kind: string }>(`/trading/actions/${id}/approve`, { method: 'POST' }, token),
  rejectAction: (token: string, id: string, reason: string) => req<void>(`/trading/actions/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }, token),
};

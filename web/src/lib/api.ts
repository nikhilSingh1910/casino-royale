import type { BalanceDto, MatchSummary, MatchViewDto, PlacedBetDto, ScoreDto, Side } from './types';

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
  matches: () => req<MatchSummary[]>('/matches'),
  match: (id: string) => req<MatchViewDto>(`/matches/${id}`),
  score: (id: string) => req<ScoreDto>(`/matches/${id}/score`),
  balance: (token: string) => req<BalanceDto>('/me/balance', {}, token),
  placeBet: (token: string, dto: PlaceFancy) => req<PlacedBetDto>('/bets', { method: 'POST', body: JSON.stringify(dto) }, token),
  placeRunnerBet: (token: string, dto: PlaceRunner) => req<PlacedBetDto>('/runner-bets', { method: 'POST', body: JSON.stringify(dto) }, token),
};

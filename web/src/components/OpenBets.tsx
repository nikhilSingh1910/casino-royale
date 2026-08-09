import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, ApiError, type PlaceFancy, type PlaceRunner } from '../lib/api';
import { useAuth } from '../lib/auth';
import { estimateProfit, formatMoney, formatOdds, parseStake } from '../lib/format';
import { useSelection } from '../lib/selection';
import type { PlacedBetDto, Selection } from '../lib/types';

const QUICK = ['500', '1000', '2500', '10000'];
const tagLabel = (s: Selection) => (s.kind === 'fancy' ? (s.side === 'back' ? 'Yes' : 'No') : s.side === 'back' ? 'Back' : 'Lay');

export function OpenBets() {
  const { selection, select } = useSelection();
  const { token } = useAuth();
  const qc = useQueryClient();
  const [stake, setStake] = useState('');
  const [ok, setOk] = useState<string | null>(null);
  const stakeCredits = parseStake(stake);
  const back = selection?.side === 'back';
  // One idempotency key per bet intent: stable across retries of the same selection+stake (so a retry
  // dedupes, never double-places, C4), fresh when either changes or a bet lands (onSuccess clears stake).
  const betKey = useMemo(() => crypto.randomUUID(), [selection, stake]);

  const place = useMutation<PlacedBetDto, Error, bigint>({
    mutationFn: (amount) => {
      if (!token || !selection) throw new ApiError(401, 'auth', 'Sign in to place a bet');
      const common = { stake: amount.toString(), seenPrice: selection.price, idempotencyKey: betKey };
      if (selection.kind === 'runner') {
        const dto: PlaceRunner = { marketId: selection.marketId, runnerId: selection.runnerId as string, side: selection.side, ...common };
        return api.placeRunnerBet(token, dto);
      }
      const dto: PlaceFancy = { marketId: selection.marketId, side: selection.side, seenLineValue: selection.lineValue as number, ...common };
      return api.placeBet(token, dto);
    },
    onSuccess: () => {
      setOk('Bet placed');
      setStake('');
      void qc.invalidateQueries({ queryKey: ['balance'] });
      void qc.invalidateQueries({ queryKey: ['match'] });
    },
  });
  const error = place.error instanceof ApiError ? place.error.message : place.error ? 'Could not place bet' : null;

  return (
    <div className="panel">
      <div className="panel__bar">
        Open Bets
        {selection && (
          <button className="btn-link" style={{ marginLeft: 'auto', color: '#fff' }} onClick={() => { select(null); setOk(null); place.reset(); }}>
            clear
          </button>
        )}
      </div>
      {!selection ? (
        <div className="state" style={{ padding: '26px 12px' }}>
          <div className="state__icon">🎟️</div>
          <div>No selection yet. Tap a price to add a bet.</div>
        </div>
      ) : (
        <div className="slip__body">
          <div className="slip__top">
            <span className={`tag tag--${back ? 'back' : 'lay'}`}>{tagLabel(selection)}</span>
            <span className="slip__sel">{selection.label}</span>
            <span className="slip__odds">{formatOdds(selection.price)}</span>
          </div>
          {!token ? (
            <div className="est">Log in from the header to place this bet.</div>
          ) : (
            <>
              <input
                className="input"
                inputMode="numeric"
                placeholder="Stake (credits)"
                value={stake}
                onChange={(e) => { setStake(e.target.value); setOk(null); place.reset(); }}
                aria-label="Stake in credits"
              />
              <div className="chips">
                {QUICK.map((q) => (
                  <button key={q} className="chip" onClick={() => { setStake(q); setOk(null); place.reset(); }}>
                    {formatMoney(q)}
                  </button>
                ))}
              </div>
              {stakeCredits && (
                <div className="est">
                  {back ? 'Est. profit' : 'Liability'} <b>{formatMoney(estimateProfit(stakeCredits, selection.price))}</b> credits
                </div>
              )}
              <button className="btn btn--green" style={{ marginTop: 10 }} disabled={!stakeCredits || place.isPending} onClick={() => stakeCredits && place.mutate(stakeCredits)}>
                {place.isPending ? '…' : 'Place bet'}
              </button>
              {ok && <div className="msg msg--ok">✓ {ok}</div>}
              {error && <div className="msg msg--err">{error}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, type PlaceFancy, type PlaceRunner } from '../lib/api';
import { useAuth } from '../lib/auth';
import { estimateProfit, formatMoney, formatOdds, parseStakeToMinor } from '../lib/format';
import type { PlacedBetDto, Selection } from '../lib/types';

const QUICK = ['5', '10', '25', '100'];

export function BetSlip({ selection, matchId, onClose }: { selection: Selection; matchId: string; onClose: () => void }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [stake, setStake] = useState('');
  const [ok, setOk] = useState<string | null>(null);

  const stakeMinor = parseStakeToMinor(stake);
  const back = selection.side === 'back';
  const tag = selection.kind === 'fancy' ? (back ? 'Yes' : 'No') : back ? 'LG' : 'KH';

  const place = useMutation<PlacedBetDto, Error, bigint>({
    mutationFn: (minor) => {
      if (!token) throw new ApiError(401, 'auth', 'Sign in to place a bet');
      const common = { stake: minor.toString(), seenPrice: selection.price, idempotencyKey: crypto.randomUUID() };
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
      void qc.invalidateQueries({ queryKey: ['match', matchId] });
    },
  });

  const error = place.error instanceof ApiError ? place.error.message : place.error ? 'Could not place bet' : null;

  return (
    <div className="slip" role="dialog" aria-label="Bet slip">
      <div className="slip__top">
        <span className={`tag tag--${back ? 'back' : 'lay'}`}>{tag}</span>
        <span className="slip__sel">{selection.label}</span>
        <span className="slip__odds">{formatOdds(selection.price)}</span>
        <button className="iconbtn" title="Close" onClick={onClose} style={{ marginLeft: 8 }}>
          ✕
        </button>
      </div>

      {!token ? (
        <button className="btn btn--primary btn--full" onClick={() => navigate('/login')}>
          Sign in to bet
        </button>
      ) : (
        <>
          <div className="slip__row">
            <input
              className="input"
              inputMode="decimal"
              placeholder="Stake (€)"
              value={stake}
              onChange={(e) => {
                setStake(e.target.value);
                setOk(null);
                place.reset();
              }}
              aria-label="Stake in euros"
            />
            <button className="btn btn--primary" disabled={!stakeMinor || place.isPending} onClick={() => stakeMinor && place.mutate(stakeMinor)}>
              {place.isPending ? '…' : 'Place'}
            </button>
          </div>
          <div className="chips">
            {QUICK.map((q) => (
              <button
                key={q}
                className="chip"
                onClick={() => {
                  setStake(q);
                  setOk(null);
                  place.reset();
                }}
              >
                €{q}
              </button>
            ))}
          </div>
          {stakeMinor && (
            <div className="est">
              {back ? 'Est. profit' : 'Liability'} <b>{formatMoney(estimateProfit(stakeMinor, selection.price))}</b> · indicative
            </div>
          )}
          {ok && <div className="slip__msg slip__msg--ok">✓ {ok}</div>}
          {error && <div className="slip__msg slip__msg--err">{error}</div>}
        </>
      )}
    </div>
  );
}

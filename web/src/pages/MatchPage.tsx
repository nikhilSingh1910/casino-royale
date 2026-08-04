import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { BetSlip } from '../components/BetSlip';
import { MarketCard } from '../components/MarketCard';
import { EmptyState, ErrorState, LoadingCards } from '../components/States';
import type { Selection } from '../lib/types';

export function MatchPage() {
  const { id = '' } = useParams();
  const [selection, setSelection] = useState<Selection | null>(null);
  const q = useQuery({ queryKey: ['match', id], queryFn: () => api.match(id), enabled: !!id });

  if (q.isLoading) return <LoadingCards rows={4} />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.status === 404) {
      return <EmptyState icon="🔍" title="Match not found" hint="It may have finished or been removed." />;
    }
    return <ErrorState message="Couldn’t load this match." onRetry={() => void q.refetch()} />;
  }

  const match = q.data;
  if (!match) return null;

  return (
    <>
      <div className="card">
        <div className="match" style={{ padding: '12px 14px' }}>
          <div className="match__body">
            <div className="match__name">{match.name}</div>
            <div className="match__meta">
              {match.competition} · {match.status}
            </div>
          </div>
          {match.status === 'inplay' && <span className="badge badge--live">Live</span>}
        </div>
      </div>

      {match.markets.length === 0 ? (
        <EmptyState title="No markets open" hint="Odds appear once trading opens." />
      ) : (
        match.markets.map((mk) => <MarketCard key={mk.id} market={mk} selection={selection} onSelect={setSelection} />)
      )}

      {selection && <BetSlip selection={selection} matchId={id} onClose={() => setSelection(null)} />}
    </>
  );
}

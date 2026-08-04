import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { BetSlip } from '../components/BetSlip';
import { FancyCard } from '../components/FancyCard';
import { MarketCard } from '../components/MarketCard';
import { ScoreStrip } from '../components/ScoreStrip';
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

  const runnerMarkets = match.markets.filter((m) => m.type === 'match_odds' || m.type === 'bookmaker');
  const fancyMarkets = match.markets.filter((m) => m.type === 'fancy');

  return (
    <>
      <div className="mkt">
        <div className="mkt__bar">
          {match.name}
          <span style={{ marginLeft: 'auto', fontWeight: 600, opacity: 0.85, fontSize: 12.5 }}>{match.competition}</span>
        </div>
      </div>

      <ScoreStrip matchId={id} />

      {match.markets.length === 0 ? (
        <EmptyState title="No markets open" hint="Odds appear once trading opens." />
      ) : (
        <>
          {runnerMarkets.map((m) => (
            <MarketCard key={m.id} market={m} selection={selection} onSelect={setSelection} />
          ))}
          <FancyCard markets={fancyMarkets} selection={selection} onSelect={setSelection} />
        </>
      )}

      {selection && <BetSlip selection={selection} matchId={id} onClose={() => setSelection(null)} />}
    </>
  );
}

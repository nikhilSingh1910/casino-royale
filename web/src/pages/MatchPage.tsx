import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { FancyTable } from '../components/FancyTable';
import { MarketOdds } from '../components/MarketOdds';
import { ScoreStrip } from '../components/ScoreStrip';
import { EmptyState, ErrorState, Loading } from '../components/States';

export function MatchPage() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['match', id], queryFn: () => api.match(id), enabled: !!id });

  if (q.isLoading) return <div className="panel"><Loading /></div>;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.status === 404) {
      return <div className="panel"><EmptyState icon="🔍" title="Match not found" hint="It may have finished or been removed." /></div>;
    }
    return <div className="panel"><ErrorState message="Couldn’t load this match." onRetry={() => void q.refetch()} /></div>;
  }

  const match = q.data;
  if (!match) return null;
  const runnerMarkets = match.markets.filter((m) => m.type === 'match_odds' || m.type === 'bookmaker');
  const fancyMarkets = match.markets.filter((m) => m.type === 'fancy');

  return (
    <div>
      <div className="panel" style={{ marginBottom: 10 }}>
        <div className="panel__bar">
          {match.name}
          <span style={{ marginLeft: 'auto', fontWeight: 600, opacity: 0.85 }}>{match.competition}</span>
        </div>
      </div>
      <ScoreStrip matchId={id} />
      {match.markets.some((m) => m.type === 'ball_by_ball') && (
        <Link to={`/bbb/${id}`} style={{ display: 'inline-block', background: 'var(--green)', color: '#fff', fontWeight: 800, padding: '9px 16px', borderRadius: 4, margin: '0 3px 10px' }}>
          🏏 Ball By Ball
        </Link>
      )}
      {match.markets.length === 0 ? (
        <div className="panel"><EmptyState title="No markets open" hint="Odds appear once trading opens." /></div>
      ) : (
        <>
          {runnerMarkets.map((m) => (
            <div style={{ marginBottom: 10 }} key={m.id}>
              <MarketOdds market={m} />
            </div>
          ))}
          <FancyTable markets={fancyMarkets} />
        </>
      )}
    </div>
  );
}

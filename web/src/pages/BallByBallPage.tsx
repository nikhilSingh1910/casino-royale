import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { CricketBall } from '../components/CricketArt';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { formatOdds } from '../lib/format';
import { useSelection } from '../lib/selection';

const colorFor = (name: string) => (name === '4 Runs' ? 'green' : name === '6 Runs' ? 'purple' : name === 'Wicket' ? 'red' : 'gold');

export function BallByBallPage() {
  const { id = '' } = useParams();
  const { selection, select } = useSelection();
  const mq = useQuery({ queryKey: ['match', id], queryFn: () => api.match(id), enabled: !!id, refetchInterval: 20000 }); // SSE-driven; poll = fallback (PC4)
  const sq = useQuery({ queryKey: ['score', id], queryFn: () => api.score(id), enabled: !!id, refetchInterval: 15000 });

  if (mq.isLoading) return <div className="panel"><Loading /></div>;
  if (mq.isError) {
    if (mq.error instanceof ApiError && mq.error.status === 404) return <div className="panel"><EmptyState icon="🔍" title="Match not found" /></div>;
    return <div className="panel"><ErrorState message="Couldn’t load this match." onRetry={() => void mq.refetch()} /></div>;
  }
  const match = mq.data;
  if (!match) return null;
  const bbb = match.markets.find((m) => m.type === 'ball_by_ball');
  const recent = sq.data?.recent ?? [];

  return (
    <div>
      <div className="bbb-promo">
        <div>
          <h2>
            Every Ball, <span className="g">Every Outcome</span>
          </h2>
          <p>Back the next delivery — runs, wickets &amp; extras.</p>
        </div>
        <CricketBall className="bbb-promo__art" />
      </div>
      <div className="bbb-bar">
        <span>Runs ⓘ</span>
        <span>Min €1 · Max €1,000</span>
      </div>
      {!bbb ? (
        <div className="panel"><EmptyState title="No ball-by-ball market" hint="It opens once the match is live." /></div>
      ) : (
        <>
          <div className="bbb-grid">
            <div className="bbb-colhead">Back</div>
            <div className="bbb-colhead">Back</div>
            {bbb.runners.map((r) => {
              const sel = selection?.marketId === bbb.id && selection.runnerId === r.id;
              return (
                <button
                  key={r.id}
                  className={`bbb-cell bbb--${colorFor(r.name)}${sel ? ' sel' : ''}`}
                  disabled={bbb.status !== 'open'}
                  onClick={() => select({ kind: 'runner', marketId: bbb.id, side: 'back', price: r.back, runnerId: r.id, label: `Ball By Ball · ${r.name}` })}
                >
                  <div className="bbb-odds">
                    <b>{formatOdds(r.back)}</b>
                    <span>100000</span>
                  </div>
                  <div className="bbb-label">{r.name.toUpperCase()}</div>
                </button>
              );
            })}
          </div>
          <div className="bbb-note">Results are based on stream only. Score board may differ.</div>
        </>
      )}
      <div className="recent">
        <span className="recent__title">Recent Result</span>
        {recent.length === 0 ? <span style={{ opacity: 0.7 }}>—</span> : recent.map((b, i) => <span className={`rball rball--${b.kind}`} key={i}>{b.symbol}</span>)}
      </div>
    </div>
  );
}

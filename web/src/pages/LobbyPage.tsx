import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { EmptyState, ErrorState, LoadingCards } from '../components/States';

export function LobbyPage() {
  const q = useQuery({ queryKey: ['matches'], queryFn: api.matches });

  if (q.isLoading) return <LoadingCards />;
  if (q.isError) return <ErrorState message="Couldn’t load matches." onRetry={() => void q.refetch()} />;

  const matches = q.data ?? [];
  if (matches.length === 0) {
    return <EmptyState icon="🏏" title="No matches yet" hint="Markets appear here once a match is live." />;
  }

  return (
    <div>
      {matches.map((m) => (
        <Link className="card" style={{ display: 'block' }} to={`/m/${m.id}`} key={m.id}>
          <div className="match">
            <div className="match__body">
              <div className="match__name">{m.name}</div>
              <div className="match__meta">
                {m.competition} · {m.status}
              </div>
            </div>
            <span className="chev">›</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

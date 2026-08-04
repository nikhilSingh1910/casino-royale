import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { EmptyState, ErrorState, LoadingCards } from '../components/States';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

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
        <Link to={`/m/${m.id}`} key={m.id} style={{ display: 'block' }}>
          <div className="match">
            <div className="match__icon">🏏</div>
            <div className="match__body">
              <div className="match__name">{m.name}</div>
              <div className="match__meta">
                {m.competition} · {m.status}
              </div>
            </div>
            <div className="match__date">{fmtDate(m.startsAt)}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

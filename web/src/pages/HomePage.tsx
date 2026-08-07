import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { HighlightsTable } from '../components/HighlightsTable';
import { EmptyState, ErrorState, Loading } from '../components/States';

export function HomePage() {
  const q = useQuery({ queryKey: ['matches'], queryFn: api.matches });

  if (q.isLoading) return <div className="panel"><Loading /></div>;
  if (q.isError) return <div className="panel"><ErrorState message="Couldn’t load matches." onRetry={() => void q.refetch()} /></div>;

  const matches = q.data ?? [];
  if (matches.length === 0) {
    return (
      <div className="panel">
        <EmptyState title="No matches yet" hint="Cricket markets appear here once a match is live." />
      </div>
    );
  }
  return <HighlightsTable matches={matches} />;
}

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { HighlightsTable } from '../components/HighlightsTable';
import { PromoCarousel } from '../components/PromoCarousel';
import { EmptyState, ErrorState, Loading } from '../components/States';

export function HomePage() {
  const q = useQuery({ queryKey: ['matches'], queryFn: api.matches, refetchInterval: 20000 }); // SSE drives updates; poll is the fallback (PC4)

  const body = q.isLoading ? (
    <div className="panel"><Loading /></div>
  ) : q.isError ? (
    <div className="panel"><ErrorState message="Couldn’t load matches." onRetry={() => void q.refetch()} /></div>
  ) : (q.data ?? []).length === 0 ? (
    <div className="panel"><EmptyState title="No matches yet" hint="Cricket markets appear here once a match is live." /></div>
  ) : (
    <HighlightsTable matches={q.data ?? []} />
  );

  return (
    <>
      <PromoCarousel />
      {body}
    </>
  );
}

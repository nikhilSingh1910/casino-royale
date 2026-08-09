import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatMoney } from '../lib/format';

export function LeaderboardPage() {
  const { token } = useAuth();
  const q = useQuery({ queryKey: ['leaderboard'], queryFn: () => api.leaderboard(token as string), enabled: !!token, refetchInterval: 15000 });

  if (!token) return <Navigate to="/login" replace />;
  if (q.isLoading) return <div className="panel"><Loading /></div>;
  if (q.isError) return <div className="panel"><ErrorState message="Couldn’t load the leaderboard." onRetry={() => void q.refetch()} /></div>;
  const rows = q.data ?? [];

  return (
    <div className="panel">
      <div className="panel__bar">🏆 Leaderboard · Top Bettors</div>
      {rows.length === 0 ? (
        <EmptyState icon="🏆" title="No settled bets yet" hint="Place and settle bets to climb the board." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="acct-table">
            <thead><tr><th>Rank</th><th>Player</th><th>Net P&amp;L</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const pnl = BigInt(r.pnl);
                return (
                  <tr key={r.rank} className={r.you ? 'lb-you' : ''}>
                    <td><span className={`lb-rank lb-rank--${r.rank <= 3 ? r.rank : 'n'}`}>{r.rank}</span></td>
                    <td>{r.handle}{r.you && <span className="lb-badge">You</span>}</td>
                    <td className={`num ${pnl > 0n ? 'pnl-pos' : pnl < 0n ? 'pnl-neg' : ''}`}>{(pnl > 0n ? '+' : '') + formatMoney(r.pnl)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

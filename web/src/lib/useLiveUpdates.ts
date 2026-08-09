import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Subscribe to the server's live stream and refetch the affected views the instant a match changes (PC4).
 * SSE drives immediacy; the queries' slow refetchInterval is the fallback if the stream drops. One
 * connection for the whole app; the browser's EventSource auto-reconnects.
 */
export function useLiveUpdates(): void {
  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource('/api/matches/stream');
    es.onmessage = (ev) => {
      let matchId: string | undefined;
      try {
        matchId = (JSON.parse(ev.data) as { matchId?: string }).matchId;
      } catch {
        return; // ignore a malformed event
      }
      void qc.invalidateQueries({ queryKey: ['matches'] });
      // A tick can carry a settlement, which moves the wallet, bets, statement and board — refresh them too
      // (inactive queries are a no-op, so this only refetches views that are actually open). N3.
      for (const key of [['balance'], ['myBets'], ['statement'], ['leaderboard']]) void qc.invalidateQueries({ queryKey: key });
      if (matchId) {
        void qc.invalidateQueries({ queryKey: ['match', matchId] });
        void qc.invalidateQueries({ queryKey: ['score', matchId] });
      }
    };
    return () => es.close();
  }, [qc]);
}

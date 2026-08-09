import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { MatchTable } from '../components/MatchTable';
import { EmptyState, ErrorState, Loading } from '../components/States';
import type { MatchListDto } from '../lib/types';

type Tab = 'inplay' | 'today' | 'tomorrow';
const TABS: [Tab, string][] = [['inplay', 'In-Play'], ['today', 'Today'], ['tomorrow', 'Tomorrow']];

function inWindow(iso: string, offsetDays: number): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return d >= start && d < end;
}
const filterFor = (tab: Tab, m: MatchListDto) =>
  tab === 'inplay' ? m.status === 'inplay' : tab === 'today' ? inWindow(m.startsAt, 0) : inWindow(m.startsAt, 1);
const emptyTitle = (tab: Tab) => (tab === 'inplay' ? 'No cricket in-play right now' : tab === 'today' ? 'No cricket matches today' : 'No cricket matches tomorrow');

export function InPlayPage() {
  const [tab, setTab] = useState<Tab>('inplay');
  const q = useQuery({ queryKey: ['matches'], queryFn: api.matches, refetchInterval: 20_000 }); // SSE-driven; poll is the fallback (PC4)
  const matches = (q.data ?? []).filter((m) => filterFor(tab, m));

  return (
    <div>
      <div className="subtabs">
        {TABS.map(([k, label]) => (
          <div key={k} className={`subtab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
            {label}
          </div>
        ))}
      </div>
      {q.isLoading ? (
        <div className="panel"><Loading /></div>
      ) : q.isError ? (
        <div className="panel"><ErrorState message="Couldn’t load matches." onRetry={() => void q.refetch()} /></div>
      ) : (
        <div className="panel">
          <div className="sect">Cricket</div>
          {matches.length === 0 ? <EmptyState title={emptyTitle(tab)} hint="Only cricket is live for now." /> : <MatchTable matches={matches} />}
        </div>
      )}
    </div>
  );
}

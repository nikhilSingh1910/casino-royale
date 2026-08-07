import { useNavigate } from 'react-router-dom';
import { formatOdds } from '../lib/format';
import type { MatchListDto, RunnerPriceDto } from '../lib/types';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

function Pair({ p, onOpen }: { p: RunnerPriceDto | null; onOpen: () => void }) {
  if (!p) {
    return (
      <div className="pair">
        <span className="odds odds--back odds__empty">-</span>
        <span className="odds odds--lay odds__empty">-</span>
      </div>
    );
  }
  return (
    <div className="pair">
      <button className="odds odds--back" onClick={onOpen}>{formatOdds(p.back)}</button>
      <button className="odds odds--lay" onClick={onOpen}>{formatOdds(p.lay)}</button>
    </div>
  );
}

/** The 1/X/2 match rows shared by the Home highlights and the In-Play page. */
export function MatchTable({ matches, label = '' }: { matches: MatchListDto[]; label?: string }) {
  const navigate = useNavigate();
  const open = (id: string) => navigate(`/m/${id}`);

  return (
    <>
      <div className="hl__colhead">
        <span>{label}</span>
        <span>1</span>
        <span>X</span>
        <span>2</span>
        <span />
      </div>
      {matches.map((m) => (
        <div className="hl__row" key={m.id}>
          <div className="hl__match">
            <div className="hl__name" onClick={() => open(m.id)}>
              {m.name} {m.status === 'inplay' && <span className="inplay">In-Play</span>}
            </div>
            <div className="hl__meta">
              {m.status !== 'inplay' && <span>{fmtDate(m.startsAt)}</span>}
              <span>{m.competition}</span>
              <span className="badges">
                <span className="bdg bdg--bm">BM</span>
                <span className="bdg bdg--f">F</span>
                <span className="bdg bdg--s">S</span>
              </span>
            </div>
          </div>
          <Pair p={m.odds.home} onOpen={() => open(m.id)} />
          <Pair p={m.odds.draw} onOpen={() => open(m.id)} />
          <Pair p={m.odds.away} onOpen={() => open(m.id)} />
          <div className="hl__bell" style={{ textAlign: 'center', color: 'var(--muted)' }} aria-hidden>
            🔔
          </div>
        </div>
      ))}
    </>
  );
}

import { formatOdds } from '../lib/format';
import type { MarketDto, Selection, Side } from '../lib/types';

/** A runner market (Match Odds / Bookmaker): LG = Lagai (back, blue), KH = Khai (lay, pink). */
export function MarketCard({ market, selection, onSelect }: { market: MarketDto; selection: Selection | null; onSelect: (s: Selection) => void }) {
  const locked = market.status !== 'open';
  const title = market.type === 'bookmaker' ? 'Bookmaker' : 'Match Odds';
  const isSel = (side: Side, runnerId: string) => selection?.marketId === market.id && selection.side === side && selection.runnerId === runnerId;

  return (
    <section className="mkt">
      <div className="mkt__bar">
        Market : {title}
        {locked && <span className="badge badge--live" style={{ marginLeft: 'auto' }}>{market.status}</span>}
      </div>
      <div className="mkt__scroll">
        <div className="r r--odds">
          <span className="r__lim" />
          <div className="h h--back">LG</div>
          <div className="h h--lay">KH</div>
          <div className="h h--plain">Position</div>
        </div>
        {market.runners.map((r) => (
          <div className="r r--odds" key={r.id}>
            <div className="r__name">{r.name}</div>
            <button
              className={`cell cell--back${isSel('back', r.id) ? ' sel' : ''}`}
              disabled={locked}
              onClick={() => onSelect({ kind: 'runner', marketId: market.id, side: 'back', price: r.back, runnerId: r.id, label: `${r.name} · LG` })}
            >
              {formatOdds(r.back)}
            </button>
            <button
              className={`cell cell--lay${isSel('lay', r.id) ? ' sel' : ''}`}
              disabled={locked}
              onClick={() => onSelect({ kind: 'runner', marketId: market.id, side: 'lay', price: r.lay, runnerId: r.id, label: `${r.name} · KH` })}
            >
              {formatOdds(r.lay)}
            </button>
            <div className="pos" />
          </div>
        ))}
      </div>
    </section>
  );
}

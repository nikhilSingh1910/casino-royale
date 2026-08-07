import { formatOdds } from '../lib/format';
import { useSelection } from '../lib/selection';
import type { MarketDto, Side } from '../lib/types';

/** Match Odds / Bookmaker runner rows — Back (blue) / Lay (pink), the exchange convention. */
export function MarketOdds({ market }: { market: MarketDto }) {
  const { selection, select } = useSelection();
  const locked = market.status !== 'open';
  const title = market.type === 'bookmaker' ? 'Bookmaker' : 'Match Odds';
  const isSel = (side: Side, runnerId: string) => selection?.marketId === market.id && selection.side === side && selection.runnerId === runnerId;

  return (
    <div className="panel">
      <div className="panel__bar">
        Market : {title}
        {locked && <span style={{ marginLeft: 'auto', color: 'var(--gold)', fontSize: 12 }}>{market.status}</span>}
      </div>
      <div className="mrow">
        <div className="mrow__name" />
        <div className="mrow__h">Back</div>
        <div className="mrow__h">Lay</div>
        <div className="mrow__h">Position</div>
      </div>
      {market.runners.map((r) => (
        <div className="mrow" key={r.id}>
          <div className="mrow__name">{r.name}</div>
          <button
            className={`odds odds--back${isSel('back', r.id) ? ' sel' : ''}`}
            disabled={locked}
            onClick={() => select({ kind: 'runner', marketId: market.id, side: 'back', price: r.back, runnerId: r.id, label: `${r.name} · Back` })}
          >
            {formatOdds(r.back)}
          </button>
          <button
            className={`odds odds--lay${isSel('lay', r.id) ? ' sel' : ''}`}
            disabled={locked}
            onClick={() => select({ kind: 'runner', marketId: market.id, side: 'lay', price: r.lay, runnerId: r.id, label: `${r.name} · Lay` })}
          >
            {formatOdds(r.lay)}
          </button>
          <div />
        </div>
      ))}
    </div>
  );
}

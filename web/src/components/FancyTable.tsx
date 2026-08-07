import { formatRate } from '../lib/format';
import { useSelection } from '../lib/selection';
import type { MarketDto } from '../lib/types';

/** All session lines under one Fancy panel: No (pink, lay) / Rate / Yes (blue, back) / Rate. */
export function FancyTable({ markets }: { markets: MarketDto[] }) {
  const { selection, select } = useSelection();
  if (markets.length === 0) return null;
  const isSel = (marketId: string, side: 'back' | 'lay') => selection?.kind === 'fancy' && selection.marketId === marketId && selection.side === side;

  return (
    <div className="panel">
      <div className="panel__bar">Fancy</div>
      <div className="mrow mrow--fancy">
        <div className="mrow__name" />
        <div className="mrow__h">No</div>
        <div className="mrow__h">Rate</div>
        <div className="mrow__h">Yes</div>
        <div className="mrow__h">Rate</div>
      </div>
      {markets.map((m) => {
        const f = m.fancy;
        if (!f) return null;
        return (
          <div className="mrow mrow--fancy" key={m.id}>
            <div className="mrow__name">
              {m.name} <span className="info">i</span>
            </div>
            {m.status !== 'open' ? (
              <div className="susp">SUSPENDED</div>
            ) : (
              <>
                <button
                  className={`odds odds--lay${isSel(m.id, 'lay') ? ' sel' : ''}`}
                  onClick={() => select({ kind: 'fancy', marketId: m.id, side: 'lay', price: f.lay, lineValue: f.line, label: `${m.name} · No ${f.line}` })}
                >
                  {f.line}
                </button>
                <div className="rate">{formatRate(f.lay)}</div>
                <button
                  className={`odds odds--back${isSel(m.id, 'back') ? ' sel' : ''}`}
                  onClick={() => select({ kind: 'fancy', marketId: m.id, side: 'back', price: f.back, lineValue: f.line, label: `${m.name} · Yes ${f.line}` })}
                >
                  {f.line}
                </button>
                <div className="rate">{formatRate(f.back)}</div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

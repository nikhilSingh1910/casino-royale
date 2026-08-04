import { formatRate } from '../lib/format';
import type { MarketDto, Selection } from '../lib/types';

/** All session/fancy lines under one "Fancy" card: No (pink, lay) / Rate / Yes (blue, back) / Rate, per the prototype. */
export function FancyCard({ markets, selection, onSelect }: { markets: MarketDto[]; selection: Selection | null; onSelect: (s: Selection) => void }) {
  if (markets.length === 0) return null;
  const isSel = (marketId: string, side: 'back' | 'lay') => selection?.kind === 'fancy' && selection.marketId === marketId && selection.side === side;

  return (
    <section className="mkt">
      <div className="mkt__bar">Fancy</div>
      <div className="mkt__scroll">
        <div className="r r--fancy">
          <span className="r__lim" />
          <div className="h h--lay">No</div>
          <div className="h h--plain">Rate</div>
          <div className="h h--back">Yes</div>
          <div className="h h--plain">Rate</div>
          <div className="h h--plain">Pos</div>
        </div>
        {markets.map((m) => {
          const f = m.fancy;
          if (!f) return null;
          const name = m.name;
          return (
            <div className="r r--fancy" key={m.id}>
              <div className="r__name">
                {name} <span className="info">i</span>
              </div>
              {m.status !== 'open' ? (
                <div className="susp">SUSPENDED</div>
              ) : (
                <>
                  <button
                    className={`cell cell--lay${isSel(m.id, 'lay') ? ' sel' : ''}`}
                    onClick={() => onSelect({ kind: 'fancy', marketId: m.id, side: 'lay', price: f.lay, lineValue: f.line, label: `${name} · No ${f.line}` })}
                  >
                    {f.line}
                  </button>
                  <div className="rate">{formatRate(f.lay)}</div>
                  <button
                    className={`cell cell--back${isSel(m.id, 'back') ? ' sel' : ''}`}
                    onClick={() => onSelect({ kind: 'fancy', marketId: m.id, side: 'back', price: f.back, lineValue: f.line, label: `${name} · Yes ${f.line}` })}
                  >
                    {f.line}
                  </button>
                  <div className="rate">{formatRate(f.back)}</div>
                  <div className="pos" />
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

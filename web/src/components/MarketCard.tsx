import { formatOdds } from '../lib/format';
import type { MarketDto, Selection, Side } from '../lib/types';
import { PriceCell } from './PriceCell';

const TITLES: Record<string, string> = { match_odds: 'Match Odds', bookmaker: 'Bookmaker', fancy: 'Session' };

export function MarketCard({ market, selection, onSelect }: { market: MarketDto; selection: Selection | null; onSelect: (s: Selection) => void }) {
  const locked = market.status !== 'open';
  const isSel = (s: Side, runnerId?: string) =>
    selection?.marketId === market.id && selection.side === s && selection.runnerId === runnerId && (runnerId !== undefined || selection.kind === 'fancy');

  return (
    <section className="card">
      <div className="card__head">
        <span className="card__title">{market.type === 'fancy' ? market.name : TITLES[market.type] ?? market.name}</span>
        <span className="spacer" />
        {locked && <span className={`badge badge--${market.status}`}>{market.status}</span>}
      </div>
      <div className="card__body">
        {market.fancy ? (
          <div className="row">
            <div>
              <div className="row__name">{market.name}</div>
              <div className="row__sub">line {market.fancy.line} · {market.fancy.overs} overs</div>
            </div>
            <div className="cells">
              <PriceCell
                side="lay"
                main={String(market.fancy.line)}
                sub={`No · ${formatOdds(market.fancy.lay)}`}
                disabled={locked}
                selected={isSel('lay')}
                onPick={() => onSelect({ kind: 'fancy', marketId: market.id, side: 'lay', price: market.fancy!.lay, lineValue: market.fancy!.line, label: `${market.name} · No ${market.fancy!.line}` })}
              />
              <PriceCell
                side="back"
                main={String(market.fancy.line)}
                sub={`Yes · ${formatOdds(market.fancy.back)}`}
                disabled={locked}
                selected={isSel('back')}
                onPick={() => onSelect({ kind: 'fancy', marketId: market.id, side: 'back', price: market.fancy!.back, lineValue: market.fancy!.line, label: `${market.name} · Yes ${market.fancy!.line}` })}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="row" aria-hidden="true">
              <span />
              <div className="cells">
                <div className="cellcol"><div className="cellcol__h">Back</div></div>
                <div className="cellcol"><div className="cellcol__h">Lay</div></div>
              </div>
            </div>
            {market.runners.map((r) => (
              <div className="row" key={r.id}>
                <div className="row__name">{r.name}</div>
                <div className="cells">
                  <PriceCell
                    side="back"
                    main={formatOdds(r.back)}
                    disabled={locked}
                    selected={isSel('back', r.id)}
                    onPick={() => onSelect({ kind: 'runner', marketId: market.id, side: 'back', price: r.back, runnerId: r.id, label: `${r.name} · Back` })}
                  />
                  <PriceCell
                    side="lay"
                    main={formatOdds(r.lay)}
                    disabled={locked}
                    selected={isSel('lay', r.id)}
                    onPick={() => onSelect({ kind: 'runner', marketId: market.id, side: 'lay', price: r.lay, runnerId: r.id, label: `${r.name} · Lay` })}
                  />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

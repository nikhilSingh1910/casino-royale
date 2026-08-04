import type { Side } from '../lib/types';

export function PriceCell({
  side,
  main,
  sub,
  disabled,
  selected,
  onPick,
}: {
  side: Side;
  main: string;
  sub?: string;
  disabled?: boolean;
  selected?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      className={`cell cell--${side}${selected ? ' cell--sel' : ''}`}
      disabled={disabled}
      onClick={onPick}
      aria-pressed={selected}
    >
      <div className="cell__price">{main}</div>
      {sub && <div className="cell__size">{sub}</div>}
    </button>
  );
}

import type { MatchListDto } from '../lib/types';
import { MatchTable } from './MatchTable';

export function HighlightsTable({ matches }: { matches: MatchListDto[] }) {
  return (
    <div className="panel">
      <div className="tabs">
        <div className="tab active">Cricket</div>
        <div className="tab">Soccer</div>
        <div className="tab">Tennis</div>
      </div>
      <MatchTable matches={matches} label="Highlights" />
    </div>
  );
}

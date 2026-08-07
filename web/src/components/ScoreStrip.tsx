import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { OverBallDto } from '../lib/types';

const ballClass = (b: OverBallDto) => (b.wicket ? 'ball ball--w' : b.runs >= 4 ? 'ball ball--boundary' : 'ball');
const ballText = (b: OverBallDto) => (b.wicket ? 'W' : b.runs === 0 ? '·' : String(b.runs));

export function ScoreStrip({ matchId }: { matchId: string }) {
  const q = useQuery({ queryKey: ['score', matchId], queryFn: () => api.score(matchId), refetchInterval: 5000 });
  const s = q.data;
  if (!s) return null;

  return (
    <div className="score">
      <div className="score__main">
        {s.innings.length === 0 ? (
          <div className="score__line">Match not started</div>
        ) : (
          s.innings.map((i) => (
            <div className="score__line" key={i.innings}>
              {(i.team ?? `Innings ${i.innings}`) + ' — '}
              {i.runs}-{i.wickets} ({i.overs} Ovs)
            </div>
          ))
        )}
        {s.summary && <div className="score__line score__lead">{s.summary}</div>}
        {s.currentOver.length > 0 && (
          <div className="over">
            <span style={{ fontWeight: 700, opacity: 0.9 }}>Over</span>
            {s.currentOver.map((b, idx) => (
              <span className={ballClass(b)} key={idx}>
                {ballText(b)}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="score__status">{s.status === 'inplay' ? 'Live' : s.status}</div>
    </div>
  );
}

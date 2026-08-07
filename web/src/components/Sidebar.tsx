import { useNavigate } from 'react-router-dom';

const SPORTS = ['Cricket', 'Casino', 'Tennis', 'Soccer', 'Horse Racing', 'Greyhound Racing', 'Lottery'];

export function Sidebar() {
  const navigate = useNavigate();
  return (
    <div className="panel">
      <div className="panel__bar">
        Sports
        <span style={{ marginLeft: 'auto', letterSpacing: 2 }}>⋮</span>
      </div>
      {SPORTS.map((s) => (
        <div className="side__item" key={s} onClick={() => s === 'Cricket' && navigate('/')} title={s === 'Cricket' ? '' : 'Coming soon'}>
          {s}
          <span className="side__arrow">›</span>
        </div>
      ))}
    </div>
  );
}

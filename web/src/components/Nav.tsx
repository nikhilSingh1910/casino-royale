import { NavLink } from 'react-router-dom';

const OTHER = ['Multi Markets', 'Tennis', 'Soccer', 'Horse Racing', 'Greyhound Racing', 'Lottery', 'Live Casino', 'Tips & Previews'];

export function Nav() {
  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');
  return (
    <nav className="nav">
      <NavLink to="/" end className={cls}>
        Home
      </NavLink>
      <NavLink to="/inplay" className={cls}>
        In-Play
      </NavLink>
      <NavLink to="/" end className={cls}>
        Cricket
      </NavLink>
      <span className="vimaan">✈ Vimaan</span>
      {OTHER.map((x) => (
        <a key={x} title="Coming soon">
          {x}
        </a>
      ))}
    </nav>
  );
}

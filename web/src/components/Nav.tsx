import { NavLink, useNavigate } from 'react-router-dom';

const OTHER = ['Multi Markets', 'Tennis', 'Soccer', 'Horse Racing', 'Greyhound Racing', 'Lottery', 'Live Casino', 'Tips & Previews'];

export function Nav() {
  const navigate = useNavigate();
  return (
    <nav className="nav">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
        Home
      </NavLink>
      <a onClick={() => navigate('/')}>In-Play</a>
      <a onClick={() => navigate('/')}>Cricket</a>
      <span className="vimaan">✈ Vimaan</span>
      {OTHER.map((x) => (
        <a key={x} title="Coming soon">
          {x}
        </a>
      ))}
    </nav>
  );
}

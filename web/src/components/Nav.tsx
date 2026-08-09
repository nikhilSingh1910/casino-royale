import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const OTHER = ['Multi Markets', 'Tennis', 'Soccer', 'Horse Racing', 'Greyhound Racing', 'Lottery', 'Live Casino', 'Tips & Previews'];

export function Nav() {
  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');
  const { token } = useAuth();
  const meQ = useQuery({ queryKey: ['me'], queryFn: () => api.me(token as string), enabled: !!token });
  const isOperator = meQ.data?.role === 'trader' || meQ.data?.role === 'admin';
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
      <NavLink to="/leaderboard" className={cls}>
        Leaderboard
      </NavLink>
      {isOperator && (
        <NavLink to="/admin" className={cls}>
          Admin
        </NavLink>
      )}
      <span className="vimaan">✈ Vimaan</span>
      {OTHER.map((x) => (
        <a key={x} title="Coming soon">
          {x}
        </a>
      ))}
    </nav>
  );
}

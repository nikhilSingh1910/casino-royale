import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatMoney } from '../lib/format';

export function Header() {
  const { token, signOut } = useAuth();
  const navigate = useNavigate();

  const balance = useQuery({
    queryKey: ['balance'],
    queryFn: () => api.balance(token as string),
    enabled: !!token,
    refetchOnWindowFocus: true,
  });

  return (
    <header className="hdr">
      <div className="hdr__logo" onClick={() => navigate('/')}>
        <span className="hdr__mark">
          TOP
          <br />
          5050
        </span>
      </div>
      {token && (
        <div className="hdr__user">
          <b>Player</b>
          <div className="sub">Balance : {balance.data ? formatMoney(balance.data.available) : '—'} · play chips</div>
        </div>
      )}
      <div className="hdr__spacer" />
      <nav className="nav">
        <button onClick={() => navigate('/')}>HOME</button>
        <button onClick={() => navigate('/')}>INPLAY</button>
        {token ? <button onClick={signOut}>LOGOUT</button> : <button onClick={() => navigate('/login')}>LOGIN</button>}
      </nav>
    </header>
  );
}

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
      <div className="brand" onClick={() => navigate('/')} title="Home">
        Kestrel
      </div>
      <div className="hdr__spacer" />
      {token && (
        <div className="wallet">
          <b>{balance.data ? formatMoney(balance.data.available) : '—'}</b>
          <small>Player · play chips</small>
        </div>
      )}
      <div className="login">
        <button type="button" className="search" title="Search">
          ⌕
        </button>
        {token ? (
          <button className="go" onClick={signOut}>
            Logout
          </button>
        ) : (
          <button className="go" onClick={() => navigate('/login')}>
            Login →
          </button>
        )}
      </div>
    </header>
  );
}

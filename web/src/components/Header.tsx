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
      <div className="hdr__brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <span className="hdr__logo">E</span>
        <span>Exchange</span>
      </div>
      <div className="hdr__spacer" />
      {token ? (
        <>
          <div className="wallet">
            <div className="wallet__amt">{balance.data ? formatMoney(balance.data.available) : '—'}</div>
            <div className="wallet__label">Balance</div>
          </div>
          <button className="iconbtn" title="Sign out" onClick={signOut}>
            ⏻
          </button>
        </>
      ) : (
        <button className="btn btn--primary" onClick={() => navigate('/login')}>
          Sign in
        </button>
      )}
    </header>
  );
}

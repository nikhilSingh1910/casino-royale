import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatMoney } from '../lib/format';

export function Header() {
  const { token, userId, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const balance = useQuery({ queryKey: ['balance'], queryFn: () => api.balance(token as string), enabled: !!token });
  const login = useMutation({
    mutationFn: async () => {
      try {
        return await api.login(email, password);
      } catch (e) {
        // First-time demo convenience: create the account, then log in. (Backend is email-based.)
        if (e instanceof ApiError && e.status === 401) {
          await api.signup(email, password);
          return api.login(email, password);
        }
        throw e;
      }
    },
    onSuccess: (r) => signIn(r.token, r.userId),
  });
  const err = login.error instanceof ApiError ? login.error.message : login.error ? 'Login failed' : null;

  return (
    <header className="hdr">
      <div className="brand" onClick={() => navigate('/')} title="Home">
        Kestrel
      </div>
      <div className="hdr__spacer" />
      {token ? (
        <div className="login">
          <div className="wallet">
            <b>{balance.data ? formatMoney(balance.data.available) : '—'}</b>
            <small>{userId ? `Player · ${userId.slice(0, 6)}` : 'Player'}</small>
          </div>
          <button className="go" onClick={signOut}>
            Logout
          </button>
        </div>
      ) : (
        <form
          className="login"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate();
          }}
        >
          <button type="button" className="search" title="Search">
            ⌕
          </button>
          <input placeholder="Username" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="go" disabled={login.isPending}>
            {login.isPending ? '…' : 'Login →'}
          </button>
          {err && <div className="err">{err} · new here? use any email + an 8-char password</div>}
        </form>
      )}
    </header>
  );
}

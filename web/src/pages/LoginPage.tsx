import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [touched, setTouched] = useState(false);

  const done = (r: { token: string; userId: string }) => {
    signIn(r.token, r.userId);
    navigate('/');
  };

  const login = useMutation({
    mutationFn: async () => {
      try {
        return await api.login(username, password);
      } catch (e) {
        // First-time convenience: create the account, then log in (backend is email-based).
        if (e instanceof ApiError && e.status === 401) {
          await api.signup(username, password);
          return api.login(username, password);
        }
        throw e;
      }
    },
    onSuccess: done,
  });
  const demo = useMutation({ mutationFn: () => api.demo(), onSuccess: done });

  const err = login.error instanceof ApiError ? login.error.message : login.error ? 'Login failed' : demo.error ? 'Could not start demo' : null;
  const usernameHint = touched && !username ? 'Please enter username.' : username && !username.includes('@') ? 'Use an email address as your username.' : '';

  return (
    <div className="loginpage">
      <button className="loginpage__close" onClick={() => navigate('/')} aria-label="Close">
        ✕
      </button>
      <div className="loginbox">
        <div className="loginbox__logo">Kestrel</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (username && password) login.mutate();
          }}
        >
          <div className="loginfield">
            <input placeholder="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} aria-label="Username" />
            <span className="loginfield__icon" aria-hidden>👤</span>
          </div>
          <div className="loginhint">{usernameHint}</div>
          <div className="loginfield">
            <input type={showPw ? 'text' : 'password'} placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" />
            <button type="button" className="loginfield__icon" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
          <div className="loginhint">{err ?? (password && password.length < 8 ? 'Password must be at least 8 characters.' : '')}</div>
          <button className="loginbtn" disabled={login.isPending}>
            {login.isPending ? '…' : 'Login'}
          </button>
        </form>
        <button className="loginbtn" onClick={() => demo.mutate()} disabled={demo.isPending}>
          {demo.isPending ? '…' : 'Login with Demo ID'}
        </button>
      </div>
    </div>
  );
}

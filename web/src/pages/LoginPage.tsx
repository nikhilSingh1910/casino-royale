import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = useMutation({
    mutationFn: async () => {
      if (mode === 'signup') await api.signup(email, password);
      return api.login(email, password);
    },
    onSuccess: (r) => {
      signIn(r.token, r.userId);
      navigate('/');
    },
  });
  const err = submit.error instanceof ApiError ? submit.error.message : submit.error ? 'Something went wrong' : null;

  return (
    <div className="auth">
      <div className="auth__card">
        <h1 className="auth__title">{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
        <p className="auth__sub">Play-money exchange — virtual chips, no real funds.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          <label className="field">
            <span className="field__label">Email</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span className="field__label">Password</span>
            <input className="input" type="password" autoComplete="current-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {err && <div className="slip__msg slip__msg--err" style={{ marginBottom: 10 }}>{err}</div>}
          <button className="btn btn--primary btn--full" disabled={submit.isPending}>
            {submit.isPending ? '…' : mode === 'login' ? 'Sign in' : 'Sign up'}
          </button>
        </form>
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <button
            className="link"
            onClick={() => {
              setMode((m) => (m === 'login' ? 'signup' : 'login'));
              submit.reset();
            }}
          >
            {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}

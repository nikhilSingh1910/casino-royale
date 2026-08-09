import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface AuthState {
  token: string | null;
  userId: string | null;
  signIn: (token: string, userId: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem('userId'));

  const signIn = useCallback(
    (t: string, u: string) => {
      localStorage.setItem('token', t);
      localStorage.setItem('userId', u);
      qc.clear(); // drop any prior account's cached data — never serve one user's balance/bets to the next (H3)
      setToken(t);
      setUserId(u);
    },
    [qc],
  );
  const signOut = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    qc.clear(); // H3
    setToken(null);
    setUserId(null);
  }, [qc]);

  const value = useMemo(() => ({ token, userId, signIn, signOut }), [token, userId, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

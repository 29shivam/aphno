import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@aphno/shared';
import { api, auth as tokenStore } from '../api/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore a persisted session on boot by validating the stored token.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tokenStore.token) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn: (token, u) => {
        tokenStore.set(token);
        setUser(u);
      },
      signOut: () => {
        tokenStore.clear();
        setUser(null);
      },
      setUser,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

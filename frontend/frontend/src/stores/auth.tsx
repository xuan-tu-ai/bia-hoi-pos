import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth.ts';
import { clearStoredSession, getStoredSession, saveStoredSession } from '../lib/storage.ts';
import type { User } from '../types/index.ts';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredSession()?.user ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    authApi.getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setUser(null);
          setError(loadError instanceof Error ? loadError.message : 'Không thể khôi phục phiên đăng nhập.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError('');
    const session = await authApi.login(email, password);
    saveStoredSession(session);
    setUser(session.user);
    return session.user;
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    setUser(null);
    setError('');
  }, []);

  const value = useMemo(() => ({ user, loading, error, login, logout }), [user, loading, error, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Người đang đứng quầy (FR-01). "Đổi người" về màn khóa mà không thoát ứng dụng.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';
import { closeSocket } from './hooks';
import type { StaffSession } from './types';

interface SessionState {
  staff: StaffSession | null;
  checking: boolean;
  signIn: (pin: string) => Promise<void>;
  lock: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<StaffSession | null>(null);
  const [checking, setChecking] = useState(!!getToken());

  const lock = useCallback(() => {
    setToken(null);
    closeSocket();
    setStaff(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(lock);
    if (getToken()) {
      api<StaffSession>('/auth/me')
        .then(setStaff, lock)
        .finally(() => setChecking(false));
    }
    return () => setUnauthorizedHandler(null);
  }, [lock]);

  const signIn = useCallback(async (pin: string) => {
    const res = await api<{ token: string; staff: StaffSession }>('/auth/pin', { method: 'POST', body: { pin } });
    setToken(res.token);
    setStaff(res.staff);
  }, []);

  return <SessionContext.Provider value={{ staff, checking, signIn, lock }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession phải nằm trong SessionProvider');
  return ctx;
}

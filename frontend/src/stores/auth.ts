import { useSyncExternalStore } from 'react';
import type { User } from '@/types';

/**
 * Lưu người dùng đang đăng nhập + token (localStorage để tải lại trang không phải đăng nhập lại).
 * Token hết hạn sau 12 giờ; khi API trả 401, api/client.ts gọi logout().
 */
const TOKEN_KEY = 'biahoi.token';
const USER_KEY = 'biahoi.user';

type AuthState = { token: string | null; user: User | null };

function read(): AuthState {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    return { token, user: token && raw ? (JSON.parse(raw) as User) : null };
  } catch {
    return { token: null, user: null };
  }
}

let state: AuthState = read();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const authStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  login(token: string, user: User) {
    state = { token, user };
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* trình duyệt chặn lưu trữ: vẫn dùng được trong phiên này */
    }
    emit();
  },
  setUser(user: User) {
    state = { ...state, user };
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* bỏ qua */
    }
    emit();
  },
  logout() {
    state = { token: null, user: null };
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      /* bỏ qua */
    }
    emit();
  },
};

export function useAuth() {
  return useSyncExternalStore(authStore.subscribe, authStore.get);
}

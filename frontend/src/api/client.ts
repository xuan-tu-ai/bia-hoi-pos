import axios, { AxiosError } from 'axios';
import { authStore } from '@/stores/auth';
import type { ApiErrorBody } from '@/types';

/** axios dùng chung: gắn token, xử lý 401 (SRS FR-01). */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const { token } = authStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiErrorBody>) => {
    const isLogin = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLogin) {
      authStore.logout(); // router tự đưa về trang đăng nhập
    }
    return Promise.reject(error);
  },
);

/** Lỗi theo định dạng chung của backend (SRS 7.1). */
export function apiError(err: unknown): { code: string; message: string; details?: unknown } {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    const body = err.response?.data?.error;
    if (body) return body;
    if (!err.response) return { code: 'NETWORK', message: 'Không kết nối được máy chủ, kiểm tra mạng rồi thử lại' };
  }
  return { code: 'UNKNOWN', message: 'Có lỗi xảy ra, vui lòng thử lại' };
}

export const errorMessage = (err: unknown) => apiError(err).message;

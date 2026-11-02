// Gọi backend (apps/api). Khi phát triển đi qua proxy /api của Vite; khi build cho LAN đặt VITE_API_URL.

export const API_BASE: string = import.meta.env.VITE_API_URL ?? '/api';

/** Origin của máy chủ cho Socket.IO: cùng origin khi đi qua proxy. */
export const API_ORIGIN = /^https?:\/\//.test(API_BASE) ? new URL(API_BASE).origin : window.location.origin;

const TOKEN_KEY = 'biahoi.admin.token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let token = readToken();

// Chỉ khi phát triển: mở trang với #token=<jwt> để công cụ chụp màn hình vào thẳng màn đã đăng nhập.
// Bản build production không có đoạn này (Vite bỏ nhánh import.meta.env.DEV).
if (import.meta.env.DEV && window.location.hash.startsWith('#token=')) {
  token = decodeURIComponent(window.location.hash.slice(7).split('&')[0]!); // có thể kèm &theme=dark
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
let onUnauthorized: (() => void) | null = null;

export function setToken(value: string | null): void {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // trình duyệt chặn lưu trữ: vẫn đăng nhập được trong phiên này
  }
}

export const getToken = () => token;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api<T>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method: options.method ?? 'GET',
      headers: {
        // Blob (ảnh) gửi nguyên dạng nhị phân, còn lại là JSON
        ...(options.body instanceof Blob ? { 'content-type': options.body.type } : options.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: options.body instanceof Blob ? options.body : options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Không kết nối được máy chủ');
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, data?.code ?? 'ERROR', data?.message ?? `Lỗi ${res.status}`, data?.details);
  }
  return data as T;
}

/** Địa chỉ ảnh món do backend phục vụ (không cần token). */
export const imageUrl = (file: string | null | undefined): string | undefined => (file ? `${API_BASE}/uploads/${file}` : undefined);

export function query(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

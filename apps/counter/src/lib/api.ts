// Gọi backend. Token đăng nhập PIN lưu theo phiên trình duyệt (sessionStorage): đóng trình duyệt
// là phải nhập lại PIN; "Đổi người" xóa token ngay. Khóa thiết bị của máy quầy lưu lâu dài (localStorage).

export const API_BASE: string = import.meta.env.VITE_API_URL ?? '/api';
export const API_ORIGIN = /^https?:\/\//.test(API_BASE) ? new URL(API_BASE).origin : window.location.origin;

const TOKEN_KEY = 'biahoi.counter.token';
const DEVICE_KEY = 'biahoi.counter.deviceKey';

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}
function write(storage: () => Storage, key: string, value: string | null): void {
  try {
    if (value) storage().setItem(key, value);
    else storage().removeItem(key);
  } catch {
    // trình duyệt chặn lưu trữ: vẫn chạy được trong phiên này
  }
}

let token = read(() => sessionStorage, TOKEN_KEY);

// Chỉ khi phát triển: mở trang với #token=<jwt> để công cụ chụp màn hình vào thẳng màn đã đăng nhập.
if (import.meta.env.DEV && window.location.hash.startsWith('#token=')) {
  token = decodeURIComponent(window.location.hash.slice(7).split('&')[0]!); // có thể kèm &theme=dark
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
let onUnauthorized: (() => void) | null = null;

export const getToken = () => token;
export function setToken(value: string | null): void {
  token = value;
  write(() => sessionStorage, TOKEN_KEY, value);
}
export const getDeviceKey = () => read(() => localStorage, DEVICE_KEY) ?? '';
export const setDeviceKey = (value: string) => write(() => localStorage, DEVICE_KEY, value.trim() || null);
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

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

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** `as` cho phép gọi bằng token khác (vd token của quản lý khi đóng ca). */
export async function api<T>(path: string, options: { method?: Method; body?: unknown; as?: string } = {}): Promise<T> {
  const auth = options.as ?? token;
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(auth ? { authorization: `Bearer ${auth}` } : {}),
        ...(path === '/auth/pin' && getDeviceKey() ? { 'x-device-key': getDeviceKey() } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Không kết nối được máy chủ. Kiểm tra mạng LAN của quầy.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !options.as && token && path !== '/auth/pin') onUnauthorized?.();
    throw new ApiError(res.status, data?.code ?? 'ERROR', data?.message ?? `Lỗi ${res.status}`, data?.details);
  }
  return data as T;
}

export const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'Có lỗi xảy ra, thử lại.');

/** Địa chỉ ảnh món do backend phục vụ (không cần token). */
export const imageUrl = (file: string | null | undefined): string | undefined => (file ? `${API_BASE}/uploads/${file}` : undefined);

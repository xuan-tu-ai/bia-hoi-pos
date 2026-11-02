import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@biahoi/shared';
import { API_ORIGIN, ApiError, api, getToken } from './api';

export interface Loaded<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  /** Lần tải lại gần nhất thành công */
  updatedAt: Date | null;
  reload: () => void;
}

/**
 * Tải dữ liệu từ API. Khi tải lại, giữ số liệu cũ trên màn hình cho tới khi có số mới
 * (không nháy về trạng thái đang tải). `path = null` để chưa tải.
 */
export function useApi<T>(path: string | null): Loaded<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (path === null) return;
    const id = ++latest.current;
    setLoading(true);
    api<T>(path).then(
      (d) => {
        if (id !== latest.current) return;
        setData(d);
        setError(null);
        setUpdatedAt(new Date());
        setLoading(false);
      },
      (e: ApiError) => {
        if (id !== latest.current) return;
        setError(e);
        setLoading(false);
      },
    );
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, updatedAt, reload };
}

let socket: Socket | null = null;

function getSocket(): Socket | null {
  const token = getToken();
  if (!token) return null;
  if (!socket) socket = io(API_ORIGIN, { auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}

export function closeSocket(): void {
  socket?.disconnect();
  socket = null;
}

type LiveEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

/** Gọi `onEvent` khi máy quầy thay đổi dữ liệu (FR-02, FR-16). */
export function useLive(events: LiveEvent[], onEvent: () => void): void {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const key = events.join(',');
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    // Giờ cao điểm mỗi lượt gọi phát vài sự kiện: gộp các sự kiện trong 800ms thành một lần tải lại số liệu
    let timer: number | undefined;
    const fn = () => {
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        handler.current();
      }, 800);
    };
    const names = key.split(',');
    for (const e of names) s.on(e, fn);
    // nối lại sau khi mất mạng thì tải lại để không sót thay đổi
    s.io.on('reconnect', fn);
    return () => {
      window.clearTimeout(timer);
      for (const e of names) s.off(e, fn);
      s.io.off('reconnect', fn);
    };
  }, [key]);
}

/** Chạy một thao tác ghi (lưu, xóa), giữ trạng thái đang chạy và lỗi để hiện ngay tại chỗ. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Có lỗi xảy ra');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run, clearError: () => setError(null) };
}

/** true khi màn hình hẹp hơn `px` (bảng chuyển thành danh sách hai dòng trên điện thoại). */
export function useNarrow(px = 640): boolean {
  const q = `(max-width: ${px}px)`;
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const fn = () => setNarrow(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [q]);
  return narrow;
}

/** Gọi lại mỗi `ms` mili giây khi tab đang hiển thị (FR-16: tự làm mới mỗi 30 giây). */
export function useInterval(ms: number, fn: () => void): void {
  const handler = useRef(fn);
  handler.current = fn;
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') handler.current();
    }, ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

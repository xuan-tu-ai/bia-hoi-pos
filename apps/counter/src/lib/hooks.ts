import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@biahoi/shared';
import { API_ORIGIN, ApiError, api, errorText, getToken } from './api';

export interface Loaded<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
}

/** Tải dữ liệu; khi tải lại vẫn giữ số cũ trên màn hình cho tới khi có số mới. */
export function useApi<T>(path: string | null): Loaded<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(path !== null);
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
        setLoading(false);
      },
      (e: ApiError) => {
        if (id !== latest.current) return;
        setError(e);
        setLoading(false);
      },
    );
  }, [path, tick]);

  return { data, error, loading, reload: useCallback(() => setTick((t) => t + 1), []) };
}

let socket: Socket | null = null;
let socketToken: string | null = null;

function getSocket(): Socket | null {
  const token = getToken();
  if (!token) return null;
  if (socket && socketToken !== token) closeSocket();
  if (!socket) {
    socket = io(API_ORIGIN, { auth: { token }, transports: ['websocket', 'polling'] });
    socketToken = token;
  }
  return socket;
}

export function closeSocket(): void {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}

type LiveEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
type LivePayload = { tableIds?: number[]; tapIds?: number[] };

/**
 * FR-02: thay đổi do máy quầy khác tạo hiện lên trong vòng vài giây.
 * `only` lọc sự kiện không liên quan (vd chỉ bàn đang mở). Nhiều sự kiện dồn dập trong 250ms gộp thành một lần tải lại.
 */
export function useLive(events: LiveEvent[], onEvent: () => void, only?: (payload: LivePayload) => boolean): void {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const filter = useRef(only);
  filter.current = only;
  const key = events.join(',');
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    let timer: number | undefined;
    const fire = () => {
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        handler.current();
      }, 250);
    };
    const fn = (payload?: LivePayload) => {
      if (!payload || !filter.current || filter.current(payload)) fire();
    };
    const names = key.split(',');
    for (const e of names) s.on(e, fn);
    // nối lại sau khi mất mạng thì tải lại để không sót thay đổi
    s.io.on('reconnect', fire);
    return () => {
      window.clearTimeout(timer);
      for (const e of names) s.off(e, fn);
      s.io.off('reconnect', fire);
    };
  }, [key]);
}

/** Máy quầy còn nối với máy chủ không. Mất kết nối quá 2 giây mới báo, để mạng chập chờn không làm nháy dải đỏ. */
export function useConnected(): boolean {
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    let timer: number | undefined;
    const up = () => {
      window.clearTimeout(timer);
      timer = undefined;
      setConnected(true);
    };
    const down = () => {
      if (timer === undefined) timer = window.setTimeout(() => setConnected(false), 2000);
    };
    if (!s.connected) down();
    s.on('connect', up);
    s.on('disconnect', down);
    s.on('connect_error', down);
    // có mạng lại mà socket chưa từng rớt (mạng chập chờn ngắn) thì cũng hết báo
    const online = () => s.connected && up();
    window.addEventListener('offline', down);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('online', online);
      window.clearTimeout(timer);
      s.off('connect', up);
      s.off('disconnect', down);
      s.off('connect_error', down);
      window.removeEventListener('offline', down);
    };
  }, []);
  return connected;
}

/** Đồng hồ cập nhật mỗi phút, cho "thời gian đã ngồi". */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Chạy thao tác ghi, giữ trạng thái đang chạy và câu báo lỗi. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <R,>(fn: () => Promise<R>): Promise<R | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(errorText(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run, clearError: useCallback(() => setError(null), []) };
}

// Socket.IO: phát sự kiện để các máy quầy và dashboard tự cập nhật (FR-02, FR-16, NFR-02).
// Client nhận sự kiện rồi gọi lại API để lấy dữ liệu mới.

import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { SOCKET_EVENTS } from '@biahoi/shared';

let io: Server | null = null;

export function attachRealtime(
  httpServer: HttpServer,
  corsOrigin: boolean | string[],
  verifyToken: (token: string) => Promise<void>,
): Server {
  io = new Server(httpServer, { cors: { origin: corsOrigin } });
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string') return next(new Error('UNAUTHORIZED'));
    verifyToken(token).then(
      () => next(),
      () => next(new Error('UNAUTHORIZED')),
    );
  });
  return io;
}

export function closeRealtime(): Promise<void> {
  return new Promise((resolve) => {
    if (!io) return resolve();
    io.close(() => resolve());
    io = null;
  });
}

export function emitTablesUpdated(tableIds: number[]): void {
  io?.emit(SOCKET_EVENTS.TABLE_UPDATED, { tableIds: [...new Set(tableIds)] });
  io?.emit(SOCKET_EVENTS.DASHBOARD_UPDATED, {});
}

export function emitTapsUpdated(tapIds: number[]): void {
  io?.emit(SOCKET_EVENTS.TAP_UPDATED, { tapIds });
}

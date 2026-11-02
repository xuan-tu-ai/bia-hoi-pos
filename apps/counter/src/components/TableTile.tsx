// Ô bàn trên sơ đồ (FR-02): số bàn, tổng tạm tính, thời gian đã ngồi; màu theo trạng thái.

import { vnd } from '../lib/format';
import type { MapTable } from '../lib/types';

export const STATUS_LABEL = { EMPTY: 'Trống', OPEN: 'Đang ngồi', PROVISIONAL: 'Đã in tạm tính', PRINT_ERROR: 'Lỗi in phiếu' } as const;

export function seated(openedAt: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(openedAt).getTime()) / 60_000));
  const h = Math.floor(minutes / 60);
  return h ? `${h} giờ ${String(minutes % 60).padStart(2, '0')}` : `${minutes} phút`;
}

export function TableTile({ table, now, onPick, disabled }: { table: MapTable; now: Date; onPick: (t: MapTable) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={`table-tile is-${table.status.toLowerCase()}`}
      onClick={() => onPick(table)}
      disabled={disabled}
      aria-label={`Bàn ${table.code}, ${STATUS_LABEL[table.status]}${table.tab ? `, tạm tính ${vnd(table.tab.total)} đồng` : ''}`}
    >
      <span className="tile-code">{table.code}</span>
      {table.tab ? (
        <>
          <span className="tile-total num">{vnd(table.tab.total)}</span>
          <span className="tile-time">{seated(table.tab.openedAt, now)}</span>
        </>
      ) : (
        <span className="tile-time">Trống</span>
      )}
      {table.status === 'PRINT_ERROR' && <span className="tile-flag">Lỗi in</span>}
      {table.status === 'PROVISIONAL' && <span className="tile-flag">Tạm tính</span>}
    </button>
  );
}

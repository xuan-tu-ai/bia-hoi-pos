import { formatDuration, formatMoneyShort } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TableSummaryRow } from '@/types';

const STYLE = {
  EMPTY: 'bg-table-empty text-stone-500 hover:bg-stone-300/70',
  OCCUPIED: 'bg-table-occupied text-white hover:brightness-110',
  PROVISIONAL_PRINTED: 'bg-table-provisional text-stone-900 hover:brightness-105',
} as const;

/** Một ô bàn: số bàn to, tổng tiền, thời gian đã ngồi; màu theo trạng thái (FR-02). */
export function TableTile({ row, now, onClick, selected, disabled }: { row: TableSummaryRow; now: Date; onClick?: () => void; selected?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-status={row.status}
      aria-label={`Bàn ${row.code}`}
      className={cn(
        'flex h-[72px] flex-col items-center justify-center rounded-lg px-1 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35',
        STYLE[row.status],
        selected && 'ring-4 ring-primary ring-offset-2',
      )}
    >
      <span className="text-2xl font-bold leading-none">{row.code}</span>
      {row.status !== 'EMPTY' && (
        <span className="mt-1 flex w-full items-center justify-center gap-1 text-[11px] font-medium leading-none opacity-95">
          <span>{formatMoneyShort(row.total ?? 0)}</span>
          <span aria-hidden>·</span>
          <span>{row.openedAt ? formatDuration(row.openedAt, now) : ''}</span>
        </span>
      )}
    </button>
  );
}

export function TableLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-table-empty ring-1 ring-stone-300" /> Trống</span>
      <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-table-occupied" /> Đang ngồi</span>
      <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-table-provisional" /> Đã in tạm tính</span>
    </div>
  );
}

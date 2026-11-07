import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Bảng màu biểu đồ (dùng chung các báo cáo). */
export const CHART = {
  primary: '#b45309', // amber-700
  secondary: '#a8a29e', // stone-400
  cash: '#15803d', // green-700
  transfer: '#1d4ed8', // blue-700
  grid: '#e7e5e4',
};

export function StatCard({ label, value, change, hint }: { label: string; value: ReactNode; change?: number | null; hint?: ReactNode }) {
  const up = (change ?? 0) >= 0;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{value}</div>
        <div className="mt-1 flex items-center gap-1 text-xs">
          {change == null ? (
            <span className="text-muted-foreground">{hint ?? 'Chưa có số liệu hôm qua'}</span>
          ) : (
            <>
              <span className={cn('flex items-center gap-0.5 font-semibold', up ? 'text-green-700' : 'text-destructive')}>
                {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {up ? '+' : ''}
                {formatPercent(change)}
              </span>
              <span className="text-muted-foreground">so với cùng giờ hôm qua</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DateRange({ from, to, onChange, children }: { from: string; to: string; onChange: (r: { from: string; to: string }) => void; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1">
        <Label htmlFor="from" className="text-xs">Từ ngày</Label>
        <Input id="from" type="date" className="w-[150px]" value={from} max={to} onChange={(e) => onChange({ from: e.target.value, to })} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="to" className="text-xs">Đến ngày</Label>
        <Input id="to" type="date" className="w-[150px]" value={to} min={from} onChange={(e) => onChange({ from, to: e.target.value })} />
      </div>
      {children}
    </div>
  );
}

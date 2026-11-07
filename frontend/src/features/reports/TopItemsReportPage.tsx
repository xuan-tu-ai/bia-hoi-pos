import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { reportsApi } from '@/api/reports';
import { apiError } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, ErrorBox, Loading, Page } from '@/components/layout/Page';
import { daysAgo, formatMoney, formatMoneyShort, toYmd } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CHART, DateRange } from './shared';

const MAX_DAYS = 31;
const dayDiff = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1;

/** FR-19 Món bán chạy & giờ cao điểm (tối đa 31 ngày). */
export function TopItemsReportPage() {
  const [range, setRange] = useState({ from: daysAgo(6), to: toYmd(new Date()) });
  const [by, setBy] = useState<'qty' | 'revenue'>('qty');
  const tooLong = dayDiff(range.from, range.to) > MAX_DAYS;

  const top = useQuery({ queryKey: ['reports', 'top', range, by], queryFn: () => reportsApi.topItems({ ...range, by }), enabled: !tooLong });
  const hourly = useQuery({ queryKey: ['reports', 'hourly', range], queryFn: () => reportsApi.hourly(range), enabled: !tooLong });

  const topData = (top.data?.items ?? []).map((i) => ({ ...i, value: by === 'qty' ? i.qty : i.revenue }));
  const hourData = (hourly.data?.hours ?? []).filter((h) => h.hour >= 9 || h.revenue > 0).map((h) => ({ ...h, label: `${h.hour}h` }));

  return (
    <Page title="Món bán chạy & giờ cao điểm" className="px-3 sm:px-6">
      <div className="mb-4">
        <DateRange from={range.from} to={range.to} onChange={setRange}>
          <div className="flex rounded-md border p-0.5">
            {(['qty', 'revenue'] as const).map((b) => (
              <button key={b} type="button" onClick={() => setBy(b)} className={cn('h-9 rounded px-3 text-sm font-medium', by === b ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>
                {b === 'qty' ? 'Theo số lượng' : 'Theo doanh thu'}
              </button>
            ))}
          </div>
        </DateRange>
      </div>

      {tooLong ? (
        <ErrorBox message={`Chỉ chọn được tối đa ${MAX_DAYS} ngày`} />
      ) : top.isError ? (
        <ErrorBox message={apiError(top.error).message} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Top 10 món</CardTitle></CardHeader>
            <CardContent className="h-[360px] px-1 sm:px-4">
              {top.isLoading ? <Loading /> : topData.length === 0 ? <Empty>Không có dữ liệu</Empty> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke={CHART.grid} />
                    <XAxis type="number" tickFormatter={by === 'qty' ? undefined : formatMoneyShort} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => (by === 'qty' ? `${v} phần` : formatMoney(v))} />
                    <Bar dataKey="value" name={by === 'qty' ? 'Số lượng' : 'Doanh thu'} fill={CHART.primary} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Doanh thu theo giờ trong ngày</CardTitle></CardHeader>
            <CardContent className="h-[360px] px-1 sm:px-4">
              {hourly.isLoading ? <Loading /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourData} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tickFormatter={formatMoneyShort} tick={{ fontSize: 11 }} width={44} />
                    <Tooltip formatter={(v: number, name) => (name === 'Số hóa đơn' ? v : formatMoney(v))} labelFormatter={(l) => `Khung ${l}`} />
                    <Bar dataKey="revenue" name="Doanh thu" fill={CHART.primary} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </Page>
  );
}

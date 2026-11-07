import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { reportsApi } from '@/api/reports';
import { apiError } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorBox, Loading, Page } from '@/components/layout/Page';
import { formatMoney, formatMoneyShort, formatTime } from '@/lib/format';
import { CHART, StatCard } from './shared';

/** FR-16 Tổng quan hôm nay — tự làm mới mỗi 30 giây, dùng tốt trên điện thoại. */
export function TodayReportPage() {
  const q = useQuery({ queryKey: ['reports', 'today'], queryFn: reportsApi.today, refetchInterval: 30_000 });

  if (q.isLoading) return <Loading />;
  if (q.isError) return <div className="p-4"><ErrorBox message={apiError(q.error).message} onRetry={() => q.refetch()} /></div>;
  const r = q.data!;

  const nowHour = new Date().getHours();
  const hourly = r.hourly.filter((h) => h.hour >= 8 || h.today > 0 || h.yesterday > 0).map((h) => ({ ...h, label: `${h.hour}h`, today: h.hour <= nowHour ? h.today : null }));
  const split = [
    { name: 'Tiền mặt', value: r.paymentSplit.cash, color: CHART.cash },
    { name: 'Chuyển khoản', value: r.paymentSplit.transfer, color: CHART.transfer },
  ];
  const splitTotal = split[0].value + split[1].value;

  return (
    <Page title="Tổng quan hôm nay" description={`Cập nhật lúc ${formatTime(r.generatedAt)} · tự làm mới mỗi 30 giây`} className="px-3 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Doanh thu đã thu" value={formatMoney(r.revenue.value)} change={r.revenue.changePercent} />
        <StatCard label="Tạm tính đang mở" value={formatMoney(r.openAmount.value)} change={r.openAmount.changePercent} />
        <StatCard label="Bàn đang ngồi" value={`${r.occupiedTables.value}/${r.occupiedTables.total}`} change={r.occupiedTables.changePercent} />
        <StatCard label="Số hóa đơn" value={r.bills.value} change={r.bills.changePercent} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Doanh thu theo giờ</CardTitle></CardHeader>
          <CardContent className="h-[260px] px-1 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={formatMoneyShort} tick={{ fontSize: 11 }} width={44} />
                <Tooltip formatter={(v: number) => formatMoney(v)} labelFormatter={(l) => `Khung ${l}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="yesterday" name="Hôm qua" fill={CHART.secondary} radius={[3, 3, 0, 0]} />
                <Bar dataKey="today" name="Hôm nay" fill={CHART.primary} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tiền mặt / Chuyển khoản</CardTitle></CardHeader>
          <CardContent>
            {splitTotal === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Chưa có thanh toán hôm nay</p>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-[160px] w-[160px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={split} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                        {split.map((s) => <Cell key={s.name} fill={s.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatMoney(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="grid gap-2 text-sm">
                  {split.map((s) => (
                    <li key={s.name}>
                      <div className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /> {s.name}</div>
                      <div className="font-semibold tabular-nums">{formatMoney(s.value)}</div>
                      <div className="text-xs text-muted-foreground">{Math.round((s.value / splitTotal) * 100)}%</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}

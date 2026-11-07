import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/reports';
import { apiError } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty, ErrorBox, Loading, Page } from '@/components/layout/Page';
import { daysAgo, formatDateTime, formatLiters, formatMinutes, formatMoney, formatNumber, formatPercent, toYmd } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DateRange } from './shared';

/** FR-17 Hao hụt keg: hao hụt = dung tích − đã bán; keg vượt ngưỡng tô đỏ. */
export function KegLossReportPage() {
  const [range, setRange] = useState({ from: daysAgo(29), to: toYmd(new Date()) });
  const [threshold, setThreshold] = useState('5');
  const t = Math.min(100, Math.max(0, Number(threshold) || 0));
  const q = useQuery({ queryKey: ['reports', 'keg-loss', range, t], queryFn: () => reportsApi.kegLoss({ ...range, threshold: t }) });

  return (
    <Page title="Hao hụt keg" description="Chỉ tính các keg đã hết (đã thay ra) trong khoảng ngày chọn." className="px-3 sm:px-6">
      <div className="mb-4">
        <DateRange from={range.from} to={range.to} onChange={setRange}>
          <div className="grid gap-1">
            <Label htmlFor="threshold" className="text-xs">Ngưỡng (%)</Label>
            <Input id="threshold" inputMode="decimal" className="w-24" value={threshold} onChange={(e) => setThreshold(e.target.value.replace(/[^\d.]/g, ''))} />
          </div>
        </DateRange>
      </div>

      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <ErrorBox message={apiError(q.error).message} />
      ) : (
        <>
          <Card className="mb-4 border-amber-300 bg-amber-50">
            <CardContent className="p-4 text-sm sm:text-base">
              Tổng hao hụt: <b>{formatNumber(q.data!.totalLossLiters, 1)} L</b> ≈ <b>{formatMoney(q.data!.totalLossAmount)}</b>
              <span className="ml-2 text-muted-foreground">({q.data!.kegs.filter((k) => k.overThreshold).length} keg vượt ngưỡng {formatPercent(t, 0)})</span>
            </CardContent>
          </Card>
          {q.data!.kegs.length === 0 ? (
            <Empty>Không có keg nào hết trong khoảng này</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã keg</TableHead>
                  <TableHead>Loại bia</TableHead>
                  <TableHead>Vòi</TableHead>
                  <TableHead className="text-right">Dung tích</TableHead>
                  <TableHead className="text-right">Đã bán</TableHead>
                  <TableHead className="text-right">Hao hụt</TableHead>
                  <TableHead className="text-right">Tỉ lệ</TableHead>
                  <TableHead>Thời gian dùng</TableHead>
                  <TableHead>Hết lúc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data!.kegs.map((k) => (
                  <TableRow key={k.kegId} className={cn(k.overThreshold && 'bg-red-50 text-red-800 hover:bg-red-100')} data-over={k.overThreshold || undefined}>
                    <TableCell className="font-mono font-medium">{k.code}</TableCell>
                    <TableCell>{k.beerName}</TableCell>
                    <TableCell>{k.tapName ?? '—'}</TableCell>
                    <TableCell className="text-right">{formatLiters(k.capacityMl)}</TableCell>
                    <TableCell className="text-right">{formatLiters(k.soldMl)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatLiters(k.lossMl)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatPercent(k.lossPercent)}</TableCell>
                    <TableCell>{formatMinutes(k.durationMinutes)}</TableCell>
                    <TableCell className="whitespace-nowrap">{k.emptiedAt ? formatDateTime(k.emptiedAt) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>Tổng hao hụt</TableCell>
                  <TableCell className="text-right">{formatNumber(q.data!.totalLossLiters, 1)} L</TableCell>
                  <TableCell colSpan={3}>≈ {formatMoney(q.data!.totalLossAmount)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </>
      )}
    </Page>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/reports';
import { apiError } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty, ErrorBox, Loading, Page } from '@/components/layout/Page';
import { REASON_LABEL, daysAgo, formatDateTime, formatMoney, toYmd } from '@/lib/format';
import type { Reason, VoidLogItem } from '@/types';
import { DateRange } from './shared';

const TYPE_LABEL: Record<VoidLogItem['type'], string> = { VOID: 'Hủy', DISCOUNT: 'Giảm món', BILL_DISCOUNT: 'Giảm hóa đơn' };

/** FR-18 Nhật ký hủy/giảm. */
export function VoidsReportPage() {
  const [range, setRange] = useState({ from: daysAgo(6), to: toYmd(new Date()) });
  const [staffId, setStaffId] = useState('');
  const [approverId, setApproverId] = useState('');
  const [reason, setReason] = useState('');
  const [type, setType] = useState('');
  const params = {
    ...range,
    staffId: staffId ? Number(staffId) : undefined,
    approverId: approverId ? Number(approverId) : undefined,
    reason: reason || undefined,
    type: type || undefined,
  };
  const q = useQuery({ queryKey: ['reports', 'voids', params], queryFn: () => reportsApi.voids(params), placeholderData: (prev) => prev });
  const people = q.data?.people ?? [];

  return (
    <Page title="Nhật ký hủy / giảm" className="px-3 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <DateRange from={range.from} to={range.to} onChange={setRange} />
        <Filter label="Nhân viên" value={staffId} onChange={setStaffId} options={people.map((p) => [String(p.id), p.fullName])} />
        <Filter label="Người duyệt" value={approverId} onChange={setApproverId} options={people.map((p) => [String(p.id), p.fullName])} />
        <Filter label="Lý do" value={reason} onChange={setReason} options={(Object.keys(REASON_LABEL) as Reason[]).map((r) => [r, REASON_LABEL[r]])} />
        <Filter label="Loại" value={type} onChange={setType} options={Object.entries(TYPE_LABEL)} />
      </div>

      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <ErrorBox message={apiError(q.error).message} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="Số lần" value={String(q.data!.count)} />
            <Mini label="Tổng tiền hủy/giảm" value={formatMoney(q.data!.totalAmount)} />
            <Mini label="Tiền hủy món" value={formatMoney(q.data!.voidAmount)} />
            <Mini label="Tiền giảm giá" value={formatMoney(q.data!.discountAmount)} />
          </div>
          {q.data!.items.length === 0 ? (
            <Empty>Không có lần hủy/giảm nào</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Bàn</TableHead>
                  <TableHead>Món</TableHead>
                  <TableHead className="text-right">SL</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Lý do</TableHead>
                  <TableHead>Người yêu cầu</TableHead>
                  <TableHead>Người duyệt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data!.items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(i.createdAt)}</TableCell>
                    <TableCell>{i.tableCode}</TableCell>
                    <TableCell>{i.itemName}</TableCell>
                    <TableCell className="text-right">{i.qty ?? '—'}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(i.amount)}</TableCell>
                    <TableCell><Badge variant={i.type === 'VOID' ? 'destructive' : 'warning'}>{TYPE_LABEL[i.type]}</Badge></TableCell>
                    <TableCell>
                      {i.reason ? REASON_LABEL[i.reason] : '—'}
                      {i.note && <div className="text-xs text-muted-foreground">{i.note}</div>}
                    </TableCell>
                    <TableCell>{i.requestedBy?.fullName ?? '—'}</TableCell>
                    <TableCell>{i.approvedBy?.fullName ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </Page>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      <NativeSelect className="w-[150px]" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Tất cả</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </NativeSelect>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

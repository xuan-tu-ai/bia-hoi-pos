import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { shiftsApi } from '@/api/shifts';
import { apiError } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty, ErrorBox, Loading, Page } from '@/components/layout/Page';
import { formatDateTime, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/auth';
import type { Shift } from '@/types';
import { qk } from './queries';

const digits = (s: string) => Number(s.replace(/\D/g, '')) || 0;
const moneyInput = (s: string) => (s ? digits(s).toLocaleString('vi-VN') : '');

/** FR-09 Mở / đóng ca. Đóng ca chỉ Quản lý ca / Chủ quán. */
export function ShiftPage() {
  const { user } = useAuth();
  const isManager = user?.role !== 'COUNTER';
  const current = useQuery({ queryKey: qk.shift, queryFn: shiftsApi.current, refetchInterval: 15_000 });
  const history = useQuery({ queryKey: qk.shifts, queryFn: shiftsApi.list, enabled: isManager });
  const [closed, setClosed] = useState<Shift | null>(null);

  return (
    <Page title="Ca làm việc" description="Theo dõi tiền trong két theo ca.">
      {closed ? (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Đã đóng ca</CardTitle>
            <CardDescription>Ca mở bởi {closed.staff.fullName} lúc {formatDateTime(closed.openedAt)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Row label="Tiền đầu ca" value={formatMoney(closed.openingCash)} />
            <Row label="Tiền mặt thu trong ca" value={formatMoney(closed.cashSales)} />
            <Row label="Chuyển khoản thu trong ca" value={formatMoney(closed.transferSales)} />
            <Row label="Tiền đếm được" value={formatMoney(closed.countedCash)} />
            <Row label="Tiền phải có" value={formatMoney(closed.expectedCash)} />
            <Row label="Chênh lệch" value={formatMoney(closed.difference)} strong danger={(closed.difference ?? 0) !== 0} />
            <Button className="mt-2" variant="outline" onClick={() => setClosed(null)}>Xong</Button>
          </CardContent>
        </Card>
      ) : current.isLoading ? (
        <Loading />
      ) : current.isError ? (
        <ErrorBox message={apiError(current.error).message} />
      ) : current.data ? (
        <CurrentShift shift={current.data} canClose={isManager} onClosed={setClosed} />
      ) : (
        <OpenShiftCard />
      )}

      {isManager && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Các ca gần đây</h2>
          {history.isLoading ? <Loading /> : history.data?.length ? <ShiftTable rows={history.data} /> : <Empty>Chưa có ca nào</Empty>}
        </div>
      )}
    </Page>
  );
}

function OpenShiftCard() {
  const qc = useQueryClient();
  const [cash, setCash] = useState('');
  const open = useMutation({
    mutationFn: () => shiftsApi.open(digits(cash)),
    onSuccess: () => {
      toast.success('Đã mở ca');
      qc.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (e) => toast.error(apiError(e).message),
  });
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Chưa có ca nào đang mở</CardTitle>
        <CardDescription>Đếm tiền trong két rồi nhập tiền đầu ca.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); open.mutate(); }}>
          <div className="grid gap-1.5">
            <Label htmlFor="opening">Tiền đầu ca</Label>
            <Input id="opening" inputMode="numeric" className="h-12 text-lg" value={moneyInput(cash)} onChange={(e) => setCash(e.target.value)} placeholder="0" />
          </div>
          <Button type="submit" disabled={open.isPending}>
            {open.isPending && <Loader2 className="animate-spin" />} Mở ca
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CurrentShift({ shift, canClose, onClosed }: { shift: Shift; canClose: boolean; onClosed: (s: Shift) => void }) {
  const qc = useQueryClient();
  const [counted, setCounted] = useState('');
  const close = useMutation({
    mutationFn: () => shiftsApi.close(shift.id, digits(counted)),
    onSuccess: (s) => {
      onClosed(s);
      toast.success('Đã đóng ca');
      qc.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (e) => toast.error(apiError(e).message),
  });
  const preview = counted ? digits(counted) - shift.expectedCash : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Ca đang mở <Badge variant="success">Đang mở</Badge></CardTitle>
          <CardDescription>Mở bởi {shift.staff.fullName} lúc {formatDateTime(shift.openedAt)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <Row label="Tiền đầu ca" value={formatMoney(shift.openingCash)} />
          <Row label="Tiền mặt thu trong ca" value={formatMoney(shift.cashSales)} />
          <Row label="Chuyển khoản thu trong ca" value={formatMoney(shift.transferSales)} />
          <div className="border-t pt-2">
            <Row label="Tiền mặt phải có trong két" value={formatMoney(shift.expectedCash)} strong />
          </div>
        </CardContent>
      </Card>

      {canClose ? (
        <Card>
          <CardHeader>
            <CardTitle>Đóng ca</CardTitle>
            <CardDescription>Chênh lệch = tiền đếm − (tiền đầu ca + tiền mặt thu trong ca)</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); close.mutate(); }}>
              <div className="grid gap-1.5">
                <Label htmlFor="counted">Tiền mặt đếm được</Label>
                <Input id="counted" inputMode="numeric" className="h-12 text-lg" value={moneyInput(counted)} onChange={(e) => setCounted(e.target.value)} placeholder="0" />
              </div>
              {preview != null && <Row label="Chênh lệch dự kiến" value={formatMoney(preview)} danger={preview !== 0} />}
              <Button type="submit" variant="destructive" disabled={!counted || close.isPending}>
                {close.isPending && <Loader2 className="animate-spin" />} Đóng ca
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">Chỉ Quản lý ca hoặc Chủ quán được đóng ca.</CardContent>
        </Card>
      )}
    </div>
  );
}

function ShiftTable({ rows }: { rows: Shift[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mở lúc</TableHead>
          <TableHead>Người mở</TableHead>
          <TableHead>Đóng lúc</TableHead>
          <TableHead className="text-right">Đầu ca</TableHead>
          <TableHead className="text-right">Tiền mặt</TableHead>
          <TableHead className="text-right">Chuyển khoản</TableHead>
          <TableHead className="text-right">Đếm được</TableHead>
          <TableHead className="text-right">Chênh lệch</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="whitespace-nowrap">{formatDateTime(s.openedAt)}</TableCell>
            <TableCell>{s.staff.fullName}</TableCell>
            <TableCell className="whitespace-nowrap">{s.closedAt ? formatDateTime(s.closedAt) : <Badge variant="success">Đang mở</Badge>}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(s.openingCash)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(s.cashSales)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(s.transferSales)}</TableCell>
            <TableCell className="text-right tabular-nums">{s.countedCash != null ? formatMoney(s.countedCash) : '—'}</TableCell>
            <TableCell className={cn('text-right font-medium tabular-nums', s.difference && s.difference !== 0 && 'text-destructive')}>
              {s.difference != null ? formatMoney(s.difference) : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Row({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div className={cn('flex justify-between', strong && 'text-base font-bold', danger && 'text-destructive')}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

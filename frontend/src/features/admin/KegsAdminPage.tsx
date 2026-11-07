import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, PackagePlus } from 'lucide-react';
import { kegsApi } from '@/api/kegs';
import { apiError } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty, ErrorBox, Loading, Page } from '@/components/layout/Page';
import { formatDate, formatLiters, formatMoney, toYmd } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { KegStatus } from '@/types';

const STATUS: Record<KegStatus, { label: string; variant: 'secondary' | 'success' | 'outline' }> = {
  IN_STOCK: { label: 'Trong kho', variant: 'secondary' },
  TAPPED: { label: 'Đang dùng', variant: 'success' },
  EMPTY: { label: 'Đã hết', variant: 'outline' },
};

/** FR-14 Nhập kho keg. */
export function KegsAdminPage() {
  const [status, setStatus] = useState<KegStatus | undefined>();
  const [receiving, setReceiving] = useState(false);
  const kegs = useQuery({ queryKey: ['kegs', status ?? 'all'], queryFn: () => kegsApi.list(status) });
  const s = kegs.data?.summary;

  const cards: { key: KegStatus | undefined; label: string; value?: number }[] = [
    { key: undefined, label: 'Tất cả', value: s ? s.inStock + s.tapped + s.empty : undefined },
    { key: 'IN_STOCK', label: 'Trong kho', value: s?.inStock },
    { key: 'TAPPED', label: 'Đang dùng', value: s?.tapped },
    { key: 'EMPTY', label: 'Đã hết', value: s?.empty },
  ];

  return (
    <Page title="Kho keg" actions={<Button onClick={() => setReceiving(true)}><PackagePlus /> Nhập keg</Button>}>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <button key={c.label} type="button" onClick={() => setStatus(c.key)} className="text-left">
            <Card className={cn('transition', status === c.key && 'border-primary ring-1 ring-primary')}>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">{c.label}</div>
                <div className="text-2xl font-bold">{c.value ?? '—'}</div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {kegs.isLoading ? (
        <Loading />
      ) : kegs.isError ? (
        <ErrorBox message={apiError(kegs.error).message} />
      ) : kegs.data!.items.length === 0 ? (
        <Empty>Không có keg nào</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã keg</TableHead>
              <TableHead>Loại bia</TableHead>
              <TableHead className="text-right">Dung tích</TableHead>
              <TableHead className="text-right">Giá nhập</TableHead>
              <TableHead>Ngày nhập</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Vòi</TableHead>
              <TableHead className="text-right">Đã bán</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kegs.data!.items.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="font-mono font-medium">{k.code}</TableCell>
                <TableCell>{k.beerName}</TableCell>
                <TableCell className="text-right">{formatLiters(k.capacityMl)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(k.cost)}</TableCell>
                <TableCell>{formatDate(k.receivedAt)}</TableCell>
                <TableCell><Badge variant={STATUS[k.status].variant}>{STATUS[k.status].label}</Badge></TableCell>
                <TableCell>{k.tap?.name ?? '—'}</TableCell>
                <TableCell className="text-right">{k.soldMl != null && k.status !== 'IN_STOCK' ? formatLiters(k.soldMl) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ReceiveDialog open={receiving} onClose={() => setReceiving(false)} />
    </Page>
  );
}

const schema = z.object({
  beerName: z.string().trim().min(1, 'Chưa nhập loại bia'),
  capacityMl: z.coerce.number().refine((v) => v === 30000 || v === 50000),
  cost: z.coerce.number().int().min(0, 'Giá không âm'),
  receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Chọn ngày nhập'),
  quantity: z.coerce.number().int().min(1, 'Ít nhất 1').max(50, 'Tối đa 50'),
});
type Form = z.infer<typeof schema>;

function ReceiveDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { beerName: 'Bia hơi Hà Nội', capacityMl: 50000, cost: 1500000, receivedAt: toYmd(new Date()), quantity: 1 },
  });
  const save = useMutation({
    mutationFn: kegsApi.receive,
    onSuccess: (created: unknown[]) => {
      toast.success(`Đã nhập ${created.length} keg`);
      qc.invalidateQueries({ queryKey: ['kegs'] });
      qc.invalidateQueries({ queryKey: ['taps'] });
      reset();
      onClose();
    },
    onError: (e) => toast.error(apiError(e).message),
  });
  const e = formState.errors;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nhập keg</DialogTitle></DialogHeader>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit((f) => save.mutate(f))}>
          <Field label="Loại bia" error={e.beerName?.message} className="sm:col-span-2"><Input {...register('beerName')} /></Field>
          <Field label="Dung tích">
            <NativeSelect {...register('capacityMl')}>
              <option value={50000}>50 L</option>
              <option value={30000}>30 L</option>
            </NativeSelect>
          </Field>
          <Field label="Giá nhập mỗi keg (₫)" error={e.cost?.message}><Input inputMode="numeric" {...register('cost')} /></Field>
          <Field label="Ngày nhập" error={e.receivedAt?.message}><Input type="date" {...register('receivedAt')} /></Field>
          <Field label="Số lượng" error={e.quantity?.message}><Input inputMode="numeric" {...register('quantity')} /></Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="animate-spin" />} Nhập kho</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

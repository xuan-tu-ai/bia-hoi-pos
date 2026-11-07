import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Beer, Loader2, RefreshCcw } from 'lucide-react';
import { kegsApi } from '@/api/kegs';
import { apiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, ErrorBox, Loading, Page } from '@/components/layout/Page';
import { formatDate, formatDuration, formatLiters, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TapInfo } from '@/types';
import { qk } from './queries';
import { useNow } from './useNow';

/** FR-10 Vòi bia & thay keg. */
export function TapsPage() {
  const taps = useQuery({ queryKey: qk.taps, queryFn: kegsApi.taps, refetchInterval: 10_000 });
  const now = useNow();
  const [changing, setChanging] = useState<TapInfo | null>(null);

  return (
    <Page title="Vòi bia" description="Số lít đã bán = tổng thể tích các món bia hơi đã gửi (trừ món hủy) kể từ khi gắn keg.">
      {taps.isLoading ? (
        <Loading />
      ) : taps.isError ? (
        <ErrorBox message={apiError(taps.error).message} onRetry={() => taps.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {taps.data!.taps.map((tap) => {
            const k = tap.currentKeg;
            const pct = k ? Math.min(100, k.percent) : 0;
            return (
              <Card key={tap.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-lg"><Beer className="h-5 w-5 text-primary" /> {tap.name}</CardTitle>
                  <Button variant="outline" onClick={() => setChanging(tap)}><RefreshCcw /> Thay keg</Button>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {k ? (
                    <>
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono text-sm font-semibold">{k.code}</span>
                        <span className="text-sm text-muted-foreground">{k.beerName}</span>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-sm">
                          <span>Đã bán <b>{formatLiters(k.soldMl)}</b> / {formatLiters(k.capacityMl)}</span>
                          <span className="font-semibold">{pct}%</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-muted">
                          <div className={cn('h-full rounded-full transition-all', pct >= 90 ? 'bg-destructive' : pct >= 75 ? 'bg-amber-500' : 'bg-green-600')} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Gắn lúc {formatTime(k.tappedAt)} {formatDate(k.tappedAt)} · {formatDuration(k.tappedAt, now)}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Chưa gắn keg</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <ChangeKegDialog tap={changing} stock={taps.data?.inStockKegs ?? []} onClose={() => setChanging(null)} />
    </Page>
  );
}

function ChangeKegDialog({ tap, stock, onClose }: { tap: TapInfo | null; stock: { id: number; code: string; beerName: string; capacityMl: number; receivedAt: string }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [kegId, setKegId] = useState<number | null>(null);
  const change = useMutation({
    mutationFn: () => kegsApi.changeKeg(tap!.id, kegId!),
    onSuccess: () => {
      toast.success(`Đã thay keg cho ${tap?.name}`);
      qc.invalidateQueries({ queryKey: qk.taps });
      qc.invalidateQueries({ queryKey: ['kegs'] });
      setKegId(null);
      onClose();
    },
    onError: (e) => toast.error(apiError(e).message),
  });

  return (
    <Dialog open={!!tap} onOpenChange={(o) => { if (!o) { setKegId(null); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thay keg — {tap?.name}</DialogTitle>
          <DialogDescription>
            {tap?.currentKeg ? `Keg ${tap.currentKeg.code} sẽ chuyển "Đã hết" (đã bán ${formatLiters(tap.currentKeg.soldMl)}).` : 'Vòi đang trống.'} Chọn keg mới trong kho:
          </DialogDescription>
        </DialogHeader>
        {stock.length === 0 ? (
          <Empty>Kho không còn keg nào. Nhờ Quản lý ca nhập kho keg.</Empty>
        ) : (
          <div className="grid max-h-[50vh] gap-2 overflow-y-auto">
            {stock.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKegId(k.id)}
                className={cn('flex items-center justify-between rounded-md border px-3 py-3 text-left text-sm', kegId === k.id ? 'border-primary bg-primary/10' : 'hover:bg-accent')}
              >
                <span className="font-mono font-semibold">{k.code}</span>
                <span>{k.beerName} · {formatLiters(k.capacityMl)}</span>
                <span className="text-xs text-muted-foreground">nhập {formatDate(k.receivedAt)}</span>
              </button>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
          <Button disabled={!kegId || change.isPending} onClick={() => change.mutate()}>
            {change.isPending && <Loader2 className="animate-spin" />} Xác nhận thay keg
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

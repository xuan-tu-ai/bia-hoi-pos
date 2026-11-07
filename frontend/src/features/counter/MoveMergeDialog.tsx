import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { tabsApi } from '@/api/tabs';
import { apiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loading } from '@/components/layout/Page';
import type { TabDetail } from '@/types';
import { useAreas, useSummary } from './queries';
import { TableTile } from './TableTile';
import { useNow } from './useNow';

export type MoveMode = 'move' | 'merge';

/**
 * FR-05: Chuyển bàn (chỉ chọn bàn trống) / Gộp bàn (chỉ chọn bàn đang có khách).
 * Bàn không hợp lệ bị mờ để không bấm nhầm; backend vẫn chặn.
 */
export function MoveMergeDialog({ tab, mode, onClose }: { tab: TabDetail; mode: MoveMode | null; onClose: () => void }) {
  const areas = useAreas();
  const summary = useSummary();
  const now = useNow();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [target, setTarget] = useState<number | null>(null);
  useEffect(() => setTarget(null), [mode]);

  const rows = summary.data?.tables ?? [];
  const targetRow = rows.find((r) => r.tableId === target);

  const run = useMutation({
    mutationFn: async (): Promise<{ tableCode: string; targetTabId?: number }> =>
      mode === 'move' ? tabsApi.move(tab.id, target!) : tabsApi.merge(tab.id, target!),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['tabs'] });
      onClose();
      if (res.targetTabId) {
        toast.success(`Đã gộp vào bàn ${res.tableCode}`);
        navigate(`/counter/tabs/${res.targetTabId}`, { replace: true });
      } else {
        toast.success(`Đã chuyển sang bàn ${res.tableCode}`);
      }
    },
    onError: (e) => toast.error(apiError(e).message),
  });

  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{mode === 'move' ? `Chuyển bàn ${tab.table.code}` : `Gộp bàn ${tab.table.code} vào bàn khác`}</DialogTitle>
          <DialogDescription>
            {mode === 'move'
              ? 'Chọn một bàn đang trống. Cả phiên sẽ chuyển sang bàn đó.'
              : 'Chọn một bàn đang có khách. Toàn bộ món của bàn này chuyển sang bàn đó; bàn này trở về trống.'}
          </DialogDescription>
        </DialogHeader>

        {summary.isLoading || areas.isLoading ? (
          <Loading />
        ) : (
          <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto">
            {(areas.data ?? []).map((a) => (
              <section key={a.id}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{a.name}</h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1.5">
                  {rows
                    .filter((r) => r.areaId === a.id)
                    .map((r) => {
                      const self = r.tableId === tab.table.id;
                      const ok = !self && (mode === 'move' ? r.status === 'EMPTY' : r.status !== 'EMPTY');
                      return <TableTile key={r.tableId} row={r} now={now} disabled={!ok} selected={target === r.tableId} onClick={() => setTarget(r.tableId)} />;
                    })}
                </div>
              </section>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
          <Button disabled={!target || run.isPending} onClick={() => run.mutate()}>
            {run.isPending && <Loader2 className="animate-spin" />}
            {targetRow ? (mode === 'move' ? `Chuyển sang bàn ${targetRow.code}` : `Gộp vào bàn ${targetRow.code}`) : 'Chọn bàn đích'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

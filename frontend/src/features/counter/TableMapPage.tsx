import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Minus, Plus } from 'lucide-react';
import { tabsApi } from '@/api/tabs';
import { apiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorBox, Loading } from '@/components/layout/Page';
import { formatMoney } from '@/lib/format';
import type { TableSummaryRow } from '@/types';
import { qk, useAreas, useSummary } from './queries';
import { TableLegend, TableTile } from './TableTile';
import { useNow } from './useNow';

const ALL = 'all';

/** FR-02 Sơ đồ bàn + FR-03 Mở phiên bàn. */
export function TableMapPage() {
  const areas = useAreas();
  const summary = useSummary();
  const now = useNow();
  const navigate = useNavigate();
  const [areaTab, setAreaTab] = useState<string>(ALL);
  const [opening, setOpening] = useState<TableSummaryRow | null>(null);

  const byArea = useMemo(() => {
    const m = new Map<number, TableSummaryRow[]>();
    for (const t of summary.data?.tables ?? []) m.set(t.areaId, [...(m.get(t.areaId) ?? []), t]);
    return m;
  }, [summary.data]);

  if (areas.isLoading || summary.isLoading) return <Loading />;
  if (areas.isError || summary.isError) return <div className="p-6"><ErrorBox message="Không tải được sơ đồ bàn" onRetry={() => summary.refetch()} /></div>;

  const s = summary.data!;
  const shownAreas = (areas.data ?? []).filter((a) => areaTab === ALL || String(a.id) === areaTab);

  const onTable = (row: TableSummaryRow) => {
    if (row.status === 'EMPTY') setOpening(row);
    else navigate(`/counter/tabs/${row.tabId}`);
  };

  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <h1 className="text-xl font-bold">Sơ đồ bàn</h1>
          <div className="text-sm">
            Đang ngồi <b className="text-base">{s.occupied}</b>/{s.totalTables}
          </div>
          <div className="text-sm">
            Tạm tính đang mở: <b className="text-base">{formatMoney(s.openAmount)}</b>
          </div>
        </div>
        <TableLegend />
      </div>

      <Tabs value={areaTab} onValueChange={setAreaTab} className="mb-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value={ALL}>Tất cả</TabsTrigger>
          {(areas.data ?? []).map((a) => {
            const rows = byArea.get(a.id) ?? [];
            const busy = rows.filter((r) => r.status !== 'EMPTY').length;
            return (
              <TabsTrigger key={a.id} value={String(a.id)}>
                {a.name} <span className="ml-1.5 text-xs text-muted-foreground">{busy}/{rows.length}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-4">
        {shownAreas.map((a) => (
          <section key={a.id}>
            {areaTab === ALL && <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{a.name}</h2>}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
              {(byArea.get(a.id) ?? []).map((row) => (
                <TableTile key={row.tableId} row={row} now={now} onClick={() => onTable(row)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <OpenTabDialog
        table={opening}
        onClose={() => setOpening(null)}
        onOpened={(tabId) => navigate(`/counter/tabs/${tabId}`)}
      />
    </div>
  );
}

function OpenTabDialog({ table, onClose, onOpened }: { table: TableSummaryRow | null; onClose: () => void; onOpened: (tabId: number) => void }) {
  const qc = useQueryClient();
  const [guests, setGuests] = useState('');
  const open = useMutation({
    mutationFn: () => tabsApi.open(table!.tableId, guests ? Number(guests) : null),
    onSuccess: (tab) => {
      qc.invalidateQueries({ queryKey: qk.summary });
      setGuests('');
      onOpened(tab.id);
    },
    onError: (err) => {
      const e = apiError(err);
      if (e.code === 'TABLE_ALREADY_OPEN') {
        // FR-03: máy khác vừa mở → đưa vào phiên đó
        toast.info('Bàn đã được mở');
        const tabId = (e.details as { tabId?: number } | undefined)?.tabId;
        if (tabId) onOpened(tabId);
        return;
      }
      toast.error(e.message);
    },
  });

  const n = Number(guests) || 0;
  return (
    <Dialog open={!!table} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mở bàn {table?.code}</DialogTitle>
          <DialogDescription>Nhập số khách (không bắt buộc).</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            open.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="guests">Số khách</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" onClick={() => setGuests(String(Math.max(0, n - 1) || ''))} aria-label="Bớt khách">
                <Minus />
              </Button>
              <Input id="guests" inputMode="numeric" className="text-center text-lg" value={guests} onChange={(e) => setGuests(e.target.value.replace(/\D/g, '').slice(0, 3))} autoFocus />
              <Button type="button" variant="outline" size="icon" onClick={() => setGuests(String(n + 1))} aria-label="Thêm khách">
                <Plus />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={open.isPending}>
              {open.isPending && <Loader2 className="animate-spin" />} Mở bàn
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

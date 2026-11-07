import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { areasApi } from '@/api/areas';
import { tabsApi } from '@/api/tabs';
import { apiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Empty, ErrorBox, Loading, Page } from '@/components/layout/Page';
import { cn } from '@/lib/utils';
import type { Area, DiningTable } from '@/types';

type AreaForm = { id?: number; name: string; sortOrder: number };
type TableForm = { id?: number; areaId: number; code: string; sortOrder: number };
type Confirm = { title: string; message: string; run: () => Promise<unknown> };

/** FR-12 Khu & bàn. */
export function AreasAdminPage() {
  const qc = useQueryClient();
  const areas = useQuery({ queryKey: ['areas'], queryFn: areasApi.list });
  const summary = useQuery({ queryKey: ['tabs', 'summary'], queryFn: tabsApi.summary, refetchInterval: 10_000 });
  const [areaForm, setAreaForm] = useState<AreaForm | null>(null);
  const [tableForm, setTableForm] = useState<TableForm | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const busy = new Set((summary.data?.tables ?? []).filter((t) => t.status !== 'EMPTY').map((t) => t.tableId));
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['areas'] });
    qc.invalidateQueries({ queryKey: ['tabs', 'summary'] });
  };
  const onError = (e: unknown) => toast.error(apiError(e).message);

  const saveArea = useMutation({
    mutationFn: (f: AreaForm) => (f.id ? areasApi.updateArea(f.id, { name: f.name, sortOrder: f.sortOrder }) : areasApi.createArea({ name: f.name, sortOrder: f.sortOrder })),
    onSuccess: () => { toast.success('Đã lưu khu'); refresh(); setAreaForm(null); },
    onError,
  });
  const saveTable = useMutation({
    mutationFn: (f: TableForm) =>
      f.id ? areasApi.updateTable(f.id, { code: f.code, areaId: f.areaId, sortOrder: f.sortOrder }) : areasApi.createTable({ code: f.code, areaId: f.areaId, sortOrder: f.sortOrder }),
    onSuccess: () => { toast.success('Đã lưu bàn'); refresh(); setTableForm(null); },
    onError,
  });
  const runConfirm = useMutation({
    mutationFn: (c: Confirm) => c.run(),
    onSuccess: () => { toast.success('Đã xóa'); refresh(); setConfirm(null); },
    onError: (e) => { onError(e); setConfirm(null); },
  });

  const list = [...(areas.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const swapArea = (i: number, dir: -1 | 1) => {
    const a = list[i];
    const b = list[i + dir];
    if (!a || !b) return;
    saveArea.mutate({ id: a.id, name: a.name, sortOrder: b.sortOrder === a.sortOrder ? a.sortOrder + dir : b.sortOrder });
    saveArea.mutate({ id: b.id, name: b.name, sortOrder: a.sortOrder });
  };

  return (
    <Page
      title="Khu & bàn"
      description="Không xóa được bàn đang có khách, không xóa được khu còn bàn."
      actions={<Button onClick={() => setAreaForm({ name: '', sortOrder: (list.at(-1)?.sortOrder ?? 0) + 1 })}><Plus /> Thêm khu</Button>}
    >
      {areas.isLoading ? (
        <Loading />
      ) : areas.isError ? (
        <ErrorBox message={apiError(areas.error).message} />
      ) : list.length === 0 ? (
        <Empty>Chưa có khu nào</Empty>
      ) : (
        <div className="grid gap-4">
          {list.map((a: Area, i) => {
            const tables = a.tables ?? [];
            return (
              <Card key={a.id}>
                <CardHeader className="flex-row flex-wrap items-center gap-2 space-y-0">
                  <CardTitle className="mr-auto text-lg">{a.name} <span className="text-sm font-normal text-muted-foreground">· {tables.length} bàn</span></CardTitle>
                  <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => swapArea(i, -1)} aria-label="Lên"><ArrowUp /></Button>
                  <Button size="sm" variant="ghost" disabled={i === list.length - 1} onClick={() => swapArea(i, 1)} aria-label="Xuống"><ArrowDown /></Button>
                  <Button size="sm" variant="outline" onClick={() => setAreaForm({ id: a.id, name: a.name, sortOrder: a.sortOrder })}><Pencil /> Sửa</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setConfirm({ title: `Xóa khu ${a.name}?`, message: 'Chỉ xóa được khu không còn bàn.', run: () => areasApi.deleteArea(a.id) })}
                  >
                    <Trash2 /> Xóa
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const max = Math.max(0, ...tables.map((t) => Number(t.code) || 0));
                      setTableForm({ areaId: a.id, code: max ? String(max + 1) : '', sortOrder: (tables.at(-1)?.sortOrder ?? 0) + 1 });
                    }}
                  >
                    <Plus /> Thêm bàn
                  </Button>
                </CardHeader>
                <CardContent>
                  {tables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Khu chưa có bàn</p>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
                      {tables.map((t: DiningTable) => (
                        <div key={t.id} className={cn('flex items-center justify-between rounded-md border px-2 py-1.5', busy.has(t.id) && 'border-green-600/40 bg-green-50')}>
                          <span className="text-lg font-bold">{t.code}</span>
                          <span className="flex">
                            <button className="rounded p-1.5 hover:bg-accent" aria-label={`Sửa bàn ${t.code}`} onClick={() => setTableForm({ id: t.id, areaId: a.id, code: t.code, sortOrder: t.sortOrder })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                              aria-label={`Xóa bàn ${t.code}`}
                              onClick={() => setConfirm({ title: `Xóa bàn ${t.code}?`, message: 'Bàn đã có lịch sử sẽ được ẩn thay vì xóa hẳn.', run: () => areasApi.deleteTable(t.id) })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Thêm/sửa khu */}
      <Dialog open={!!areaForm} onOpenChange={(o) => !o && setAreaForm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{areaForm?.id ? 'Sửa khu' : 'Thêm khu'}</DialogTitle></DialogHeader>
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (areaForm?.name.trim()) saveArea.mutate({ ...areaForm, name: areaForm.name.trim() }); }}>
            <Field label="Tên khu"><Input autoFocus value={areaForm?.name ?? ''} onChange={(e) => setAreaForm((f) => f && { ...f, name: e.target.value })} /></Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAreaForm(null)}>Hủy</Button>
              <Button type="submit" disabled={!areaForm?.name.trim() || saveArea.isPending}>Lưu</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Thêm/sửa bàn */}
      <Dialog open={!!tableForm} onOpenChange={(o) => !o && setTableForm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{tableForm?.id ? 'Sửa bàn' : 'Thêm bàn'}</DialogTitle></DialogHeader>
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (tableForm?.code.trim()) saveTable.mutate({ ...tableForm, code: tableForm.code.trim() }); }}>
            <Field label="Số bàn"><Input autoFocus value={tableForm?.code ?? ''} onChange={(e) => setTableForm((f) => f && { ...f, code: e.target.value })} /></Field>
            <Field label="Khu">
              <NativeSelect value={tableForm?.areaId ?? ''} onChange={(e) => setTableForm((f) => f && { ...f, areaId: Number(e.target.value) })}>
                {list.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Thứ tự hiển thị"><Input inputMode="numeric" value={tableForm?.sortOrder ?? 0} onChange={(e) => setTableForm((f) => f && { ...f, sortOrder: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTableForm(null)}>Hủy</Button>
              <Button type="submit" disabled={!tableForm?.code.trim() || saveTable.isPending}>Lưu</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Xác nhận xóa */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Không</Button>
            <Button variant="destructive" disabled={runConfirm.isPending} onClick={() => confirm && runConfirm.mutate(confirm)}>Xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

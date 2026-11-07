import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { happyHoursApi, type HappyHourInput } from '@/api/happy-hours';
import { menuApi } from '@/api/menu';
import { apiError } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Empty, ErrorBox, Loading, Page } from '@/components/layout/Page';
import { WEEKDAY_LABEL, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { HappyHour } from '@/types';

const key = ['admin', 'happy-hours'] as const;

/** FR-15 Giá giờ vàng. Giá ưu đãi được chốt khi gửi lượt gọi trong khung giờ đang bật. */
export function HappyHoursAdminPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: key, queryFn: happyHoursApi.list });
  const [editing, setEditing] = useState<HappyHour | 'new' | null>(null);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['menu'] });
  };

  const toggle = useMutation({
    mutationFn: (h: HappyHour) => happyHoursApi.update(h.id, { enabled: !h.enabled }),
    onSuccess: invalidate,
    onError: (e) => toast.error(apiError(e).message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => happyHoursApi.remove(id),
    onSuccess: () => { toast.success('Đã xóa khung giờ'); invalidate(); },
    onError: (e) => toast.error(apiError(e).message),
  });

  return (
    <Page title="Giờ vàng" description="Gửi món trong khung giờ đang bật → giá ưu đãi; ngoài khung → giá thường." actions={<Button onClick={() => setEditing('new')}><Plus /> Thêm khung giờ</Button>}>
      {list.isLoading ? (
        <Loading />
      ) : list.isError ? (
        <ErrorBox message={apiError(list.error).message} />
      ) : list.data!.length === 0 ? (
        <Empty>Chưa có khung giờ vàng nào</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.data!.map((h) => (
            <Card key={h.id} className={cn(!h.enabled && 'opacity-60')}>
              <CardHeader className="flex-row items-start gap-2 space-y-0">
                <div className="mr-auto">
                  <CardTitle className="flex items-center gap-2">{h.name} {h.activeNow && <Badge variant="warning">Đang áp dụng</Badge>}</CardTitle>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {h.startTime} – {h.endTime} · {h.weekdays.map((d) => WEEKDAY_LABEL[d]).join(', ')}
                  </div>
                </div>
                <Switch checked={h.enabled} onCheckedChange={() => toggle.mutate(h)} aria-label="Bật / tắt" />
              </CardHeader>
              <CardContent className="grid gap-3">
                <ul className="divide-y rounded-md border text-sm">
                  {h.prices.map((p) => (
                    <li key={p.menuItemId} className="flex justify-between px-3 py-1.5">
                      <span>{p.name}</span>
                      <span>
                        <s className="mr-2 text-muted-foreground">{formatMoney(p.regularPrice)}</s>
                        <b className="text-amber-700">{formatMoney(p.price)}</b>
                      </span>
                    </li>
                  ))}
                  {h.prices.length === 0 && <li className="px-3 py-2 text-muted-foreground">Chưa chọn món</li>}
                </ul>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(h)}><Pencil /> Sửa</Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => remove.mutate(h.id)}><Trash2 /> Xóa</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <HappyHourDialog value={editing} onClose={() => setEditing(null)} onSaved={invalidate} />
    </Page>
  );
}

function HappyHourDialog({ value, onClose, onSaved }: { value: HappyHour | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const items = useQuery({ queryKey: ['admin', 'menu-items', false], queryFn: () => menuApi.items() });
  const isNew = value === 'new';
  const [form, setForm] = useState<HappyHourInput>({ name: '', weekdays: [1, 2, 3, 4, 5], startTime: '16:00', endTime: '18:00', enabled: true, prices: [] });
  const [addItem, setAddItem] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    setErr(null);
    setAddItem('');
    if (value === 'new') setForm({ name: '', weekdays: [1, 2, 3, 4, 5], startTime: '16:00', endTime: '18:00', enabled: true, prices: [] });
    else setForm({ name: value.name, weekdays: value.weekdays, startTime: value.startTime, endTime: value.endTime, enabled: value.enabled, prices: value.prices.map((p) => ({ menuItemId: p.menuItemId, price: p.price })) });
  }, [value]);

  const save = useMutation({
    mutationFn: () => (isNew ? happyHoursApi.create(form) : happyHoursApi.update((value as HappyHour).id, form)),
    onSuccess: () => { toast.success('Đã lưu khung giờ'); onSaved(); onClose(); },
    onError: (e) => setErr(apiError(e).message),
  });

  const nameOf = (id: number) => items.data?.find((i) => i.id === id);
  const toggleDay = (d: number) => setForm((f) => ({ ...f, weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d].sort() }));

  const submit = () => {
    if (!form.name.trim()) return setErr('Chưa nhập tên khung giờ');
    if (form.weekdays.length === 0) return setErr('Chọn ít nhất một thứ');
    if (form.startTime === form.endTime) return setErr('Giờ bắt đầu và kết thúc không được trùng');
    if (form.prices.length === 0) return setErr('Chọn ít nhất một món');
    setErr(null);
    save.mutate();
  };

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{isNew ? 'Thêm khung giờ vàng' : 'Sửa khung giờ vàng'}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Tên"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="vd Giờ vàng chiều" /></Field>
          <div className="grid gap-1.5">
            <Label>Các thứ trong tuần</Label>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button key={d} type="button" onClick={() => toggleDay(d)} className={cn('h-10 w-12 rounded-md border text-sm font-medium', form.weekdays.includes(d) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent')}>
                  {WEEKDAY_LABEL[d]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bắt đầu"><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></Field>
            <Field label="Kết thúc"><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></Field>
          </div>
          <div className="grid gap-1.5">
            <Label>Món & giá ưu đãi</Label>
            <ul className="grid gap-1.5">
              {form.prices.map((p, i) => (
                <li key={p.menuItemId} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm">
                    {nameOf(p.menuItemId)?.name} <span className="text-xs text-muted-foreground">(thường {formatMoney(nameOf(p.menuItemId)?.price)})</span>
                  </span>
                  <Input
                    className="w-32"
                    inputMode="numeric"
                    value={p.price}
                    onChange={(e) => setForm((f) => ({ ...f, prices: f.prices.map((x, j) => (j === i ? { ...x, price: Number(e.target.value.replace(/\D/g, '')) || 0 } : x)) }))}
                  />
                  <Button type="button" size="icon" variant="ghost" onClick={() => setForm((f) => ({ ...f, prices: f.prices.filter((_, j) => j !== i) }))} aria-label="Bỏ món"><X /></Button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <NativeSelect value={addItem} onChange={(e) => setAddItem(e.target.value)}>
                <option value="">— Thêm món —</option>
                {items.data?.filter((i) => !form.prices.some((p) => p.menuItemId === i.id)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </NativeSelect>
              <Button
                type="button"
                variant="outline"
                disabled={!addItem}
                onClick={() => {
                  const it = nameOf(Number(addItem));
                  if (!it) return;
                  setForm((f) => ({ ...f, prices: [...f.prices, { menuItemId: it.id, price: it.price }] }));
                  setAddItem('');
                }}
              >
                <Plus /> Thêm
              </Button>
            </div>
          </div>
          {err && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending && <Loader2 className="animate-spin" />} Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

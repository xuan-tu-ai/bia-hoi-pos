import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Search } from 'lucide-react';
import { menuApi, type MenuItemInput } from '@/api/menu';
import { kegsApi } from '@/api/kegs';
import { apiError } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Empty, ErrorBox, Loading, Page } from '@/components/layout/Page';
import { formatMoney } from '@/lib/format';
import type { KitchenStation, MenuGroup, MenuItem } from '@/types';

const keys = { items: ['admin', 'menu-items'] as const, groups: ['admin', 'menu-groups'] as const, stations: ['admin', 'stations'] as const };

/** FR-11 Thực đơn & khu chế biến. */
export function MenuAdminPage() {
  return (
    <Page title="Thực đơn" description="Món đã từng bán không xóa được, chỉ ẩn. Đổi giá không ảnh hưởng các lượt đã gửi.">
      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Món</TabsTrigger>
          <TabsTrigger value="groups">Nhóm món</TabsTrigger>
          <TabsTrigger value="stations">Khu chế biến</TabsTrigger>
        </TabsList>
        <TabsContent value="items"><ItemsTab /></TabsContent>
        <TabsContent value="groups"><NamedListTab kind="group" /></TabsContent>
        <TabsContent value="stations"><NamedListTab kind="station" /></TabsContent>
      </Tabs>
    </Page>
  );
}

// Món

function ItemsTab() {
  const qc = useQueryClient();
  const [showHidden, setShowHidden] = useState(false);
  const items = useQuery({ queryKey: [...keys.items, showHidden], queryFn: () => menuApi.items({ includeInactive: showHidden }) });
  const groups = useQuery({ queryKey: keys.groups, queryFn: menuApi.groups });
  const [groupId, setGroupId] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null);

  const toggle = useMutation({
    mutationFn: ({ id, available }: { id: number; available: boolean }) => menuApi.updateItem(id, { available }),
    onSuccess: (it) => {
      toast.success(it.available ? `"${it.name}" còn món` : `"${it.name}" đã hết món`);
      qc.invalidateQueries({ queryKey: keys.items });
      qc.invalidateQueries({ queryKey: ['menu'] });
    },
    onError: (e) => toast.error(apiError(e).message),
  });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items.data ?? []).filter(
      (i) => (!groupId || String(i.groupId) === groupId) && (!needle || i.name.toLowerCase().includes(needle) || i.shortcut.startsWith(needle)),
    );
  }, [items.data, groupId, q]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Tìm theo tên hoặc mã tắt" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <NativeSelect className="w-44" value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Lọc theo nhóm">
          <option value="">Tất cả nhóm</option>
          {groups.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showHidden} onCheckedChange={setShowHidden} /> Hiện món đã ẩn
        </label>
        <Button onClick={() => setEditing('new')}><Plus /> Thêm món</Button>
      </div>

      {items.isLoading ? (
        <Loading />
      ) : items.isError ? (
        <ErrorBox message={apiError(items.error).message} />
      ) : rows.length === 0 ? (
        <Empty>Không có món nào</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên món</TableHead>
              <TableHead>Mã tắt</TableHead>
              <TableHead>Nhóm</TableHead>
              <TableHead className="text-right">Giá</TableHead>
              <TableHead>Đơn vị</TableHead>
              <TableHead>Khu chế biến</TableHead>
              <TableHead>Còn / Hết</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((i) => (
              <TableRow key={i.id} className={i.active ? '' : 'opacity-50'}>
                <TableCell className="font-medium">
                  {i.name}
                  {i.beerVolumeMl && <Badge variant="warning" className="ml-2">Bia hơi {i.beerVolumeMl} ml · {i.defaultTap?.name}</Badge>}
                  {!i.active && <Badge variant="secondary" className="ml-2">Đã ẩn</Badge>}
                </TableCell>
                <TableCell className="font-mono">{i.shortcut}</TableCell>
                <TableCell>{i.group.name}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(i.price)}</TableCell>
                <TableCell>{i.unit}</TableCell>
                <TableCell>{i.station.name}</TableCell>
                <TableCell>
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={i.available} onCheckedChange={(v) => toggle.mutate({ id: i.id, available: v })} aria-label={`Còn món ${i.name}`} />
                    {i.available ? 'Còn' : 'Hết món'}
                  </label>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(i)}><Pencil /> Sửa</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ItemDialog item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

const itemSchema = z
  .object({
    name: z.string().trim().min(1, 'Chưa nhập tên món'),
    shortcut: z.string().trim().toLowerCase().min(1, 'Chưa nhập mã tắt').regex(/^[a-z0-9]+$/, 'Chỉ chữ không dấu và số'),
    groupId: z.coerce.number().int().positive('Chọn nhóm'),
    price: z.coerce.number().int('Giá là số nguyên').min(0, 'Giá không âm'),
    unit: z.string().trim().min(1, 'Chưa nhập đơn vị'),
    stationId: z.coerce.number().int().positive('Chọn khu chế biến'),
    isBeer: z.boolean(),
    beerVolumeMl: z.coerce.number().int().optional(),
    defaultTapId: z.coerce.number().int().optional(),
    available: z.boolean(),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (!v.isBeer) return;
    if (!v.beerVolumeMl || v.beerVolumeMl <= 0) ctx.addIssue({ code: 'custom', path: ['beerVolumeMl'], message: 'Nhập thể tích (ml)' });
    if (!v.defaultTapId) ctx.addIssue({ code: 'custom', path: ['defaultTapId'], message: 'Chọn vòi mặc định' });
  });
type ItemForm = z.infer<typeof itemSchema>;

function ItemDialog({ item, onClose }: { item: MenuItem | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const groups = useQuery({ queryKey: keys.groups, queryFn: menuApi.groups });
  const stations = useQuery({ queryKey: keys.stations, queryFn: menuApi.stations });
  const taps = useQuery({ queryKey: ['taps'], queryFn: kegsApi.taps });
  const isNew = item === 'new';
  const { register, handleSubmit, reset, watch, formState, setError } = useForm<ItemForm>({ resolver: zodResolver(itemSchema) });

  useEffect(() => {
    if (!item) return;
    const it = item === 'new' ? null : item;
    reset({
      name: it?.name ?? '',
      shortcut: it?.shortcut ?? '',
      groupId: it?.groupId ?? groups.data?.[0]?.id ?? 0,
      price: it?.price ?? 0,
      unit: it?.unit ?? 'đĩa',
      stationId: it?.stationId ?? stations.data?.[0]?.id ?? 0,
      isBeer: !!it?.beerVolumeMl,
      beerVolumeMl: it?.beerVolumeMl ?? undefined,
      defaultTapId: it?.defaultTapId ?? undefined,
      available: it?.available ?? true,
      active: it?.active ?? true,
    });
  }, [item, reset, groups.data, stations.data]);

  const save = useMutation({
    mutationFn: (f: ItemForm) => {
      const body: MenuItemInput = {
        name: f.name,
        shortcut: f.shortcut,
        groupId: f.groupId,
        price: f.price,
        unit: f.unit,
        stationId: f.stationId,
        beerVolumeMl: f.isBeer ? f.beerVolumeMl : null,
        defaultTapId: f.isBeer ? f.defaultTapId : null,
        available: f.available,
        active: f.active,
      };
      return isNew ? menuApi.createItem(body) : menuApi.updateItem((item as MenuItem).id, body);
    },
    onSuccess: () => {
      toast.success(isNew ? 'Đã thêm món' : 'Đã lưu món');
      qc.invalidateQueries({ queryKey: keys.items });
      qc.invalidateQueries({ queryKey: ['menu'] });
      onClose();
    },
    onError: (e) => {
      const err = apiError(e);
      if (err.code === 'DUPLICATE_SHORTCUT') setError('shortcut', { message: err.message });
      else toast.error(err.message);
    },
  });

  const isBeer = watch('isBeer');
  const e = formState.errors;
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{isNew ? 'Thêm món' : 'Sửa món'}</DialogTitle></DialogHeader>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit((f) => save.mutate(f))}>
          <Field label="Tên món" error={e.name?.message} className="sm:col-span-2"><Input {...register('name')} autoFocus /></Field>
          <Field label="Mã tắt" error={e.shortcut?.message}><Input className="font-mono" {...register('shortcut')} /></Field>
          <Field label="Giá (₫)" error={e.price?.message}><Input inputMode="numeric" {...register('price')} /></Field>
          <Field label="Nhóm" error={e.groupId?.message}>
            <NativeSelect {...register('groupId')}>{groups.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</NativeSelect>
          </Field>
          <Field label="Đơn vị" error={e.unit?.message}><Input {...register('unit')} /></Field>
          <Field label="Khu chế biến" error={e.stationId?.message} className="sm:col-span-2">
            <NativeSelect {...register('stationId')}>{stations.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect>
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="h-4 w-4" {...register('isBeer')} /> Là bia hơi (tính vào số lít bán của keg)
          </label>
          {isBeer && (
            <>
              <Field label="Thể tích (ml)" error={e.beerVolumeMl?.message}><Input inputMode="numeric" placeholder="vd 500" {...register('beerVolumeMl')} /></Field>
              <Field label="Vòi mặc định" error={e.defaultTapId?.message}>
                <NativeSelect {...register('defaultTapId')}>
                  <option value="">— Chọn vòi —</option>
                  {taps.data?.taps.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </NativeSelect>
              </Field>
            </>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" {...register('available')} /> Còn món</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" {...register('active')} /> Đang bán (bỏ chọn = ẩn món)</label>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="animate-spin" />} Lưu</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Nhóm món & khu chế biến (cùng dạng: tên + thứ tự)

function NamedListTab({ kind }: { kind: 'group' | 'station' }) {
  const qc = useQueryClient();
  const key = kind === 'group' ? keys.groups : keys.stations;
  const list = useQuery<(MenuGroup | KitchenStation)[]>({ queryKey: key, queryFn: kind === 'group' ? menuApi.groups : menuApi.stations });
  const [editing, setEditing] = useState<{ id?: number; name: string; sortOrder: number } | null>(null);
  const label = kind === 'group' ? 'nhóm món' : 'khu chế biến';

  const save = useMutation({
    mutationFn: (v: { id?: number; name: string; sortOrder: number }) => {
      const body = { name: v.name, sortOrder: v.sortOrder };
      if (kind === 'group') return v.id ? menuApi.updateGroup(v.id, body) : menuApi.createGroup(body);
      return v.id ? menuApi.updateStation(v.id, body) : menuApi.createStation(body);
    },
    onSuccess: () => {
      toast.success('Đã lưu');
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: keys.items });
      qc.invalidateQueries({ queryKey: ['menu'] });
      setEditing(null);
    },
    onError: (e) => toast.error(apiError(e).message),
  });

  const rows = [...(list.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const move = (idx: number, dir: -1 | 1) => {
    const a = rows[idx];
    const b = rows[idx + dir];
    if (!a || !b) return;
    // đổi chỗ thứ tự hai dòng
    save.mutate({ id: a.id, name: a.name, sortOrder: b.sortOrder === a.sortOrder ? a.sortOrder + dir : b.sortOrder });
    save.mutate({ id: b.id, name: b.name, sortOrder: a.sortOrder });
  };

  return (
    <div className="grid max-w-2xl gap-3">
      <div><Button onClick={() => setEditing({ name: '', sortOrder: (rows.at(-1)?.sortOrder ?? 0) + 1 })}><Plus /> Thêm {label}</Button></div>
      {list.isLoading ? (
        <Loading />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Thứ tự</TableHead>
              <TableHead>Tên</TableHead>
              {kind === 'group' && <TableHead>Số món</TableHead>}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, idx) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={idx === 0} onClick={() => move(idx, -1)} aria-label="Lên">↑</Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={idx === rows.length - 1} onClick={() => move(idx, 1)} aria-label="Xuống">↓</Button>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                {kind === 'group' && <TableCell>{(r as MenuGroup).itemCount}</TableCell>}
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ id: r.id, name: r.name, sortOrder: r.sortOrder })}><Pencil /> Sửa</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing?.id ? `Sửa ${label}` : `Thêm ${label}`}</DialogTitle></DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (editing?.name.trim()) save.mutate({ ...editing, name: editing.name.trim() });
            }}
          >
            <Field label="Tên"><Input autoFocus value={editing?.name ?? ''} onChange={(e) => setEditing((v) => v && { ...v, name: e.target.value })} /></Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Hủy</Button>
              <Button type="submit" disabled={!editing?.name.trim() || save.isPending}>Lưu</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

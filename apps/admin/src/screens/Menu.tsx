// FR-11 — thực đơn: nhóm món, món, giá, trạm in, thể tích bia, còn/hết.
// Đổi giá không ảnh hưởng lượt gọi đã gửi (backend chốt giá trên từng dòng order).

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { Dialog, Empty, ErrorBlock, Field, Money, SkeletonRows, TitleRow } from '../components/ui';
import { api, imageUrl } from '../lib/api';
import { shrinkImage } from '../lib/image';
import { int } from '../lib/format';
import { useAction, useApi, useNarrow } from '../lib/hooks';
import type { MenuGroup, MenuItem, PrintStation, Tap } from '../lib/types';

interface ItemForm {
  groupId: string;
  name: string;
  shortcut: string;
  price: string;
  unit: string;
  stationId: string;
  isBeer: boolean;
  beerVolumeL: string;
  defaultTapId: string;
}

const emptyForm = (groupId = ''): ItemForm => ({
  groupId,
  name: '',
  shortcut: '',
  price: '',
  unit: 'đĩa',
  stationId: '',
  isBeer: false,
  beerVolumeL: '0,5',
  defaultTapId: '',
});

function toForm(i: MenuItem): ItemForm {
  return {
    groupId: String(i.groupId),
    name: i.name,
    shortcut: i.shortcut ?? '',
    price: String(i.price),
    unit: i.unit,
    stationId: i.stationId ? String(i.stationId) : '',
    isBeer: !!i.beerVolumeMl,
    beerVolumeL: i.beerVolumeMl ? String(i.beerVolumeMl / 1000).replace('.', ',') : '0,5',
    defaultTapId: i.defaultTapId ? String(i.defaultTapId) : '',
  };
}

/** Ảnh món thu nhỏ trong danh sách; món chưa có ảnh thì là ô trống cùng cỡ để cột tên thẳng hàng. */
function Thumb({ item }: { item: MenuItem }) {
  const src = imageUrl(item.imageFile);
  return src ? <img className="thumb" src={src} alt="" loading="lazy" /> : <span className="thumb" aria-hidden="true" />;
}

export function Menu() {
  const groups = useApi<MenuGroup[]>('/menu-groups');
  const items = useApi<MenuItem[]>('/menu-items');
  const stations = useApi<PrintStation[]>('/print-stations');
  const taps = useApi<Tap[]>('/taps');
  const narrow = useNarrow();
  const [groupFilter, setGroupFilter] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm());
  // Ảnh chọn trong hộp thoại: Blob = ảnh mới (đã thu nhỏ), 'remove' = bỏ ảnh, null = giữ nguyên
  const [image, setImage] = useState<Blob | 'remove' | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const preview = useMemo(() => (image instanceof Blob ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const currentImage = image === 'remove' ? undefined : preview ?? (editing && editing !== 'new' ? imageUrl(editing.imageFile) : undefined);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const save = useAction();
  const toggle = useAction();
  // Công tắc đổi ngay khi bấm; lỗi thì trả về trạng thái cũ
  const [pending, setPending] = useState<Record<number, boolean>>({});
  const isAvailable = (i: MenuItem) => pending[i.id] ?? i.available;

  const stationName = (id: number | null) => stations.data?.find((s) => s.id === id)?.name ?? '—';
  const tapName = (id: number | null) => taps.data?.find((t) => t.id === id)?.name ?? '—';
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items.data ?? []).filter(
      (i) => (groupFilter === 'all' || i.groupId === groupFilter) && (!q || i.name.toLowerCase().includes(q) || i.shortcut?.toLowerCase() === q),
    );
  }, [items.data, groupFilter, search]);
  const soldOut = (items.data ?? []).filter((i) => !(pending[i.id] ?? i.available)).length;

  function open(item: MenuItem | 'new') {
    save.clearError();
    setImage(null);
    setImageError(null);
    setEditing(item);
    setForm(item === 'new' ? emptyForm(groupFilter === 'all' ? String(groups.data?.[0]?.id ?? '') : String(groupFilter)) : toForm(item));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const volume = Math.round(Number(form.beerVolumeL.replace(',', '.')) * 1000);
    const body = {
      groupId: Number(form.groupId),
      name: form.name,
      shortcut: form.shortcut.trim() || null,
      price: Number(form.price),
      unit: form.unit,
      stationId: form.stationId ? Number(form.stationId) : null,
      beerVolumeMl: form.isBeer ? volume : null,
      defaultTapId: form.isBeer && form.defaultTapId ? Number(form.defaultTapId) : null,
    };
    const ok = await save.run(async () => {
      const saved = await (editing === 'new'
        ? api<MenuItem>('/menu-items', { method: 'POST', body })
        : api<MenuItem>(`/menu-items/${(editing as MenuItem).id}`, { method: 'PATCH', body }));
      if (image instanceof Blob) await api(`/menu-items/${saved.id}/image`, { method: 'PUT', body: image });
      else if (image === 'remove') await api(`/menu-items/${saved.id}/image`, { method: 'DELETE' });
    });
    if (ok) {
      setEditing(null);
      items.reload();
    }
  }

  async function remove(item: MenuItem) {
    if (!window.confirm(`Xóa món "${item.name}" khỏi thực đơn? Lịch sử bán vẫn được giữ.`)) return;
    if (await save.run(() => api(`/menu-items/${item.id}`, { method: 'DELETE' }))) {
      setEditing(null);
      items.reload();
    }
  }

  async function setAvailable(item: MenuItem, available: boolean) {
    setPending((p) => ({ ...p, [item.id]: available }));
    await toggle.run(() => api(`/menu-items/${item.id}`, { method: 'PATCH', body: { available } }));
    items.reload();
    setPending(({ [item.id]: _, ...rest }) => rest);
  }

  const set = (patch: Partial<ItemForm>) => setForm((f) => ({ ...f, ...patch }));

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setImageError(null);
    try {
      setImage(await shrinkImage(file));
    } catch (e) {
      setImageError((e as Error).message);
    }
  }

  return (
    <>
      <TitleRow
        title="Thực đơn"
        sub={items.data ? `${int(items.data.length)} món trong ${groups.data?.length ?? 0} nhóm${soldOut ? ` · ${soldOut} món đang hết` : ''}` : 'Đang tải…'}
        actions={
          <>
            <button className="btn" onClick={() => setGroupsOpen(true)}>
              Nhóm món
            </button>
            <button className="btn primary" onClick={() => open('new')}>
              <Icon name="plus" /> Thêm món
            </button>
          </>
        }
      />

      <nav className="tabs" role="tablist" aria-label="Nhóm món">
        <button role="tab" aria-selected={groupFilter === 'all'} onClick={() => setGroupFilter('all')}>
          Tất cả
        </button>
        {groups.data?.map((g) => (
          <button role="tab" key={g.id} aria-selected={groupFilter === g.id} onClick={() => setGroupFilter(g.id)}>
            {g.name}
          </button>
        ))}
      </nav>
      <div className="toolbar">
        <label className="search">
          <Icon name="search" />
          <input className="input" type="search" placeholder="Tìm theo tên hoặc mã tắt" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <span className="muted">{int(visible.length)} món</span>
      </div>
      {toggle.error && <p className="form-error">{toggle.error}</p>}

      <section className="panel flush">
        {items.error && !items.data ? (
          <ErrorBlock error={items.error} onRetry={items.reload} />
        ) : !items.data ? (
          <SkeletonRows rows={8} />
        ) : visible.length === 0 ? (
          <Empty>{search ? `Không có món nào khớp "${search}".` : 'Nhóm này chưa có món nào.'}</Empty>
        ) : narrow ? (
          <ul className="rows">
            {visible.map((i) => (
              <li className={isAvailable(i) ? 'row two-line' : 'row two-line dim'} key={i.id}>
                <Thumb item={i} />
                <button className="grow row-button" onClick={() => open(i)}>
                  <span className="truncate-line">{i.name}</span>
                  <span className="sub">
                    {i.shortcut ? `Mã ${i.shortcut} · ` : ''}
                    {stationName(i.stationId)}
                    {i.beerVolumeMl ? ` · ${String(i.beerVolumeMl / 1000).replace('.', ',')} L` : ''}
                  </span>
                </button>
                <span className="num end">
                  <Money value={i.price} />
                </span>
                <input
                  type="checkbox"
                  className="switch"
                  checked={isAvailable(i)}
                  onChange={(e) => setAvailable(i, e.target.checked)}
                  aria-label={`${i.name}: ${isAvailable(i) ? 'còn' : 'hết'}`}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="table-wrap">
            <table className="menu-table">
              <thead>
                <tr>
                  <th>Món</th>
                  <th>Mã tắt</th>
                  <th className="n">Giá</th>
                  <th>Đơn vị</th>
                  <th>Trạm in</th>
                  <th>Bia hơi</th>
                  <th>Còn món</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => (
                  <tr key={i.id} className={isAvailable(i) ? undefined : 'dim'}>
                    <td>
                      <span className="item-cell">
                        <Thumb item={i} />
                        <span>
                          {i.name}
                          {groupFilter === 'all' && <span className="sub">{groups.data?.find((g) => g.id === i.groupId)?.name}</span>}
                        </span>
                      </span>
                    </td>
                    <td>{i.shortcut ?? <span className="muted">—</span>}</td>
                    <td className="n">
                      <Money value={i.price} />
                    </td>
                    <td>{i.unit}</td>
                    <td>{stationName(i.stationId)}</td>
                    <td>{i.beerVolumeMl ? `${String(i.beerVolumeMl / 1000).replace('.', ',')} L · ${tapName(i.defaultTapId)}` : <span className="muted">—</span>}</td>
                    <td>
                      <label className="switch-label">
                        <input type="checkbox" className="switch" checked={isAvailable(i)} onChange={(e) => setAvailable(i, e.target.checked)} />
                        <span>{isAvailable(i) ? 'Còn' : 'Hết'}</span>
                      </label>
                    </td>
                    <td className="n">
                      <button className="btn ghost icon" onClick={() => open(i)} aria-label={`Sửa ${i.name}`}>
                        <Icon name="edit" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog
        open={editing !== null}
        title={editing === 'new' ? 'Thêm món' : 'Sửa món'}
        onClose={() => setEditing(null)}
        footer={
          <>
            {editing && editing !== 'new' && (
              <button className="btn danger-text" onClick={() => remove(editing)} disabled={save.busy}>
                Xóa món
              </button>
            )}
            <span className="spacer" />
            <button className="btn" onClick={() => setEditing(null)}>
              Hủy
            </button>
            <button className="btn primary" type="submit" form="item-form" disabled={save.busy}>
              {save.busy ? 'Đang lưu…' : 'Lưu'}
            </button>
          </>
        }
      >
        <form id="item-form" className="form-grid" onSubmit={submit}>
          <div className="image-field">
            {currentImage ? <img src={currentImage} alt="Ảnh món" /> : <span className="image-empty">Chưa có ảnh</span>}
            <div>
              <p className="field-label">Ảnh món</p>
              <p className="hint">Hiện trên nút món ở App quầy. Ảnh chụp ngang là đẹp nhất; ảnh tự thu nhỏ trước khi tải lên.</p>
              <div className="image-actions">
                <label className="btn">
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" onChange={(e) => void pickImage(e.target.files?.[0])} />
                  {currentImage ? 'Đổi ảnh' : 'Chọn ảnh'}
                </label>
                {currentImage && (
                  <button type="button" className="btn ghost" onClick={() => setImage(editing !== 'new' && editing?.imageFile ? 'remove' : null)}>
                    Bỏ ảnh
                  </button>
                )}
              </div>
              {imageError && <p className="form-error">{imageError}</p>}
            </div>
          </div>
          <Field label="Tên món">
            <input className="input" required value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <div className="form-row">
            <Field label="Nhóm">
              <select className="input" required value={form.groupId} onChange={(e) => set({ groupId: e.target.value })}>
                {groups.data?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mã tắt" hint="Gõ nhanh trên App quầy, vd b">
              <input className="input" maxLength={10} value={form.shortcut} onChange={(e) => set({ shortcut: e.target.value })} />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Giá (đ)">
              <input className="input num" required type="number" min={1000} step={1000} value={form.price} onChange={(e) => set({ price: e.target.value })} />
            </Field>
            <Field label="Đơn vị">
              <input className="input" required value={form.unit} onChange={(e) => set({ unit: e.target.value })} />
            </Field>
          </div>
          <Field label="Trạm in" hint="Phiếu gọi món của món này in ở đâu">
            <select className="input" value={form.stationId} onChange={(e) => set({ stationId: e.target.value })}>
              <option value="">Chưa gán (in ra PDF)</option>
              {stations.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="switch-label">
            <input type="checkbox" className="switch" checked={form.isBeer} onChange={(e) => set({ isBeer: e.target.checked })} />
            <span>Món bia hơi (tính thể tích vào keg đang gắn ở vòi)</span>
          </label>
          {form.isBeer && (
            <div className="form-row">
              <Field label="Thể tích mỗi phần (lít)">
                <input className="input num" required inputMode="decimal" value={form.beerVolumeL} onChange={(e) => set({ beerVolumeL: e.target.value })} />
              </Field>
              <Field label="Vòi mặc định">
                <select className="input" required value={form.defaultTapId} onChange={(e) => set({ defaultTapId: e.target.value })}>
                  <option value="">Chọn vòi</option>
                  {taps.data?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          {save.error && <p className="form-error">{save.error}</p>}
        </form>
      </Dialog>

      <GroupsDialog open={groupsOpen} onClose={() => setGroupsOpen(false)} groups={groups.data ?? []} items={items.data ?? []} onChanged={groups.reload} />
    </>
  );
}

function GroupsDialog({ open, onClose, groups, items, onChanged }: { open: boolean; onClose: () => void; groups: MenuGroup[]; items: MenuItem[]; onChanged: () => void }) {
  const [name, setName] = useState('');
  const action = useAction();
  const count = (id: number) => items.filter((i) => i.groupId === id).length;

  async function add(e: FormEvent) {
    e.preventDefault();
    if (await action.run(() => api('/menu-groups', { method: 'POST', body: { name, sortOrder: groups.length } }))) {
      setName('');
      onChanged();
    }
  }
  async function rename(g: MenuGroup) {
    const next = window.prompt('Tên mới của nhóm', g.name);
    if (next && next !== g.name && (await action.run(() => api(`/menu-groups/${g.id}`, { method: 'PATCH', body: { name: next } })))) onChanged();
  }
  async function remove(g: MenuGroup) {
    if (window.confirm(`Xóa nhóm "${g.name}"?`) && (await action.run(() => api(`/menu-groups/${g.id}`, { method: 'DELETE' })))) onChanged();
  }

  return (
    <Dialog open={open} title="Nhóm món" onClose={onClose}>
      <ul className="rows">
        {groups.map((g) => (
          <li className="row" key={g.id}>
            <span className="grow">{g.name}</span>
            <span className="muted num">{count(g.id)} món</span>
            <button className="btn ghost icon" onClick={() => rename(g)} aria-label={`Đổi tên ${g.name}`}>
              <Icon name="edit" />
            </button>
            <button className="btn ghost icon" onClick={() => remove(g)} disabled={count(g.id) > 0} title={count(g.id) > 0 ? 'Nhóm còn món, không xóa được' : undefined} aria-label={`Xóa ${g.name}`}>
              <Icon name="trash" />
            </button>
          </li>
        ))}
      </ul>
      <form className="inline-form" onSubmit={add}>
        <input className="input" required placeholder="Tên nhóm mới, vd Đồ hấp" value={name} onChange={(e) => setName(e.target.value)} aria-label="Tên nhóm mới" />
        <button className="btn" type="submit" disabled={action.busy}>
          Thêm nhóm
        </button>
      </form>
      {action.error && <p className="form-error">{action.error}</p>}
    </Dialog>
  );
}

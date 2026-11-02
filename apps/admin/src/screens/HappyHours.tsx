// FR-15 — giá giờ vàng: khung giờ theo thứ, giá riêng từng món. Lượt gọi gửi trong khung dùng giá này.

import { useState, type FormEvent } from 'react';
import { isRuleActive } from '@biahoi/shared';
import { Icon } from '../components/Icon';
import { Dialog, Empty, ErrorBlock, Field, Money, SkeletonRows, TitleRow } from '../components/ui';
import { api } from '../lib/api';
import { vnd, weekdayLabel } from '../lib/format';
import { useAction, useApi } from '../lib/hooks';
import type { HappyHour, MenuItem } from '../lib/types';

const WEEK = [1, 2, 3, 4, 5, 6, 0]; // T2 → CN

interface RuleForm {
  name: string;
  days: number[];
  start: string;
  end: string;
  active: boolean;
  prices: { itemId: string; price: string }[];
}

function daysText(days: number[]): string {
  const sorted = WEEK.filter((d) => days.includes(d));
  if (sorted.length === 7) return 'Cả tuần';
  if (sorted.join() === '1,2,3,4,5') return 'T2 – T6';
  if (sorted.join() === '6,0') return 'T7, CN';
  return sorted.map(weekdayLabel).join(', ');
}

export function HappyHours() {
  const rules = useApi<HappyHour[]>('/happy-hours');
  const items = useApi<MenuItem[]>('/menu-items');
  const [editing, setEditing] = useState<HappyHour | 'new' | null>(null);
  const [form, setForm] = useState<RuleForm>({ name: '', days: [1, 2, 3, 4, 5], start: '16:00', end: '18:00', active: true, prices: [] });
  const save = useAction();
  const toggle = useAction();
  const [pending, setPending] = useState<Record<number, boolean>>({});
  const isActive = (r: HappyHour) => pending[r.id] ?? r.active;
  const itemOf = (id: number) => items.data?.find((i) => i.id === id);
  const now = new Date();
  const running = rules.data?.filter((r) => r.active && isRuleActive(r, now)) ?? [];

  function open(r: HappyHour | 'new') {
    save.clearError();
    setEditing(r);
    setForm(
      r === 'new'
        ? { name: '', days: [1, 2, 3, 4, 5], start: '16:00', end: '18:00', active: true, prices: [{ itemId: '', price: '' }] }
        : { name: r.name, days: r.daysOfWeek, start: r.start, end: r.end, active: r.active, prices: r.prices.map((p) => ({ itemId: String(p.itemId), price: String(p.price) })) },
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const prices = form.prices.filter((p) => p.itemId && p.price).map((p) => ({ itemId: Number(p.itemId), price: Number(p.price) }));
    const body = { name: form.name, daysOfWeek: form.days, start: form.start, end: form.end, active: form.active, prices };
    const ok = await save.run(() =>
      editing === 'new' ? api('/happy-hours', { method: 'POST', body }) : api(`/happy-hours/${(editing as HappyHour).id}`, { method: 'PATCH', body }),
    );
    if (ok) {
      setEditing(null);
      rules.reload();
    }
  }

  async function remove(r: HappyHour) {
    if (!window.confirm(`Xóa khung "${r.name}"? Khung đã từng áp dụng thì chỉ tắt được.`)) return;
    if (await save.run(() => api(`/happy-hours/${r.id}`, { method: 'DELETE' }))) {
      setEditing(null);
      rules.reload();
    }
  }

  async function setActive(r: HappyHour, active: boolean) {
    setPending((p) => ({ ...p, [r.id]: active }));
    await toggle.run(() => api(`/happy-hours/${r.id}`, { method: 'PATCH', body: { active } }));
    rules.reload();
    setPending(({ [r.id]: _, ...rest }) => rest);
  }

  const setPrice = (i: number, patch: Partial<RuleForm['prices'][number]>) =>
    setForm((f) => ({ ...f, prices: f.prices.map((p, k) => (k === i ? { ...p, ...patch } : p)) }));

  return (
    <>
      <TitleRow
        title="Giờ vàng"
        sub={rules.data ? (running.length ? `Đang áp dụng: ${running.map((r) => `${r.name} (${r.start}–${r.end})`).join(', ')}` : 'Hiện không có khung giờ vàng nào đang áp dụng') : 'Đang tải…'}
        actions={
          <button className="btn primary" onClick={() => open('new')}>
            <Icon name="plus" /> Thêm khung giờ
          </button>
        }
      />
      {toggle.error && <p className="form-error">{toggle.error}</p>}
      <section className="panel flush">
        {rules.error && !rules.data ? (
          <ErrorBlock error={rules.error} onRetry={rules.reload} />
        ) : !rules.data ? (
          <SkeletonRows rows={2} />
        ) : rules.data.length === 0 ? (
          <Empty>Chưa có khung giờ vàng. Món gửi ngoài khung luôn dùng giá thường.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Khung</th>
                  <th>Ngày</th>
                  <th>Giờ</th>
                  <th>Giá giờ vàng</th>
                  <th>Bật</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {rules.data.map((r) => (
                  <tr key={r.id} className={isActive(r) ? undefined : 'dim'}>
                    <td>
                      {r.name}
                      {isActive(r) && isRuleActive(r, now) && <span className="sub accent-text">Đang áp dụng</span>}
                    </td>
                    <td>{daysText(r.daysOfWeek)}</td>
                    <td className="num nowrap">
                      {r.start}–{r.end}
                    </td>
                    <td>
                      {r.prices.length === 0 ? (
                        <span className="muted">Chưa có món</span>
                      ) : (
                        <ul className="price-list">
                          {r.prices.map((p) => {
                            const item = itemOf(p.itemId);
                            return (
                              <li key={p.id}>
                                <span>{item?.name ?? `Món #${p.itemId}`}</span>
                                <span className="num">
                                  {item && <s className="muted">{vnd(item.price)}</s>} <Money value={p.price} />
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </td>
                    <td>
                      <input type="checkbox" className="switch" checked={isActive(r)} onChange={(e) => setActive(r, e.target.checked)} aria-label={`Bật ${r.name}`} />
                    </td>
                    <td className="n">
                      <button className="btn ghost icon" onClick={() => open(r)} aria-label={`Sửa ${r.name}`}>
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
      {rules.data && rules.data.length > 0 && <WeekView rules={rules.data.map((r) => ({ ...r, active: isActive(r) }))} />}
      <p className="footnote">Giá chốt theo giờ gửi lượt gọi. Cùng một món mà khác giá sẽ in thành hai dòng trên hóa đơn.</p>

      <Dialog
        open={editing !== null}
        wide
        title={editing === 'new' ? 'Thêm khung giờ vàng' : 'Sửa khung giờ vàng'}
        onClose={() => setEditing(null)}
        footer={
          <>
            {editing && editing !== 'new' && (
              <button className="btn danger-text" onClick={() => remove(editing)} disabled={save.busy}>
                Xóa khung
              </button>
            )}
            <span className="spacer" />
            <button className="btn" onClick={() => setEditing(null)}>
              Hủy
            </button>
            <button className="btn primary" type="submit" form="hh-form" disabled={save.busy || form.days.length === 0}>
              Lưu
            </button>
          </>
        }
      >
        <form id="hh-form" className="form-grid" onSubmit={submit}>
          <Field label="Tên khung">
            <input className="input" required placeholder="Giờ vàng chiều" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <fieldset className="field">
            <legend className="field-label">Áp dụng các ngày</legend>
            <div className="day-picker">
              {WEEK.map((d) => (
                <button
                  type="button"
                  key={d}
                  aria-pressed={form.days.includes(d)}
                  onClick={() => setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d] }))}
                >
                  {weekdayLabel(d)}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="form-row">
            <Field label="Bắt đầu">
              <input className="input" type="time" required value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} />
            </Field>
            <Field label="Kết thúc" hint="Sớm hơn giờ bắt đầu nghĩa là qua nửa đêm">
              <input className="input" type="time" required value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} />
            </Field>
          </div>
          <fieldset className="field">
            <legend className="field-label">Giá riêng theo món</legend>
            <div className="price-rows">
              {form.prices.map((p, i) => {
                const item = items.data?.find((x) => String(x.id) === p.itemId);
                return (
                  <div className="price-row" key={i}>
                    <select className="input" value={p.itemId} onChange={(e) => setPrice(i, { itemId: e.target.value })} aria-label="Món">
                      <option value="">Chọn món</option>
                      {items.data?.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} — giá thường {vnd(it.price)} đ
                        </option>
                      ))}
                    </select>
                    <input className="input num" type="number" min={0} step={1000} placeholder={item ? String(item.price) : 'Giá'} value={p.price} onChange={(e) => setPrice(i, { price: e.target.value })} aria-label="Giá giờ vàng" />
                    <button type="button" className="btn ghost icon" onClick={() => setForm((f) => ({ ...f, prices: f.prices.filter((_, k) => k !== i) }))} aria-label="Bỏ món">
                      <Icon name="close" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" className="card-link plain" onClick={() => setForm((f) => ({ ...f, prices: [...f.prices, { itemId: '', price: '' }] }))}>
              + Thêm món
            </button>
          </fieldset>
          {save.error && <p className="form-error">{save.error}</p>}
        </form>
      </Dialog>
    </>
  );
}

/** Lịch tuần: mỗi ngày một rãnh 00:00–24:00, khung đang bật tô hổ phách, khung đã tắt tô xám. */
function WeekView({ rules }: { rules: HappyHour[] }) {
  const spans = (day: number) =>
    rules.flatMap((r) => {
      const out: { left: number; width: number; rule: HappyHour }[] = [];
      const at = (m: number) => (m / 1440) * 100;
      if (r.startMinute < r.endMinute) {
        if (r.daysOfWeek.includes(day)) out.push({ left: at(r.startMinute), width: at(r.endMinute - r.startMinute), rule: r });
      } else {
        if (r.daysOfWeek.includes(day)) out.push({ left: at(r.startMinute), width: at(1440 - r.startMinute), rule: r });
        if (r.daysOfWeek.includes((day + 6) % 7) && r.endMinute > 0) out.push({ left: 0, width: at(r.endMinute), rule: r });
      }
      return out;
    });
  const hours = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  return (
    <section className="panel week">
      <header>
        <h2>Giờ vàng trong tuần</h2>
        <span className="meta">Khung đang bật tô màu, khung đã tắt tô xám</span>
      </header>
      <div className="week-grid" role="img" aria-label="Các khung giờ vàng theo ngày trong tuần">
        {WEEK.map((d) => (
          <div className="week-row" key={d}>
            <span className="week-day">{weekdayLabel(d)}</span>
            <span className="week-track">
              {spans(d).map((s, i) => (
                <span
                  key={i}
                  className={s.rule.active ? 'week-span' : 'week-span off'}
                  style={{ left: `${s.left}%`, width: `${s.width}%` }}
                  title={`${s.rule.name} ${s.rule.start}–${s.rule.end}`}
                >
                  {s.width > 8 ? `${s.rule.start}–${s.rule.end}` : ''}
                </span>
              ))}
            </span>
          </div>
        ))}
        <div className="week-row axis">
          <span className="week-day" />
          <span className="week-track">
            {hours.map((h) => (
              <span key={h} className="week-tick" style={{ left: `${(h / 24) * 100}%` }}>
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </span>
        </div>
      </div>
    </section>
  );
}

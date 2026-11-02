// FR-14 — nhập kho keg, xem keg theo trạng thái; kèm vòi bia và thay keg (FR-10).
// Keg chỉ gắn được vào vòi khi đang Trong kho.

import { useState, type FormEvent } from 'react';
import { SOCKET_EVENTS, type KegStatus } from '@biahoi/shared';
import { Icon } from '../components/Icon';
import { TapStrip } from '../components/KegStrip';
import { Dialog, Empty, ErrorBlock, Field, Money, SkeletonRows, TitleRow } from '../components/ui';
import { api } from '../lib/api';
import { day, int, litres, vnd, vnDate } from '../lib/format';
import { useAction, useApi, useLive, useNarrow } from '../lib/hooks';
import type { Keg, Tap } from '../lib/types';

const STATUS_LABEL: Record<KegStatus, string> = { IN_STOCK: 'Trong kho', TAPPED: 'Đang dùng', EMPTY: 'Đã hết' };

export function KegStock() {
  const kegs = useApi<Keg[]>('/kegs');
  const taps = useApi<Tap[]>('/taps');
  const narrow = useNarrow();
  useLive([SOCKET_EVENTS.TAP_UPDATED], () => {
    kegs.reload();
    taps.reload();
  });
  const [tab, setTab] = useState<KegStatus>('IN_STOCK');
  const [receiving, setReceiving] = useState(false);
  const [changing, setChanging] = useState<Tap | null>(null);
  const [newKeg, setNewKeg] = useState('');
  const [form, setForm] = useState({ beerName: 'Bia hơi Hà Nội', capacityL: '50', cost: '950000', receivedAt: vnDate(0), quantity: '4' });
  const save = useAction();
  const tapAction = useAction();

  const all = kegs.data ?? [];
  const count = (s: KegStatus) => all.filter((k) => k.status === s).length;
  const rows = all.filter((k) => k.status === tab);
  const inStock = all.filter((k) => k.status === 'IN_STOCK');
  const stockLitres = inStock.reduce((s, k) => s + k.capacityMl, 0);

  async function receive(e: FormEvent) {
    e.preventDefault();
    const body = {
      beerName: form.beerName,
      capacityMl: Math.round(Number(form.capacityL.replace(',', '.')) * 1000),
      cost: Number(form.cost),
      receivedAt: new Date(`${form.receivedAt}T08:00:00+07:00`).toISOString(),
      quantity: Number(form.quantity),
    };
    if (await save.run(() => api('/kegs', { method: 'POST', body }))) {
      setReceiving(false);
      setTab('IN_STOCK');
      kegs.reload();
    }
  }

  async function changeKeg(e: FormEvent) {
    e.preventDefault();
    if (!changing) return;
    if (await tapAction.run(() => api(`/taps/${changing.id}/change-keg`, { method: 'POST', body: { kegId: Number(newKeg) } }))) {
      setChanging(null);
      kegs.reload();
      taps.reload();
    }
  }

  async function addTap() {
    const name = window.prompt('Tên vòi mới', `Vòi ${(taps.data?.length ?? 0) + 1}`);
    if (name && (await tapAction.run(() => api('/taps', { method: 'POST', body: { name, sortOrder: taps.data?.length ?? 0 } })))) taps.reload();
  }

  return (
    <>
      <TitleRow
        title="Kho keg & vòi"
        sub={kegs.data ? `${count('IN_STOCK')} keg trong kho (${litres(stockLitres)} L) · ${count('TAPPED')} đang gắn ở vòi` : 'Đang tải…'}
        actions={
          <button className="btn primary" onClick={() => { save.clearError(); setReceiving(true); }}>
            <Icon name="plus" /> Nhập keg
          </button>
        }
      />

      <section className="panel">
        <header>
          <h2>Vòi bia</h2>
          <button className="card-link" onClick={addTap}>
            Thêm vòi
          </button>
        </header>
        {taps.error && !taps.data ? (
          <ErrorBlock error={taps.error} onRetry={taps.reload} />
        ) : !taps.data ? (
          <SkeletonRows rows={2} />
        ) : taps.data.length === 0 ? (
          <Empty>Chưa có vòi nào.</Empty>
        ) : (
          <>
            <TapStrip taps={taps.data} />
            <div className="tap-actions">
              {taps.data.map((t) => (
                <button key={t.id} className="btn" onClick={() => { tapAction.clearError(); setNewKeg(String(inStock[0]?.id ?? '')); setChanging(t); }} disabled={inStock.length === 0}>
                  Thay keg {t.name}
                </button>
              ))}
              {inStock.length === 0 && <span className="muted">Kho hết keg, nhập keg trước khi thay.</span>}
            </div>
          </>
        )}
        {tapAction.error && !changing && <p className="form-error">{tapAction.error}</p>}
      </section>

      <nav className="tabs" role="tablist" aria-label="Trạng thái keg">
        {(['IN_STOCK', 'TAPPED', 'EMPTY'] as KegStatus[]).map((s) => (
          <button role="tab" key={s} aria-selected={tab === s} onClick={() => setTab(s)}>
            {STATUS_LABEL[s]} <span className="num muted">{kegs.data ? count(s) : ''}</span>
          </button>
        ))}
      </nav>

      <section className="panel flush">
        {kegs.error && !kegs.data ? (
          <ErrorBlock error={kegs.error} onRetry={kegs.reload} />
        ) : !kegs.data ? (
          <SkeletonRows rows={5} />
        ) : rows.length === 0 ? (
          <Empty>{tab === 'IN_STOCK' ? 'Kho không còn keg nào. Bấm "Nhập keg" khi nhận hàng.' : `Không có keg nào ${STATUS_LABEL[tab].toLowerCase()}.`}</Empty>
        ) : narrow ? (
          <ul className="rows">
            {rows.map((k) => (
              <li className="row two-line" key={k.id}>
                <span className="grow">
                  <span>
                    Keg #{k.id} · {k.beerName}
                  </span>
                  <span className="sub">
                    {litres(k.capacityMl)} L · nhập {day(k.receivedAt)}
                    {k.tap ? ` · ${k.tap.name}` : ''}
                  </span>
                </span>
                <span className="num end">{k.status === 'IN_STOCK' ? `${vnd(k.cost)} đ` : `${litres(k.soldMl)} L đã bán`}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Keg</th>
                  <th>Ngày nhập</th>
                  <th className="n">Dung tích</th>
                  <th className="n">Giá nhập</th>
                  {tab !== 'IN_STOCK' && <th>Vòi</th>}
                  {tab !== 'IN_STOCK' && <th>Gắn lúc</th>}
                  {tab === 'EMPTY' && <th>Hết lúc</th>}
                  {tab !== 'IN_STOCK' && <th className="n">Đã bán</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((k) => (
                  <tr key={k.id}>
                    <td>
                      Keg #{k.id}
                      <span className="sub">{k.beerName}</span>
                    </td>
                    <td>{day(k.receivedAt)}</td>
                    <td className="n num">
                      {litres(k.capacityMl)}
                      <small className="unit"> L</small>
                    </td>
                    <td className="n">
                      <Money value={k.cost} />
                    </td>
                    {tab !== 'IN_STOCK' && <td>{k.tap?.name ?? '—'}</td>}
                    {tab !== 'IN_STOCK' && <td>{k.tappedAt ? day(k.tappedAt) : '—'}</td>}
                    {tab === 'EMPTY' && <td>{k.emptiedAt ? day(k.emptiedAt) : '—'}</td>}
                    {tab !== 'IN_STOCK' && (
                      <td className="n num">
                        {litres(k.soldMl)}
                        <small className="unit"> L</small>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog
        open={receiving}
        title="Nhập keg"
        onClose={() => setReceiving(false)}
        footer={
          <>
            <span className="muted num">
              Tổng {int(Number(form.quantity) || 0)} keg · {vnd((Number(form.quantity) || 0) * (Number(form.cost) || 0))} đ
            </span>
            <span className="spacer" />
            <button className="btn" onClick={() => setReceiving(false)}>
              Hủy
            </button>
            <button className="btn primary" type="submit" form="keg-form" disabled={save.busy}>
              Nhập kho
            </button>
          </>
        }
      >
        <form id="keg-form" className="form-grid" onSubmit={receive}>
          <Field label="Loại bia">
            <input className="input" required value={form.beerName} onChange={(e) => setForm((f) => ({ ...f, beerName: e.target.value }))} />
          </Field>
          <div className="form-row">
            <Field label="Dung tích (lít)">
              <select className="input" value={form.capacityL} onChange={(e) => setForm((f) => ({ ...f, capacityL: e.target.value }))}>
                <option value="30">30 L</option>
                <option value="50">50 L</option>
              </select>
            </Field>
            <Field label="Số lượng keg">
              <input className="input num" required type="number" min={1} max={50} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Giá nhập mỗi keg (đ)">
              <input className="input num" required type="number" min={0} step={1000} value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
            </Field>
            <Field label="Ngày nhập">
              <input className="input" required type="date" value={form.receivedAt} onChange={(e) => setForm((f) => ({ ...f, receivedAt: e.target.value }))} />
            </Field>
          </div>
          {save.error && <p className="form-error">{save.error}</p>}
        </form>
      </Dialog>

      <Dialog
        open={changing !== null}
        title={`Thay keg ${changing?.name ?? ''}`}
        onClose={() => setChanging(null)}
        footer={
          <>
            <span className="spacer" />
            <button className="btn" onClick={() => setChanging(null)}>
              Hủy
            </button>
            <button className="btn primary" type="submit" form="change-form" disabled={tapAction.busy || !newKeg}>
              Thay keg
            </button>
          </>
        }
      >
        <form id="change-form" className="form-grid" onSubmit={changeKeg}>
          {changing?.currentKeg && (
            <p>
              Keg #{changing.currentKeg.id} đang gắn (đã bán {litres(changing.currentKeg.soldMl)} L) sẽ chuyển sang <strong>Đã hết</strong> và được tính hao hụt.
            </p>
          )}
          <Field label="Keg mới từ kho">
            <select className="input" required value={newKeg} onChange={(e) => setNewKeg(e.target.value)}>
              {inStock.map((k) => (
                <option key={k.id} value={k.id}>
                  Keg #{k.id} · {k.beerName}, {litres(k.capacityMl)} L, nhập {day(k.receivedAt).replace(/^Hôm/, 'hôm')}
                </option>
              ))}
            </select>
          </Field>
          {tapAction.error && <p className="form-error">{tapAction.error}</p>}
        </form>
      </Dialog>
    </>
  );
}

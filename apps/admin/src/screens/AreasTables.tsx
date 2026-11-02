// FR-12 — khu và bàn. Bàn đang có khách không xóa được; trạng thái bàn cập nhật theo máy quầy.

import { useEffect, useState, type FormEvent } from 'react';
import { SOCKET_EVENTS } from '@biahoi/shared';
import { Icon } from '../components/Icon';
import { Empty, ErrorBlock, SkeletonRows, TitleRow } from '../components/ui';
import { api } from '../lib/api';
import { time, vndText } from '../lib/format';
import { useAction, useApi, useLive } from '../lib/hooks';
import type { AreaWithTables } from '../lib/types';

const STATUS_LABEL = { EMPTY: 'Trống', OPEN: 'Đang ngồi', PROVISIONAL: 'Đã in tạm tính', PRINT_ERROR: 'Lỗi in phiếu' } as const;
const STATUS_PILL = { EMPTY: 'pill', OPEN: 'pill pos', PROVISIONAL: 'pill warn', PRINT_ERROR: 'pill neg' } as const;

export function AreasTables() {
  const areas = useApi<AreaWithTables[]>('/areas?include=tables');
  useLive([SOCKET_EVENTS.TABLE_UPDATED], areas.reload);
  const [selected, setSelected] = useState<number | null>(null);
  const [areaName, setAreaName] = useState('');
  const [code, setCode] = useState('');
  const areaAction = useAction();
  const tableAction = useAction();

  useEffect(() => {
    if (selected === null && areas.data?.[0]) setSelected(areas.data[0].id);
  }, [areas.data, selected]);

  const area = areas.data?.find((a) => a.id === selected);
  const totalTables = areas.data?.reduce((s, a) => s + a.tables.length, 0) ?? 0;

  async function addArea(e: FormEvent) {
    e.preventDefault();
    if (await areaAction.run(() => api<{ id: number }>('/areas', { method: 'POST', body: { name: areaName, sortOrder: areas.data?.length ?? 0 } }).then((a) => setSelected(a.id)))) {
      setAreaName('');
      areas.reload();
    }
  }
  async function renameArea() {
    if (!area) return;
    const next = window.prompt('Tên mới của khu', area.name);
    if (next && next !== area.name && (await areaAction.run(() => api(`/areas/${area.id}`, { method: 'PATCH', body: { name: next } })))) areas.reload();
  }
  async function removeArea() {
    if (!area || !window.confirm(`Xóa khu "${area.name}"?`)) return;
    if (await areaAction.run(() => api(`/areas/${area.id}`, { method: 'DELETE' }))) {
      setSelected(null);
      areas.reload();
    }
  }
  async function addTable(e: FormEvent) {
    e.preventDefault();
    if (!area) return;
    const ok = await tableAction.run(() => api('/tables', { method: 'POST', body: { areaId: area.id, code: code.trim().toUpperCase(), sortOrder: area.tables.length } }));
    if (ok) {
      setCode('');
      areas.reload();
    }
  }
  async function removeTable(id: number, tableCode: string) {
    if (!window.confirm(`Xóa bàn ${tableCode}?`)) return;
    if (await tableAction.run(() => api(`/tables/${id}`, { method: 'DELETE' }))) areas.reload();
  }

  return (
    <>
      <TitleRow title="Khu & bàn" sub={areas.data ? `${areas.data.length} khu, ${totalTables} bàn` : 'Đang tải…'} />

      {areas.error && !areas.data ? (
        <ErrorBlock error={areas.error} onRetry={areas.reload} />
      ) : !areas.data ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="master-detail">
          <section className="panel">
            <header>
              <h2>Khu</h2>
            </header>
            <ul className="pick-list" role="listbox" aria-label="Chọn khu">
              {areas.data.map((a) => (
                <li key={a.id}>
                  <button role="option" aria-selected={a.id === selected} onClick={() => setSelected(a.id)}>
                    <span>{a.name}</span>
                    <span className="muted num">{a.tables.length} bàn</span>
                  </button>
                </li>
              ))}
            </ul>
            {area && (
              <div className="mini-map">
                <h3>Sơ đồ {area.name.toLowerCase()}</h3>
                <ul className="tiles" aria-label={`Sơ đồ bàn ${area.name}`}>
                  {area.tables.map((t) => (
                    <li key={t.id} className={`tile is-${t.status.toLowerCase()}`} title={`${t.code}: ${STATUS_LABEL[t.status]}`}>
                      {t.code}
                    </li>
                  ))}
                </ul>
                <p className="map-key">
                  {(['OPEN', 'PROVISIONAL', 'PRINT_ERROR', 'EMPTY'] as const)
                    .map((s) => ({ s, n: area.tables.filter((t) => t.status === s).length }))
                    .filter((x) => x.n > 0)
                    .map((x) => (
                      <span key={x.s}>
                        <i className={`tile-dot is-${x.s.toLowerCase()}`} aria-hidden="true" />
                        {STATUS_LABEL[x.s]} {x.n}
                      </span>
                    ))}
                </p>
              </div>
            )}
            <form className="inline-form" onSubmit={addArea}>
              <input className="input" required placeholder="Khu mới, vd Sân thượng" value={areaName} onChange={(e) => setAreaName(e.target.value)} aria-label="Tên khu mới" />
              <button className="btn" type="submit" disabled={areaAction.busy}>
                Thêm khu
              </button>
            </form>
            {areaAction.error && <p className="form-error">{areaAction.error}</p>}
          </section>

          <section className="panel flush">
            {!area ? (
              <Empty>Chọn một khu để xem bàn.</Empty>
            ) : (
              <>
                <header className="panel-pad">
                  <h2>
                    {area.name} <span className="muted num">· {area.tables.length} bàn, {area.tables.filter((t) => t.tab).length} đang có khách</span>
                  </h2>
                  <span className="header-actions">
                    <button className="btn ghost icon" onClick={renameArea} aria-label={`Đổi tên khu ${area.name}`}>
                      <Icon name="edit" />
                    </button>
                    <button className="btn ghost icon" onClick={removeArea} disabled={area.tables.length > 0} title={area.tables.length ? 'Xóa hết bàn trước khi xóa khu' : undefined} aria-label={`Xóa khu ${area.name}`}>
                      <Icon name="trash" />
                    </button>
                  </span>
                </header>
                <form className="inline-form panel-pad" onSubmit={addTable}>
                  <input className="input" required maxLength={20} placeholder="Mã bàn, vd S31" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Mã bàn mới" />
                  <button className="btn" type="submit" disabled={tableAction.busy}>
                    <Icon name="plus" /> Thêm bàn
                  </button>
                </form>
                {tableAction.error && <p className="form-error panel-pad">{tableAction.error}</p>}
                {area.tables.length === 0 ? (
                  <div className="panel-pad">
                    <Empty>Khu này chưa có bàn.</Empty>
                  </div>
                ) : (
                  <div className="table-wrap table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Bàn</th>
                          <th>Trạng thái</th>
                          <th className="n">Tạm tính</th>
                          <th aria-label="Thao tác" />
                        </tr>
                      </thead>
                      <tbody>
                        {area.tables.map((t) => (
                          <tr key={t.id}>
                            <td>{t.code}</td>
                            <td>
                              <span className={STATUS_PILL[t.status]}>{STATUS_LABEL[t.status]}</span>
                              {t.tab && <span className="sub">Mở lúc {time(t.tab.openedAt)}</span>}
                            </td>
                            <td className="n num">{t.tab ? vndText(t.tab.total) : <span className="muted">—</span>}</td>
                            <td className="n">
                              <button
                                className="btn ghost icon"
                                onClick={() => removeTable(t.id, t.code)}
                                disabled={!!t.tab}
                                title={t.tab ? 'Bàn đang có khách, không xóa được' : undefined}
                                aria-label={`Xóa bàn ${t.code}`}
                              >
                                <Icon name="trash" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

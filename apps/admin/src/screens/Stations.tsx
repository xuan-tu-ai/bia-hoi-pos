// FR-11 — trạm in: nơi nhận phiếu gọi món (Quầy rót bia, Bếp…) và cách in: máy in mạng (máy chủ gửi thẳng)
// hoặc máy in mặc định của máy quầy (in qua trình duyệt).

import { useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { Dialog, Empty, ErrorBlock, Field, SkeletonRows, TitleRow } from '../components/ui';
import { api } from '../lib/api';
import { useAction, useApi } from '../lib/hooks';
import type { MenuItem, PrintStation } from '../lib/types';

export function Stations() {
  const stations = useApi<PrintStation[]>('/print-stations');
  const items = useApi<MenuItem[]>('/menu-items');
  const [editing, setEditing] = useState<PrintStation | 'new' | null>(null);
  const [name, setName] = useState('');
  const [printer, setPrinter] = useState('');
  const [connection, setConnection] = useState<PrintStation['connection']>('BROWSER');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('9100');
  const save = useAction();
  const test = useAction();
  const [tested, setTested] = useState<string | null>(null);
  const itemCount = (id: number) => items.data?.filter((i) => i.stationId === id).length ?? 0;
  const unassigned = items.data?.filter((i) => !i.stationId).length ?? 0;

  function open(s: PrintStation | 'new') {
    save.clearError();
    setEditing(s);
    setName(s === 'new' ? '' : s.name);
    setPrinter(s === 'new' ? '' : s.printerName);
    setConnection(s === 'new' ? 'BROWSER' : s.connection);
    setHost(s === 'new' ? '' : (s.host ?? ''));
    setPort(s === 'new' ? '9100' : String(s.port));
  }

  async function testPrint(s: PrintStation) {
    setTested(null);
    if (await test.run(() => api(`/print-stations/${s.id}/test`, { method: 'POST' }))) setTested(`Đã gửi phiếu in thử tới ${s.name} (${s.host}:${s.port}).`);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = {
      name,
      printerName: printer,
      connection,
      host: connection === 'NETWORK' ? host.trim() : null,
      port: Number(port) || 9100,
    };
    const ok = await save.run(() =>
      editing === 'new' ? api('/print-stations', { method: 'POST', body }) : api(`/print-stations/${(editing as PrintStation).id}`, { method: 'PATCH', body }),
    );
    if (ok) {
      setEditing(null);
      stations.reload();
    }
  }

  async function remove(s: PrintStation) {
    if (!window.confirm(`Xóa trạm in "${s.name}"?`)) return;
    if (await save.run(() => api(`/print-stations/${s.id}`, { method: 'DELETE' }))) {
      setEditing(null);
      stations.reload();
    }
  }

  return (
    <>
      <TitleRow
        title="Trạm in"
        sub={
          stations.data
            ? `${stations.data.length} trạm${unassigned ? ` · ${unassigned} món chưa gán trạm sẽ in ra PDF` : ' · mọi món đều đã gán trạm'}`
            : 'Đang tải…'
        }
        actions={
          <button className="btn primary" onClick={() => open('new')}>
            <Icon name="plus" /> Thêm trạm in
          </button>
        }
      />
      <div className="stack">
      <section className="panel flush">
        {stations.error && !stations.data ? (
          <ErrorBlock error={stations.error} onRetry={stations.reload} />
        ) : !stations.data ? (
          <SkeletonRows rows={2} />
        ) : stations.data.length === 0 ? (
          <Empty>Chưa có trạm in nào. Thêm "Quầy rót bia" và "Bếp" để bắt đầu.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Trạm</th>
                  <th>Cách in</th>
                  <th className="n">Số món</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {stations.data.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.name}
                      <span className="sub">{s.printerName}</span>
                    </td>
                    <td>
                      {s.connection === 'NETWORK' ? (
                        <>
                          Máy in mạng <span className="num">{s.host ?? '—'}:{s.port}</span>
                        </>
                      ) : (
                        'Máy in của máy quầy'
                      )}
                      <span className="sub">{s.connection === 'NETWORK' ? 'Máy chủ gửi phiếu thẳng tới máy in' : 'In qua trình duyệt, ra máy in mặc định'}</span>
                    </td>
                    <td className="n num">{itemCount(s.id)}</td>
                    <td className="n nowrap">
                      {s.connection === 'NETWORK' && (
                        <button className="btn" onClick={() => testPrint(s)} disabled={test.busy}>
                          In thử
                        </button>
                      )}
                      <button className="btn ghost icon" onClick={() => open(s)} aria-label={`Sửa ${s.name}`}>
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

      {(tested || test.error) && (
        <p className={test.error ? 'form-error' : 'notice-line'} role="status">
          {test.error ?? tested}
        </p>
      )}

      <section className="panel">
        <header>
          <h2>Món in ở mỗi trạm</h2>
          <span className="meta">{items.data ? `${items.data.length} món` : ''}</span>
        </header>
        {!items.data || !stations.data ? (
          <SkeletonRows rows={4} />
        ) : (
          <dl className="station-items">
            {[
              ...stations.data.map((s) => ({ key: String(s.id), name: s.name, list: items.data!.filter((i) => i.stationId === s.id) })),
              { key: 'none', name: 'Chưa gán trạm (in ra PDF)', list: items.data.filter((i) => !i.stationId) },
            ]
              .filter((g) => g.key !== 'none' || g.list.length > 0)
              .map((g) => (
                <div key={g.key}>
                  <dt>
                    {g.name} <span className="muted num">· {g.list.length} món</span>
                  </dt>
                  <dd>{g.list.length ? g.list.map((i) => i.name).join(', ') : <span className="muted">Chưa có món nào</span>}</dd>
                </div>
              ))}
          </dl>
        )}
      </section>
      </div>
      <p className="footnote">
        Máy in mạng: máy in nhiệt 80 mm có cổng LAN, đặt IP tĩnh, cổng thường là 9100; phiếu in dạng ảnh nên luôn đúng dấu tiếng Việt.
        Máy in của máy quầy: phiếu in ra máy in mặc định của máy đang gọi món (không có máy in thì chọn "Microsoft Print to PDF").
      </p>

      <Dialog
        open={editing !== null}
        title={editing === 'new' ? 'Thêm trạm in' : 'Sửa trạm in'}
        onClose={() => setEditing(null)}
        footer={
          <>
            {editing && editing !== 'new' && (
              <button className="btn danger-text" onClick={() => remove(editing)} disabled={save.busy || itemCount(editing.id) > 0} title={itemCount(editing.id) > 0 ? 'Còn món gán vào trạm này' : undefined}>
                Xóa trạm
              </button>
            )}
            <span className="spacer" />
            <button className="btn" onClick={() => setEditing(null)}>
              Hủy
            </button>
            <button className="btn primary" type="submit" form="station-form" disabled={save.busy}>
              Lưu
            </button>
          </>
        }
      >
        <form id="station-form" className="form-grid" onSubmit={submit}>
          <Field label="Tên trạm">
            <input className="input" required placeholder="Bếp nướng" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Tên hoặc ghi chú máy in">
            <input className="input" required placeholder="Xprinter XP-80C ở bếp" value={printer} onChange={(e) => setPrinter(e.target.value)} />
          </Field>
          <Field label="Cách in">
            <select className="input" value={connection} onChange={(e) => setConnection(e.target.value as PrintStation['connection'])}>
              <option value="BROWSER">Máy in của máy quầy (qua trình duyệt)</option>
              <option value="NETWORK">Máy in mạng (máy chủ gửi thẳng)</option>
            </select>
          </Field>
          {connection === 'NETWORK' && (
            <div className="form-row">
              <Field label="Địa chỉ IP máy in" hint="Chạy máy in giả trên máy này thì nhập host.docker.internal">
                <input className="input num" required placeholder="192.168.1.50" value={host} onChange={(e) => setHost(e.target.value)} />
              </Field>
              <Field label="Cổng">
                <input className="input num" required inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))} />
              </Field>
            </div>
          )}
          {save.error && <p className="form-error">{save.error}</p>}
        </form>
      </Dialog>
    </>
  );
}

// FR-02 sơ đồ bàn, FR-03 mở phiên bàn.
// Câu hỏi của màn: "Bàn nào đang có khách, bàn nào cần xử lý?" — bàn lỗi in và đã tạm tính nổi lên trước.

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SOCKET_EVENTS } from '@biahoi/shared';
import { Shell } from '../components/Shell';
import { STATUS_LABEL, TableTile } from '../components/TableTile';
import { Dialog } from '../components/ui';
import { api, errorText } from '../lib/api';
import { vndText } from '../lib/format';
import { useApi, useLive, useMinuteClock } from '../lib/hooks';
import type { MapArea, MapTable, TabDetail } from '../lib/types';

const AREA_KEY = 'biahoi.counter.area';

export function FloorMap() {
  const navigate = useNavigate();
  const location = useLocation();
  const now = useMinuteClock();
  const map = useApi<MapArea[]>('/areas?include=tables');
  useLive([SOCKET_EVENTS.TABLE_UPDATED], map.reload);
  const [areaId, setAreaId] = useState<number | null>(() => {
    try {
      return Number(sessionStorage.getItem(AREA_KEY)) || null;
    } catch {
      return null;
    }
  });
  const [opening, setOpening] = useState<MapTable | null>(null);
  const [guests, setGuests] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null);
  const [busy, setBusy] = useState(false);

  const areas = map.data ?? [];
  const area = areas.find((a) => a.id === areaId) ?? areas[0];
  useEffect(() => {
    if (area) {
      try {
        sessionStorage.setItem(AREA_KEY, String(area.id));
      } catch {
        // không lưu được khu đang xem thì thôi
      }
    }
  }, [area]);

  const all = areas.flatMap((a) => a.tables);
  const occupied = all.filter((t) => t.tab);
  const attention = all.filter((t) => t.status === 'PRINT_ERROR');

  function pick(t: MapTable) {
    if (t.tab) navigate(`/ban/${t.tab.id}`);
    else {
      setError(null);
      setGuests('');
      setOpening(t);
    }
  }

  async function open() {
    if (!opening) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ alreadyOpen: boolean; message?: string; tab: TabDetail }>('/tabs', {
        method: 'POST',
        body: { tableId: opening.id, ...(guests ? { guestCount: Number(guests) } : {}) },
      });
      setOpening(null);
      navigate(`/ban/${res.tab.id}`, {
        state: res.alreadyOpen ? { notice: `${res.message}: bàn ${opening.code} vừa được máy khác mở, bạn đang ở phiên đó.` } : undefined,
      });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      top={
        <nav className="area-tabs" role="tablist" aria-label="Khu">
          {areas.map((a) => {
            const busyCount = a.tables.filter((t) => t.tab).length;
            return (
              <button key={a.id} role="tab" aria-selected={a.id === area?.id} onClick={() => setAreaId(a.id)}>
                {a.name} <span className="num muted">{busyCount}/{a.tables.length}</span>
              </button>
            );
          })}
        </nav>
      }
    >
      <div className="map-head">
        <h1>
          {area?.name ?? 'Sơ đồ bàn'}
          <span className="muted num"> · {area ? `${area.tables.filter((t) => t.tab).length} bàn có khách` : ''}</span>
        </h1>
        <p className="map-summary">
          {attention.length > 0 && (
            <span className="attention">
              {attention.length} bàn lỗi in phiếu:{' '}
              {attention.map((t) => (
                <button key={t.id} className="link-btn" onClick={() => navigate(`/ban/${t.tab!.id}`)}>
                  {t.code}
                </button>
              ))}
            </span>
          )}
          <span className="num">
            Cả quán {occupied.length}/{all.length} bàn · tạm tính {vndText(occupied.reduce((s, t) => s + (t.tab?.total ?? 0), 0))}
          </span>
        </p>
        <p className="legend" aria-label="Chú thích màu">
          {(['EMPTY', 'OPEN', 'PROVISIONAL', 'PRINT_ERROR'] as const).map((s) => (
            <span key={s}>
              <i className={`swatch is-${s.toLowerCase()}`} aria-hidden="true" />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </p>
      </div>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {map.error && !map.data ? (
        <p className="form-error" role="alert">
          {map.error.message}{' '}
          <button className="btn" onClick={map.reload}>
            Thử lại
          </button>
        </p>
      ) : (
        <div className="table-grid fill" aria-busy={!map.data}>
          {area?.tables.map((t) => <TableTile key={t.id} table={t} now={now} onPick={pick} />)}
          {!map.data && Array.from({ length: 24 }, (_, i) => <span key={i} className="table-tile skeleton" />)}
        </div>
      )}

      <Dialog
        open={opening !== null}
        title={`Mở bàn ${opening?.code ?? ''}`}
        onClose={() => setOpening(null)}
        footer={
          <>
            <span className="spacer" />
            <button className="btn big" onClick={() => setOpening(null)}>
              Hủy
            </button>
            <button className="btn primary big" onClick={open} disabled={busy}>
              {busy ? 'Đang mở…' : 'Mở bàn'}
            </button>
          </>
        }
      >
        <fieldset className="field">
          <legend className="field-label">Số khách (không bắt buộc)</legend>
          <div className="guest-picker">
            {[2, 4, 6, 8, 10].map((n) => (
              <button key={n} type="button" className="chip" aria-pressed={guests === String(n)} onClick={() => setGuests(guests === String(n) ? '' : String(n))}>
                {n}
              </button>
            ))}
            <input className="input narrow num" inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value.replace(/\D/g, '').slice(0, 3))} aria-label="Số khách khác" />
          </div>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </Dialog>
    </Shell>
  );
}

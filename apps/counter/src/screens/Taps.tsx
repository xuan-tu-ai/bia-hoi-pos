// FR-10 màn "Vòi bia": vòi và keg đang gắn; "Thay keg" chọn keg mới từ kho, keg cũ chuyển "Đã hết".

import { useState } from 'react';
import { SOCKET_EVENTS } from '@biahoi/shared';
import { Shell } from '../components/Shell';
import { Dialog } from '../components/ui';
import { api } from '../lib/api';
import { dayTimeInline, day, litres } from '../lib/format';
import { useAction, useApi, useLive } from '../lib/hooks';
import type { Keg, Tap } from '../lib/types';

export function Taps() {
  const taps = useApi<Tap[]>('/taps');
  const stock = useApi<Keg[]>('/kegs?status=IN_STOCK');
  useLive([SOCKET_EVENTS.TAP_UPDATED, SOCKET_EVENTS.TABLE_UPDATED], () => {
    taps.reload();
    stock.reload();
  });
  const [changing, setChanging] = useState<Tap | null>(null);
  const [kegId, setKegId] = useState<number | null>(null);
  const action = useAction();

  async function change() {
    if (!changing || !kegId) return;
    const ok = await action.run(() => api(`/taps/${changing.id}/change-keg`, { method: 'POST', body: { kegId } }));
    if (ok) {
      setChanging(null);
      taps.reload();
      stock.reload();
    }
  }

  return (
    <Shell top={<strong className="tab-title">Vòi bia</strong>}>
      <div className="taps-head">
        <h1>Vòi bia</h1>
        <p className="muted">{stock.data ? `${stock.data.length} keg trong kho` : ''}</p>
      </div>
      <ul className="tap-list">
        {taps.data?.map((t) => {
          const keg = t.currentKeg;
          const share = keg ? Math.min(1, keg.soldMl / keg.capacityMl) : 0;
          return (
            <li key={t.id} className="tap-card">
              <div className="tap-info">
                <h2>{t.name}</h2>
                {keg ? (
                  <p className="muted">
                    Keg #{keg.id} · {keg.beerName} · gắn {keg.tappedAt ? dayTimeInline(keg.tappedAt) : '—'}
                  </p>
                ) : (
                  <p className="muted">Chưa gắn keg</p>
                )}
              </div>
              <div className="tap-meter">
                <p className="num">
                  <strong>{keg ? litres(keg.soldMl) : '0,0'}</strong> / {keg ? litres(keg.capacityMl) : '—'} L đã bán
                  {keg && <span className="muted"> · còn khoảng {litres(Math.max(0, keg.capacityMl - keg.soldMl))} L</span>}
                </p>
                <div className="keg-track" role="img" aria-label={`${t.name}: đã bán ${keg ? litres(keg.soldMl) : 0} lít`}>
                  <span className="keg-fill" style={{ width: `${share * 100}%` }} />
                </div>
              </div>
              <button
                className="btn primary big"
                onClick={() => {
                  action.clearError();
                  setKegId(stock.data?.[0]?.id ?? null);
                  setChanging(t);
                }}
                disabled={!stock.data?.length}
              >
                Thay keg
              </button>
            </li>
          );
        })}
      </ul>
      {stock.data && stock.data.length === 0 && <p className="notice">Kho hết keg. Báo chủ quán nhập keg trước khi thay.</p>}

      <Dialog
        open={changing !== null}
        title={`Thay keg ${changing?.name ?? ''}`}
        onClose={() => setChanging(null)}
        footer={
          <>
            <span className="spacer" />
            <button className="btn big" onClick={() => setChanging(null)}>
              Hủy
            </button>
            <button className="btn primary big" onClick={change} disabled={!kegId || action.busy}>
              Gắn keg đã chọn
            </button>
          </>
        }
      >
        {changing?.currentKeg && (
          <p>
            Keg #{changing.currentKeg.id} (đã bán {litres(changing.currentKeg.soldMl)} L) sẽ chuyển sang <strong>Đã hết</strong> và được tính hao hụt.
          </p>
        )}
        <div className="pick-keg" role="radiogroup" aria-label="Keg trong kho">
          {stock.data?.map((k) => (
            <button key={k.id} type="button" role="radio" aria-checked={kegId === k.id} className="chip big" onClick={() => setKegId(k.id)}>
              Keg #{k.id} · {litres(k.capacityMl)} L · nhập {day(k.receivedAt).replace(/^Hôm/, 'hôm')}
            </button>
          ))}
        </div>
        {action.error && (
          <p className="form-error" role="alert">
            {action.error}
          </p>
        )}
      </Dialog>
    </Shell>
  );
}

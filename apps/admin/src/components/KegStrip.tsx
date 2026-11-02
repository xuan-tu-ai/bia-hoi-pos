// Yếu tố riêng của sản phẩm: mỗi vòi là một thanh dài đúng dung tích keg đang gắn, phần đã bán
// tô hổ phách; keg đã hết hiện phần hao hụt, đỏ khi vượt ngưỡng (FR-10, FR-17).

import { dayTimeInline, litres, pct } from '../lib/format';
import type { KegLossRow, Tap } from '../lib/types';

export function TapStrip({ taps }: { taps: Tap[] }) {
  return (
    <ul className="keg-strip">
      {taps.map((tap) => {
        const keg = tap.currentKeg;
        if (!keg) {
          return (
            <li key={tap.id} className="keg-row">
              <div className="keg-head">
                <strong>{tap.name}</strong>
                <span className="muted">Chưa gắn keg</span>
              </div>
              <div className="keg-track" aria-hidden="true" />
            </li>
          );
        }
        const share = Math.min(1, keg.soldMl / keg.capacityMl);
        return (
          <li key={tap.id} className="keg-row">
            <div className="keg-head">
              <span>
                <strong>{tap.name}</strong>
                <span className="muted"> · keg #{keg.id}, gắn {keg.tappedAt ? dayTimeInline(keg.tappedAt) : '—'}</span>
              </span>
              <span className="num">
                <strong>{litres(keg.soldMl)}</strong>
                <span className="muted"> / {litres(keg.capacityMl)} L đã bán</span>
              </span>
            </div>
            <div
              className="keg-track"
              role="img"
              aria-label={`${tap.name}: đã bán ${litres(keg.soldMl)} trên ${litres(keg.capacityMl)} lít`}
            >
              <span className="keg-fill" style={{ width: `${share * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Keg đã hết: phần bán (hổ phách) và phần hao hụt (xám, đỏ khi vượt ngưỡng) trên cùng một thanh. */
export function EmptiedKegBar({ row }: { row: KegLossRow }) {
  const sold = Math.max(0, Math.min(1, row.soldMl / row.capacityMl));
  return (
    <div className="keg-track small" role="img" aria-label={`Bán ${litres(row.soldMl)} L, hao hụt ${litres(row.lossMl)} L (${pct(row.lossPct)})`}>
      <span className="keg-fill" style={{ width: `${sold * 100}%` }} />
      <span className={row.exceeded ? 'keg-loss over' : 'keg-loss'} style={{ left: `${sold * 100}%`, width: `${(1 - sold) * 100}%` }} />
    </div>
  );
}

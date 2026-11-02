// FR-17 — câu hỏi: "Keg nào mất bia nhiều hơn mức cho phép?"

import { useState } from 'react';
import { EmptiedKegBar } from '../components/KegStrip';
import { Empty, ErrorBlock, Field, Money, SkeletonRows, Stamp, TitleRow } from '../components/ui';
import { query } from '../lib/api';
import { day, dayTimeInline, duration, litres, pct, vnd, vnDate } from '../lib/format';
import { useApi, useNarrow } from '../lib/hooks';
import type { KegLossReport } from '../lib/types';

export function KegLoss() {
  const [from, setFrom] = useState(vnDate(30));
  const [to, setTo] = useState(vnDate(0));
  const [threshold, setThreshold] = useState('');
  const narrow = useNarrow();
  const report = useApi<KegLossReport>(`/reports/keg-loss${query({ from, to, threshold })}`);
  const d = report.data;

  const sub = d
    ? d.summary.kegCount === 0
      ? 'Chưa có keg nào hết trong khoảng này.'
      : `${d.summary.exceededCount} trong ${d.summary.kegCount} keg vượt ngưỡng ${pct(d.thresholdPct)} · tổng mất ${litres(d.summary.totalLossMl)} L`
    : 'Đang tải…';

  return (
    <>
      <TitleRow title="Hao hụt keg" sub={sub} actions={<Stamp at={report.updatedAt} onRefresh={report.reload} busy={report.loading} />} />

      <div className="filters">
        <Field label="Keg hết từ ngày">
          <input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="đến ngày">
          <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Ngưỡng hao hụt (%)">
          <input
            className="input narrow"
            type="number"
            min={0}
            max={100}
            step={0.5}
            placeholder={String(d?.thresholdPct ?? 5)}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </Field>
      </div>

      {d && d.summary.kegCount > 0 && (
        <section className="kpis" aria-label="Tổng hợp hao hụt">
          <div className="kpi lead">
            <p className="kpi-label">Tiền bia mất</p>
            <p className="kpi-value">
              <Money value={d.summary.totalLossValue} />
            </p>
            <p className="delta">Quy theo giá nhập của {d.summary.kegCount} keg đã hết</p>
          </div>
          <div className="kpi">
            <p className="kpi-label">Bia mất</p>
            <p className="kpi-value num">
              {litres(d.summary.totalLossMl)}
              <small> L</small>
            </p>
            <p className="delta">{pct((d.summary.totalLossMl / d.summary.capacityMl) * 100)} tổng dung tích</p>
          </div>
          <div className="kpi">
            <p className="kpi-label">Bia đã bán</p>
            <p className="kpi-value num">
              {litres(d.summary.soldMl)}
              <small> L</small>
            </p>
            <p className="delta">Trên {litres(d.summary.capacityMl)} L của các keg đã hết</p>
          </div>
          <div className="kpi">
            <p className="kpi-label">Keg vượt ngưỡng</p>
            <p className="kpi-value num">
              {d.summary.exceededCount}
              <small> /{d.summary.kegCount}</small>
            </p>
            <p className="delta">Ngưỡng {pct(d.thresholdPct)}</p>
          </div>
        </section>
      )}

      <section className="panel flush">
        {report.error && !d ? (
          <ErrorBlock error={report.error} onRetry={report.reload} />
        ) : !d ? (
          <SkeletonRows rows={4} />
        ) : d.rows.length === 0 ? (
          <Empty>Không có keg nào hết từ {from} đến {to}.</Empty>
        ) : narrow ? (
          <ul className="rows">
            {d.rows.map((k) => (
              <li className="keg-item" key={k.id}>
                <div className="row-top">
                  <strong>Keg #{k.id}</strong>
                  <span className={k.exceeded ? 'pill neg' : 'pill'}>{pct(k.lossPct)}</span>
                </div>
                <EmptiedKegBar row={k} />
                <span className="sub num">
                  {k.tap?.name ?? '—'} · hết {k.emptiedAt ? day(k.emptiedAt) : '—'} · bán {litres(k.soldMl)} L, mất {litres(k.lossMl)} L ({vnd(k.lossValue)} đ)
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Keg</th>
                  <th>Vòi</th>
                  <th>Thời gian dùng</th>
                  <th className="bar-col">Bán và hao hụt</th>
                  <th className="n">Đã bán</th>
                  <th className="n">Hao hụt</th>
                  <th className="n">Tiền mất</th>
                  <th className="n">Tỉ lệ</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((k) => (
                  <tr key={k.id}>
                    <td>
                      Keg #{k.id}
                      <span className="sub">
                        {k.beerName}, {litres(k.capacityMl)} L
                      </span>
                    </td>
                    <td>{k.tap?.name ?? '—'}</td>
                    <td>
                      {k.emptiedAt ? `Hết ${dayTimeInline(k.emptiedAt)}` : '—'}
                      <span className="sub">{k.durationMinutes != null ? `Dùng ${duration(k.durationMinutes)}` : '—'}</span>
                    </td>
                    <td className="bar-col">
                      <EmptiedKegBar row={k} />
                    </td>
                    <td className="n num">
                      {litres(k.soldMl)}
                      <small className="unit"> L</small>
                    </td>
                    <td className="n num">
                      {litres(k.lossMl)}
                      <small className="unit"> L</small>
                    </td>
                    <td className="n">
                      <Money value={k.lossValue} />
                    </td>
                    <td className="n">
                      <span className={k.exceeded ? 'pill neg' : 'pill'}>{pct(k.lossPct)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="footnote">
        Hao hụt = dung tích keg − thể tích đã bán (cốc 0,5 L, ca 1,5 L, tháp 3 L). Món bia bị hủy được trừ khỏi thể tích đã bán.
      </p>
    </>
  );
}

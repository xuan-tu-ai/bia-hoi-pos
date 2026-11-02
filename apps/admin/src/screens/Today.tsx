// FR-16 — câu hỏi của màn: "Hôm nay quán thu được bao nhiêu, và có gì cần chú ý?"
// Lớn nhất là tiền đã thu; phát hiện cần chú ý đứng ngay dưới tiêu đề.

import { Link } from 'react-router-dom';
import { SOCKET_EVENTS, vnParts } from '@biahoi/shared';
import { Chart } from '../components/Chart';
import { EmptiedKegBar, TapStrip } from '../components/KegStrip';
import { Empty, ErrorBlock, Money, Skeleton, SkeletonRows, Stamp, TitleRow } from '../components/ui';
import { query } from '../lib/api';
import { int, litres, longDate, pct, signed, time, vnd, vndText, day } from '../lib/format';
import { useApi, useInterval, useLive } from '../lib/hooks';
import type { HourlyReport, KegLossReport, Tap, TodayReport, VoidsReport } from '../lib/types';

const OPEN_HOUR = 10; // quán mở cửa 10:00 (mẫu)

function findingOf(voids: VoidsReport | undefined, loss: KegLossReport | undefined): string {
  const lastKeg = loss?.rows[0];
  if (lastKeg?.exceeded && lastKeg.emptiedAt) {
    return `Keg #${lastKeg.id} hết ${day(lastKeg.emptiedAt).replace(/^Hôm/, 'hôm')} lúc ${time(lastKeg.emptiedAt)}, hao hụt ${pct(lastKeg.lossPct)} — vượt ngưỡng ${pct(loss!.thresholdPct)}.`;
  }
  if (voids && voids.count > 0) return `${voids.count} lần hủy/giảm hôm nay, tổng ${vndText(voids.total)}.`;
  if (voids) return 'Chưa có lần hủy/giảm món nào hôm nay.';
  return '';
}

function Delta({ now, before, unit }: { now: number; before: number; unit?: string }) {
  if (before === 0 && now === 0) return <p className="delta">Cùng giờ hôm qua cũng chưa có</p>;
  if (before === 0) return <p className="delta">Cùng giờ hôm qua: 0{unit ? ` ${unit}` : ''}</p>;
  const diff = now - before;
  const f = unit === 'đ' ? vnd : int;
  return (
    <p className="delta">
      <span className={diff > 0 ? 'up' : diff < 0 ? 'down' : ''}>
        {signed(diff, f)}
        {unit ? ` ${unit}` : ''}
      </span>{' '}
      so với cùng giờ hôm qua
    </p>
  );
}

export function Today() {
  const today = useApi<TodayReport>('/reports/today');
  const hourly = useApi<HourlyReport>('/reports/hourly');
  const taps = useApi<Tap[]>('/taps');
  const voids = useApi<VoidsReport>('/reports/voids');
  const loss = useApi<KegLossReport>(`/reports/keg-loss${query({})}`);

  const reloadAll = () => {
    today.reload();
    hourly.reload();
    taps.reload();
    voids.reload();
    loss.reload();
  };
  useInterval(30_000, reloadAll);
  useLive([SOCKET_EVENTS.DASHBOARD_UPDATED, SOCKET_EVENTS.TAP_UPDATED], reloadAll);

  const t = today.data;
  const nowHour = vnParts(new Date()).hour;
  const firstHour = Math.min(OPEN_HOUR, ...(hourly.data?.rows.filter((r) => r.revenue > 0).map((r) => r.hour) ?? []));
  const hours = hourly.data?.rows.filter((r) => r.hour >= firstHour && r.hour <= Math.max(nowHour, firstHour)) ?? [];
  const peak = hours.reduce((best, r) => (r.revenue > (best?.revenue ?? 0) ? r : best), undefined as (typeof hours)[number] | undefined);
  const recentKegs = loss.data?.rows.slice(0, 3) ?? [];

  return (
    <>
      <TitleRow
        title="Hôm nay"
        sub={
          <>
            {longDate()}
            {findingOf(voids.data, loss.data) && <span className="finding"> · {findingOf(voids.data, loss.data)}</span>}
          </>
        }
        actions={<Stamp at={today.updatedAt} onRefresh={reloadAll} busy={today.loading} />}
      />

      {today.error && !t ? (
            <ErrorBlock error={today.error} onRetry={today.reload} />
          ) : (
            <section className="kpis" aria-label="Số liệu hôm nay">
              <div className="kpi lead">
                <p className="kpi-label">Đã thu</p>
                <p className="kpi-value">{t ? <Money value={t.revenue} /> : <Skeleton width={160} height={34} />}</p>
                {t && <Delta now={t.revenue} before={t.yesterday.revenue} unit="đ" />}
              </div>
              <div className="kpi">
                <p className="kpi-label">Tạm tính đang mở</p>
                <p className="kpi-value">{t ? <Money value={t.openTotal} /> : <Skeleton width={120} height={24} />}</p>
                {t && <p className="delta">Chưa thu, trên {t.occupiedTables} bàn</p>}
              </div>
              <div className="kpi">
                <p className="kpi-label">Bàn đang ngồi</p>
                <p className="kpi-value num">
                  {t ? (
                    <>
                      {t.occupiedTables}
                      <small> /{t.totalTables}</small>
                    </>
                  ) : (
                    <Skeleton width={80} height={24} />
                  )}
                </p>
                {t && <p className="delta">{pct((t.occupiedTables / Math.max(1, t.totalTables)) * 100)} số bàn</p>}
              </div>
              <div className="kpi">
                <p className="kpi-label">Hóa đơn đã thu</p>
                <p className="kpi-value num">{t ? int(t.billCount) : <Skeleton width={60} height={24} />}</p>
                {t && <Delta now={t.billCount} before={t.yesterday.billCount} />}
              </div>
            </section>
          )}

      <div className="overview">
        <div className="main-col">
          <section className="panel">
            <header>
              <h2>Doanh thu theo giờ</h2>
              <span className="meta">
                {peak && peak.revenue > 0 ? `Đông nhất ${String(peak.hour).padStart(2, '0')}:00, ${vndText(peak.revenue)}` : 'Tiền đã thu, theo giờ thanh toán'}
              </span>
            </header>
            {hourly.error && !hourly.data ? (
              <ErrorBlock error={hourly.error} onRetry={hourly.reload} />
            ) : hours.length === 0 ? (
              <Skeleton width="100%" height={200} />
            ) : (
              <Chart
                label="Doanh thu theo giờ hôm nay"
                deps={[hours.map((h) => h.revenue).join(','), peak?.hour]}
                draw={(el, C) =>
                  C.bars(el, {
                    labels: hours.map((h) => `${String(h.hour).padStart(2, '0')}:00`),
                    values: hours.map((h) => h.revenue),
                    format: (v) => vndText(v),
                    tickFormat: (v) => (v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString('vi-VN')} tr` : v >= 1000 ? `${v / 1000}k` : String(v)),
                    highlight: peak && peak.revenue > 0 ? hours.indexOf(peak) : null,
                    height: 200,
                  })
                }
              />
            )}
          </section>

          <section className="panel">
            <header>
              <h2>Vòi bia</h2>
              <Link className="card-link" to="/kho-keg">
                Kho keg
              </Link>
            </header>
            {taps.error && !taps.data ? (
              <ErrorBlock error={taps.error} onRetry={taps.reload} />
            ) : taps.data ? (
              taps.data.length ? <TapStrip taps={taps.data} /> : <Empty>Chưa khai báo vòi nào.</Empty>
            ) : (
              <SkeletonRows rows={2} />
            )}
          </section>
        </div>

        <aside className="rail">
          <h2 className="rail-heading">Hủy & giảm hôm nay</h2>
          <section className="panel">
            {voids.error && !voids.data ? (
              <ErrorBlock error={voids.error} onRetry={voids.reload} />
            ) : !voids.data ? (
              <SkeletonRows rows={4} />
            ) : voids.data.count === 0 ? (
              <Empty>Chưa có lần hủy hay giảm giá nào.</Empty>
            ) : (
              <>
                <p className="rail-total">
                  <Money value={voids.data.total} />
                  <span className="muted"> trong {voids.data.count} lần</span>
                </p>
                <ul className="rows">
                  {voids.data.rows.slice(0, 5).map((r) => (
                    <li className="row two-line" key={r.id}>
                      <span className="grow">
                        <span className="truncate-line">{r.itemName ?? 'Giảm giá hóa đơn'}</span>
                        <span className="sub">
                          Bàn {r.tableCode} · {time(r.createdAt)} · {r.reasonNote || r.reasonLabel}
                        </span>
                      </span>
                      <span className="num end">−{vnd(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <footer className="panel-foot">
              <Link className="card-link" to="/nhat-ky-huy">
                Xem nhật ký
              </Link>
            </footer>
          </section>

          <h2 className="rail-heading">Keg vừa hết</h2>
          <section className="panel">
            {loss.error && !loss.data ? (
              <ErrorBlock error={loss.error} onRetry={loss.reload} />
            ) : !loss.data ? (
              <SkeletonRows rows={3} />
            ) : recentKegs.length === 0 ? (
              <Empty>Chưa có keg nào hết trong 31 ngày qua.</Empty>
            ) : (
              <ul className="rows">
                {recentKegs.map((k) => (
                  <li className="keg-item" key={k.id}>
                    <div className="row-top">
                      <span>
                        <strong>Keg #{k.id}</strong>
                        <span className="muted"> · {k.emptiedAt ? day(k.emptiedAt) : '—'}</span>
                      </span>
                      <span className={k.exceeded ? 'pill neg' : 'pill'}>Hao hụt {pct(k.lossPct)}</span>
                    </div>
                    <EmptiedKegBar row={k} />
                    <span className="sub num">
                      Bán {litres(k.soldMl)} L · mất {litres(k.lossMl)} L
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <footer className="panel-foot">
              <Link className="card-link" to="/hao-hut-keg">
                Báo cáo hao hụt
              </Link>
            </footer>
          </section>
        </aside>
      </div>
    </>
  );
}

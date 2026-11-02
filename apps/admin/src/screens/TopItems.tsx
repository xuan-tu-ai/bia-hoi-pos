// FR-19 — câu hỏi: "Món nào bán chạy nhất, và quán đông vào giờ nào?"

import { useState } from 'react';
import { Chart } from '../components/Chart';
import { Empty, ErrorBlock, Segmented, Skeleton, SkeletonRows, Stamp, TitleRow } from '../components/ui';
import { query } from '../lib/api';
import { int, vnd, vndText, vnDate } from '../lib/format';
import { useApi } from '../lib/hooks';
import type { HourlyReport, TopItemsReport } from '../lib/types';

type Range = '1' | '7' | '30';
type By = 'qty' | 'revenue';

const RANGE_LABEL: Record<Range, string> = { '1': 'hôm nay', '7': '7 ngày qua', '30': '30 ngày qua' };
const compact = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

export function TopItems() {
  const [range, setRange] = useState<Range>('7');
  const [by, setBy] = useState<By>('qty');
  const span = { from: vnDate(Number(range) - 1), to: vnDate(0) };
  const top = useApi<TopItemsReport>(`/reports/top-items${query({ ...span, by, limit: 10 })}`);
  const hourly = useApi<HourlyReport>(`/reports/hourly${query(span)}`);

  const rows = top.data?.rows ?? [];
  const hours = (hourly.data?.rows ?? []).filter((r) => r.hour >= 10 || r.revenue > 0);
  const perDay = (hourly.data?.days ?? 1) > 1;
  const values = hours.map((h) => (perDay ? h.avgRevenuePerDay : h.revenue));
  const peakIdx = values.reduce((best, v, i) => (v > values[best]! ? i : best), 0);
  const peak = hours[peakIdx];
  const leader = rows[0];
  const days = hourly.data?.days ?? 1;
  const totalRevenue = (hourly.data?.rows ?? []).reduce((s, r) => s + r.revenue, 0);
  const totalBills = (hourly.data?.rows ?? []).reduce((s, r) => s + r.billCount, 0);

  const sub =
    leader && peak && values[peakIdx]! > 0
      ? `${RANGE_LABEL[range][0]!.toUpperCase()}${RANGE_LABEL[range].slice(1)}: bán chạy nhất là ${leader.name} (${int(leader.qty)}); đông nhất lúc ${String(peak.hour).padStart(2, '0')}:00`
      : `Số liệu ${RANGE_LABEL[range]}`;

  return (
    <>
      <TitleRow
        title="Bán chạy & giờ cao điểm"
        sub={sub}
        actions={
          <Stamp
            at={top.updatedAt}
            onRefresh={() => {
              top.reload();
              hourly.reload();
            }}
            busy={top.loading}
          />
        }
      />
      <div className="filters">
        <Segmented<Range>
          label="Khoảng thời gian"
          value={range}
          onChange={setRange}
          options={[
            { value: '1', label: 'Hôm nay' },
            { value: '7', label: '7 ngày' },
            { value: '30', label: '30 ngày' },
          ]}
        />
      </div>

      <div className="pair">
        <section className="panel">
          <header>
            <h2>Top 10 món</h2>
            <Segmented<By>
              label="Xếp theo"
              value={by}
              onChange={setBy}
              options={[
                { value: 'qty', label: 'Số lượng' },
                { value: 'revenue', label: 'Doanh thu' },
              ]}
            />
          </header>
          {top.error && !top.data ? (
            <ErrorBlock error={top.error} onRetry={top.reload} />
          ) : !top.data ? (
            <SkeletonRows rows={10} />
          ) : rows.length === 0 ? (
            <Empty>Chưa bán món nào trong khoảng này.</Empty>
          ) : (
            <Chart
              label={`Top 10 món theo ${by === 'qty' ? 'số lượng' : 'doanh thu'}`}
              deps={[rows.map((r) => `${r.itemId}:${r.qty}:${r.revenue}`).join(','), by]}
              draw={(el, C) =>
                C.barList(
                  el,
                  rows.map((r) => ({ label: r.name, value: by === 'qty' ? r.qty : r.revenue })),
                  { format: by === 'qty' ? int : (v) => `${vnd(v)} đ` },
                )
              }
            />
          )}
          <p className="footnote in-panel">Số lượng đã trừ món bị hủy; doanh thu đã trừ hủy và giảm giá món.</p>
        </section>

        <section className="panel">
          <header>
            <h2>{perDay ? 'Doanh thu trung bình mỗi ngày, theo giờ' : 'Doanh thu theo giờ'}</h2>
            <span className="meta">Theo giờ thanh toán</span>
          </header>
          {hourly.error && !hourly.data ? (
            <ErrorBlock error={hourly.error} onRetry={hourly.reload} />
          ) : !hourly.data ? (
            <Skeleton width="100%" height={260} />
          ) : (
            <Chart
              label="Doanh thu theo giờ trong ngày"
              deps={[values.join(','), range]}
              draw={(el, C) =>
                C.bars(el, {
                  labels: hours.map((h) => `${String(h.hour).padStart(2, '0')}:00`),
                  values,
                  format: vndText,
                  tickFormat: compact,
                  highlight: values[peakIdx]! > 0 ? peakIdx : null,
                  height: 260,
                })
              }
            />
          )}
          {hourly.data && (
            <dl className="kv">
              <div>
                <dt>{perDay ? 'Doanh thu trung bình mỗi ngày' : 'Doanh thu hôm nay'}</dt>
                <dd className="num">{vndText(Math.round(totalRevenue / days))}</dd>
              </div>
              <div>
                <dt>{perDay ? 'Hóa đơn trung bình mỗi ngày' : 'Hóa đơn hôm nay'}</dt>
                <dd className="num">{(totalBills / days).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</dd>
              </div>
              <div>
                <dt>Giờ đông nhất</dt>
                <dd className="num">{peak && values[peakIdx]! > 0 ? `${String(peak.hour).padStart(2, '0')}:00, ${vndText(values[peakIdx]!)}${perDay ? ' mỗi ngày' : ''}` : '—'}</dd>
              </div>
              <div>
                <dt>Tổng {RANGE_LABEL[range]}</dt>
                <dd className="num">{vndText(totalRevenue)}</dd>
              </div>
            </dl>
          )}
        </section>
      </div>
    </>
  );
}

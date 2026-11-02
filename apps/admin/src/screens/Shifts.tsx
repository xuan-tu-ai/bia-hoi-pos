// FR-09 — câu hỏi: "Các ca có đủ tiền không?" Xem lại báo cáo đóng ca trên web.

import { useState } from 'react';
import { Empty, ErrorBlock, Money, Segmented, SkeletonRows, Stamp, TitleRow } from '../components/ui';
import { query } from '../lib/api';
import { day, int, signed, time, vnd, vndText, vnDate } from '../lib/format';
import { useApi, useNarrow } from '../lib/hooks';
import type { Shift } from '../lib/types';

type Range = '7' | '30' | '90';

function Diff({ value }: { value: number | null }) {
  if (value === null) return <span className="muted">—</span>;
  if (value === 0) return <span className="num">0</span>;
  return <span className={value < 0 ? 'num neg-text' : 'num'}>{signed(value, vnd)}</span>;
}

export function Shifts() {
  const [range, setRange] = useState<Range>('7');
  const narrow = useNarrow();
  const list = useApi<Shift[]>(`/shifts${query({ from: vnDate(Number(range) - 1), to: vnDate(0) })}`);
  const shifts = list.data ?? [];
  const closed = shifts.filter((s) => s.closedAt);
  const short = closed.filter((s) => (s.summary?.difference ?? 0) < 0);
  const shortTotal = short.reduce((sum, s) => sum + (s.summary?.difference ?? 0), 0);

  const sub = list.data
    ? closed.length === 0
      ? 'Chưa có ca nào đóng trong khoảng này.'
      : short.length
        ? `${short.length} trong ${closed.length} ca thiếu tiền mặt, tổng ${vndText(Math.abs(shortTotal))}`
        : `${closed.length} ca đã đóng, không ca nào thiếu tiền mặt`
    : 'Đang tải…';

  return (
    <>
      <TitleRow title="Ca làm việc" sub={sub} actions={<Stamp at={list.updatedAt} onRefresh={list.reload} busy={list.loading} />} />
      <div className="filters">
        <Segmented<Range>
          label="Khoảng thời gian"
          value={range}
          onChange={setRange}
          options={[
            { value: '7', label: '7 ngày' },
            { value: '30', label: '30 ngày' },
            { value: '90', label: '90 ngày' },
          ]}
        />
      </div>
      <section className="panel flush">
        {list.error && !list.data ? (
          <ErrorBlock error={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <SkeletonRows rows={6} />
        ) : shifts.length === 0 ? (
          <Empty>Không có ca nào trong {range} ngày qua.</Empty>
        ) : narrow ? (
          <ul className="rows">
            {shifts.map((s) => (
              <li className="row two-line" key={s.id}>
                <span className="grow">
                  <span>
                    {day(s.openedAt)}, {time(s.openedAt)}–{s.closedAt ? time(s.closedAt) : 'đang mở'}
                  </span>
                  <span className="sub">
                    Thu {vndText(s.summary?.revenue ?? 0)} · {int(s.summary?.billCount ?? 0)} hóa đơn · {s.closedBy?.name ?? s.openedBy.name}
                  </span>
                </span>
                <span className="end">{s.closedAt ? <Diff value={s.summary?.difference ?? null} /> : <span className="pill accent">Đang mở</span>}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ca</th>
                  <th>Người mở / đóng</th>
                  <th className="n">Hóa đơn</th>
                  <th className="n">Tiền mặt</th>
                  <th className="n">Chuyển khoản</th>
                  <th className="n">Tiền phải có</th>
                  <th className="n">Tiền đếm</th>
                  <th className="n">Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {day(s.openedAt)}
                      <span className="sub">
                        {time(s.openedAt)}–{s.closedAt ? time(s.closedAt) : 'đang mở'}
                      </span>
                    </td>
                    <td>
                      {s.openedBy.name}
                      <span className="sub">{s.closedBy ? `Đóng: ${s.closedBy.name}` : 'Chưa đóng ca'}</span>
                    </td>
                    <td className="n num">{int(s.summary?.billCount ?? 0)}</td>
                    <td className="n">
                      <Money value={s.summary?.cashTotal ?? 0} />
                    </td>
                    <td className="n">
                      <Money value={s.summary?.transferTotal ?? 0} />
                    </td>
                    <td className="n">
                      <Money value={s.summary?.expectedCash ?? s.openingCash} />
                      <span className="sub">đầu ca {vnd(s.openingCash)}</span>
                    </td>
                    <td className="n">{s.countedCash !== null ? <Money value={s.countedCash} /> : <span className="muted">—</span>}</td>
                    <td className="n">{s.closedAt ? <Diff value={s.summary?.difference ?? null} /> : <span className="pill accent">Đang mở</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="footnote">Tiền phải có = tiền đầu ca + tiền mặt thu trong ca. Chênh lệch âm là thiếu tiền.</p>
    </>
  );
}

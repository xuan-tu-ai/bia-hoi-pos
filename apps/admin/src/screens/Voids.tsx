// FR-18 — câu hỏi: "Ai hủy, giảm những gì, ai duyệt, mất bao nhiêu tiền?"

import { useMemo, useState } from 'react';
import { ADJUST_REASONS, ADJUST_REASON_LABELS, SOCKET_EVENTS, type AdjustReason } from '@biahoi/shared';
import { PushToggle } from '../components/PushToggle';
import { Empty, ErrorBlock, Field, Money, SkeletonRows, Stamp, TitleRow } from '../components/ui';
import { isOwner, useAuth } from '../lib/auth';
import { query } from '../lib/api';
import { dayTime, int, time, vnd, vndText, vnDate } from '../lib/format';
import { useApi, useLive, useNarrow } from '../lib/hooks';
import type { VoidRow, VoidsReport } from '../lib/types';

const TYPE_LABEL: Record<VoidRow['type'], string> = { VOID: 'Hủy món', DISCOUNT: 'Giảm món', BILL_DISCOUNT: 'Giảm hóa đơn' };

function uniquePeople(rows: VoidRow[], pick: (r: VoidRow) => { id: number; name: string } | null) {
  const map = new Map<number, string>();
  for (const r of rows) {
    const p = pick(r);
    if (p) map.set(p.id, p.name);
  }
  return [...map].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
}

export function Voids() {
  const [from, setFrom] = useState(vnDate(6));
  const [to, setTo] = useState(vnDate(0));
  const [reason, setReason] = useState<AdjustReason | ''>('');
  const [staffId, setStaffId] = useState('');
  const [approverId, setApproverId] = useState('');
  const narrow = useNarrow();
  const { user } = useAuth();
  const report = useApi<VoidsReport>(`/reports/voids${query({ from, to })}`);
  useLive([SOCKET_EVENTS.DASHBOARD_UPDATED], report.reload);

  const all = report.data?.rows ?? [];
  const rows = useMemo(
    () =>
      all.filter(
        (r) =>
          (!reason || r.reason === reason) &&
          (!staffId || String(r.requestedBy.id) === staffId) &&
          (!approverId || String(r.approvedBy?.id) === approverId),
      ),
    [all, reason, staffId, approverId],
  );
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const requesters = uniquePeople(all, (r) => r.requestedBy);
  const approvers = uniquePeople(all, (r) => r.approvedBy);
  const filtered = rows.length !== all.length;
  const byType = (t: VoidRow['type']) => {
    const of = rows.filter((r) => r.type === t);
    return { count: of.length, amount: of.reduce((s, r) => s + r.amount, 0) };
  };

  const sub = report.data
    ? rows.length === 0
      ? 'Không có lần hủy hay giảm giá nào.'
      : `${int(rows.length)} lần, tổng ${vndText(total)}${filtered ? ` (lọc từ ${int(all.length)} lần)` : ''}`
    : 'Đang tải…';

  return (
    <>
      <TitleRow title="Nhật ký hủy/giảm" sub={sub} actions={<Stamp at={report.updatedAt} onRefresh={report.reload} busy={report.loading} />} />

      {isOwner(user) && <PushToggle />}

      <div className="filters">
        <Field label="Từ ngày">
          <input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="đến ngày">
          <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Lý do">
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value as AdjustReason | '')}>
            <option value="">Tất cả lý do</option>
            {ADJUST_REASONS.map((r) => (
              <option key={r} value={r}>
                {ADJUST_REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Người yêu cầu">
          <select className="input" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Tất cả</option>
            {requesters.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Người duyệt">
          <select className="input" value={approverId} onChange={(e) => setApproverId(e.target.value)}>
            <option value="">Tất cả</option>
            {approvers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {report.data && (
        <section className="kpis" aria-label="Tổng hợp hủy và giảm giá">
          <div className="kpi lead">
            <p className="kpi-label">Tổng tiền bị hủy/giảm</p>
            <p className="kpi-value">
              <Money value={total} />
            </p>
            <p className="delta">{int(rows.length)} lần trong khoảng đã chọn</p>
          </div>
          {(['VOID', 'DISCOUNT', 'BILL_DISCOUNT'] as const).map((t) => {
            const v = byType(t);
            return (
              <div className="kpi" key={t}>
                <p className="kpi-label">{TYPE_LABEL[t]}</p>
                <p className="kpi-value">
                  <Money value={v.amount} />
                </p>
                <p className="delta">{v.count ? `${int(v.count)} lần` : 'Không có'}</p>
              </div>
            );
          })}
        </section>
      )}

      <section className="panel flush">
        {report.error && !report.data ? (
          <ErrorBlock error={report.error} onRetry={report.reload} />
        ) : !report.data ? (
          <SkeletonRows rows={6} />
        ) : rows.length === 0 ? (
          <Empty>{filtered ? 'Không có lần nào khớp bộ lọc.' : `Không có lần hủy hay giảm giá nào từ ${from} đến ${to}.`}</Empty>
        ) : narrow ? (
          <ul className="rows">
            {rows.map((r) => (
              <li className="row two-line" key={r.id}>
                <span className="grow">
                  <span className="truncate-line">
                    {r.itemName ?? 'Giảm giá hóa đơn'}
                    {r.qty ? ` ×${r.qty}` : ''}
                  </span>
                  <span className="sub">
                    {TYPE_LABEL[r.type]} · bàn {r.tableCode} · {time(r.createdAt)} · {r.reasonNote || r.reasonLabel} · {r.requestedBy.name} → {r.approvedBy?.name ?? '—'}
                  </span>
                </span>
                <span className="num end">−{vnd(r.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Bàn</th>
                  <th>Món</th>
                  <th className="n">SL</th>
                  <th className="n">Số tiền</th>
                  <th>Lý do</th>
                  <th>Người yêu cầu</th>
                  <th>Người duyệt</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{dayTime(r.createdAt)}</td>
                    <td>{r.tableCode}</td>
                    <td>
                      {r.itemName ?? 'Cả hóa đơn'}
                      <span className="sub">{TYPE_LABEL[r.type]}</span>
                    </td>
                    <td className="n num">{r.qty ?? '—'}</td>
                    <td className="n num">
                      −<Money value={r.amount} />
                    </td>
                    <td>
                      {r.reasonLabel}
                      {r.reasonNote && <span className="sub">{r.reasonNote}</span>}
                    </td>
                    <td>{r.requestedBy.name}</td>
                    <td>{r.approvedBy?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

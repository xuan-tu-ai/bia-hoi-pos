import { useCallback, useEffect, useState } from 'react';
import { formatDate, formatMoney, formatTime } from '../../lib/format.ts';
import { reportsApi } from '../../services/reports.ts';
import { ADJUSTMENT_REASONS, type AdjustmentReason, type ReportKegLoss, type ReportSummary, type ReportTopItems, type ReportVoid } from '../../types/index.ts';

const reasonToApi: Record<AdjustmentReason, string> = {
  'Khách đổi ý': 'CUSTOMER_CHANGED_MIND',
  'Bếp hết món': 'OUT_OF_STOCK',
  'Nhập nhầm': 'WRONG_ENTRY',
  'Món lỗi': 'DEFECTIVE',
  'Khác': 'OTHER'
};

export function ReportPage({ view, onToast }: { view: string; onToast: (message: string) => void }) {
  if (view === 'reports') return <ReportsPage onToast={onToast} />;
  if (view === 'kegLoss') return <KegLossPage onToast={onToast} />;
  if (view === 'voids') return <VoidsPage onToast={onToast} />;
  if (view === 'topItems') return <TopItemsPage onToast={onToast} />;
  return null;
}

function ReportsPage({ onToast }: { onToast: (message: string) => void }) {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [updatedAt, setUpdatedAt] = useState('');

  useEffect(() => {
    let active = true;
    reportsApi.today()
      .then((res) => {
        if (!active) return;
        setSummary(res);
        setUpdatedAt(formatTime(new Date().toISOString()));
      })
      .catch((error: unknown) => {
        if (active) onToast(error instanceof Error ? error.message : 'Không thể tải báo cáo hôm nay.');
      });
    return () => { active = false; };
  }, [onToast]);

  const revenue = summary?.revenue ?? 0;
  const yesterday = summary?.yesterdayRevenue ?? 0;
  const diffPct = yesterday > 0 ? Math.round(((revenue - yesterday) / yesterday) * 100) : 0;
  const cash = summary?.cashRevenue ?? 0;
  const transfer = summary?.transferRevenue ?? 0;
  const totalPay = cash + transfer || 1;
  const cashPct = cash + transfer > 0 ? Math.round((cash / totalPay) * 100) : 0;
  const transferPct = cash + transfer > 0 ? 100 - cashPct : 0;

  const hours = Array.from({ length: 14 }, (_, i) => i + 9);
  const todayMap = new Map((summary?.hourly ?? []).map((h) => [h.hour, h.revenue]));
  const yesterdayMap = new Map((summary?.yesterdayHourly ?? []).map((h) => [h.hour, h.revenue]));
  const maxHour = Math.max(1, ...hours.map((h) => Math.max(todayMap.get(h) ?? 0, yesterdayMap.get(h) ?? 0)));

  return <main className="page-content reports-content">
    <Heading title="Tổng quan hôm nay" subtitle="FR-16 · Doanh thu đã thu, tạm tính và tình hình hoạt động" action={<span className="report-updated">{updatedAt ? `Cập nhật lúc ${updatedAt} · Neon DB` : 'Đang tải...'}</span>} />
    <section className="report-metrics">
      <Metric label="Doanh thu đã thu" value={formatMoney(revenue)} change={yesterday > 0 ? `${diffPct >= 0 ? '+' : ''}${diffPct}% so với hôm qua` : 'Hôm nay'} />
      <Metric label="Tạm tính đang mở" value={formatMoney(summary?.openAmount ?? 0)} change={`${summary?.occupiedTables ?? 0} bàn đang phục vụ`} />
      <Metric label="Bàn đang ngồi" value={`${summary?.occupiedTables ?? 0} / ${summary?.totalTables ?? 80}`} change={`${summary?.totalTables ? Math.round(((summary.occupiedTables ?? 0) / summary.totalTables) * 100) : 0}% công suất`} />
      <Metric label="Số hóa đơn" value={String(summary?.bills ?? 0)} change="Đã thanh toán hôm nay" />
    </section>
    <div className="report-grid">
      <section className="panel report-panel">
        <header className="panel-header"><div><h2 className="panel-title">Doanh thu theo giờ</h2><div className="panel-subtitle">Hôm nay so với hôm qua (9g – 22g)</div></div></header>
        <div className="feature-hour-bars">
          {hours.map((hour) => {
            const tH = Math.round(((todayMap.get(hour) ?? 0) / maxHour) * 100);
            const yH = Math.round(((yesterdayMap.get(hour) ?? 0) / maxHour) * 100);
            return <div className="feature-hour-group" key={hour} title={`${hour}:00 · Hôm nay ${formatMoney(todayMap.get(hour) ?? 0)}`}>
              <span style={{ height: `${Math.max(3, tH)}%` }} />
              <i style={{ height: `${Math.max(3, yH)}%` }} />
            </div>;
          })}
        </div>
        <div className="report-legend"><span>● Hôm nay</span><span>● Hôm qua</span></div>
      </section>
      <section className="panel payment-panel">
        <header className="panel-header"><div><h2 className="panel-title">Phương thức thanh toán</h2><div className="panel-subtitle">Tỷ lệ doanh thu đã thu hôm nay</div></div></header>
        <div className="payment-breakdown feature-breakdown">
          <div><span>Tiền mặt</span><strong>{cashPct}% · {formatMoney(cash)}</strong></div>
          <div><span>Chuyển khoản</span><strong>{transferPct}% · {formatMoney(transfer)}</strong></div>
        </div>
      </section>
    </div>
  </main>;
}

function KegLossPage({ onToast }: { onToast: (message: string) => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [threshold, setThreshold] = useState('5');
  const [data, setData] = useState<ReportKegLoss | null>(null);

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (threshold) params.set('threshold', threshold);
      const q = params.toString() ? `?${params.toString()}` : '';
      setData(await reportsApi.kegLoss(q));
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Không thể tải báo cáo hao hụt keg.');
    }
  }, [from, onToast, threshold, to]);

  useEffect(() => { void loadData(); }, [loadData]);

  const rows = (data?.kegs ?? []).map((k) => [
    String(k.code),
    String(k.beerName),
    String(k.tapName),
    `${Math.round(Number(k.capacityMl) / 1000)} L`,
    `${Number((Number(k.soldMl) / 1000).toFixed(1))} L`,
    `${Number((Number(k.lossMl) / 1000).toFixed(1))} L`,
    `${k.lossPercent}%`,
    k.overThreshold ? 'Cảnh báo' : 'Bình thường'
  ]);

  return <main className="page-content feature-content">
    <Heading title="Hao hụt keg" subtitle="FR-17 · Đối chiếu lượng bia xuất keg và lượng bán ra" />
    <div className="feature-filters panel">
      <label>Từ ngày<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label>Đến ngày<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      <label>Ngưỡng cảnh báo (%)<input type="number" min="0" max="100" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label>
      <button className="button-primary" type="button" onClick={() => { void loadData(); }}>Lọc báo cáo</button>
    </div>
    <section className="report-metrics">
      <Metric label="Tổng hao hụt" value={`${data?.totalLossLiters ?? 0} L`} change="Tổng hợp từ Neon DB" />
      <Metric label="Giá trị ước tính" value={formatMoney(data?.totalLossAmount ?? 0)} change="Theo giá nhập keg" />
      <Metric label="Keg đã hết" value={String(data?.kegs.length ?? 0)} change="Trong khoảng thời gian lọc" />
      <Metric label="Ngưỡng cảnh báo" value={`${threshold}%`} change="Keg vượt ngưỡng sẽ đánh dấu" />
    </section>
    <DataTable
      title="Chi tiết theo keg"
      subtitle={`${rows.length} keg đã hết`}
      columns={['Mã keg', 'Loại bia', 'Vòi', 'Dung tích', 'Đã bán', 'Hao hụt', 'Tỷ lệ', 'Trạng thái']}
      rows={rows}
    />
  </main>;
}

function VoidsPage({ onToast }: { onToast: (message: string) => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [staff, setStaff] = useState('');
  const [approver, setApprover] = useState('');
  const [reason, setReason] = useState('');
  const [rows, setRows] = useState<ReportVoid[]>([]);

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (staff.trim()) params.set('staff', staff.trim());
      if (approver.trim()) params.set('approver', approver.trim());
      if (reason) params.set('reason', reasonToApi[reason as AdjustmentReason] ?? reason);
      const q = params.toString() ? `?${params.toString()}` : '';
      setRows(await reportsApi.voids(q));
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Không thể tải nhật ký hủy/giảm.');
    }
  }, [approver, from, onToast, reason, staff, to]);

  useEffect(() => { void loadData(); }, [loadData]);

  const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const tableRows = rows.map((r) => [
    r.createdAt ? `${formatDate(String(r.createdAt))} ${formatTime(String(r.createdAt))}` : '—',
    String(r.table),
    String(r.item),
    String(r.quantity),
    formatMoney(Number(r.amount || 0)),
    String(r.type || ''),
    r.note ? `${r.reason} (${r.note})` : String(r.reason),
    String(r.staff || '—')
  ]);

  return <main className="page-content feature-content">
    <Heading title="Nhật ký hủy / giảm" subtitle="FR-18 · Theo dõi thao tác điều chỉnh món và hóa đơn" />
    <div className="feature-filters panel">
      <label>Từ ngày<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label>Đến ngày<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <label>Nhân viên<input type="search" value={staff} onChange={(e) => setStaff(e.target.value)} placeholder="Tất cả" /></label>
      <label>Người duyệt<input type="search" value={approver} onChange={(e) => setApprover(e.target.value)} placeholder="Tất cả" /></label>
      <label>Lý do<select value={reason} onChange={(e) => setReason(e.target.value)}><option value="">Tất cả lý do</option>{ADJUSTMENT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
      <button className="button-primary" type="button" onClick={() => { void loadData(); }}>Lọc nhật ký</button>
    </div>
    <section className="report-metrics">
      <Metric label="Số lần hủy / giảm" value={String(rows.length)} change="Dữ liệu thực tế từ Neon DB" />
      <Metric label="Tổng tiền điều chỉnh" value={formatMoney(totalAmount)} change="Tổng giá trị hủy & giảm" />
      <Metric label="Trạng thái lọc" value={reason || 'Tất cả lý do'} change="Cập nhật theo bộ lọc" />
      <Metric label="Phạm vi ngày" value={from || to ? `${from || '...'} → ${to || '...'}` : 'Tất cả'} change="Theo giờ Việt Nam" />
    </section>
    <DataTable
      title="Nhật ký"
      subtitle={`${tableRows.length} bản ghi · Neon DB`}
      columns={['Thời gian', 'Bàn', 'Món', 'Số lượng', 'Số tiền', 'Loại', 'Lý do', 'Người yêu cầu / duyệt']}
      rows={tableRows}
    />
  </main>;
}

function TopItemsPage({ onToast }: { onToast: (message: string) => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortBy, setSortBy] = useState<'quantity' | 'amount'>('quantity');
  const [dateError, setDateError] = useState('');
  const [items, setItems] = useState<ReportTopItems[]>([]);
  const [hourly, setHourly] = useState<Array<{ hour: number; revenue: number }>>([]);

  const validateDates = (nextFrom: string, nextTo: string) => {
    if (!nextFrom || !nextTo) {
      setDateError('');
      return true;
    }
    const days = (new Date(`${nextTo}T00:00:00`).getTime() - new Date(`${nextFrom}T00:00:00`).getTime()) / 86400000;
    if (days < 0) {
      setDateError('Ngày bắt đầu phải trước ngày kết thúc.');
      return false;
    }
    if (days > 30) {
      setDateError('Khoảng ngày không được vượt quá 31 ngày.');
      return false;
    }
    setDateError('');
    return true;
  };

  const loadData = useCallback(async () => {
    if (!validateDates(from, to)) return;
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('by', sortBy);
      const res = await reportsApi.topItems(`?${params.toString()}`);
      setItems(res.items);
      setHourly(res.hourly);
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Không thể tải báo cáo món bán chạy.');
    }
  }, [from, onToast, sortBy, to]);

  useEffect(() => { void loadData(); }, [loadData]);

  const top10 = items.slice(0, 10);
  const maxItemVal = Math.max(1, ...top10.map((i) => sortBy === 'amount' ? i.revenue : i.quantity));
  const hours = Array.from({ length: 12 }, (_, i) => i + 10);
  const hourMap = new Map(hourly.map((h) => [h.hour, h.revenue]));
  const maxHourVal = Math.max(1, ...hours.map((h) => hourMap.get(h) ?? 0));

  const tableRows = items.map((item, idx) => [
    String(item.rank ?? idx + 1),
    item.name,
    item.quantity.toLocaleString('vi-VN'),
    formatMoney(item.revenue),
    item.share ?? '—'
  ]);

  return <main className="page-content feature-content">
    <Heading title="Món bán chạy & giờ cao điểm" subtitle="FR-19 · Thống kê theo thời điểm thanh toán (tối đa 31 ngày)" />
    <div className="feature-filters panel">
      <label>Từ ngày<input id="report-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); validateDates(e.target.value, to); }} /></label>
      <label>Đến ngày<input id="report-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); validateDates(from, e.target.value); }} /></label>
      <label>Xếp theo<select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'quantity' | 'amount')}><option value="quantity">Số lượng</option><option value="amount">Doanh thu</option></select></label>
      <button className="button-primary" type="button" onClick={() => { void loadData(); }}>Xem báo cáo</button>
      {dateError && <p className="form-error" role="alert">{dateError}</p>}
    </div>
    <div className="report-grid feature-report-grid">
      <section className="panel report-panel">
        <header className="panel-header"><div><h2 className="panel-title">Top 10 món bán chạy</h2><div className="panel-subtitle">Biểu đồ theo {sortBy === 'amount' ? 'doanh thu' : 'số lượng'}</div></div></header>
        <div className="top-item-bars">
          {top10.map((item, idx) => {
            const val = sortBy === 'amount' ? item.revenue : item.quantity;
            const height = Math.max(6, Math.round((val / maxItemVal) * 100));
            return <div key={item.id} title={`${item.name}: ${item.quantity} · ${formatMoney(item.revenue)}`}><span style={{ height: `${height}%` }} /><small>{idx + 1}</small></div>;
          })}
        </div>
      </section>
      <section className="panel report-panel">
        <header className="panel-header"><div><h2 className="panel-title">Doanh thu theo giờ</h2><div className="panel-subtitle">Tính theo thời điểm thanh toán (10g – 21g)</div></div></header>
        <div className="feature-hour-bars">
          {hours.map((h) => {
            const height = Math.max(4, Math.round(((hourMap.get(h) ?? 0) / maxHourVal) * 100));
            return <div className="feature-hour-group" key={h} title={`${h}:00 · ${formatMoney(hourMap.get(h) ?? 0)}`}><span style={{ height: `${height}%` }} /></div>;
          })}
        </div>
        <div className="chart-labels report-labels"><span>10:00</span><span>13:00</span><span>16:00</span><span>19:00</span><span>21:00</span></div>
      </section>
    </div>
    <DataTable
      title="Bảng xếp hạng món"
      subtitle={`${tableRows.length} món · Neon DB`}
      columns={['#', 'Món', 'Số lượng', 'Doanh thu', 'Tỷ trọng']}
      rows={tableRows}
    />
  </main>;
}

function Heading({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">Báo cáo trực tiếp</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function Metric({ label, value, change }: { label: string; value: string; change?: string }) {
  return <article className="metric-card"><div className="metric-top">{label}</div><div className="metric-value">{value}</div><div className="metric-foot">{change || 'Dữ liệu thực tế'}</div></article>;
}

function DataTable({ title, subtitle, columns, rows }: { title: string; subtitle: string; columns: string[]; rows: string[][] }) {
  return <section className="panel feature-panel"><header className="panel-header"><div><h2 className="panel-title">{title}</h2><div className="panel-subtitle">{subtitle}</div></div></header><div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>) : <tr><td className="empty-state" colSpan={columns.length}>Không có dữ liệu phù hợp.</td></tr>}</tbody></table></div></section>;
}

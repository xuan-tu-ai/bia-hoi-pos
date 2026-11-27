import { useState } from 'react';
import { ReportRecords } from '../admin/index.tsx';
import { formatMoney } from '../../lib/format.ts';

export function ReportPage({ view, onToast }: { view: string; onToast: (message: string) => void }) {
  if (view === 'reports') return <ReportsPage />;
  if (view === 'kegLoss') return <KegLossPage />;
  return <ReportRecords view={view} onToast={onToast} />;
}

function KegLossPage() {
  const [threshold, setThreshold] = useState('5');
  return <main className="page-content feature-content"><Heading title="Hao hụt keg" subtitle="FR-17 · Đối chiếu lượng bia xuất keg và lượng bán ra" />
    <div className="feature-filters panel"><label>Từ ngày<input type="date" defaultValue="2026-11-01" /></label><label>Đến ngày<input type="date" defaultValue="2026-11-10" /></label><label>Ngưỡng cảnh báo (%)<input type="number" min="0" max="100" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label><button className="button-primary" type="button">Lọc báo cáo</button></div>
    <section className="report-metrics"><Metric label="Tổng hao hụt" value="6,5 L" /><Metric label="Giá trị ước tính" value={formatMoney(195000)} /><Metric label="Keg đã hết" value="4" /><Metric label="Ngưỡng cảnh báo" value={`${threshold}%`} /></section>
    <DataTable columns={['Mã keg', 'Loại bia', 'Vòi', 'Dung tích', 'Đã bán', 'Hao hụt', 'Tỷ lệ', 'Trạng thái']} rows={[
      ['KEG-0007', 'Bia hơi Hà Nội', 'Vòi 1', '50 L', '46 L', '4 L', '8%', 'Cảnh báo'],
      ['KEG-0005', 'Bia hơi Hải Phòng', 'Vòi 2', '30 L', '28,8 L', '1,2 L', '4%', 'Bình thường'],
      ['KEG-0004', 'Bia hơi Hà Nội', 'Vòi 1', '50 L', '48,5 L', '1,5 L', '3%', 'Bình thường']
    ]} />
  </main>;
}

function ReportsPage() {
  return <main className="page-content reports-content"><Heading title="Tổng quan hôm nay" subtitle="FR-16 · Doanh thu đã thu, tạm tính và tình hình hoạt động" action={<span className="report-updated">Cập nhật lúc 17:30 · Dữ liệu minh họa</span>} />
    <section className="report-metrics"><Metric label="Doanh thu đã thu" value={formatMoney(12840000)} change="+8,4% so cùng giờ hôm qua" /><Metric label="Tạm tính đang mở" value={formatMoney(6420000)} change="6 bàn" /><Metric label="Bàn đang ngồi" value="25 / 80" change="31% công suất" /><Metric label="Số hóa đơn" value="42" change="+5,2% so cùng giờ hôm qua" /></section>
    <div className="report-grid"><section className="panel report-panel"><header className="panel-header"><div><h2 className="panel-title">Doanh thu theo giờ</h2><div className="panel-subtitle">Hôm nay so với cùng giờ hôm qua</div></div></header><div className="feature-hour-bars">{[38, 51, 42, 69, 54, 82, 63, 91, 72, 48, 34, 20].map((height, index) => <div className="feature-hour-group" key={index}><span style={{ height: `${height}%` }} /><i style={{ height: `${height * .65}%` }} /></div>)}</div><div className="report-legend"><span>● Hôm nay</span><span>● Hôm qua</span></div></section><section className="panel payment-panel"><header className="panel-header"><div><h2 className="panel-title">Phương thức thanh toán</h2><div className="panel-subtitle">Tỷ lệ doanh thu đã thu</div></div></header><div className="payment-breakdown feature-breakdown"><div><span>Tiền mặt</span><strong>68% · {formatMoney(8731200)}</strong></div><div><span>Chuyển khoản</span><strong>32% · {formatMoney(4108800)}</strong></div></div></section></div>
  </main>;
}

function Heading({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">Giao diện theo đặc tả</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function Metric({ label, value, change }: { label: string; value: string; change?: string }) {
  return <article className="metric-card"><div className="metric-top">{label}</div><div className="metric-value">{value}</div><div className="metric-foot">{change || 'Dữ liệu minh họa'}</div></article>;
}

function DataTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return <section className="panel feature-panel"><header className="panel-header"><div><h2 className="panel-title">Chi tiết theo keg</h2><div className="panel-subtitle">Dữ liệu minh họa</div></div></header><div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>)}</tbody></table></div></section>;
}

import { useState, type Dispatch, type SetStateAction } from 'react';
import { can } from '../../../lib/permissions.ts';
import { formatMoney } from '../../../lib/format.ts';
import type { User } from '../../../types/index.ts';

interface ShiftPageProps {
  user: User;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onToast: (message: string) => void;
}

export function ShiftPage({ user, isOpen, setIsOpen, onToast }: ShiftPageProps) {
  const [countedCash, setCountedCash] = useState('');
  const expectedCash = 2500000 + 6820000;
  return <main className="page-content feature-content">
    <div className="page-heading"><div><span className="eyebrow">Giao diện theo đặc tả</span><h1>Mở / đóng ca</h1><p>FR-09 · Theo dõi tiền đầu ca, doanh thu và chênh lệch</p></div><span className={`status-pill${isOpen ? '' : ' pending'}`}>{isOpen ? 'Ca đang mở' : 'Chưa mở ca'}</span></div>
    <section className="report-metrics"><Metric label="Tiền đầu ca" value={formatMoney(isOpen ? 2500000 : 0)} /><Metric label="Tiền mặt thu trong ca" value={formatMoney(isOpen ? 6820000 : 0)} /><Metric label="Chuyển khoản" value={formatMoney(isOpen ? 4380000 : 0)} /><Metric label="Hóa đơn" value={isOpen ? '42' : '0'} /></section>
    <section className="panel shift-page-card"><header className="panel-header"><div><h2 className="panel-title">Ca chiều · 14:00 – hiện tại</h2><div className="panel-subtitle">Nhân viên: Nguyễn Thị Lan · Quản lý: Lê Văn Hùng</div></div>{!isOpen ? <button className="button-primary" type="button" onClick={() => { setIsOpen(true); onToast('Đã mở ca demo.'); }}>Mở ca</button> : can(user, 'shifts:close') && <button className="button-secondary" type="button" onClick={() => { setIsOpen(false); onToast('Đã đóng ca demo.'); }}>Đóng ca</button>}</header>
      {isOpen && <div className="shift-close-form"><label className="modal-field"><span>Tiền mặt đếm được (₫)</span><input type="number" min="0" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} placeholder="Nhập số tiền trong két" /></label><div className="shift-difference"><span>Dự kiến trong két: <strong>{formatMoney(expectedCash)}</strong></span><span>Chênh lệch: <strong>{formatMoney((Number(countedCash) || 0) - expectedCash)}</strong></span></div>{!can(user, 'shifts:close') && <p className="form-hint">Chỉ Quản lý ca hoặc Chủ quán mới có thể đóng ca.</p>}</div>}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="metric-card"><div className="metric-top">{label}</div><div className="metric-value">{value}</div><div className="metric-foot">Dữ liệu minh họa</div></article>;
}

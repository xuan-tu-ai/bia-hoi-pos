import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { can } from '../../../lib/permissions.ts';
import { formatMoney, formatTime } from '../../../lib/format.ts';
import { counterApi, type CurrentShiftResponse } from '../../../services/counter.ts';
import type { User } from '../../../types/index.ts';

interface ShiftPageProps {
  user: User;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onToast: (message: string) => void;
}

export function ShiftPage({ user, isOpen, setIsOpen, onToast }: ShiftPageProps) {
  const [shiftData, setShiftData] = useState<CurrentShiftResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingCash, setOpeningCash] = useState('2000000');
  const [countedCash, setCountedCash] = useState('');
  const [busy, setBusy] = useState(false);

  const loadShift = useCallback(async () => {
    try {
      const res = await counterApi.getCurrentShift();
      setShiftData(res);
      setIsOpen(Boolean(res.current));
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Không thể tải thông tin ca.');
    } finally {
      setLoading(false);
    }
  }, [onToast, setIsOpen]);

  useEffect(() => { void loadShift(); }, [loadShift]);

  const current = shiftData?.current ?? null;
  const lastClosed = shiftData?.lastClosed ?? null;
  const expectedCash = current ? current.openingCash + current.cashSales : 0;

  const handleOpenShift = async () => {
    setBusy(true);
    try {
      await counterApi.openShift(Number(openingCash) || 0);
      onToast('Đã mở ca làm việc.');
      await loadShift();
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Không thể mở ca.');
    } finally {
      setBusy(false);
    }
  };

  const handleCloseShift = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await counterApi.closeShift(current.id, Number(countedCash) || 0);
      setCountedCash('');
      onToast('Đã đóng ca làm việc.');
      await loadShift();
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Không thể đóng ca.');
    } finally {
      setBusy(false);
    }
  };

  return <main className="page-content feature-content">
    <div className="page-heading">
      <div><span className="eyebrow">Phân hệ Quầy</span><h1>Mở / đóng ca</h1><p>FR-09 · Theo dõi tiền đầu ca, doanh thu và chênh lệch từ Neon DB</p></div>
      <span className={`status-pill${isOpen ? '' : ' pending'}`}>{isOpen ? 'Ca đang mở' : 'Chưa mở ca'}</span>
    </div>
    <section className="report-metrics">
      <Metric label="Tiền đầu ca" value={formatMoney(current ? current.openingCash : 0)} />
      <Metric label="Tiền mặt thu trong ca" value={formatMoney(current ? current.cashSales : 0)} />
      <Metric label="Chuyển khoản" value={formatMoney(current ? current.transferSales : 0)} />
      <Metric label="Hóa đơn" value={current ? String(current.bills) : '0'} />
    </section>
    <section className="panel shift-page-card">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">
            {loading ? 'Đang tải...' : current ? `Ca hiện tại · mở lúc ${formatTime(current.openedAt)}` : 'Hiện chưa có ca mở'}
          </h2>
          <div className="panel-subtitle">
            {current
              ? `Nhân viên mở ca: ${current.staffName}`
              : lastClosed
                ? `Ca gần nhất: ${lastClosed.staffName} · thu TM ${formatMoney(lastClosed.cashSales)}, CK ${formatMoney(lastClosed.transferSales)}`
                : `Người thao tác: ${user.name}`}
          </div>
        </div>
        {!loading && (!current
          ? <button className="button-primary" type="button" disabled={busy} onClick={() => { void handleOpenShift(); }}>Mở ca</button>
          : can(user, 'shifts:close') && <button className="button-secondary" type="button" disabled={busy} onClick={() => { void handleCloseShift(); }}>Đóng ca</button>)}
      </header>
      {!loading && !current && (
        <div className="shift-close-form">
          <label className="modal-field">
            <span>Tiền mặt đầu ca (₫)</span>
            <input type="number" min="0" step="10000" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} placeholder="Nhập tiền đầu ca" />
          </label>
        </div>
      )}
      {!loading && current && (
        <div className="shift-close-form">
          <label className="modal-field">
            <span>Tiền mặt đếm được (₫)</span>
            <input type="number" min="0" step="1000" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} placeholder="Nhập số tiền trong két" />
          </label>
          <div className="shift-difference">
            <span>Dự kiến trong két: <strong>{formatMoney(expectedCash)}</strong></span>
            <span>Chênh lệch: <strong>{formatMoney((Number(countedCash) || 0) - expectedCash)}</strong></span>
          </div>
          {!can(user, 'shifts:close') && <p className="form-hint">Chỉ Quản lý ca hoặc Chủ quán mới có thể đóng ca.</p>}
        </div>
      )}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="metric-card"><div className="metric-top">{label}</div><div className="metric-value">{value}</div><div className="metric-foot">Dữ liệu thực tế</div></article>;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { getMenu, getPosData, openTable, addRound, markProvisional, moveTable, adjustOrderLine, payTable } from '../../../api/tabs.ts';
import { formatMoney } from '../../../lib/format.ts';
import { can } from '../../../lib/permissions.ts';
import { useAuth } from '../../../hooks/use-auth.ts';
import { DashboardLayout } from '../../../components/layout/DashboardLayout.tsx';
import { Modal } from '../../../components/shared/Modal.tsx';
import { PrintReceipt } from '../../../components/print/Receipt.tsx';
import { TableSessionDialog } from '../order/TableSessionDialog.tsx';
import { PaymentDialog } from '../payment/PaymentDialog.tsx';
import { FeatureRouter } from '../../FeatureRouter.tsx';
import { ModuleLoader } from '../../ModuleLoader.tsx';
import type { CompletedBill, DiningTable, MenuItem, OrderAdjustment, OrderLine, OrderRound, PaymentDetails, PosData, User } from '../../../types/index.ts';

const money = (value: number) => formatMoney(value);

function elapsedTime(openedAt: string | null) {
  if (!openedAt) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000));
  return `${Math.floor(minutes / 60)}g ${minutes % 60}p`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<PosData | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [areaId, setAreaId] = useState('inside');
  const [activeView, setActiveView] = useState(can(user, 'reports:today') ? 'reports' : 'tables');
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [paymentTableId, setPaymentTableId] = useState<number | null>(null);
  const [openTableId, setOpenTableId] = useState<number | null>(null);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [receipt, setReceipt] = useState<CompletedBill | null>(null);
  const provisionalCounts = useRef<Record<number, number>>({});
  const selectedTable = data?.tables.find((table) => table.id === selectedTableId);
  const paymentTable = data?.tables.find((table) => table.id === paymentTableId);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [nextData, nextMenu] = await Promise.all([getPosData(), getMenu()]);
        if (active) {
          nextData.tables.forEach((table) => {
            table.provisionalCount = Math.max(table.provisionalCount ?? 0, provisionalCounts.current[table.id] ?? 0);
          });
          setData(nextData);
          setMenuItems(nextMenu);
        }
      } catch (error) {
        if (active) setToast(error instanceof Error ? error.message : 'Không thể tải dữ liệu quầy.');
      }
    };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 3000);
    window.addEventListener('storage', refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const tables = useMemo(() => (data?.tables ?? []).filter((table) => table.areaId === areaId), [areaId, data?.tables]);
  const allTables = data?.tables ?? [];
  const occupiedCount = allTables.filter((table) => table.status !== 'empty').length;
  const provisionalTotal = allTables.filter((table) => table.status === 'provisional').reduce((sum, table) => sum + table.total, 0);
  const updateData = (nextData: PosData) => {
    setData(nextData);
    setOpenTableId(null);
    setToast('');
  };
  const handleTableClick = (table: DiningTable) => {
    if (table.status === 'empty') setOpenTableId(table.id);
    else setSelectedTableId(table.id);
  };
  const handleOpenTable = async (guestCount: number | null) => {
    try {
      if (openTableId === null) return;
      delete provisionalCounts.current[openTableId];
      updateData(await openTable(openTableId, guestCount));
      setSelectedTableId(openTableId);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Không thể mở bàn.');
    }
  };
  const handleAddRound = async (lines: OrderLine[]): Promise<OrderRound | null> => {
    try {
      if (selectedTableId === null || !user) return null;
      const nextData = await addRound(selectedTableId, lines, user.name);
      updateData(nextData);
      return nextData.tables.find((table) => table.id === selectedTableId)?.rounds.at(-1) ?? null;
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Không thể gửi lượt gọi.');
      return null;
    }
  };
  const handleProvisional = async (): Promise<number | null> => {
    try {
      if (selectedTableId === null) return null;
      const previousCount = Math.max(
        selectedTable?.provisionalCount ?? 0,
        provisionalCounts.current[selectedTableId] ?? 0
      );
      const nextData = await markProvisional(selectedTableId);
      const table = nextData.tables.find((item) => item.id === selectedTableId);
      const printCount = Math.max(table?.provisionalCount ?? 0, previousCount + 1);
      provisionalCounts.current[selectedTableId] = printCount;
      if (table) table.provisionalCount = printCount;
      setData(nextData);
      setToast('Đã ghi nhận in tạm tính.');
      return printCount;
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Không thể in tạm tính.');
      return null;
    }
  };
  const handlePayment = async (payment: PaymentDetails) => {
    try {
      if (paymentTableId === null) return;
      const result = await payTable(paymentTableId, payment);
      delete provisionalCounts.current[paymentTableId];
      setData(result.data);
      setOpenTableId(null);
      setToast('');
      setSelectedTableId(null);
      setPaymentTableId(null);
      setReceipt(result.receipt);
      setToast('Đã hoàn tất thanh toán. Bàn đã trở về trạng thái trống.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Không thể hoàn tất thanh toán.');
    }
  };
  const handleMoveMerge = async (targetId: number, merge: boolean) => {
    try {
      if (selectedTableId === null) return;
      updateData(await moveTable(selectedTableId, targetId, merge));
      setSelectedTableId(null);
      setToast(merge ? 'Đã gộp phiên bàn.' : 'Đã chuyển bàn.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Không thể chuyển hoặc gộp bàn.');
    }
  };
  const handleAdjustment = async ({ roundId, lineId, action, quantity, discountAmount, reason, note, approverPin }: OrderAdjustment) => {
    try {
      if (selectedTableId === null) return;
      updateData(await adjustOrderLine(selectedTableId, roundId, lineId, action, quantity, discountAmount, reason, note, approverPin));
      setToast(action === 'void' ? 'Đã ghi nhận hủy món demo.' : 'Đã ghi nhận giảm giá demo.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Không thể điều chỉnh món.');
    }
  };

  if (!user) return null;
  if (!data) return <main className="page-content"><p>{toast || 'Đang tải dữ liệu quầy...'}</p></main>;

  return <>
    <DashboardLayout
      user={user}
      occupiedCount={occupiedCount}
      shiftOpen={shiftOpen}
      activeView={activeView}
      onNavigate={(view) => setActiveView(view)}
    >
      <ModuleLoader view={activeView} user={user}>
        {activeView === 'tables'
          ? <main className="page-content pos-content">
          <div className="page-heading"><div><span className="eyebrow">Phân hệ Quầy</span><h1>Sơ đồ bàn</h1><p>Chọn bàn để mở phiên hoặc tiếp tục phục vụ khách.</p></div><div className="shift-reminder"><span className="shift-dot" />{shiftOpen ? 'Ca đang mở' : 'Chưa mở ca'}</div></div>
          <section className="pos-summary" aria-label="Tình trạng bàn">
            <div className="pos-summary-item"><span className="table-state-dot empty" />Bàn trống <strong>{80 - occupiedCount}</strong></div>
            <div className="pos-summary-item"><span className="table-state-dot occupied" />Đang ngồi <strong>{occupiedCount}/80</strong></div>
            <div className="pos-summary-item"><span className="table-state-dot provisional" />Tạm tính đang mở <strong>{money(provisionalTotal)}</strong></div>
          </section>
          <section className="panel floor-panel">
            <header className="floor-toolbar">
              <div className="area-tabs" role="tablist" aria-label="Chọn khu vực">
                {data.areas.map((area) => <button key={area.id} type="button" role="tab" aria-selected={areaId === area.id} className={`area-tab${areaId === area.id ? ' is-active' : ''}`} onClick={() => setAreaId(area.id)}>{area.name}<span>{area.count}</span></button>)}
              </div>
              <div className="floor-legend" aria-label="Chú thích trạng thái">
                <span><i className="table-state-dot empty" />Trống</span><span><i className="table-state-dot occupied" />Đang ngồi</span><span><i className="table-state-dot provisional" />Tạm tính</span>
              </div>
            </header>
            <div className="table-grid" role="list" aria-label="Bàn trong khu vực">
              {tables.map((table) => <button key={table.id} type="button" role="listitem" className={`table-tile table-${table.status}`} onClick={() => handleTableClick(table)} aria-label={`Bàn ${table.id}, ${table.status === 'empty' ? 'trống' : `${money(table.total)}, ${elapsedTime(table.openedAt)}`}`}>
                <span className="table-number">{table.id}</span>
                {table.status === 'empty' ? <span className="table-tile-hint">Mở bàn</span> : <><span className="table-total">{money(table.total)}</span><span className="table-elapsed">{elapsedTime(table.openedAt)}</span></>}
              </button>)}
            </div>
          </section>
          </main>
          : <FeatureRouter view={activeView} user={user} shiftOpen={shiftOpen} setShiftOpen={setShiftOpen} onToast={setToast} />}
      </ModuleLoader>
    </DashboardLayout>
    {openTableId !== null && <OpenTableDialog tableId={openTableId} onCancel={() => setOpenTableId(null)} onConfirm={handleOpenTable} />}
    {selectedTable && <TableSessionDialog table={selectedTable} tables={data.tables} menuItems={menuItems} user={user} onClose={() => setSelectedTableId(null)} onAddRound={handleAddRound} onProvisional={handleProvisional} onPayment={() => setPaymentTableId(selectedTableId)} onMoveMerge={handleMoveMerge} onAdjustment={handleAdjustment} />}
    {paymentTable && <PaymentDialog table={paymentTable} user={user} onClose={() => setPaymentTableId(null)} onConfirm={handlePayment} />}
    {receipt && <PrintReceipt receipt={receipt} onClose={() => setReceipt(null)} />}
    <div className="toast-region" aria-live="polite">{toast && <div className="toast" role="status">{toast}</div>}</div>
  </>;
}

function OpenTableDialog({ tableId, onCancel, onConfirm }: { tableId: number; onCancel: () => void; onConfirm: (guestCount: number | null) => void }) {
  const [guestCount, setGuestCount] = useState('');
  return <Modal title={`Mở bàn ${tableId}`} onClose={onCancel}>
    <form onSubmit={(event) => { event.preventDefault(); onConfirm(guestCount ? Number(guestCount) : null); }}>
      <div className="modal-body"><label className="modal-field"><span>Số khách <small>(không bắt buộc)</small></span><input type="number" min="1" value={guestCount} onChange={(event) => setGuestCount(event.target.value)} placeholder="Nhập số khách" autoFocus /></label></div>
      <footer className="modal-footer"><button className="button-secondary" type="button" onClick={onCancel}>Hủy</button><button className="button-primary" type="submit">Mở bàn</button></footer>
    </form>
  </Modal>;
}

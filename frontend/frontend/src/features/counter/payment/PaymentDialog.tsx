import { useState } from 'react';
import { Modal } from '../../../components/shared/Modal.tsx';
import { formatMoney } from '../../../lib/format.ts';
import type { DiningTable, PaymentDetails, User } from '../../../types/index.ts';

interface PaymentDialogProps {
  table: DiningTable;
  user: User;
  onClose: () => void;
  onConfirm: (payment: PaymentDetails) => void;
}

const money = formatMoney;

export function PaymentDialog({ table, user, onClose, onConfirm }: PaymentDialogProps) {
  const [method, setMethod] = useState<'cash' | 'transfer' | 'split'>('cash');
  const [received, setReceived] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [approverPin, setApproverPin] = useState('');
  const subtotal = table.total;
  const discountValue = discountType === 'percent' ? Math.round(subtotal * Math.min(100, Number(discount)) / 100) : Math.min(subtotal, Number(discount));
  const payable = Math.max(0, subtotal - discountValue);
  const transferValue = method === 'cash' ? 0 : method === 'transfer' ? payable : Number(transferAmount);
  const cashValue = method === 'transfer' ? 0 : Number(received);
  const discountApproved = discountValue === 0 || user.role !== 'staff' || approverPin === '1234';
  const canComplete = payable > 0 && transferValue <= payable && cashValue + transferValue >= payable && (transferValue === 0 || (transferConfirmed && Boolean(table.billNo))) && discountApproved;
  const change = Math.max(0, cashValue + transferValue - payable);

  return <Modal title={`Thanh toán bàn ${table.id}`} onClose={onClose}>
    <div className="modal-body payment-form">
      <div className="payment-total"><span>Tạm tính</span><strong>{money(subtotal)}</strong></div>
      <div className="bill-discount"><label className="modal-field"><span>Giảm giá hóa đơn</span><input type="number" min="0" max={discountType === 'percent' ? 100 : subtotal} value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="0" /></label><select value={discountType} onChange={(event) => setDiscountType(event.target.value as 'amount' | 'percent')} aria-label="Loại giảm giá"><option value="amount">₫</option><option value="percent">%</option></select></div>
      {discountValue > 0 && <div className="payment-change"><span>Giảm giá</span><strong>−{money(discountValue)}</strong></div>}
      <div className="payment-total"><span>Tổng cần thanh toán</span><strong>{money(payable)}</strong></div>
      {discountValue > 0 && user.role === 'staff' && <label className="modal-field"><span>PIN Quản lý ca</span><input type="password" inputMode="numeric" value={approverPin} onChange={(event) => setApproverPin(event.target.value)} placeholder="PIN demo: 1234" /></label>}
      <div className="payment-methods" role="group" aria-label="Phương thức thanh toán">
        <button type="button" className={method === 'cash' ? 'is-selected' : ''} aria-pressed={method === 'cash'} onClick={() => setMethod('cash')}><i className="icon fa-solid fa-money-bill-wave" aria-hidden="true" />Tiền mặt</button>
        <button type="button" className={method === 'transfer' ? 'is-selected' : ''} aria-pressed={method === 'transfer'} onClick={() => setMethod('transfer')}><i className="icon fa-solid fa-qrcode" aria-hidden="true" />Chuyển khoản</button>
        <button type="button" className={method === 'split' ? 'is-selected' : ''} aria-pressed={method === 'split'} onClick={() => setMethod('split')}>Kết hợp</button>
      </div>
      {method !== 'transfer' && <><label className="modal-field"><span>{method === 'split' ? 'Tiền mặt khách đưa (₫)' : 'Tiền khách đưa (₫)'}</span><input type="number" min="0" step="1000" value={received} onChange={(event) => setReceived(event.target.value)} placeholder="Nhập số tiền" /></label><div className="quick-cash">{[100000, 200000, 500000].map((amount) => <button key={amount} type="button" onClick={() => setReceived(String(amount))}>{money(amount)}</button>)}</div></>}
      {method === 'split' && <label className="modal-field"><span>Chuyển khoản (₫)</span><input type="number" min="0" max={payable} value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} placeholder="Nhập số tiền chuyển khoản" /></label>}
      {method !== 'cash' && <><div className="qr-placeholder"><i className="icon fa-solid fa-qrcode" aria-hidden="true" /><strong>Mã VietQR · {money(transferValue)}</strong><span>QR thật cần cấu hình tài khoản ngân hàng của quán.</span>{table.billNo && <code>BH{table.billNo}</code>}</div>{!table.billNo && <p className="form-error" role="alert">Phiên bàn chưa có số hóa đơn để tạo nội dung chuyển khoản.</p>}<label className="payment-confirm"><input type="checkbox" checked={transferConfirmed} onChange={(event) => setTransferConfirmed(event.target.checked)} /><span>Đã kiểm tra và xác nhận nhận đủ tiền chuyển khoản</span></label></>}
      <div className="payment-change"><span>Tiền thừa</span><strong>{money(change)}</strong></div>
      {transferValue > payable && <p className="form-error" role="alert">Số tiền chuyển khoản không được vượt quá tổng cần thanh toán.</p>}
      {!discountApproved && <p className="form-error" role="alert">PIN không đúng.</p>}
    </div>
    <footer className="modal-footer"><button className="button-secondary" type="button" onClick={onClose}>Quay lại</button><button className="button-primary" type="button" disabled={!canComplete} onClick={() => {
      const cashPaid = Math.max(0, payable - transferValue);
      const payments: PaymentDetails['payments'] = [];
      if (cashPaid) payments.push({ method: 'CASH', amount: cashPaid });
      if (transferValue) payments.push({ method: 'TRANSFER', amount: transferValue });
      onConfirm({
        subtotal,
        discount: discountValue,
        total: payable,
        change,
        payments,
        discountType: discountType === 'percent' ? 'PERCENT' : 'AMOUNT',
        discountValue: discountType === 'percent' ? Math.min(100, Number(discount)) : Math.min(subtotal, Number(discount)),
        approverPin: approverPin || undefined
      });
    }}>Hoàn tất thanh toán</button></footer>
  </Modal>;
}

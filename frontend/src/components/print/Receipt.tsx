import { useEffect, useState } from 'react';
import { formatDate, formatMoney, formatTime } from '../../lib/format.ts';
import { Modal } from '../shared/Modal.tsx';
import { PrintSurface } from './PrintSurface.tsx';
import { groupReceiptLines, type ReceiptLine } from './receiptLines.ts';
import type { CompletedBill } from '../../types/index.ts';

function ReceiptDocument({ receipt, lines }: { receipt: CompletedBill; lines: ReceiptLine[] }) {
  return <article className="receipt-document">
    <header className="receipt-brand">
      <strong>QUẢN LÝ QUẦY BIA</strong>
      <span>HÓA ĐƠN THANH TOÁN</span>
    </header>
    <div className="receipt-meta">
      <div><span>Số hóa đơn</span><strong>{receipt.billNo}</strong></div>
      <div><span>Bàn</span><strong>{receipt.tableId}</strong></div>
      <div><span>Ngày</span><strong>{formatDate(receipt.paidAt)}</strong></div>
      <div><span>Giờ</span><strong>{formatTime(receipt.paidAt)}</strong></div>
    </div>
    <div className="receipt-table">
      <div className="receipt-table-head" aria-hidden="true">
        <span>Tên món</span><span>SL</span><span>Thành tiền</span>
      </div>
      <div className="receipt-lines">{lines.map((line, index) => <div className="receipt-line" key={`${line.name}-${index}`}>
        <span className="receipt-item-name">{line.name}</span>
        <span className="receipt-item-quantity">{line.quantity}</span>
        <strong>{formatMoney(line.total)}</strong>
      </div>)}</div>
    </div>
    <div className="receipt-summary">
      <div className="receipt-total"><span>Tạm tính</span><strong>{formatMoney(receipt.subtotal)}</strong></div>
      {receipt.discount > 0 && <div className="receipt-total"><span>Giảm giá</span><strong>−{formatMoney(receipt.discount)}</strong></div>}
      <div className="receipt-total grand"><span>Tổng thanh toán</span><strong>{formatMoney(receipt.total)}</strong></div>
      {receipt.payments.map((payment) => <div className="receipt-payment" key={payment.method}><span>{payment.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</span><strong>{formatMoney(payment.amount)}</strong></div>)}
      <div className="receipt-change"><span>Tiền thừa</span><strong>{formatMoney(receipt.change)}</strong></div>
    </div>
    <footer className="receipt-footer">Cảm ơn quý khách!<span>Hẹn gặp lại</span></footer>
  </article>;
}

export function PrintReceipt({ receipt, onClose }: { receipt: CompletedBill; onClose: () => void }) {
  const [printing, setPrinting] = useState(false);
  const lines = groupReceiptLines(receipt.lines);

  useEffect(() => {
    if (!printing) return undefined;
    const handleAfterPrint = () => setPrinting(false);
    window.addEventListener('afterprint', handleAfterPrint);
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [printing]);

  return <Modal title="Hóa đơn thanh toán" onClose={onClose}>
    <div className="modal-body receipt-body">
      <ReceiptDocument receipt={receipt} lines={lines} />
    </div>
    <footer className="modal-footer"><button className="button-secondary" type="button" onClick={onClose}>Đóng</button><button className="button-primary" type="button" onClick={() => setPrinting(true)}><i className="icon fa-solid fa-print" />In hóa đơn</button></footer>
    <PrintSurface active={printing}><ReceiptDocument receipt={receipt} lines={lines} /></PrintSurface>
  </Modal>;
}

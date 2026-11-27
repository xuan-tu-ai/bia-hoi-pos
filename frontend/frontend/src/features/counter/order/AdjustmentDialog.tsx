import { useState } from 'react';
import { Modal } from '../../../components/shared/Modal.tsx';
import { ADJUSTMENT_REASONS, type AdjustmentReason, type DiningTable, type OrderAdjustment, type User } from '../../../types/index.ts';

interface AdjustmentDialogProps {
  table: DiningTable;
  user: User;
  onClose: () => void;
  onSubmit: (adjustment: OrderAdjustment) => void;
}

export function AdjustmentDialog({ table, user, onClose, onSubmit }: AdjustmentDialogProps) {
  const [selected, setSelected] = useState('');
  const [action, setAction] = useState<'void' | 'discount'>('void');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState<AdjustmentReason>(ADJUSTMENT_REASONS[0]);
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [discount, setDiscount] = useState('');
  const lines = table.rounds.flatMap((round) => round.lines.filter((line) => !line.adjustment && line.quantity > 0).map((line) => ({ ...line, roundId: round.id })));
  const selectedLine = lines.find((line) => `${line.roundId}:${line.id}` === selected);

  return <Modal title="Hủy / giảm món đã gửi" onClose={onClose}>
    <div className="modal-body feature-form">
      <label className="modal-field"><span>Món đã gửi</span><select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Chọn món</option>{lines.map((line) => <option key={`${line.roundId}:${line.id}`} value={`${line.roundId}:${line.id}`}>{line.name} · còn {line.quantity}</option>)}</select></label>
      <label className="modal-field"><span>Thao tác</span><select value={action} onChange={(event) => setAction(event.target.value as 'void' | 'discount')}><option value="void">Hủy món</option><option value="discount">Giảm giá</option></select></label>
      <label className="modal-field"><span>{action === 'void' ? 'Số lượng hủy' : 'Số lượng món áp dụng'}</span><input type="number" min="1" max={selectedLine?.quantity || 1} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
      {action === 'discount' && <label className="modal-field"><span>Số tiền giảm (₫)</span><input type="number" min="1" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>}
      <label className="modal-field"><span>Lý do bắt buộc</span><select value={reason} onChange={(event) => setReason(event.target.value as AdjustmentReason)}>{ADJUSTMENT_REASONS.map((item) => <option key={item}>{item}</option>)}</select></label>
      {reason === 'Khác' && <label className="modal-field"><span>Ghi chú lý do</span><input value={note} onChange={(event) => setNote(event.target.value)} required /></label>}
      {user.role === 'staff' && <label className="modal-field"><span>PIN Quản lý ca</span><input type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="PIN demo: 1234" /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
    <footer className="modal-footer"><button className="button-secondary" type="button" onClick={onClose}>Hủy</button><button className="button-primary" type="button" disabled={!selected || !reason || (reason === 'Khác' && !note.trim()) || (user.role === 'staff' && !pin) || (action === 'discount' && Number(discount) <= 0)} onClick={() => {
      if (user.role === 'staff' && pin !== '1234') {
        setError('PIN không đúng.');
        return;
      }
      const [roundId, lineId] = selected.split(':');
      setError('');
      onSubmit({ roundId, lineId, action, quantity: Number(quantity), discountAmount: Number(discount), reason, note, approverPin: pin || undefined });
    }}>Xác nhận</button></footer>
  </Modal>;
}

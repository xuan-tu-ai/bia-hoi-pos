import { useState } from 'react';
import { Modal } from '../../../components/shared/Modal.tsx';
import type { DiningTable } from '../../../types/index.ts';

interface MoveMergeDialogProps {
  table: DiningTable;
  tables: DiningTable[];
  onClose: () => void;
  onSubmit: (targetId: number, merge: boolean) => void;
}

export function MoveMergeDialog({ table, tables, onClose, onSubmit }: MoveMergeDialogProps) {
  const [mode, setMode] = useState<'move' | 'merge'>('move');
  const [targetId, setTargetId] = useState('');
  const candidates = tables.filter((item) => item.id !== table.id && (mode === 'move' ? item.status === 'empty' : item.status !== 'empty'));

  return <Modal title="Chuyển / gộp bàn" onClose={onClose}>
    <div className="modal-body">
      <div className="payment-methods"><button type="button" className={mode === 'move' ? 'is-selected' : ''} onClick={() => { setMode('move'); setTargetId(''); }}>Chuyển bàn</button><button type="button" className={mode === 'merge' ? 'is-selected' : ''} onClick={() => { setMode('merge'); setTargetId(''); }}>Gộp bàn</button></div>
      <label className="modal-field"><span>Bàn đích</span><select value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="" disabled>Chọn bàn</option>{candidates.map((item) => <option value={item.id} key={item.id}>Bàn {item.id}{item.status !== 'empty' ? ' · đang có khách' : ''}</option>)}</select></label>
      <p className="form-hint">{mode === 'move' ? 'Chỉ chọn được bàn trống. Toàn bộ phiên sẽ chuyển sang bàn đích.' : 'Chỉ chọn được bàn đang có khách. Các món sẽ nhập vào phiên bàn đích.'}</p>
    </div>
    <footer className="modal-footer"><button className="button-secondary" type="button" onClick={onClose}>Hủy</button><button className="button-primary" type="button" disabled={!targetId} onClick={() => onSubmit(Number(targetId), mode === 'merge')}>Xác nhận</button></footer>
  </Modal>;
}

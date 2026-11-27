import { useState } from 'react';
import { Modal } from '../../../components/shared/Modal.tsx';

interface Tap {
  name: string;
  keg: string;
  beer: string;
  sold: number;
  capacity: number;
}

interface WarehouseKeg {
  code: string;
  beer: string;
  capacity: number;
  status: 'Trong kho' | 'Đang dùng' | 'Đã hết';
}

export function TapPage({ onToast }: { onToast: (message: string) => void }) {
  const [taps, setTaps] = useState<Tap[]>([
    { name: 'Vòi 1', keg: 'KEG-0008', beer: 'Bia hơi Hà Nội', sold: 46, capacity: 50 },
    { name: 'Vòi 2', keg: 'KEG-0006', beer: 'Bia hơi Hải Phòng', sold: 27, capacity: 30 },
    { name: 'Vòi 3', keg: 'Chưa gắn keg', beer: '—', sold: 0, capacity: 50 }
  ]);
  const [warehouseKegs, setWarehouseKegs] = useState<WarehouseKeg[]>([
    { code: 'KEG-0009', beer: 'Bia hơi Hà Nội', capacity: 50, status: 'Trong kho' },
    { code: 'KEG-0010', beer: 'Bia hơi Hải Phòng', capacity: 30, status: 'Trong kho' }
  ]);
  const [confirmTap, setConfirmTap] = useState<number | null>(null);
  const [selectedKegCode, setSelectedKegCode] = useState('');
  const openReplaceDialog = (index: number) => {
    const currentTap = taps[index];
    const available = warehouseKegs.filter((keg) => keg.status === 'Trong kho'
      && (currentTap.beer === '—' || keg.beer === currentTap.beer));
    setSelectedKegCode(available[0]?.code ?? '');
    setConfirmTap(index);
  };
  const replaceTap = (index: number) => {
    const selectedKeg = warehouseKegs.find((keg) => keg.code === selectedKegCode && keg.status === 'Trong kho');
    if (!selectedKeg) return;
    setTaps((current) => current.map((item, itemIndex) => itemIndex === index
      ? { ...item, keg: selectedKeg.code, beer: selectedKeg.beer, sold: 0, capacity: selectedKeg.capacity }
      : item));
    setWarehouseKegs((current) => current.map((keg) => keg.code === selectedKeg.code
      ? { ...keg, status: 'Đang dùng' }
      : keg.code === taps[index].keg
        ? { ...keg, status: 'Đã hết' }
        : keg));
    setConfirmTap(null);
    setSelectedKegCode('');
    onToast(`Đã thay ${selectedKeg.code} cho ${taps[index].name}.`);
  };
  const availableForCurrentTap = confirmTap === null ? [] : warehouseKegs.filter((keg) =>
    keg.status === 'Trong kho'
    && (taps[confirmTap].beer === '—' || keg.beer === taps[confirmTap].beer));

  return <main className="page-content feature-content">
    <div className="page-heading"><div><span className="eyebrow">Phân hệ Quầy</span><h1>Vòi bia & thay keg</h1><p>FR-10 · Theo dõi keg đang dùng và thể tích bia đã bán</p></div></div>
    <div className="tap-grid">{taps.map((tap, index) => <article className="panel tap-card" key={tap.name}><header><span className="tap-icon"><i className="icon fa-solid fa-beer-mug-empty" /></span><div><h2>{tap.name}</h2><p>{tap.beer} · {tap.keg}</p></div><span className="status-pill">{tap.keg === 'Chưa gắn keg' ? 'Sẵn sàng' : 'Đang dùng'}</span></header><div className="tap-progress-label"><span>Đã bán</span><strong>{tap.sold} / {tap.capacity} L</strong></div><div className="tap-progress"><span style={{ width: `${Math.min(100, tap.sold / tap.capacity * 100)}%` }} /></div><div className="tap-card-footer"><span>Còn khoảng {Math.max(0, tap.capacity - tap.sold)} L</span><button className="button-secondary" type="button" onClick={() => openReplaceDialog(index)}>Thay keg</button></div></article>)}</div>
    {confirmTap !== null && <Modal title="Chọn keg thay mới" onClose={() => setConfirmTap(null)}>
      <div className="modal-body">
        <p><strong>{taps[confirmTap].name}</strong> đang dùng {taps[confirmTap].keg}. Chỉ hiển thị keg cùng loại bia còn trong kho.</p>
        {availableForCurrentTap.length > 0
          ? <label className="modal-field">
              <span>Keg trong kho</span>
              <select value={selectedKegCode} onChange={(event) => setSelectedKegCode(event.target.value)}>
                {availableForCurrentTap.map((keg) => <option key={keg.code} value={keg.code}>{keg.code} · {keg.beer} · {keg.capacity} L</option>)}
              </select>
            </label>
          : <p className="form-error" role="alert">Không có keg phù hợp đang trong kho.</p>}
        {taps[confirmTap].keg !== 'Chưa gắn keg' && taps[confirmTap].sold / taps[confirmTap].capacity < .9
          && <p>Keg cũ đã bán {Math.round(taps[confirmTap].sold / taps[confirmTap].capacity * 100)}% dung tích. Phần bia còn lại sẽ được tính là hao hụt.</p>}
      </div>
      <footer className="modal-footer"><button className="button-secondary" type="button" onClick={() => { setConfirmTap(null); setSelectedKegCode(''); }}>Hủy</button><button className="button-primary" type="button" disabled={!selectedKegCode} onClick={() => replaceTap(confirmTap)}>Xác nhận thay</button></footer>
    </Modal>}
  </main>;
}

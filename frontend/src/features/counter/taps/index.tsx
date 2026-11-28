import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../../../components/shared/Modal.tsx';
import { counterApi } from '../../../services/counter.ts';
import type { AvailableKeg, TapInfo } from '../../../types/index.ts';

export function TapPage({ onToast }: { onToast: (message: string) => void }) {
  const [taps, setTaps] = useState<TapInfo[]>([]);
  const [availableKegs, setAvailableKegs] = useState<AvailableKeg[]>([]);
  const [loading, setLoading] = useState(true);
  const [warnTap, setWarnTap] = useState<TapInfo | null>(null);
  const [confirmTap, setConfirmTap] = useState<TapInfo | null>(null);
  const [selectedKegId, setSelectedKegId] = useState('');
  const [busy, setBusy] = useState(false);

  const loadTaps = useCallback(async () => {
    try {
      const res = await counterApi.getTaps();
      setTaps(res.taps);
      setAvailableKegs(res.availableKegs);
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Không thể tải danh sách vòi bia.');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => { void loadTaps(); }, [loadTaps]);

  const isBelowNinetyPercent = (tap: TapInfo) => Boolean(tap.kegCode) && tap.soldMl / (tap.capacityMl || 1) < 0.9;

  const proceedToReplaceDialog = (tap: TapInfo) => {
    const matching = availableKegs.filter((keg) => !tap.beerName || keg.beerName === tap.beerName);
    setSelectedKegId(matching[0] ? String(matching[0].id) : '');
    setConfirmTap(tap);
  };

  const openReplaceDialog = (tap: TapInfo) => {
    if (isBelowNinetyPercent(tap)) {
      setWarnTap(tap);
      return;
    }
    proceedToReplaceDialog(tap);
  };

  const replaceTap = async () => {
    if (!confirmTap || !selectedKegId) return;
    setBusy(true);
    try {
      await counterApi.changeTapKeg(confirmTap.id, Number(selectedKegId));
      const chosen = availableKegs.find((k) => String(k.id) === selectedKegId);
      onToast(`Đã thay ${chosen?.code ?? 'keg mới'} cho ${confirmTap.name}.`);
      setConfirmTap(null);
      setSelectedKegId('');
      await loadTaps();
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Không thể thay keg.');
    } finally {
      setBusy(false);
    }
  };

  const availableForCurrentTap = !confirmTap
    ? []
    : availableKegs.filter((keg) => !confirmTap.beerName || keg.beerName === confirmTap.beerName);

  return <main className="page-content feature-content">
    <div className="page-heading"><div><span className="eyebrow">Phân hệ Quầy</span><h1>Vòi bia & thay keg</h1><p>FR-10 · Theo dõi keg đang dùng và thể tích bia đã bán từ Neon DB</p></div></div>
    {loading ? <p>Đang tải danh sách vòi bia...</p> : (
      <div className="tap-grid">
        {taps.map((tap) => {
          const soldLiters = Number((tap.soldMl / 1000).toFixed(1));
          const capLiters = Math.round(tap.capacityMl / 1000) || 50;
          const pct = Math.min(100, (tap.soldMl / (tap.capacityMl || 1)) * 100);
          return <article className="panel tap-card" key={tap.id}>
            <header>
              <span className="tap-icon"><i className="icon fa-solid fa-beer-mug-empty" /></span>
              <div><h2>{tap.name}</h2><p>{tap.beerName ?? '—'} · {tap.kegCode ?? 'Chưa gắn keg'}</p></div>
              <span className="status-pill">{tap.kegCode ? 'Đang dùng' : 'Sẵn sàng'}</span>
            </header>
            <div className="tap-progress-label"><span>Đã bán</span><strong>{soldLiters} / {capLiters} L</strong></div>
            <div className="tap-progress"><span style={{ width: `${pct}%` }} /></div>
            <div className="tap-card-footer">
              <span>Còn khoảng {Math.max(0, Number((capLiters - soldLiters).toFixed(1)))} L ({Math.round(pct)}%)</span>
              <button className="button-secondary" type="button" onClick={() => openReplaceDialog(tap)}>
                Thay keg
              </button>
            </div>
          </article>;
        })}
      </div>
    )}
    {warnTap && <Modal title="Cảnh báo chưa đủ 90%" onClose={() => setWarnTap(null)}>
      <div className="modal-body">
        <p className="feature-note" role="alert">
          Keg <strong>{warnTap.kegCode}</strong> trên <strong>{warnTap.name}</strong> mới dùng{' '}
          <strong>{Math.round((warnTap.soldMl / (warnTap.capacityMl || 1)) * 100)}%</strong> (chưa đủ 90%).
          Phần bia còn lại sẽ được tính là hao hụt.
        </p>
        <p className="form-hint">Bạn vẫn có thể tiếp tục chọn keg mới nếu chắc chắn muốn thay.</p>
      </div>
      <footer className="modal-footer">
        <button className="button-secondary" type="button" onClick={() => setWarnTap(null)}>Hủy</button>
        <button className="button-primary" type="button" onClick={() => {
          const target = warnTap;
          setWarnTap(null);
          proceedToReplaceDialog(target);
        }}>Tiếp tục thay</button>
      </footer>
    </Modal>}
    {confirmTap && <Modal title="Chọn keg thay mới" onClose={() => setConfirmTap(null)}>
      <div className="modal-body">
        <p><strong>{confirmTap.name}</strong> đang dùng {confirmTap.kegCode ?? 'chưa gắn keg'}. Chỉ hiển thị keg cùng loại bia còn trong kho.</p>
        {isBelowNinetyPercent(confirmTap) && (
          <p className="feature-note" role="alert">
            Cảnh báo: Keg hiện tại mới dùng {Math.round((confirmTap.soldMl / (confirmTap.capacityMl || 1)) * 100)}% (chưa đủ 90%). Phần bia còn lại sẽ được tính là hao hụt — bấm "Xác nhận thay" nếu chắc chắn.
          </p>
        )}
        {availableForCurrentTap.length > 0
          ? <label className="modal-field">
              <span>Keg trong kho</span>
              <select value={selectedKegId} onChange={(event) => setSelectedKegId(event.target.value)}>
                {availableForCurrentTap.map((keg) => <option key={keg.id} value={keg.id}>{keg.code} · {keg.beerName} · {Math.round(keg.capacityMl / 1000)} L</option>)}
              </select>
            </label>
          : <p className="form-error" role="alert">Không có keg phù hợp đang trong kho.</p>}
      </div>
      <footer className="modal-footer">
        <button className="button-secondary" type="button" onClick={() => { setConfirmTap(null); setSelectedKegId(''); }}>Hủy</button>
        <button className="button-primary" type="button" disabled={!selectedKegId || busy} onClick={() => { void replaceTap(); }}>Xác nhận thay</button>
      </footer>
    </Modal>}
  </main>;
}

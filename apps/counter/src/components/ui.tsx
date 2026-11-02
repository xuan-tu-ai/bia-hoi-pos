import { useEffect, useRef, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { vnd } from '../lib/format';
import { Icon } from './Icon';

export function Money({ value, unit = 'đ' }: { value: number; unit?: string }) {
  return (
    <span className="num">
      {vnd(value)}
      <small className="unit"> {unit}</small>
    </span>
  );
}

/** Hộp thoại dùng thẻ <dialog> gốc: bẫy focus, phím Esc, lớp phủ. */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={wide ? 'dialog wide' : 'dialog'} onClose={onClose} onCancel={onClose} aria-label={title}>
      <header>
        <h2>{title}</h2>
        <button className="btn ghost icon" onClick={onClose} aria-label="Đóng">
          <Icon name="close" />
        </button>
      </header>
      <div className="dialog-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </dialog>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className="field-control">
        <span className="field-label">{label}</span>
        {children}
      </label>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

/**
 * Bàn phím PIN cảm ứng (nút 64px) — gõ được cả bằng bàn phím số của máy.
 * Đủ 4–6 số thì bấm "Xác nhận" hoặc Enter.
 */
export function PinPad({ onSubmit, busy, label, submitLabel = 'Xác nhận' }: { onSubmit: (pin: string) => void; busy?: boolean; label: string; submitLabel?: string }) {
  const [pin, setPin] = useState('');
  const press = (k: (typeof KEYS)[number]) => {
    if (k === 'clear') setPin('');
    else if (k === 'back') setPin((p) => p.slice(0, -1));
    else setPin((p) => (p.length < 6 ? p + k : p));
  };
  const submit = () => {
    if (pin.length >= 4 && !busy) {
      onSubmit(pin);
      setPin('');
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // đang gõ vào ô nhập khác thì không bắt phím
      if ((e.target as HTMLElement).closest?.('input, textarea, select')) return;
      if (/^\d$/.test(e.key)) press(e.key as (typeof KEYS)[number]);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Enter') submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="pinpad" role="group" aria-label={label}>
      <div className="pin-dots" aria-live="polite" aria-label={`Đã nhập ${pin.length} số`}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={i < pin.length ? 'dot on' : i < 4 ? 'dot' : 'dot opt'} />
        ))}
      </div>
      <div className="pin-keys">
        {KEYS.map((k) => (
          <button key={k} type="button" className="pin-key" onClick={() => press(k)} aria-label={k === 'clear' ? 'Xóa hết' : k === 'back' ? 'Xóa một số' : k}>
            {k === 'clear' ? 'Xóa' : k === 'back' ? <Icon name="del" size={22} /> : k}
          </button>
        ))}
      </div>
      <button type="button" className="btn primary big block" disabled={pin.length < 4 || busy} onClick={submit}>
        {busy ? 'Đang kiểm tra…' : submitLabel}
      </button>
    </div>
  );
}

/** Mã QR vẽ bằng SVG từ chuỗi VietQR. */
export function QrCode({ value, size = 220, label }: { value: string; size?: number; label: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(setSvg, () => setSvg(''));
  }, [value]);
  return <div className="qr" style={{ width: size, height: size }} role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Toast({ message, action, onClose }: { message: string; action?: { label: string; run: () => void }; onClose: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onClose, 12_000);
    return () => window.clearTimeout(id);
  }, [message, onClose]);
  return (
    <div className="toast" role="status">
      <span>{message}</span>
      {action && (
        <button className="btn" onClick={action.run}>
          {action.label}
        </button>
      )}
      <button className="btn ghost icon" onClick={onClose} aria-label="Đóng thông báo">
        <Icon name="close" />
      </button>
    </div>
  );
}

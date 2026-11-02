import { useEffect, useRef, type ReactNode } from 'react';
import type { ApiError } from '../lib/api';
import { time, vnd } from '../lib/format';
import { Icon } from './Icon';

/** Số tiền với đơn vị nhỏ, xám (app-screens §7.4). */
export function Money({ value, unit = 'đ' }: { value: number; unit?: string }) {
  return (
    <span className="num">
      {vnd(value)}
      <small className="unit"> {unit}</small>
    </span>
  );
}

export function TitleRow({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="title-row">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div className="title-actions">{actions}</div>}
    </div>
  );
}

/** "Cập nhật 16:05" kèm nút làm mới. */
export function Stamp({ at, onRefresh, busy }: { at: Date | null; onRefresh: () => void; busy?: boolean }) {
  return (
    <span className="stamp">
      {at ? `Cập nhật ${time(at.toISOString())}` : 'Đang tải…'}
      <button className="btn ghost icon" onClick={onRefresh} disabled={busy} aria-label="Làm mới">
        <Icon name="refresh" />
      </button>
    </span>
  );
}

/** Lỗi nằm trong khối bị lỗi, không phủ cả màn hình (app-screens §11). */
export function ErrorBlock({ error, onRetry, lastGood }: { error: ApiError; onRetry: () => void; lastGood?: Date | null }) {
  return (
    <div className="error-block" role="alert">
      <span className="error-icon">
        <Icon name="alert" />
      </span>
      <span>
        {error.status === 0 ? 'Không kết nối được máy chủ.' : `Không tải được dữ liệu: ${error.message}.`}
        {lastGood && ` Số liệu đang hiện là của lúc ${time(lastGood.toISOString())}.`}
      </span>
      <button className="card-link" onClick={onRetry}>
        Thử lại
      </button>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Ô giữ chỗ khi đang tải: thanh xám đúng kích thước, không hiệu ứng nhấp nháy. */
export function Skeleton({ width = '60%', height = 20 }: { width?: number | string; height?: number }) {
  return <span className="skeleton" style={{ display: 'block', width, height }} />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rows" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div className="row" key={i}>
          <Skeleton width="40%" height={14} />
          <span style={{ flex: 1 }} />
          <Skeleton width={72} height={14} />
        </div>
      ))}
    </div>
  );
}

/** Hộp thoại dùng thẻ <dialog> gốc: có bẫy focus, phím Esc và lớp phủ. */
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

export function Field({ label, hint, children, error }: { label: string; hint?: string; children: ReactNode; error?: string }) {
  return (
    <div className="field">
      <label className="field-control">
        <span className="field-label">{label}</span>
        {children}
      </label>
      {error ? <span className="field-error">{error}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

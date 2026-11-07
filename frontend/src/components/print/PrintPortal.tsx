import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Đưa nội dung cần in ra ngay dưới <body>. CSS @media print (index.css) chỉ in phần này,
 * nên bấm In chỉ ra phiếu, không ra cả trang (FR-04).
 */
export function PrintPortal({ children }: { children: ReactNode }) {
  return createPortal(<div className="print-root">{children}</div>, document.body);
}

export function printNow() {
  // đợi trình duyệt vẽ xong nội dung portal
  requestAnimationFrame(() => window.print());
}

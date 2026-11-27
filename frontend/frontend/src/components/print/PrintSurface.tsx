import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

export function PrintSurface({ active, children }: { active: boolean; children: ReactNode }) {
  return createPortal(
    <div className="print-stage" data-active={active ? 'true' : 'false'}>{children}</div>,
    document.body
  );
}

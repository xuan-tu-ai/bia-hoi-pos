import { useEffect, type MouseEvent, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, wide = false }: ModalProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const closeOnBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return <div className="modal-backdrop" onMouseDown={closeOnBackdrop}>
    <section className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header className="modal-header"><h2 id="modal-title">{title}</h2><button className="modal-close" type="button" aria-label="Đóng" onClick={onClose}><i className="icon fa-solid fa-xmark" aria-hidden="true" /></button></header>
      {children}
    </section>
  </div>;
}

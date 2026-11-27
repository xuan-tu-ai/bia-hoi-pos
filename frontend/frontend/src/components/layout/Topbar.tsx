import { formatDate } from '../../lib/format.ts';
import { FEATURE_MODULES } from '../../features/registry.ts';

interface TopbarProps {
  activeView: string;
  mobileOpen: boolean;
  onToggleMobile: () => void;
}

export function Topbar({ activeView, mobileOpen, onToggleMobile }: TopbarProps) {
  const activeLabel = FEATURE_MODULES.find((module) => module.view === activeView)?.label ?? 'Sơ đồ bàn';
  return <header className="topbar">
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button className="icon-button mobile-menu" type="button" aria-label="Mở menu" aria-expanded={mobileOpen} onClick={onToggleMobile}><i className="icon fa-solid fa-bars" aria-hidden="true" /></button>
      <div className="breadcrumb"><span>Quầy Bia</span><span>/</span><strong>{activeLabel}</strong></div>
    </div>
    <div className="topbar-actions"><span className="today-label">{formatDate()}</span><button className="icon-button" type="button" aria-label="Thông báo" title="Thông báo"><i className="icon fa-solid fa-bell" aria-hidden="true" /></button></div>
  </header>;
}

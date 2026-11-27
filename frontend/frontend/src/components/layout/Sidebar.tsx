import { can, roleLabel } from '../../lib/permissions.ts';
import { initials } from '../../lib/format.ts';
import { FEATURE_MODULES } from '../../features/registry.ts';
import type { User } from '../../types/index.ts';
import type { Dispatch, SetStateAction } from 'react';

interface SidebarProps {
  user: User;
  occupiedCount: number;
  shiftOpen: boolean;
  activeView: string;
  onNavigate: (view: string) => void;
  onSignOut: () => void;
  mobileOpen: boolean;
  setMobileOpen: Dispatch<SetStateAction<boolean>>;
}

export function Sidebar({ user, occupiedCount, shiftOpen, activeView, onNavigate, onSignOut, mobileOpen, setMobileOpen }: SidebarProps) {
  return <aside className={`sidebar${mobileOpen ? ' is-open' : ''}`} aria-label="Điều hướng chính">
    <a className="brand-mark" href="/dashboard"><span className="brand-symbol"><i className="icon fa-solid fa-beer-mug-empty" aria-hidden="true" /></span><span>quầy bia<span style={{ color: 'var(--green)' }}>.</span></span></a>
    <div className="workspace-label">Không gian làm việc</div>
    <nav className="nav-list">{(['Quầy', 'Báo cáo', 'Quản trị'] as const).map((group) => {
      const visibleLinks = FEATURE_MODULES.filter((module) => module.group === group && can(user, module.permission));
      if (!visibleLinks.length) return null;
      return <div className="nav-group" key={group}><div className="nav-group-title">{group}</div>{visibleLinks.map((module) => <a className="nav-link" href={`#${module.view}`} key={module.view} aria-current={module.view === activeView ? 'page' : undefined} onClick={(event) => { event.preventDefault(); setMobileOpen(false); onNavigate(module.view); }}><i className={`icon fa-solid ${module.icon}`} aria-hidden="true" />{module.label}{module.view === 'tables' && <span className="nav-count">{occupiedCount}</span>}</a>)}</div>;
    })}</nav>
    <div className="sidebar-bottom"><div className="shift-card"><div className="shift-label">Ca hiện tại <span className={`shift-status${shiftOpen ? '' : ' is-closed'}`}>{shiftOpen ? 'Đang mở' : 'Chưa mở'}</span></div><div className="shift-value">{shiftOpen ? 'Ca chiều · 14:00' : 'Chưa mở ca'}</div></div><div className="profile"><span className="avatar">{initials(user.name)}</span><div className="profile-copy"><div className="profile-name">{user.name}</div><div className="profile-role">{roleLabel(user.role)}</div></div><button className="logout-button" type="button" onClick={onSignOut} aria-label="Đăng xuất" title="Đăng xuất"><i className="icon fa-solid fa-right-from-bracket" aria-hidden="true" /></button></div></div>
  </aside>;
}

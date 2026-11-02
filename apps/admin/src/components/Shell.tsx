// Khung "open plane" của phong cách accent-ladder: sidebar trên nền trang, không có thanh trên cùng.
// Trên điện thoại sidebar gập thành thanh 48px và một tấm toàn màn hình.

import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ROLE_LABELS } from '@biahoi/shared';
import { isOwner, useAuth } from '../lib/auth';
import { useInstall } from '../lib/install';
import { setTheme, useTheme } from '../lib/theme';
import { ErrorBoundary } from './ErrorBoundary';
import { Icon, Mark, type IconName } from './Icon';

export const SHOP_NAME = 'Bia hơi Ngõ 7'; // tên quán mẫu cho bản demo

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

const REPORTS: NavItem[] = [
  { to: '/', label: 'Hôm nay', icon: 'today' },
  { to: '/hao-hut-keg', label: 'Hao hụt keg', icon: 'keg' },
  { to: '/nhat-ky-huy', label: 'Nhật ký hủy/giảm', icon: 'voids' },
  { to: '/ban-chay', label: 'Bán chạy & giờ đông', icon: 'ranking' },
  { to: '/ca', label: 'Ca làm việc', icon: 'shift' },
];

const ADMIN: NavItem[] = [
  { to: '/thuc-don', label: 'Thực đơn', icon: 'menu' },
  { to: '/tram-in', label: 'Trạm in', icon: 'printer' },
  { to: '/khu-ban', label: 'Khu & bàn', icon: 'tables' },
  { to: '/nhan-vien', label: 'Nhân viên', icon: 'staff' },
  { to: '/kho-keg', label: 'Kho keg & vòi', icon: 'stock' },
  { to: '/gio-vang', label: 'Giờ vàng', icon: 'happy' },
];

export const ALL_NAV = [...REPORTS, ...ADMIN];

function NavList({ items }: { items: NavItem[] }) {
  return (
    <ul className="nav-list">
      {items.map((it) => (
        <li key={it.to}>
          <NavLink to={it.to} end={it.to === '/'} className="nav-item">
            <Icon name={it.icon} />
            <span>{it.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const install = useInstall();
  const theme = useTheme();
  useEffect(() => setOpen(false), [location.pathname]);

  const current = ALL_NAV.find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)));

  return (
    <div className="app">
      <header className="phone-bar">
        <span className="brand-mini">
          <Mark size={24} />
        </span>
        <span className="phone-title">{current?.label ?? 'Bia Hơi Quầy'}</span>
        <button className="btn ghost icon menu-toggle" onClick={() => setOpen(true)} aria-label="Mở menu" aria-expanded={open}>
          <Icon name="burger" size={20} />
        </button>
      </header>

      <nav className={open ? 'sidebar open' : 'sidebar'} aria-label="Điều hướng chính">
        <div className="brand">
          <Mark />
          <span className="brand-text">
            <strong>Bia Hơi Quầy</strong>
            <span>{SHOP_NAME}</span>
          </span>
          <button className="btn ghost icon sheet-close" onClick={() => setOpen(false)} aria-label="Đóng menu">
            <Icon name="close" size={20} />
          </button>
        </div>

        <p className="group-label">Báo cáo</p>
        <NavList items={REPORTS} />
        {isOwner(user) && (
          <>
            <p className="group-label">Quản trị</p>
            <NavList items={ADMIN} />
          </>
        )}

        {install && (
          <button className="btn install-app" onClick={() => void install()}>
            <Icon name="download" /> Cài ứng dụng
          </button>
        )}
        <div className="bottom user-row">
          <span className="avatar" aria-hidden="true">
            {user?.name.split(' ').at(-1)?.[0] ?? '?'}
          </span>
          <span className="user-text">
            <strong>{user?.name}</strong>
            <span>{user ? ROLE_LABELS[user.role] : ''}</span>
          </span>
          <button
            className="btn ghost icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
            title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <button className="btn ghost icon" onClick={logout} aria-label="Đăng xuất" title="Đăng xuất">
            <Icon name="logout" />
          </button>
        </div>
      </nav>

      <main className="canvas">
        <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
      </main>
    </div>
  );
}

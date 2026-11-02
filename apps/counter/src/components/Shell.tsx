// Khung framed-sheet: một khung màu nhạt hình chữ L (thanh trái 88px + thanh trên 48px) và tấm trắng làm việc.
// Thanh trái có nhãn dưới icon vì App quầy chỉ có 3 màn và cần chiều rộng cho sơ đồ 80 bàn.

import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { ROLE_LABELS } from '@biahoi/shared';
import { useConnected, useMinuteClock } from '../lib/hooks';
import { formatVnTime } from '@biahoi/shared';
import { useSession } from '../lib/session';
import { setTheme, useTheme } from '../lib/theme';
import { Icon, Mark, type IconName } from './Icon';

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Sơ đồ bàn', icon: 'map' },
  { to: '/voi-bia', label: 'Vòi bia', icon: 'keg' },
  { to: '/ca', label: 'Ca', icon: 'shift' },
];

export function Shell({ top, children }: { top?: ReactNode; children: ReactNode }) {
  const { staff, lock } = useSession();
  const now = useMinuteClock();
  const connected = useConnected();
  const theme = useTheme();
  return (
    <div className="frame">
      <nav className="rail" aria-label="Màn hình quầy">
        <span className="rail-mark" title="Bia Hơi Quầy">
          <Mark />
        </span>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className="rail-item">
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <header className="topbar">
        <div className="topbar-main">{top}</div>
        <div className="topbar-user">
          <span className="clock num" aria-label="Giờ hiện tại">
            {formatVnTime(now)}
          </span>
          <span className="who">
            <strong>{staff?.name}</strong>
            <span>{staff ? ROLE_LABELS[staff.role] : ''}</span>
          </span>
          <button
            className="btn icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
            title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
          </button>
          <button className="btn" onClick={lock}>
            <Icon name="user" /> Đổi người
          </button>
        </div>
      </header>
      <main className="sheet">
        {!connected && (
          <p className="offline" role="alert">
            <strong>Mất kết nối máy chủ.</strong> Bàn của máy khác chưa cập nhật và chưa gửi món được. Kiểm tra dây mạng hoặc wifi; kết nối lại thì màn tự cập nhật.
          </p>
        )}
        {children}
      </main>
    </div>
  );
}

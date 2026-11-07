import {
  Beer,
  CalendarClock,
  ChartColumn,
  ClipboardList,
  Gauge,
  LayoutGrid,
  Package,
  Sparkles,
  Users,
  UtensilsCrossed,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/types';

export type NavItem = { to: string; label: string; icon: LucideIcon; roles: Role[] };
export type NavSection = { title: string; items: NavItem[] };

const ALL: Role[] = ['COUNTER', 'SHIFT_MANAGER', 'OWNER'];
const MANAGERS: Role[] = ['SHIFT_MANAGER', 'OWNER'];
const OWNER: Role[] = ['OWNER'];

/** Menu bên trái — chỉ hiện mục hợp với vai trò (SRS 2.2). Quyền thật kiểm tra ở backend. */
export const NAV: NavSection[] = [
  {
    title: 'Quầy',
    items: [
      { to: '/counter', label: 'Sơ đồ bàn', icon: LayoutGrid, roles: ALL },
      { to: '/counter/taps', label: 'Vòi bia', icon: Beer, roles: ALL },
      { to: '/counter/shift', label: 'Ca làm việc', icon: Wallet, roles: ALL },
    ],
  },
  {
    title: 'Quản trị',
    items: [
      { to: '/admin/menu', label: 'Thực đơn', icon: UtensilsCrossed, roles: OWNER },
      { to: '/admin/areas', label: 'Khu & bàn', icon: Warehouse, roles: OWNER },
      { to: '/admin/staff', label: 'Nhân viên', icon: Users, roles: OWNER },
      { to: '/admin/kegs', label: 'Kho keg', icon: Package, roles: MANAGERS },
      { to: '/admin/happy-hours', label: 'Giờ vàng', icon: Sparkles, roles: OWNER },
    ],
  },
  {
    title: 'Báo cáo',
    items: [
      { to: '/reports/today', label: 'Hôm nay', icon: Gauge, roles: MANAGERS },
      { to: '/reports/keg-loss', label: 'Hao hụt keg', icon: CalendarClock, roles: OWNER },
      { to: '/reports/voids', label: 'Hủy / giảm', icon: ClipboardList, roles: MANAGERS },
      { to: '/reports/top-items', label: 'Bán chạy', icon: ChartColumn, roles: OWNER },
    ],
  },
];

export function navFor(role: Role): NavSection[] {
  return NAV.map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(role)) })).filter((s) => s.items.length > 0);
}

/** Trang mặc định sau khi đăng nhập. */
export function homeFor(role: Role): string {
  return role === 'OWNER' ? '/reports/today' : '/counter';
}

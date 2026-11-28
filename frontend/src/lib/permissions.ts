import type { User, UserRole } from '../types/index.ts';

export type Permission =
  | 'tables:view'
  | 'shifts:view'
  | 'shifts:close'
  | 'taps:manage'
  | 'inventory:receive'
  | 'menu:manage'
  | 'areas:manage'
  | 'staff:manage'
  | 'happyHours:manage'
  | 'reports:today'
  | 'reports:voids'
  | 'reports:kegLoss'
  | 'reports:topItems';

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = Object.freeze({
  staff: ['tables:view', 'shifts:view', 'taps:manage'],
  manager: ['tables:view', 'shifts:view', 'shifts:close', 'taps:manage', 'inventory:receive', 'reports:today', 'reports:voids'],
  owner: [
    'tables:view', 'shifts:view', 'shifts:close', 'taps:manage', 'inventory:receive',
    'menu:manage', 'areas:manage', 'staff:manage', 'happyHours:manage',
    'reports:today', 'reports:voids', 'reports:kegLoss', 'reports:topItems'
  ]
});

export const can = (user: User | null, permission: Permission): boolean => Boolean(user && ROLE_PERMISSIONS[user.role].includes(permission));

export const roleLabel = (role: UserRole) => ({ staff: 'Nhân viên quầy', manager: 'Quản lý ca', owner: 'Chủ quán' }[role] || 'Người dùng');
import type { Permission } from '../lib/permissions.ts';

export interface FeatureModule {
  view: string;
  label: string;
  icon: string;
  group: 'Quầy' | 'Báo cáo' | 'Quản trị';
  permission: Permission;
}

export const FEATURE_MODULES: readonly FeatureModule[] = [
  { view: 'tables', label: 'Sơ đồ bàn', icon: 'fa-table-cells-large', group: 'Quầy', permission: 'tables:view' },
  { view: 'shifts', label: 'Mở / đóng ca', icon: 'fa-clock', group: 'Quầy', permission: 'shifts:view' },
  { view: 'taps', label: 'Vòi & keg', icon: 'fa-beer-mug-empty', group: 'Quầy', permission: 'taps:manage' },
  { view: 'reports', label: 'Tổng quan hôm nay', icon: 'fa-chart-line', group: 'Báo cáo', permission: 'reports:today' },
  { view: 'kegLoss', label: 'Hao hụt keg', icon: 'fa-chart-column', group: 'Báo cáo', permission: 'reports:kegLoss' },
  { view: 'voids', label: 'Nhật ký hủy / giảm', icon: 'fa-receipt', group: 'Báo cáo', permission: 'reports:voids' },
  { view: 'topItems', label: 'Món bán chạy', icon: 'fa-ranking-star', group: 'Báo cáo', permission: 'reports:topItems' },
  { view: 'menu', label: 'Thực đơn & bếp', icon: 'fa-utensils', group: 'Quản trị', permission: 'menu:manage' },
  { view: 'areas', label: 'Khu & bàn', icon: 'fa-chair', group: 'Quản trị', permission: 'areas:manage' },
  { view: 'staff', label: 'Nhân viên', icon: 'fa-users', group: 'Quản trị', permission: 'staff:manage' },
  { view: 'kegs', label: 'Nhập kho keg', icon: 'fa-boxes-stacked', group: 'Quản trị', permission: 'inventory:receive' },
  { view: 'happyHours', label: 'Giá giờ vàng', icon: 'fa-tags', group: 'Quản trị', permission: 'happyHours:manage' }
];

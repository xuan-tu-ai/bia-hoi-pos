// Kiểu dữ liệu và hằng số dùng chung giữa API, App quầy và Web quản trị/PWA.

export const ROLES = ['COUNTER', 'SHIFT_MANAGER', 'OWNER'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  COUNTER: 'Nhân viên quầy',
  SHIFT_MANAGER: 'Quản lý ca',
  OWNER: 'Chủ quán',
};

/** Vai trò được phép duyệt hủy/giảm món và giảm giá hóa đơn (FR-06, FR-08). */
export const APPROVER_ROLES: readonly Role[] = ['SHIFT_MANAGER', 'OWNER'];

export const LINE_TYPES = ['NORMAL', 'VOID', 'DISCOUNT'] as const;
export type LineType = (typeof LINE_TYPES)[number];

export const ADJUST_REASONS = ['KHACH_DOI_Y', 'BEP_HET_MON', 'NHAP_NHAM', 'MON_LOI', 'KHAC'] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number];

export const ADJUST_REASON_LABELS: Record<AdjustReason, string> = {
  KHACH_DOI_Y: 'Khách đổi ý',
  BEP_HET_MON: 'Bếp hết món',
  NHAP_NHAM: 'Nhập nhầm',
  MON_LOI: 'Món lỗi',
  KHAC: 'Khác',
};

export const PAYMENT_METHODS = ['CASH', 'TRANSFER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const KEG_STATUSES = ['IN_STOCK', 'TAPPED', 'EMPTY'] as const;
export type KegStatus = (typeof KEG_STATUSES)[number];

/** Trạng thái màu của ô bàn trên sơ đồ (FR-02). */
export type TableStatus = 'EMPTY' | 'OPEN' | 'PROVISIONAL' | 'PRINT_ERROR';

export const SOCKET_EVENTS = {
  /** payload: { tableIds: number[] } */
  TABLE_UPDATED: 'table.updated',
  /** payload: {} — dashboard nên tải lại số liệu */
  DASHBOARD_UPDATED: 'dashboard.updated',
  /** payload: { tapIds: number[] } */
  TAP_UPDATED: 'tap.updated',
} as const;

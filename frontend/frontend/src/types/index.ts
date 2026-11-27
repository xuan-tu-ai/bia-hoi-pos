export type UserRole = 'staff' | 'manager' | 'owner';
export type TableStatus = 'empty' | 'occupied' | 'provisional';
export type AdjustmentAction = 'void' | 'discount';
export type PaymentMethod = 'CASH' | 'TRANSFER';
export const ADJUSTMENT_REASONS = ['Khách đổi ý', 'Bếp hết món', 'Nhập nhầm', 'Món lỗi', 'Khác'] as const;
export type AdjustmentReason = typeof ADJUSTMENT_REASONS[number];

export interface OrderAdjustment {
  roundId: string;
  lineId: string;
  action: AdjustmentAction;
  quantity: number;
  discountAmount: number;
  reason: AdjustmentReason;
  note: string;
  approverPin?: string;
}

export interface User {
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface ReportSummary {
  revenue: number;
  openAmount: number;
  occupiedTables: number;
  totalTables: number;
  bills: number;
}

export interface ReportKegLoss {
  threshold: number;
  totalLossLiters: number;
  totalLossAmount: number;
  kegs: Array<Record<string, string | number | boolean>>;
}

export interface ReportVoid {
  id: number;
  [key: string]: string | number;
}

export interface ReportTopItems {
  id: number;
  name: string;
  quantity: number;
  revenue: number;
}

export interface Area {
  id: string;
  name: string;
  firstTable: number;
  count: number;
}

export interface MenuItem {
  id: string;
  shortcut: string;
  name: string;
  category: string;
  price: number;
  station: string;
}

export interface OrderLine {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category?: string;
  station?: string;
  adjustment?: boolean;
  reason?: string;
  note?: string;
}

export interface OrderRound {
  id: string;
  sentAt: string;
  staffName: string;
  lines: OrderLine[];
}

export interface DiningTable {
  id: number;
  billNo?: string;
  areaId: string;
  status: TableStatus;
  guestCount: number | null;
  openedAt: string | null;
  total: number;
  rounds: OrderRound[];
  provisionalCount?: number;
}

export interface PaymentEntry {
  method: PaymentMethod;
  amount: number;
}

export interface PaymentDetails {
  subtotal: number;
  discount: number;
  total: number;
  change: number;
  payments: PaymentEntry[];
  discountType?: 'AMOUNT' | 'PERCENT';
  discountValue?: number;
  approverPin?: string;
}

export interface CompletedBill extends PaymentDetails {
  billNo: string;
  tableId: number;
  paidAt: string;
  lines: OrderLine[];
}

export interface PosData {
  areas: Area[];
  tables: DiningTable[];
  completedBills: CompletedBill[];
}

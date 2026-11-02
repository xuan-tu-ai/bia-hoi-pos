// Kiểu dữ liệu trả về từ backend (xem apps/api/README.md). Ngày giờ là chuỗi ISO.

import type { AdjustReason, KegStatus, Role } from '@biahoi/shared';

export interface Person {
  id: number;
  name: string;
}

export interface Me extends Person {
  role: Role;
  email: string | null;
}

export interface TodayReport {
  asOf: string;
  revenue: number;
  openTotal: number;
  occupiedTables: number;
  totalTables: number;
  billCount: number;
  yesterday: { revenue: number; billCount: number };
}

export interface HourlyReport {
  from: string;
  to: string;
  days: number;
  rows: { hour: number; revenue: number; billCount: number; avgRevenuePerDay: number }[];
}

export interface KegLossRow {
  id: number;
  beerName: string;
  tap: Person | null;
  capacityMl: number;
  soldMl: number;
  lossMl: number;
  lossPct: number;
  exceeded: boolean;
  cost: number;
  lossValue: number;
  tappedAt: string | null;
  emptiedAt: string | null;
  durationMinutes: number | null;
}

export interface KegLossReport {
  thresholdPct: number;
  rows: KegLossRow[];
  summary: { kegCount: number; totalLossMl: number; totalLossValue: number; exceededCount: number; soldMl: number; capacityMl: number };
}

export interface VoidRow {
  id: string;
  type: 'VOID' | 'DISCOUNT' | 'BILL_DISCOUNT';
  itemName: string | null;
  qty: number | null;
  amount: number;
  reason: AdjustReason | null;
  reasonLabel: string | null;
  reasonNote: string | null;
  tabId: number;
  tableCode: string;
  requestedBy: Person;
  approvedBy: Person | null;
  createdAt: string;
}

export interface VoidsReport {
  rows: VoidRow[];
  total: number;
  count: number;
}

export interface TopItemsReport {
  by: 'qty' | 'revenue';
  rows: { itemId: number; name: string; qty: number; revenue: number }[];
}

export interface Keg {
  id: number;
  beerName: string;
  capacityMl: number;
  cost: number;
  receivedAt: string;
  status: KegStatus;
  tapId: number | null;
  tappedAt: string | null;
  emptiedAt: string | null;
  soldMl: number;
  tap?: Person | null;
}

export interface Tap {
  id: number;
  name: string;
  sortOrder: number;
  currentKeg: Keg | null;
}

export interface ShiftSummary {
  cashTotal: number;
  transferTotal: number;
  revenue: number;
  billCount: number;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  note?: string | null;
}

export interface Shift {
  id: number;
  openedAt: string;
  openingCash: number;
  closedAt: string | null;
  countedCash: number | null;
  expectedCash: number | null;
  summary: ShiftSummary | null;
  openedBy: Person;
  closedBy: Person | null;
}

export interface MenuGroup {
  id: number;
  name: string;
  sortOrder: number;
}

export interface MenuItem {
  id: number;
  groupId: number;
  name: string;
  shortcut: string | null;
  price: number;
  unit: string;
  stationId: number | null;
  beerVolumeMl: number | null;
  defaultTapId: number | null;
  available: boolean;
  active: boolean;
  sortOrder: number;
  imageFile: string | null;
}

export interface PrintStation {
  id: number;
  name: string;
  printerName: string;
  /** BROWSER: App quầy in ra máy in mặc định; NETWORK: máy chủ gửi thẳng tới máy in mạng */
  connection: 'BROWSER' | 'NETWORK';
  host: string | null;
  port: number;
}

export interface Area {
  id: number;
  name: string;
  sortOrder: number;
}

export interface AreaWithTables extends Area {
  tables: {
    id: number;
    code: string;
    sortOrder: number;
    status: 'EMPTY' | 'OPEN' | 'PROVISIONAL' | 'PRINT_ERROR';
    tab: { id: number; openedAt: string; guestCount: number | null; total: number } | null;
  }[];
}

export interface Staff {
  id: number;
  name: string;
  role: Role;
  email: string | null;
  active: boolean;
  createdAt: string;
}

export interface HappyHour {
  id: number;
  name: string;
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
  start: string;
  end: string;
  active: boolean;
  prices: { id: number; itemId: number; price: number }[];
}

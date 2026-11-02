// Kiểu dữ liệu backend trả về (xem apps/api/openapi.yaml). Ngày giờ là chuỗi ISO.

import type { AdjustReason, Role } from '@biahoi/shared';

export interface Person {
  id: number;
  name: string;
}

export interface StaffSession extends Person {
  role: Role;
}

export type TableStatus = 'EMPTY' | 'OPEN' | 'PROVISIONAL' | 'PRINT_ERROR';

export interface MapTable {
  id: number;
  code: string;
  sortOrder: number;
  status: TableStatus;
  tab: { id: number; openedAt: string; guestCount: number | null; total: number } | null;
}

export interface MapArea {
  id: number;
  name: string;
  tables: MapTable[];
}

export interface LineState {
  remainingQty: number;
  discounted: number;
  netAmount: number;
}

export interface TabLine {
  id: number;
  itemId: number;
  itemName: string;
  qty: number;
  unitPrice: number;
  amount: number;
  lineType: 'NORMAL' | 'VOID' | 'DISCOUNT';
  refLineId: number | null;
  reason: AdjustReason | null;
  reasonNote: string | null;
  note: string | null;
  createdAt: string;
  createdBy: Person;
  approvedBy: Person | null;
  happyHourId: number | null;
  state?: LineState;
}

export interface TabRound {
  id: number;
  createdAt: string;
  createdBy: Person;
  printedStatus: 'PENDING' | 'PRINTED' | 'FAILED';
  note: string | null;
  lines: TabLine[];
}

export interface TabDetail {
  id: number;
  billCode: string;
  status: 'OPEN' | 'PAID' | 'MERGED';
  tableStatus: TableStatus | null;
  table: { id: number; code: string; areaId: number; areaName: string };
  openedAt: string;
  openedBy: Person;
  guestCount: number | null;
  total: number;
  paidAmount: number;
  provisionalCount: number;
  mergedIntoId: number | null;
  rounds: TabRound[];
  billDiscounts: { id: number; amount: number; percent: number | null; reason: AdjustReason; reasonNote: string | null; createdBy: Person; approvedBy: Person }[];
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
  available: boolean;
  sortOrder: number;
  imageFile: string | null;
}

export interface HappyHour {
  id: number;
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
  active: boolean;
  prices: { itemId: number; price: number }[];
}

export interface PrintTicket {
  title: string;
  stationId: number | null;
  stationName: string;
  printerName: string | null;
  roundId: number;
  tableCode: string;
  areaName: string;
  time: string;
  staffName: string;
  note: string | null;
  lines: { name: string; qty: number; note: string | null }[];
  /** network: máy chủ đã gửi tới máy in mạng của trạm; browser: App quầy tự in ra máy in mặc định */
  delivery: 'network' | 'browser';
  printed: boolean | null;
  error: string | null;
}

export interface PrintedBill {
  kind: 'PROVISIONAL' | 'FINAL';
  title: string;
  billCode: string;
  tableCode: string;
  areaName: string;
  openedAt: string;
  printedAt: string;
  printNo: number;
  guestCount: number | null;
  rows: { name: string; qty: number; unitPrice: number; amount: number }[];
  adjustments: { label: string; amount: number }[];
  total: number;
  payments?: { method: 'CASH' | 'TRANSFER'; amount: number; tendered: number | null }[];
  change?: number;
}

export interface Keg {
  id: number;
  beerName: string;
  capacityMl: number;
  status: 'IN_STOCK' | 'TAPPED' | 'EMPTY';
  receivedAt: string;
  tappedAt: string | null;
  soldMl: number;
}

export interface Tap {
  id: number;
  name: string;
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
}

export interface Shift {
  id: number;
  openedAt: string;
  openingCash: number;
  closedAt: string | null;
  openedBy: Person;
}

/** Kiểu dữ liệu khớp với response của API (SRS mục 7, docs/api.md). */

export type Role = 'COUNTER' | 'SHIFT_MANAGER' | 'OWNER';
export type Reason = 'CUSTOMER_CHANGED_MIND' | 'OUT_OF_STOCK' | 'WRONG_ENTRY' | 'DEFECTIVE' | 'OTHER';
export type StaffBrief = { id: number; fullName: string };

export type User = { id: number; fullName: string; email: string; role: Role };
export type LoginResponse = { token: string; user: User };

export type ApiErrorBody = { error: { code: string; message: string; details?: unknown } };

// Khu & bàn
export type DiningTable = { id: number; code: string; sortOrder: number; areaId: number };
export type Area = { id: number; name: string; sortOrder: number; tables?: DiningTable[] };

export type TableStatus = 'EMPTY' | 'OCCUPIED' | 'PROVISIONAL_PRINTED';
export type TableSummaryRow = {
  tableId: number;
  code: string;
  areaId: number;
  status: TableStatus;
  tabId?: number;
  total?: number;
  guestCount?: number | null;
  openedAt?: string;
};
export type TabsSummary = { occupied: number; totalTables: number; openAmount: number; tables: TableSummaryRow[] };

// Thực đơn
export type MenuEntry = {
  id: number;
  name: string;
  shortcut: string;
  unit: string;
  price: number;
  regularPrice: number;
  isHappyHour: boolean;
  available: boolean;
  stationId: number;
  stationName: string;
  beerVolumeMl: number | null;
};
export type MenuGroupWithItems = { id: number; name: string; items: MenuEntry[] };

export type MenuGroup = { id: number; name: string; sortOrder: number; itemCount: number };
export type KitchenStation = { id: number; name: string; sortOrder: number };
export type MenuItem = {
  id: number;
  name: string;
  shortcut: string;
  groupId: number;
  price: number;
  unit: string;
  stationId: number;
  beerVolumeMl: number | null;
  defaultTapId: number | null;
  available: boolean;
  active: boolean;
  sortOrder: number;
  group: { id: number; name: string };
  station: { id: number; name: string };
  defaultTap: { id: number; name: string } | null;
};

// Phiên bàn
export type LineType = 'NORMAL' | 'VOID' | 'DISCOUNT';
export type TabLine = {
  id: number;
  menuItemId: number;
  name: string;
  unit: string;
  stationId: number;
  stationName: string;
  qty: number;
  unitPrice: number;
  amount: number;
  note: string | null;
  lineType: LineType;
  refLineId: number | null;
  reason: Reason | null;
  requestedBy: StaffBrief | null;
  approvedBy: StaffBrief | null;
  createdAt: string;
  remainingQty?: number;
  discountAmount?: number;
  netAmount?: number;
};
export type TabRound = { id: number; createdAt: string; createdBy: StaffBrief; lines: TabLine[] };
export type TabDetail = {
  id: number;
  billNo: string;
  status: 'OPEN' | 'PAID' | 'MERGED';
  table: { id: number; code: string; areaId: number; areaName: string };
  guestCount: number | null;
  openedAt: string;
  openedBy: StaffBrief;
  closedAt: string | null;
  mergedIntoId: number | null;
  provisionalCount: number;
  subtotal: number;
  billDiscount: number;
  total: number;
  rounds: TabRound[];
};

export type Ticket = { stationId: number; stationName: string; tableCode: string; lines: { name: string; qty: number; note: string | null }[] };
export type SendRoundResponse = { round: { id: number; tabId: number; createdAt: string; createdBy: StaffBrief }; tickets: Ticket[]; tabTotal: number };

export type BillLine = { name: string; qty: number; unitPrice: number; amount: number; discount: number };
export type Bill = {
  tabId: number;
  billNo: string;
  tableCode: string;
  areaName: string;
  guestCount: number | null;
  openedAt: string;
  lines: BillLine[];
  subtotal: number;
  discount: number;
  total: number;
};
export type ProvisionalBill = Bill & { kind: 'PROVISIONAL'; printNo: number; printedAt: string; printedBy: string };
export type PaidBill = Bill & {
  kind: 'FINAL';
  paid: number;
  change: number;
  payments: { method: PaymentMethod; amount: number }[];
  paidAt: string;
  cashier: string;
};

export type PaymentMethod = 'CASH' | 'TRANSFER';
export type VietQr = { url: string; amount: number; addInfo: string; billNo: string; bank: string; account: string; accountName: string };

// Ca
export type Shift = {
  id: number;
  staff: StaffBrief;
  openedAt: string;
  openingCash: number;
  closedAt: string | null;
  closedBy: StaffBrief | null;
  countedCash: number | null;
  cashSales: number;
  transferSales: number;
  expectedCash: number;
  difference: number | null;
  status: 'OPEN' | 'CLOSED';
};

// Vòi & keg
export type KegStatus = 'IN_STOCK' | 'TAPPED' | 'EMPTY';
export type TapInfo = {
  id: number;
  name: string;
  currentKeg: { id: number; code: string; beerName: string; capacityMl: number; tappedAt: string; soldMl: number; percent: number } | null;
};
export type StockKeg = { id: number; code: string; beerName: string; capacityMl: number; receivedAt: string };
export type TapsResponse = { taps: TapInfo[]; inStockKegs: StockKeg[] };
export type Keg = {
  id: number;
  code: string;
  beerName: string;
  capacityMl: number;
  cost: number;
  receivedAt: string;
  status: KegStatus;
  tap: { id: number; name: string } | null;
  tappedAt: string | null;
  emptiedAt: string | null;
  soldMl: number | null;
};
export type KegsResponse = { summary: { inStock: number; tapped: number; empty: number }; items: Keg[] };

// Nhân viên
export type Staff = { id: number; fullName: string; email: string; role: Role; active: boolean; createdAt: string; hasPin: boolean };

// Giờ vàng
export type HappyHour = {
  id: number;
  name: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  enabled: boolean;
  activeNow: boolean;
  prices: { menuItemId: number; name: string; regularPrice: number; price: number }[];
};

// Báo cáo
type Metric = { value: number; yesterday: number; changePercent: number | null };
export type TodayReport = {
  generatedAt: string;
  revenue: Metric;
  openAmount: Metric;
  occupiedTables: Metric & { total: number };
  bills: Metric;
  hourly: { hour: number; today: number; yesterday: number }[];
  paymentSplit: { cash: number; transfer: number };
};
export type KegLossRow = {
  kegId: number;
  code: string;
  beerName: string;
  tapName: string | null;
  capacityMl: number;
  soldMl: number;
  lossMl: number;
  lossPercent: number;
  lossAmount: number;
  tappedAt: string | null;
  emptiedAt: string | null;
  durationMinutes: number | null;
  overThreshold: boolean;
};
export type KegLossReport = { from: string; to: string; threshold: number; totalLossLiters: number; totalLossAmount: number; kegs: KegLossRow[] };
export type VoidLogItem = {
  id: string;
  type: 'VOID' | 'DISCOUNT' | 'BILL_DISCOUNT';
  createdAt: string;
  tabId: number;
  tableCode: string;
  itemName: string;
  qty: number | null;
  amount: number;
  reason: Reason | null;
  note: string | null;
  requestedBy: StaffBrief | null;
  approvedBy: StaffBrief | null;
};
export type VoidsReport = {
  from: string;
  to: string;
  count: number;
  totalAmount: number;
  voidAmount: number;
  discountAmount: number;
  items: VoidLogItem[];
  people: StaffBrief[];
};
export type TopItemsReport = { from: string; to: string; by: 'qty' | 'revenue'; items: { menuItemId: number; name: string; qty: number; revenue: number }[] };
export type HourlyReport = { from: string; to: string; days: number; hours: { hour: number; revenue: number; bills: number }[] };

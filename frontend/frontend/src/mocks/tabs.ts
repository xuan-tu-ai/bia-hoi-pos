import { cacheService } from '../lib/storage.ts';
import type { AdjustmentAction, AdjustmentReason, Area, CompletedBill, DiningTable, MenuItem, OrderLine, OrderRound, PaymentDetails, PosData, TableStatus } from '../types/index.ts';

const STORAGE_KEY = 'pos-demo-data';
let billSequence = 0;

function createBillNo() {
  billSequence += 1;
  return `HD-${Date.now()}-${billSequence}`;
}

const AREAS: Area[] = [
  { id: 'inside', name: 'Trong nhà', firstTable: 1, count: 30 },
  { id: 'yard', name: 'Sân vườn', firstTable: 31, count: 30 },
  { id: 'upstairs', name: 'Tầng 2', firstTable: 61, count: 20 }
];

export const MENU: MenuItem[] = [
  { id: 'beer-glass', shortcut: 'b', name: 'Bia hơi cốc', category: 'Bia', price: 15000, station: 'Đồ uống' },
  { id: 'beer-pitcher', shortcut: 'bc', name: 'Bia hơi ca', category: 'Bia', price: 42000, station: 'Đồ uống' },
  { id: 'beer-tower', shortcut: 'tb', name: 'Tháp bia 3L', category: 'Bia', price: 180000, station: 'Đồ uống' },
  { id: 'grilled-squid', shortcut: 'mn', name: 'Mực nướng', category: 'Đồ nướng', price: 135000, station: 'Bếp nướng' },
  { id: 'grilled-sausage', shortcut: 'dn', name: 'Dồi sụn nướng', category: 'Đồ nướng', price: 85000, station: 'Bếp nướng' },
  { id: 'fried-tofu', shortcut: 'dp', name: 'Đậu phụ chiên', category: 'Đồ chiên', price: 45000, station: 'Bếp chiên' },
  { id: 'fried-corn', shortcut: 'nc', name: 'Ngô chiên bơ', category: 'Đồ chiên', price: 55000, station: 'Bếp chiên' },
  { id: 'peanuts', shortcut: 'lr', name: 'Lạc rang', category: 'Đồ nhắm', price: 25000, station: 'Bếp lạnh' }
];

const createInitialData = (): PosData => {
  const tables = AREAS.flatMap((area) => Array.from({ length: area.count }, (_, index) => {
    const number = area.firstTable + index;
    const isOccupied = number <= 25;
    const status: TableStatus = !isOccupied ? 'empty' : number > 20 ? 'provisional' : 'occupied';
    const openedAt = isOccupied ? new Date(Date.now() - (number % 90 + 15) * 60000).toISOString() : null;
    const rounds = openedAt ? createMockRounds(number, openedAt) : [];
    return {
      id: number,
      billNo: isOccupied ? createBillNo() : undefined,
      areaId: area.id,
      status,
      guestCount: isOccupied ? (number % 5) + 2 : 0,
      openedAt,
      total: getRoundsTotal(rounds),
      rounds
    };
  }));
  return { areas: AREAS, tables, completedBills: [] };
};

function createMockRounds(tableId: number, openedAt: string): OrderRound[] {
  const openedTime = new Date(openedAt).getTime();
  const roundCount = 1 + (tableId % 3);

  return Array.from({ length: roundCount }, (_, roundIndex) => {
    const firstItem = MENU[(tableId + roundIndex) % MENU.length];
    const secondItem = MENU[(tableId + roundIndex + 3) % MENU.length];
    const elapsed = Date.now() - openedTime;
    const lines: OrderLine[] = [
      { ...firstItem, id: `mock-${tableId}-${roundIndex + 1}-1`, quantity: 1 + ((tableId + roundIndex) % 3) },
      { ...secondItem, id: `mock-${tableId}-${roundIndex + 1}-2`, quantity: 1 + ((tableId + roundIndex + 1) % 2) }
    ];

    return {
      id: `mock-${tableId}-${roundIndex + 1}`,
      sentAt: new Date(openedTime + elapsed * (roundIndex + 1) / (roundCount + 1)).toISOString(),
      staffName: ['Lan', 'Minh', 'Hùng'][(tableId + roundIndex) % 3],
      lines
    };
  });
}

function getRoundsTotal(rounds: OrderRound[]) {
  return rounds.reduce((total, round) => total + round.lines.reduce(
    (roundTotal, line) => roundTotal + line.price * line.quantity,
    0
  ), 0);
}

const save = (data: PosData): PosData => {
  cacheService.set(STORAGE_KEY, data);
  return data;
};

export const posService = {
  getData() {
    const data = cacheService.get<PosData>(STORAGE_KEY);
    if (!data) return save(createInitialData());
    let updated = false;
    data.tables.forEach((table) => {
      if (table.status !== 'empty' && !table.billNo) {
        table.billNo = createBillNo();
        updated = true;
      }
      if (table.status !== 'empty' && !table.rounds?.length && table.total > 0) {
        const openedAt = table.openedAt ?? new Date(Date.now() - 30 * 60000).toISOString();
        table.openedAt = openedAt;
        table.rounds = createMockRounds(table.id, openedAt);
        table.total = getRoundsTotal(table.rounds);
        updated = true;
      }
    });
    if (!data.completedBills) {
      data.completedBills = [];
      updated = true;
    }
    return updated ? save(data) : data;
  },
  openTable(tableId: number, guestCount: number | null) {
    const data = this.getData();
    const table = data.tables.find((item) => item.id === tableId);
    if (!table) throw new Error('Không tìm thấy bàn.');
    if (table.status !== 'empty') throw new Error('Bàn đã được mở.');
    table.status = 'occupied';
    table.billNo = createBillNo();
    table.guestCount = guestCount;
    table.openedAt = new Date().toISOString();
    table.total = 0;
    table.rounds = [];
    return save(data);
  },
  addRound(tableId: number, lines: OrderLine[], staffName: string) {
    const data = this.getData();
    const table = data.tables.find((item) => item.id === tableId);
    if (!table || table.status === 'empty') throw new Error('Phiên bàn không còn mở.');
    if (!lines.length) throw new Error('Chưa có món trong lượt đang nhập.');
    const pricedLines = lines.map((line) => {
      const menuItem = MENU.find((item) => item.id === line.id);
      if (!menuItem) throw new Error('Không tìm thấy món trong thực đơn.');
      return { ...line, name: menuItem.name, category: menuItem.category, station: menuItem.station, price: menuItem.price };
    });
    const round: OrderRound = {
      id: `${Date.now()}`,
      sentAt: new Date().toISOString(),
      staffName,
      lines: pricedLines
    };
    table.rounds.push(round);
    table.total += round.lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    return save(data);
  },
  markProvisional(tableId: number) {
    const data = this.getData();
    const table = data.tables.find((item) => item.id === tableId);
    if (!table || table.status === 'empty') throw new Error('Phiên bàn không còn mở.');
    table.status = 'provisional';
    table.provisionalCount = (table.provisionalCount || 0) + 1;
    return save(data);
  },
  moveTable(sourceId: number, targetId: number, merge = false) {
    const data = this.getData();
    const source = data.tables.find((item) => item.id === sourceId);
    const target = data.tables.find((item) => item.id === targetId);
    if (!source || !target || source.status === 'empty') throw new Error('Không tìm thấy phiên bàn cần chuyển.');
    if (sourceId === targetId) throw new Error('Vui lòng chọn bàn khác.');
    if (merge && target.status === 'empty') throw new Error('Bàn đích đang trống, hãy dùng Chuyển bàn.');
    if (!merge && target.status !== 'empty') throw new Error('Bàn đích đang có khách, hãy dùng Gộp bàn.');
    if (merge) {
      target.rounds = [...target.rounds, ...source.rounds];
      target.total += source.total;
      target.guestCount = (target.guestCount || 0) + (source.guestCount || 0);
    } else {
      Object.assign(target, { ...source, id: target.id, areaId: target.areaId });
    }
    Object.assign(source, { status: 'empty', billNo: undefined, guestCount: 0, openedAt: null, total: 0, rounds: [], provisionalCount: 0 });
    return save(data);
  },
  adjustOrderLine(tableId: number, roundId: string, lineId: string, action: AdjustmentAction, quantity: number, discountAmount = 0, reason: AdjustmentReason = 'Khách đổi ý', note = '') {
    const data = this.getData();
    const table = data.tables.find((item) => item.id === tableId);
    const round = table?.rounds.find((item) => item.id === roundId);
    const line = round?.lines.find((item) => item.id === lineId && !item.adjustment);
    if (!table || !round || !line) throw new Error('Không tìm thấy món đã gửi.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > line.quantity) throw new Error('Số lượng điều chỉnh không hợp lệ.');
    if (action === 'void') {
      line.quantity -= quantity;
      table.total = Math.max(0, table.total - line.price * quantity);
      round.lines.push({ id: `void-${Date.now()}`, name: `Hủy: ${line.name}`, quantity: -quantity, price: line.price, adjustment: true, reason, note });
    } else {
      const amount = Math.min(Math.max(0, discountAmount), line.price * quantity);
      if (!amount) throw new Error('Số tiền giảm phải lớn hơn 0.');
      table.total = Math.max(0, table.total - amount);
      round.lines.push({ id: `discount-${Date.now()}`, name: `Giảm: ${line.name}`, quantity: -1, price: amount, adjustment: true, reason, note });
    }
    return save(data);
  },
  closeTable(tableId: number, payment: Partial<PaymentDetails> = {}) {
    const data = this.getData();
    const table = data.tables.find((item) => item.id === tableId);
    if (!table || table.status === 'empty') throw new Error('Phiên bàn không còn mở.');
    const paidAt = new Date().toISOString();
    const bill: CompletedBill = {
      billNo: table.billNo ?? createBillNo(),
      tableId,
      paidAt,
      subtotal: payment.subtotal ?? table.total,
      discount: payment.discount ?? 0,
      total: payment.total ?? table.total,
      change: payment.change ?? 0,
      payments: payment.payments ?? [],
      lines: table.rounds.flatMap((round) => round.lines.map((line) => ({ ...line })))
    };
    data.completedBills.unshift(bill);
    Object.assign(table, { status: 'empty', billNo: undefined, guestCount: 0, openedAt: null, total: 0, rounds: [], provisionalCount: 0 });
    return save(data);
  }
};

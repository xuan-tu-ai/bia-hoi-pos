/**
 * Dữ liệu mẫu theo SRS 8.3 — chạy: npx prisma db seed
 * Chạy lại bao nhiêu lần cũng được: xóa sạch dữ liệu cũ rồi tạo lại.
 * Ngẫu nhiên có "hạt giống" cố định nên lần nào chạy cũng ra cùng dữ liệu (chỉ khác ngày).
 */
import bcrypt from 'bcryptjs';
import { PrismaClient, type MenuItem } from '@prisma/client';
import { happyPriceMap, type HappyHourLike } from '../src/lib/pricing.js';
import { addDays, startOfVnDay, vnYmd } from '../src/lib/time.js';

const prisma = new PrismaClient();

// tiện ích

let seed = 20261024;
function rand() {
  // mulberry32
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const minutes = (n: number) => n * 60_000;
const HOUR = minutes(60);

// danh mục

const STAFF = [
  { email: 'lan@biahoi.vn', fullName: 'Nguyễn Thị Lan', role: 'COUNTER', pin: null, active: true },
  { email: 'minh@biahoi.vn', fullName: 'Trần Văn Minh', role: 'COUNTER', pin: null, active: true },
  { email: 'hung@biahoi.vn', fullName: 'Lê Văn Hùng', role: 'SHIFT_MANAGER', pin: '1234', active: true },
  { email: 'hoa@biahoi.vn', fullName: 'Phạm Thị Hoa', role: 'OWNER', pin: '9999', active: true },
  { email: 'khoa@biahoi.vn', fullName: 'Đỗ Minh Khoa', role: 'COUNTER', pin: null, active: false },
] as const;

const AREAS = [
  { name: 'Trong nhà', from: 1, to: 30 },
  { name: 'Sân', from: 31, to: 60 },
  { name: 'Tầng 2', from: 61, to: 80 },
];

const STATIONS = ['Quầy rót bia', 'Bếp nướng', 'Bếp chiên'] as const;
type Station = (typeof STATIONS)[number];

type ItemDef = {
  name: string;
  shortcut: string;
  price: number;
  unit: string;
  station: Station;
  beerMl?: number;
  tap?: 1 | 2;
  available?: boolean;
};

const GROUPS: { name: string; items: ItemDef[] }[] = [
  {
    name: 'Bia',
    items: [
      { name: 'Bia hơi cốc 0,5L', shortcut: 'b', price: 15000, unit: 'cốc', station: 'Quầy rót bia', beerMl: 500, tap: 1 },
      { name: 'Ca bia 1,5L', shortcut: 'ca', price: 42000, unit: 'ca', station: 'Quầy rót bia', beerMl: 1500, tap: 1 },
      { name: 'Tháp bia 3L', shortcut: 'thap', price: 80000, unit: 'tháp', station: 'Quầy rót bia', beerMl: 3000, tap: 2 },
      { name: 'Bia chai Hà Nội', shortcut: 'bhn', price: 20000, unit: 'chai', station: 'Quầy rót bia' },
      { name: 'Bia Tiger bạc', shortcut: 'tiger', price: 25000, unit: 'lon', station: 'Quầy rót bia' },
      { name: 'Nước ngọt', shortcut: 'nn', price: 15000, unit: 'lon', station: 'Quầy rót bia' },
      { name: 'Nước suối', shortcut: 'ns', price: 10000, unit: 'chai', station: 'Quầy rót bia' },
      { name: 'Trà đá', shortcut: 'tra', price: 5000, unit: 'cốc', station: 'Quầy rót bia' },
    ],
  },
  {
    name: 'Đồ nướng',
    items: [
      { name: 'Ngô nướng', shortcut: 'ngo', price: 25000, unit: 'bắp', station: 'Bếp nướng' },
      { name: 'Chân gà nướng', shortcut: 'cg', price: 69000, unit: 'đĩa', station: 'Bếp nướng' },
      { name: 'Cánh gà nướng', shortcut: 'canh', price: 79000, unit: 'đĩa', station: 'Bếp nướng' },
      { name: 'Mực nướng', shortcut: 'muc', price: 129000, unit: 'con', station: 'Bếp nướng' },
      { name: 'Ba chỉ nướng', shortcut: 'bachi', price: 89000, unit: 'đĩa', station: 'Bếp nướng' },
      { name: 'Nem chua nướng', shortcut: 'nem', price: 45000, unit: 'đĩa', station: 'Bếp nướng' },
      { name: 'Sườn nướng', shortcut: 'suon', price: 99000, unit: 'đĩa', station: 'Bếp nướng' },
      { name: 'Đậu bắp nướng', shortcut: 'daubap', price: 35000, unit: 'đĩa', station: 'Bếp nướng', available: false },
    ],
  },
  {
    name: 'Đồ chiên',
    items: [
      { name: 'Khoai tây chiên', shortcut: 'khoai', price: 39000, unit: 'đĩa', station: 'Bếp chiên' },
      { name: 'Đậu rán', shortcut: 'dau', price: 35000, unit: 'đĩa', station: 'Bếp chiên' },
      { name: 'Nem rán', shortcut: 'nemran', price: 59000, unit: 'đĩa', station: 'Bếp chiên' },
      { name: 'Cá chiên giòn', shortcut: 'cachien', price: 89000, unit: 'đĩa', station: 'Bếp chiên' },
      { name: 'Ngô chiên bơ', shortcut: 'ngochien', price: 45000, unit: 'đĩa', station: 'Bếp chiên' },
      { name: 'Chả cá chiên', shortcut: 'chaca', price: 79000, unit: 'đĩa', station: 'Bếp chiên', available: false },
      { name: 'Mực rim me', shortcut: 'mucrim', price: 69000, unit: 'đĩa', station: 'Bếp chiên' },
    ],
  },
  {
    name: 'Đồ nhắm',
    items: [
      { name: 'Lạc rang', shortcut: 'lac', price: 15000, unit: 'đĩa', station: 'Quầy rót bia' },
      { name: 'Khăn lạnh', shortcut: 'khan', price: 2000, unit: 'cái', station: 'Quầy rót bia' },
      { name: 'Dưa chuột', shortcut: 'dua', price: 20000, unit: 'đĩa', station: 'Quầy rót bia' },
      { name: 'Bò khô', shortcut: 'bokho', price: 59000, unit: 'đĩa', station: 'Quầy rót bia' },
      { name: 'Nộm sứa', shortcut: 'nom', price: 59000, unit: 'đĩa', station: 'Bếp chiên' },
      { name: 'Đậu phộng da cá', shortcut: 'dauphong', price: 20000, unit: 'đĩa', station: 'Quầy rót bia' },
    ],
  },
];

// dữ liệu nháp

type DraftLine = { item: MenuItem; qty: number; unitPrice: number; note: string | null; tapId: number | null; kegId: number | null; createdAt: Date };
type DraftRound = { createdAt: Date; createdById: number; lines: DraftLine[] };
type DraftBill = {
  tableId: number;
  openedAt: Date;
  closedAt: Date | null;
  openedById: number;
  guestCount: number;
  rounds: DraftRound[];
  provisional?: number;
};

async function clean() {
  await prisma.auditLog.deleteMany();
  await prisma.billPrint.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderLine.updateMany({ data: { refLineId: null } });
  await prisma.orderLine.deleteMany();
  await prisma.orderRound.deleteMany();
  await prisma.tab.updateMany({ data: { mergedIntoId: null } });
  await prisma.tab.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.happyHourPrice.deleteMany();
  await prisma.happyHour.deleteMany();
  await prisma.tap.updateMany({ data: { currentKegId: null } });
  await prisma.keg.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.tap.deleteMany();
  await prisma.menuGroup.deleteMany();
  await prisma.kitchenStation.deleteMany();
  await prisma.diningTable.deleteMany();
  await prisma.area.deleteMany();
  await prisma.staff.deleteMany();
}

async function main() {
  await clean();
  const now = new Date();
  const today = startOfVnDay(now);

  // --- nhân viên ---
  const passwordHash = await bcrypt.hash('123456', 10);
  const staff: Record<string, number> = {};
  for (const s of STAFF) {
    const row = await prisma.staff.create({
      data: {
        email: s.email,
        fullName: s.fullName,
        role: s.role,
        active: s.active,
        passwordHash,
        pinHash: s.pin ? await bcrypt.hash(s.pin, 10) : null,
      },
    });
    staff[s.email.split('@')[0]] = row.id;
  }
  const cashiers = [staff.lan, staff.minh, staff.hung];

  // --- khu & bàn ---
  const tableIds: number[] = [];
  for (const [i, a] of AREAS.entries()) {
    const area = await prisma.area.create({ data: { name: a.name, sortOrder: i + 1 } });
    for (let n = a.from; n <= a.to; n++) {
      const t = await prisma.diningTable.create({ data: { areaId: area.id, code: String(n), sortOrder: n } });
      tableIds.push(t.id);
    }
  }

  // --- khu chế biến, vòi, nhóm, món ---
  const stationId: Record<string, number> = {};
  for (const [i, name] of STATIONS.entries()) {
    stationId[name] = (await prisma.kitchenStation.create({ data: { name, sortOrder: i + 1 } })).id;
  }
  const tap1 = await prisma.tap.create({ data: { name: 'Vòi 1', sortOrder: 1 } });
  const tap2 = await prisma.tap.create({ data: { name: 'Vòi 2', sortOrder: 2 } });
  const tapId = { 1: tap1.id, 2: tap2.id };

  const items: Record<string, MenuItem> = {};
  for (const [gi, g] of GROUPS.entries()) {
    const group = await prisma.menuGroup.create({ data: { name: g.name, sortOrder: gi + 1 } });
    for (const [ii, d] of g.items.entries()) {
      items[d.shortcut] = await prisma.menuItem.create({
        data: {
          groupId: group.id,
          name: d.name,
          shortcut: d.shortcut,
          price: d.price,
          unit: d.unit,
          stationId: stationId[d.station],
          beerVolumeMl: d.beerMl ?? null,
          defaultTapId: d.tap ? tapId[d.tap] : null,
          available: d.available ?? true,
          sortOrder: ii + 1,
        },
      });
    }
  }

  // --- giờ vàng: Bia hơi cốc 12.000 ₫, Ca bia 36.000 ₫, 16:00–18:00 thứ 2 → thứ 6 ---
  const happy = await prisma.happyHour.create({
    data: {
      name: 'Giờ vàng chiều',
      weekdays: [1, 2, 3, 4, 5],
      startTime: '16:00',
      endTime: '18:00',
      prices: { create: [{ menuItemId: items.b.id, price: 12000 }, { menuItemId: items.ca.id, price: 36000 }] },
    },
    include: { prices: true },
  });
  const happyHours: HappyHourLike[] = [{ ...happy }];
  const priceAt = (item: MenuItem, at: Date) => happyPriceMap(happyHours, at).get(item.id) ?? item.price;

  // --- keg ---
  // Lịch thay keg 7 ngày qua (ngày tính từ hôm nay lùi lại).
  type KegPlan = { tap: 1 | 2; capacityMl: number; cost: number; fromDay: number; toDay: number; soldMl: number; cupsOnly?: boolean };
  const plans: KegPlan[] = [
    { tap: 1, capacityMl: 50000, cost: 1500000, fromDay: 7, toDay: 5, soldMl: 48500 }, // hao hụt 3%
    { tap: 2, capacityMl: 50000, cost: 1500000, fromDay: 7, toDay: 4, soldMl: 48000 }, // 4%
    { tap: 1, capacityMl: 50000, cost: 1500000, fromDay: 4, toDay: 2, soldMl: 46000, cupsOnly: true }, // 92 cốc 0,5 L → 8%
    { tap: 2, capacityMl: 30000, cost: 900000, fromDay: 3, toDay: 1, soldMl: 27000 }, // 10%
    { tap: 1, capacityMl: 50000, cost: 1500000, fromDay: 1, toDay: 1, soldMl: 49000 }, // 2%
  ];
  let kegNo = 1;
  const kegCode = () => `KEG-${String(kegNo++).padStart(4, '0')}`;

  // keg trước đó được nhập trước ngày dùng
  const emptyKegs = [];
  for (const p of plans) {
    const tappedAt = new Date(addDays(today, -p.fromDay).getTime() + 9 * HOUR);
    const emptiedAt = new Date(addDays(today, -p.toDay).getTime() + 23 * HOUR + minutes(59));
    const k = await prisma.keg.create({
      data: {
        code: kegCode(),
        beerName: 'Bia hơi Hà Nội',
        capacityMl: p.capacityMl,
        cost: p.cost,
        receivedAt: addDays(today, -p.fromDay - 1),
        status: 'EMPTY',
        tapId: tapId[p.tap],
        tappedAt,
        emptiedAt,
        soldMl: p.soldMl,
      },
    });
    emptyKegs.push({ plan: p, keg: k });
  }

  // keg đang gắn hôm nay
  const tappedToday = new Date(Math.min(today.getTime() + 9 * HOUR, now.getTime() - 4 * HOUR));
  const current: Record<1 | 2, number> = { 1: 0, 2: 0 };
  for (const t of [1, 2] as const) {
    const k = await prisma.keg.create({
      data: {
        code: kegCode(),
        beerName: 'Bia hơi Hà Nội',
        capacityMl: 50000,
        cost: 1500000,
        receivedAt: addDays(today, -1),
        status: 'TAPPED',
        tapId: tapId[t],
        tappedAt: tappedToday,
      },
    });
    current[t] = k.id;
    await prisma.tap.update({ where: { id: tapId[t] }, data: { currentKegId: k.id } });
  }
  // 4 keg trong kho
  for (let i = 0; i < 4; i++) {
    await prisma.keg.create({
      data: { code: kegCode(), beerName: 'Bia hơi Hà Nội', capacityMl: 50000, cost: 1500000, receivedAt: addDays(today, -1) },
    });
  }

  // --- hóa đơn ---
  const foodItems = Object.values(items).filter((i) => !i.beerVolumeMl && i.available);

  function draftBill(openedAt: Date, closedAt: Date | null, tableId: number): DraftBill {
    const cashier = pick(cashiers);
    const end = closedAt ?? now;
    const roundCount = int(1, 3);
    const rounds: DraftRound[] = [];
    for (let r = 0; r < roundCount; r++) {
      const span = Math.max(1, end.getTime() - openedAt.getTime() - minutes(5));
      const createdAt = new Date(openedAt.getTime() + minutes(1) + Math.floor((span * r) / roundCount));
      const lines: DraftLine[] = [];
      const used = new Set<number>();
      for (let n = int(1, 3); n > 0; n--) {
        const item = pick(foodItems);
        if (used.has(item.id)) continue;
        used.add(item.id);
        lines.push({ item, qty: item.shortcut === 'khan' ? int(2, 6) : int(1, 2), unitPrice: priceAt(item, createdAt), note: null, tapId: null, kegId: null, createdAt });
      }
      rounds.push({ createdAt, createdById: cashier, lines });
    }
    return { tableId, openedAt, closedAt, openedById: cashier, guestCount: int(2, 10), rounds };
  }

  function addBeer(bill: DraftBill, item: MenuItem, qty: number, kegId: number) {
    const round = pick(bill.rounds);
    round.lines.push({
      item,
      qty,
      unitPrice: priceAt(item, round.createdAt),
      note: null,
      tapId: item.defaultTapId,
      kegId,
      createdAt: round.createdAt,
    });
  }

  // Lịch sử 7 ngày (đã thanh toán)
  const paidBills: DraftBill[] = [];
  const billsByDay = new Map<number, DraftBill[]>();
  for (let d = 7; d >= 1; d--) {
    const dayStart = addDays(today, -d);
    const list: DraftBill[] = [];
    for (let n = int(22, 30); n > 0; n--) {
      const openedAt = new Date(dayStart.getTime() + int(10, 21) * HOUR + minutes(int(0, 59)));
      const closedAt = new Date(openedAt.getTime() + minutes(int(40, 120)));
      list.push(draftBill(openedAt, closedAt, pick(tableIds)));
    }
    billsByDay.set(d, list);
    paidBills.push(...list);
  }

  // Rót bia đúng bằng số ml đã bán của từng keg
  for (const { plan, keg } of emptyKegs) {
    const pool: DraftBill[] = [];
    for (let d = plan.fromDay; d >= plan.toDay; d--) pool.push(...(billsByDay.get(d) ?? []));
    let remaining = plan.soldMl;
    while (remaining > 0) {
      const bill = pick(pool);
      if (plan.tap === 2) {
        const qty = Math.min(int(1, 2), remaining / 3000);
        addBeer(bill, items.thap, qty, keg.id);
        remaining -= qty * 3000;
      } else if (!plan.cupsOnly && remaining >= 1500 && rand() < 0.3) {
        const qty = Math.min(int(1, 2), Math.floor(remaining / 1500));
        addBeer(bill, items.ca, qty, keg.id);
        remaining -= qty * 1500;
      } else {
        const qty = Math.min(int(2, 8), remaining / 500);
        addBeer(bill, items.b, qty, keg.id);
        remaining -= qty * 500;
      }
    }
  }

  // Hôm nay: vài hóa đơn đã thanh toán + khoảng 20 bàn đang có khách
  const openStart = Math.max(tappedToday.getTime() + minutes(10), today.getTime() + 10 * HOUR);
  const latestClose = now.getTime() - minutes(15);
  const todayPaid: DraftBill[] = [];
  for (let n = 12; n > 0 && latestClose - openStart > HOUR; n--) {
    const openedAt = new Date(openStart + Math.floor(rand() * (latestClose - openStart - HOUR)));
    const closedAt = new Date(Math.min(openedAt.getTime() + minutes(int(40, 100)), latestClose));
    todayPaid.push(draftBill(openedAt, closedAt, pick(tableIds)));
  }

  const openTables = [...tableIds].sort(() => rand() - 0.5).slice(0, 20);
  const openBills: DraftBill[] = openTables.map((tableId, i) => {
    const openedAt = new Date(Math.max(now.getTime() - minutes(int(10, 180)), tappedToday.getTime() + minutes(5)));
    const b = draftBill(openedAt, null, tableId);
    if (i < 3) b.provisional = 1; // vài bàn đã in tạm tính (màu vàng)
    return b;
  });

  // Keg đang gắn hôm nay mới bán được một phần (không vượt dung tích 50 L)
  const budget: Record<1 | 2, number> = { 1: 31000, 2: 21000 };
  for (const b of [...todayPaid, ...openBills]) {
    for (let n = int(1, 3); n > 0; n--) {
      if (rand() < 0.75) {
        const qty = int(2, 6);
        if (budget[1] < qty * 500) continue;
        addBeer(b, items.b, qty, current[1]);
        budget[1] -= qty * 500;
      } else if (budget[2] >= 3000) {
        addBeer(b, items.thap, 1, current[2]);
        budget[2] -= 3000;
      }
    }
  }

  // --- ghi xuống CSDL ---
  const reasons = ['CUSTOMER_CHANGED_MIND', 'OUT_OF_STOCK', 'WRONG_ENTRY', 'DEFECTIVE'] as const;

  async function writeBill(b: DraftBill, paid: boolean) {
    const tab = await prisma.tab.create({
      data: {
        tableId: b.tableId,
        guestCount: b.guestCount,
        openedAt: b.openedAt,
        openedById: b.openedById,
        status: 'OPEN',
        rounds: {
          create: b.rounds
            .filter((r) => r.lines.length)
            .map((r) => ({
              createdAt: r.createdAt,
              createdById: r.createdById,
              lines: {
                create: r.lines.map((l) => ({
                  menuItemId: l.item.id,
                  qty: l.qty,
                  unitPrice: l.unitPrice,
                  note: l.note,
                  tapId: l.tapId,
                  kegId: l.kegId,
                  createdAt: l.createdAt,
                })),
              },
            })),
        },
      },
      include: { rounds: { include: { lines: true } } },
    });

    const lines = tab.rounds.flatMap((r) => r.lines);
    const food = lines.filter((l) => l.kegId == null);

    // ~1/8 hóa đơn có hủy món, ~1/12 có giảm giá món (chỉ đồ ăn để không lệch số liệu keg)
    if (food.length && rand() < 0.125) {
      const l = pick(food);
      await prisma.orderLine.create({
        data: {
          roundId: l.roundId, menuItemId: l.menuItemId, qty: -1, unitPrice: l.unitPrice, lineType: 'VOID', refLineId: l.id,
          reason: pick([...reasons]), requestedById: b.openedById, approvedById: staff.hung,
          createdAt: new Date(l.createdAt.getTime() + minutes(int(3, 15))),
        },
      });
    } else if (food.length && rand() < 0.09) {
      const l = pick(food);
      const amount = Math.round((l.qty * l.unitPrice * 0.2) / 1000) * 1000 || 1000;
      await prisma.orderLine.create({
        data: {
          roundId: l.roundId, menuItemId: l.menuItemId, qty: 1, unitPrice: -amount, lineType: 'DISCOUNT', refLineId: l.id,
          reason: 'DEFECTIVE', note: 'Món ra chậm', requestedById: b.openedById, approvedById: staff.hung,
          createdAt: new Date(l.createdAt.getTime() + minutes(int(3, 15))),
        },
      });
    }

    if (b.provisional) {
      await prisma.billPrint.create({ data: { tabId: tab.id, kind: 'PROVISIONAL', printNo: 1, printedAt: new Date(now.getTime() - minutes(int(1, 8))) } });
    }
    if (!paid || !b.closedAt) return;

    const all = await prisma.orderLine.findMany({ where: { round: { tabId: tab.id } } });
    const subtotal = all.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    const billDiscount = rand() < 0.06 ? Math.round((subtotal * 0.1) / 1000) * 1000 : 0;
    const total = subtotal - billDiscount;
    const r = rand();
    const payments =
      r < 0.6
        ? [{ method: 'CASH' as const, amount: total }]
        : r < 0.9
          ? [{ method: 'TRANSFER' as const, amount: total }]
          : [
              { method: 'CASH' as const, amount: Math.round(total / 2000) * 1000 },
              { method: 'TRANSFER' as const, amount: total - Math.round(total / 2000) * 1000 },
            ];
    await prisma.payment.createMany({
      data: payments.filter((p) => p.amount > 0).map((p) => ({ tabId: tab.id, method: p.method, amount: p.amount, receivedById: b.openedById, createdAt: b.closedAt! })),
    });
    await prisma.billPrint.create({ data: { tabId: tab.id, kind: 'FINAL', printNo: 1, printedAt: b.closedAt } });
    await prisma.tab.update({
      where: { id: tab.id },
      data: {
        status: 'PAID',
        closedAt: b.closedAt,
        billNo: `HD-${vnYmd(b.openedAt)}-${String(tab.id).padStart(4, '0')}`,
        billDiscount,
        ...(billDiscount > 0
          ? { billDiscountReason: 'OTHER', billDiscountNote: 'Khách quen', billDiscountById: b.openedById, billDiscountApprovedById: staff.hoa }
          : {}),
      },
    });
  }

  const ordered = [...paidBills, ...todayPaid].sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
  for (const b of ordered) await writeBill(b, true);
  for (const b of openBills) await writeBill(b, false);

  // --- ca đã đóng 3 ngày gần nhất ---
  for (let d = 3; d >= 1; d--) {
    const openedAt = new Date(addDays(today, -d).getTime() + 9 * HOUR + minutes(30));
    const closedAt = new Date(addDays(today, -d).getTime() + 23 * HOUR + minutes(59));
    const sums = await prisma.payment.groupBy({ by: ['method'], where: { createdAt: { gte: openedAt, lt: closedAt } }, _sum: { amount: true } });
    const cashSales = sums.find((s) => s.method === 'CASH')?._sum.amount ?? 0;
    const transferSales = sums.find((s) => s.method === 'TRANSFER')?._sum.amount ?? 0;
    const openingCash = 2_000_000;
    await prisma.shift.create({
      data: {
        staffId: staff.hung, openedAt, openingCash, closedAt, closedById: staff.hung,
        cashSales, transferSales, countedCash: openingCash + cashSales + pick([0, 0, -20000, 10000]),
      },
    });
  }

  const [tabs, lines] = await Promise.all([prisma.tab.count(), prisma.orderLine.count()]);
  console.log(`Đã tạo: ${STAFF.length} nhân viên, ${tableIds.length} bàn, ${Object.keys(items).length} món, ${kegNo - 1} keg, ${tabs} phiên bàn (${openBills.length} đang mở), ${lines} dòng món.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

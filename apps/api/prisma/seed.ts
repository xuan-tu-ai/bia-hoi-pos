// Dữ liệu demo theo SRS mục 8: 3 khu / 80 bàn, 4 nhóm / 30 món (3 món bia hơi), 2 trạm in,
// 2 vòi, 6 keg 50 L, 5 nhân viên, 7 ngày bán hàng; keg #1 hao hụt đúng 8% (92 cốc 0,5 L).
// Chạy: pnpm --filter @biahoi/api db:seed  (XÓA toàn bộ dữ liệu cũ)

import { PrismaClient, type AdjustReason, type PaymentMethod } from '@prisma/client';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { DAY_MS, resolveUnitPrice, vnStartOfDay, type HappyHourRule } from '@biahoi/shared';
import { config } from '../src/config';
import { FILE_NAME, imageExt, saveImage } from '../src/lib/uploads';

const prisma = new PrismaClient();
const MINUTE = 60_000;

// Sinh số ngẫu nhiên có hạt giống để lần seed nào cũng ra cùng dữ liệu.
let seed = 20261019;
function rand(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;

async function reset() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE audit_log, bill_print, payment, bill_discount, order_line, order_round, tab,
      shift, happy_hour_price, happy_hour, menu_item, menu_group, print_station,
      dining_table, area, keg, tap, staff RESTART IDENTITY CASCADE`);
}

/** Ảnh minh họa của món mẫu (prisma/seed-images/<mã tắt>.jpg, nguồn ở CREDITS.md), chép vào thư mục uploads. */
async function seedImage(shortcut: string): Promise<string | null> {
  const file = path.resolve(import.meta.dirname, 'seed-images', `${shortcut}.jpg`);
  if (!existsSync(file)) return null;
  const buf = readFileSync(file);
  return saveImage('mon', 0, buf, imageExt(buf)!);
}

async function main() {
  await reset();
  // Thực đơn tạo lại từ đầu nên ảnh món cũ không còn ai dùng
  const uploads = path.resolve(config.uploadDir);
  if (existsSync(uploads)) for (const f of readdirSync(uploads)) if (FILE_NAME.test(f)) rmSync(path.join(uploads, f));
  const hash = (s: string) => bcrypt.hash(s, 10);

  // ---- Nhân viên: PIN để demo; chủ quán và quản lý ca có thêm tài khoản web ----
  await prisma.staff.create({
    data: { name: 'Nguyễn Văn Chủ', role: 'OWNER', pinHash: await hash('9999'), email: 'chuquan@biahoi.vn', passwordHash: await hash('chuquan123') },
  });
  const manager = await prisma.staff.create({
    data: { name: 'Trần Thị Quản Lý', role: 'SHIFT_MANAGER', pinHash: await hash('8888'), email: 'quanly@biahoi.vn', passwordHash: await hash('quanly123') },
  });
  const counter1 = await prisma.staff.create({ data: { name: 'Lê Văn Quầy', role: 'COUNTER', pinHash: await hash('1111') } });
  const counter2 = await prisma.staff.create({ data: { name: 'Phạm Thị Thu Ngân', role: 'COUNTER', pinHash: await hash('2222') } });
  await prisma.staff.create({ data: { name: 'Hoàng Văn Nghỉ', role: 'COUNTER', pinHash: await hash('3333'), active: false } });
  const counters = [counter1, counter2];

  // ---- Khu & bàn: 30 + 30 + 20 = 80 ----
  const areaDefs = [
    { name: 'Trong nhà', prefix: 'T', count: 30 },
    { name: 'Sân', prefix: 'S', count: 30 },
    { name: 'Tầng 2', prefix: 'L', count: 20 },
  ];
  const tableIds: number[] = [];
  for (const [i, a] of areaDefs.entries()) {
    const area = await prisma.area.create({ data: { name: a.name, sortOrder: i } });
    const created = await prisma.diningTable.createManyAndReturn({
      data: Array.from({ length: a.count }, (_, n) => ({ areaId: area.id, code: `${a.prefix}${String(n + 1).padStart(2, '0')}`, sortOrder: n })),
    });
    tableIds.push(...created.map((t) => t.id));
  }

  // ---- Trạm in, vòi ----
  const beerStation = await prisma.printStation.create({ data: { name: 'Quầy rót bia', printerName: 'XP-80C Quay Bia' } });
  const kitchen = await prisma.printStation.create({ data: { name: 'Bếp', printerName: 'XP-80C Bep' } });
  const tap1 = await prisma.tap.create({ data: { name: 'Vòi 1', sortOrder: 0 } });
  const tap2 = await prisma.tap.create({ data: { name: 'Vòi 2', sortOrder: 1 } });

  // ---- Thực đơn: 4 nhóm / 30 món ----
  type ItemDef = [name: string, shortcut: string, price: number, unit: string, extra?: { volume: number; tapId: number }];
  const menu: { group: string; station: number; items: ItemDef[] }[] = [
    {
      group: 'Bia & đồ uống',
      station: beerStation.id,
      items: [
        ['Bia hơi cốc 0,5L', 'b', 15000, 'cốc', { volume: 500, tapId: tap1.id }],
        ['Bia hơi ca 1,5L', 'c', 40000, 'ca', { volume: 1500, tapId: tap2.id }],
        ['Bia hơi tháp 3L', 't', 75000, 'tháp', { volume: 3000, tapId: tap2.id }],
        ['Bia Hà Nội chai', 'bhn', 20000, 'chai'],
        ['Bia Sài Gòn chai', 'bsg', 20000, 'chai'],
        ['Heineken lon', 'hnk', 30000, 'lon'],
        ['Nước ngọt', 'nn', 15000, 'lon'],
        ['Trà đá', 'td', 5000, 'cốc'],
      ],
    },
    {
      group: 'Đồ nướng',
      station: kitchen.id,
      items: [
        ['Chân gà nướng', 'cg', 60000, 'đĩa'],
        ['Nem chua nướng', 'ncn', 50000, 'đĩa'],
        ['Sườn nướng', 'sn', 90000, 'đĩa'],
        ['Ba chỉ nướng', 'bcn', 85000, 'đĩa'],
        ['Mực nướng', 'mn', 120000, 'con'],
        ['Cá chỉ vàng nướng', 'cvn', 45000, 'đĩa'],
        ['Đậu bắp nướng', 'dbn', 35000, 'đĩa'],
        ['Lòng nướng', 'ln', 70000, 'đĩa'],
      ],
    },
    {
      group: 'Đồ chiên',
      station: kitchen.id,
      items: [
        ['Khoai tây chiên', 'ktc', 35000, 'đĩa'],
        ['Đậu phụ rán', 'dpr', 30000, 'đĩa'],
        ['Nem rán', 'nr', 60000, 'đĩa'],
        ['Cánh gà chiên mắm', 'cgc', 80000, 'đĩa'],
        ['Ngô chiên', 'ngc', 40000, 'đĩa'],
        ['Chả cá chiên', 'ccc', 70000, 'đĩa'],
        ['Cá trứng chiên', 'ctc', 55000, 'đĩa'],
      ],
    },
    {
      group: 'Món khác',
      station: kitchen.id,
      items: [
        ['Lạc luộc', 'll', 20000, 'đĩa'],
        ['Lạc rang', 'lr', 20000, 'đĩa'],
        ['Dưa chuột', 'dc', 15000, 'đĩa'],
        ['Rau muống xào tỏi', 'rm', 45000, 'đĩa'],
        ['Lẩu riêu cua', 'lau', 250000, 'nồi'],
        ['Cơm rang dưa bò', 'cr', 70000, 'đĩa'],
        ['Bò xào', 'bx', 120000, 'đĩa'],
      ],
    },
  ];

  const items: { id: number; name: string; price: number; stationId: number; volume: number | null; tapId: number | null; group: number }[] = [];
  for (const [gi, g] of menu.entries()) {
    const group = await prisma.menuGroup.create({ data: { name: g.group, sortOrder: gi } });
    for (const [ii, [name, shortcut, price, unit, extra]] of g.items.entries()) {
      const item = await prisma.menuItem.create({
        data: {
          groupId: group.id,
          name,
          shortcut,
          price,
          unit,
          stationId: g.station,
          beerVolumeMl: extra?.volume ?? null,
          defaultTapId: extra?.tapId ?? null,
          sortOrder: ii,
          imageFile: await seedImage(shortcut),
        },
      });
      items.push({ id: item.id, name, price, stationId: g.station, volume: extra?.volume ?? null, tapId: extra?.tapId ?? null, group: gi });
    }
  }
  const [cup, jug, tower] = items;
  const drinks = items.filter((i) => i.group === 0 && !i.volume);
  const foods = items.filter((i) => i.group > 0);

  // ---- Giờ vàng: 16:00–18:00 thứ Hai – thứ Sáu ----
  const hh = await prisma.happyHour.create({
    data: {
      name: 'Giờ vàng chiều',
      daysOfWeek: [1, 2, 3, 4, 5],
      startMinute: 16 * 60,
      endMinute: 18 * 60,
      prices: { create: [{ itemId: cup!.id, price: 12000 }, { itemId: jug!.id, price: 32000 }] },
    },
  });
  const rules: HappyHourRule[] = [
    { id: hh.id, daysOfWeek: hh.daysOfWeek, startMinute: hh.startMinute, endMinute: hh.endMinute, prices: new Map([[cup!.id, 12000], [jug!.id, 32000]]) },
  ];

  // ---- Keg: 6 × 50 L. Vòi 1 chỉ bán cốc 0,5 L nên keg #1 dừng đúng ở 92 cốc = 46 L ----
  const today = vnStartOfDay(new Date());
  const firstDay = new Date(today.getTime() - 6 * DAY_MS);
  const kegs = await prisma.keg.createManyAndReturn({
    data: Array.from({ length: 6 }, () => ({ beerName: 'Bia hơi Hà Nội', capacityMl: 50000, cost: 950000, receivedAt: new Date(firstDay.getTime() - DAY_MS) })),
  });
  // Mỗi vòi có hàng đợi keg; keg dừng khi đạt "mục tiêu bán" để tạo đúng tỉ lệ hao hụt.
  const kegQueues: Record<number, { id: number; target: number }[]> = {
    [tap1.id]: [
      { id: kegs[0]!.id, target: 46000 }, // hao hụt 8% → tô đỏ (FR-17 AC)
      { id: kegs[1]!.id, target: 48500 }, // 3%
      { id: kegs[2]!.id, target: 50000 },
      { id: kegs[5]!.id, target: 50000 },
    ],
    [tap2.id]: [
      { id: kegs[3]!.id, target: 49500 }, // 1–4% tùy lần đổi keg
      { id: kegs[4]!.id, target: 50000 },
    ],
  };
  const kegState = new Map<number, { sold: number; tappedAt: Date | null; emptiedAt: Date | null; tapId: number }>();
  const tapPos: Record<number, number> = { [tap1.id]: 0, [tap2.id]: 0 };
  const startOfSales = new Date(firstDay.getTime() + 15 * 60 * MINUTE);
  for (const tapId of [tap1.id, tap2.id]) {
    kegState.set(kegQueues[tapId]![0]!.id, { sold: 0, tappedAt: startOfSales, emptiedAt: null, tapId });
  }

  /** Phân bổ `qty` phần bia vào keg đang gắn ở vòi, tự thay keg khi keg đạt mục tiêu. */
  function allocateBeer(tapId: number, volume: number, qty: number, at: Date): { kegId: number | null; qty: number }[] {
    const out: { kegId: number | null; qty: number }[] = [];
    while (qty > 0) {
      const entry = kegQueues[tapId]![tapPos[tapId]!];
      if (!entry) {
        out.push({ kegId: null, qty });
        break;
      }
      const state = kegState.get(entry.id)!;
      const fit = Math.floor((entry.target - state.sold) / volume);
      if (fit === 0) {
        state.emptiedAt = at;
        tapPos[tapId]! += 1;
        const next = kegQueues[tapId]![tapPos[tapId]!];
        if (next) kegState.set(next.id, { sold: 0, tappedAt: at, emptiedAt: null, tapId });
        continue;
      }
      const take = Math.min(qty, fit);
      state.sold += take * volume;
      qty -= take;
      out.push({ kegId: entry.id, qty: take });
    }
    return out;
  }

  // ---- Bán hàng 7 ngày ----
  const reasons: AdjustReason[] = ['KHACH_DOI_Y', 'BEP_HET_MON', 'NHAP_NHAM', 'MON_LOI'];
  const now = new Date();

  for (let d = 6; d >= 0; d--) {
    const dayStart = new Date(today.getTime() - d * DAY_MS);
    const isToday = d === 0;
    // Hôm nay: ca mở 4 tiếng trước lúc chạy seed để luôn có bàn đang ngồi khi demo.
    const shiftOpen = isToday ? new Date(now.getTime() - 4 * 60 * MINUTE) : new Date(dayStart.getTime() + 15 * 60 * MINUTE);

    const shift = await prisma.shift.create({ data: { openedById: manager.id, openedAt: shiftOpen, openingCash: 1_000_000 } });
    const salesEnd = isToday ? now.getTime() - 5 * MINUTE : dayStart.getTime() + 23 * 60 * MINUTE;
    const tabCount = isToday ? randInt(14, 18) : randInt(18, 26);
    const usedTables = new Set<number>();
    let cashTotal = 0;

    for (let n = 0; n < tabCount; n++) {
      const openedAt = new Date(randInt(shiftOpen.getTime() + 30 * MINUTE, salesEnd - 30 * MINUTE));
      if (openedAt.getTime() >= salesEnd) continue;
      let tableId = pick(tableIds);
      if (isToday) {
        while (usedTables.has(tableId)) tableId = pick(tableIds);
        usedTables.add(tableId);
      }
      const staff = pick(counters);
      const tab = await prisma.tab.create({ data: { tableId, openedAt, openedById: staff.id, guestCount: randInt(2, 8) } });

      // Lượt gọi
      let at = openedAt.getTime();
      const roundCount = randInt(1, 3);
      const createdLines: { id: number; roundId: number; itemId: number; qty: number; unitPrice: number; itemName: string; stationId: number; at: Date; isBeer: boolean }[] = [];
      for (let r = 0; r < roundCount; r++) {
        at += r === 0 ? randInt(2, 8) * MINUTE : randInt(15, 45) * MINUTE;
        if (at >= salesEnd) break;
        const when = new Date(at);
        const round = await prisma.orderRound.create({ data: { tabId: tab.id, createdById: staff.id, createdAt: when, printedStatus: 'PRINTED' } });

        const wanted: { item: (typeof items)[number]; qty: number }[] = [];
        if (rand() < 0.6) wanted.push({ item: cup!, qty: randInt(1, 2) });
        if (rand() < 0.12) wanted.push({ item: rand() < 0.6 ? jug! : tower!, qty: 1 });
        if (rand() < 0.25) wanted.push({ item: pick(drinks), qty: randInt(1, 3) });
        for (let k = randInt(r === 0 ? 1 : 0, 2); k > 0; k--) wanted.push({ item: pick(foods), qty: randInt(1, 2) });
        if (wanted.length === 0) wanted.push({ item: pick(foods), qty: 1 });

        for (const { item, qty } of wanted) {
          const price = resolveUnitPrice(item.id, item.price, rules, when);
          const parts = item.volume && item.tapId ? allocateBeer(item.tapId, item.volume, qty, when) : [{ kegId: null, qty }];
          for (const part of parts) {
            const line = await prisma.orderLine.create({
              data: {
                roundId: round.id,
                itemId: item.id,
                itemName: item.name,
                qty: part.qty,
                unitPrice: price.unitPrice,
                happyHourId: price.happyHourId,
                createdById: staff.id,
                createdAt: when,
                stationId: item.stationId,
                kegId: part.kegId,
                volumeMl: item.volume,
              },
            });
            createdLines.push({ id: line.id, roundId: round.id, itemId: item.id, qty: part.qty, unitPrice: price.unitPrice, itemName: item.name, stationId: item.stationId, at: when, isBeer: !!item.volume });
          }
        }
      }

      // Hủy/giảm món (chỉ trên đồ ăn để không làm lệch số liệu keg)
      const food = createdLines.filter((l) => !l.isBeer);
      if (food.length && rand() < 0.12) {
        const target = pick(food);
        const isVoid = rand() < 0.7;
        const reason = pick(reasons);
        const amount = isVoid ? target.unitPrice : Math.round((target.unitPrice * target.qty * 0.2) / 1000) * 1000;
        await prisma.orderLine.create({
          data: {
            roundId: target.roundId,
            itemId: target.itemId,
            itemName: target.itemName,
            qty: isVoid ? -1 : 1,
            unitPrice: isVoid ? target.unitPrice : -amount,
            lineType: isVoid ? 'VOID' : 'DISCOUNT',
            refLineId: target.id,
            reason,
            createdById: staff.id,
            approvedById: manager.id,
            createdAt: new Date(target.at.getTime() + randInt(3, 15) * MINUTE),
            stationId: target.stationId,
          },
        });
      }

      const lines = await prisma.orderLine.findMany({ where: { round: { tabId: tab.id } }, select: { qty: true, unitPrice: true } });
      let total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);

      // Hôm nay: một phần bàn vẫn đang ngồi
      const stillOpen = isToday && (n % 3 !== 0 || at + 40 * MINUTE > salesEnd);
      if (stillOpen) {
        await prisma.diningTable.update({ where: { id: tableId }, data: { currentTabId: tab.id } });
        if (n === 1) await prisma.billPrint.create({ data: { tabId: tab.id, kind: 'PROVISIONAL', printNo: 1, printedById: staff.id, printedAt: new Date(at + MINUTE) } });
        if (n === 2) await prisma.orderRound.updateMany({ where: { tabId: tab.id }, data: { printedStatus: 'FAILED' } });
        continue;
      }

      // Thỉnh thoảng giảm giá cả hóa đơn
      if (rand() < 0.05 && total > 300000) {
        const discount = Math.round((total * 0.1) / 1000) * 1000;
        await prisma.billDiscount.create({
          data: { tabId: tab.id, amount: -discount, percent: 10, reason: 'KHAC', reasonNote: 'Khách quen', createdById: staff.id, approvedById: manager.id, createdAt: new Date(at + 20 * MINUTE) },
        });
        total -= discount;
      }

      const paidAt = new Date(Math.min(at + randInt(25, 70) * MINUTE, salesEnd));
      const roll = rand();
      const methods: { method: PaymentMethod; amount: number; tendered?: number }[] =
        roll < 0.6
          ? [{ method: 'CASH', amount: total, tendered: Math.ceil(total / 50000) * 50000 }]
          : roll < 0.9
            ? [{ method: 'TRANSFER', amount: total }]
            : [
                { method: 'TRANSFER', amount: total - Math.floor(total / 2000) * 1000 },
                { method: 'CASH', amount: Math.floor(total / 2000) * 1000 },
              ];
      for (const m of methods.filter((m) => m.amount > 0)) {
        await prisma.payment.create({
          data: { tabId: tab.id, method: m.method, amount: m.amount, tendered: m.tendered ?? null, receivedById: staff.id, shiftId: shift.id, createdAt: paidAt },
        });
        if (m.method === 'CASH') cashTotal += m.amount;
      }
      await prisma.tab.update({ where: { id: tab.id }, data: { status: 'PAID', closedAt: paidAt } });
      await prisma.billPrint.create({ data: { tabId: tab.id, kind: 'FINAL', printNo: 1, printedById: staff.id, printedAt: paidAt } });
    }

    if (!isToday) {
      const expectedCash = 1_000_000 + cashTotal;
      const countedCash = expectedCash - pick([0, 0, 0, 5000, 10000, -20000]);
      await prisma.shift.update({
        where: { id: shift.id },
        data: { closedAt: new Date(dayStart.getTime() + 23 * 60 * MINUTE + 30 * MINUTE), closedById: manager.id, countedCash, expectedCash },
      });
    }
  }

  // ---- Chốt trạng thái keg và vòi theo kết quả mô phỏng ----
  for (const keg of kegs) {
    const state = kegState.get(keg.id);
    if (!state) continue; // chưa từng gắn → vẫn Trong kho
    await prisma.keg.update({
      where: { id: keg.id },
      data: state.emptiedAt
        ? { status: 'EMPTY', tapId: state.tapId, tappedAt: state.tappedAt, emptiedAt: state.emptiedAt }
        : { status: 'TAPPED', tapId: state.tapId, tappedAt: state.tappedAt },
    });
    if (!state.emptiedAt) await prisma.tap.update({ where: { id: state.tapId }, data: { currentKegId: keg.id } });
  }

  const summary = {
    staff: await prisma.staff.count(),
    tables: await prisma.diningTable.count(),
    items: await prisma.menuItem.count(),
    tabs: await prisma.tab.count(),
    openTabs: await prisma.tab.count({ where: { status: 'OPEN' } }),
    lines: await prisma.orderLine.count(),
    kegs: Object.fromEntries([...kegState].map(([id, s]) => [`keg${id}`, `${s.sold / 1000}L${s.emptiedAt ? ' (đã hết)' : ''}`])),
  };
  console.log('Seed xong:', summary);
  console.log('Đăng nhập: PIN quầy 1111 / 2222, quản lý ca 8888, chủ quán 9999; web: chuquan@biahoi.vn / chuquan123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

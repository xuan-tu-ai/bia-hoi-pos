// Test tích hợp theo tiêu chí nghiệm thu trong SRS. Chạy trên CSDL thật (PostgreSQL nhúng).

import bcrypt from 'bcryptjs';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { resetLockouts } from '../src/lib/lockout';
import { prisma } from '../src/lib/prisma';

let app: FastifyInstance;
const ids = {} as {
  tables: number[];
  cup: number;
  grill: number;
  soldOut: number;
  tap: number;
  keg: number;
  spareKeg: number;
};

async function seedFixtures() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE audit_log, bill_print, payment, bill_discount, order_line, order_round, tab,
      shift, happy_hour_price, happy_hour, menu_item, menu_group, print_station,
      dining_table, area, keg, tap, staff RESTART IDENTITY CASCADE`);
  const hash = (s: string) => bcrypt.hash(s, 4);
  await prisma.staff.createMany({
    data: [
      { name: 'Quầy A', role: 'COUNTER', pinHash: await hash('1111') },
      { name: 'Quản lý B', role: 'SHIFT_MANAGER', pinHash: await hash('8888'), email: 'ql@test.vn', passwordHash: await hash('matkhau123') },
      { name: 'Chủ C', role: 'OWNER', pinHash: await hash('9999'), email: 'chu@test.vn', passwordHash: await hash('matkhau123') },
      { name: 'Nghỉ D', role: 'COUNTER', pinHash: await hash('3333'), active: false },
    ],
  });
  const area = await prisma.area.create({ data: { name: 'Trong nhà' } });
  const tables = await prisma.diningTable.createManyAndReturn({
    data: ['T01', 'T02', 'T03', 'T04', 'T05', 'T06'].map((code, i) => ({ areaId: area.id, code, sortOrder: i })),
  });
  const bar = await prisma.printStation.create({ data: { name: 'Quầy rót bia', printerName: 'Bia' } });
  const kitchen = await prisma.printStation.create({ data: { name: 'Bếp', printerName: 'Bep' } });
  const tap = await prisma.tap.create({ data: { name: 'Vòi 1' } });
  const [keg, spareKeg] = await prisma.keg.createManyAndReturn({
    data: [
      { beerName: 'Bia hơi', capacityMl: 50000, cost: 900000, receivedAt: new Date(), status: 'TAPPED', tapId: tap.id, tappedAt: new Date() },
      { beerName: 'Bia hơi', capacityMl: 50000, cost: 900000, receivedAt: new Date() },
    ],
  });
  await prisma.tap.update({ where: { id: tap.id }, data: { currentKegId: keg!.id } });
  const group = await prisma.menuGroup.create({ data: { name: 'Chung' } });
  const cup = await prisma.menuItem.create({
    data: { groupId: group.id, name: 'Bia hơi cốc', shortcut: 'b', price: 15000, unit: 'cốc', stationId: bar.id, beerVolumeMl: 500, defaultTapId: tap.id },
  });
  const grill = await prisma.menuItem.create({ data: { groupId: group.id, name: 'Sườn nướng', price: 90000, unit: 'đĩa', stationId: kitchen.id } });
  const soldOut = await prisma.menuItem.create({ data: { groupId: group.id, name: 'Mực nướng', price: 120000, unit: 'con', stationId: kitchen.id, available: false } });
  Object.assign(ids, { tables: tables.map((t) => t.id), cup: cup.id, grill: grill.id, soldOut: soldOut.id, tap: tap.id, keg: keg!.id, spareKeg: spareKeg!.id });
}

type Call = (method: InjectOptions['method'], url: string, payload?: object) => Promise<LightMyRequestResponse>;

function client(token: string): Call {
  return (method, url, payload) => app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } } as InjectOptions);
}

async function pinLogin(pin: string, device = 'may-quay-1') {
  return app.inject({ method: 'POST', url: '/auth/pin', payload: { pin }, headers: { 'x-device-key': device } });
}

let counter: Call;
let manager: Call;
let owner: Call;

async function approval(pin = '8888'): Promise<string> {
  const res = await counter('POST', '/auth/approve', { pin });
  expect(res.statusCode).toBe(200);
  return res.json().approvalToken;
}

async function openTab(tableId: number): Promise<number> {
  const res = await counter('POST', '/tabs', { tableId, guestCount: 4 });
  expect(res.statusCode).toBe(201);
  return res.json().tab.id;
}

async function addRound(tabId: number, items: { itemId: number; qty: number; note?: string }[]) {
  return counter('POST', `/tabs/${tabId}/rounds`, { items });
}

beforeAll(async () => {
  await seedFixtures();
  app = await buildApp({ logger: false });
  counter = client((await pinLogin('1111')).json().token);
  manager = client((await pinLogin('8888')).json().token);
  const ownerLogin = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'chu@test.vn', password: 'matkhau123' } });
  owner = client(ownerLogin.json().token);
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('FR-01 / FR-13: đăng nhập & phân quyền', () => {
  it('PIN sai 5 lần liên tiếp thì khóa 60 giây, kể cả khi sau đó nhập đúng', async () => {
    resetLockouts();
    for (let i = 0; i < 4; i++) expect((await pinLogin('0000', 'may-khoa')).statusCode).toBe(401);
    const fifth = await pinLogin('0000', 'may-khoa');
    expect(fifth.statusCode).toBe(401);
    expect(fifth.json().message).toContain('đã khóa');
    const locked = await pinLogin('1111', 'may-khoa');
    expect(locked.statusCode).toBe(429);
    expect(locked.json().code).toBe('LOCKED');
    expect((await pinLogin('1111', 'may-khac')).statusCode).toBe(200);
  });

  it('nhân viên ngừng hoạt động không đăng nhập được', async () => {
    expect((await pinLogin('3333', 'may-2')).statusCode).toBe(401);
  });

  it('nhân viên quầy không vào được web quản trị và API quản trị', async () => {
    expect((await counter('GET', '/reports/today')).statusCode).toBe(403);
    expect((await counter('POST', '/menu-groups', { name: 'X' })).statusCode).toBe(403);
    expect((await manager('POST', '/menu-groups', { name: 'X' })).statusCode).toBe(403);
    expect((await owner('GET', '/staff')).json().every((s: object) => !('pinHash' in s))).toBe(true);
  });

  it('API yêu cầu token', async () => {
    expect((await app.inject({ method: 'GET', url: '/areas' })).statusCode).toBe(401);
  });

  it('PIN lưu dạng băm bcrypt', async () => {
    const staff = await prisma.staff.findFirstOrThrow({ where: { role: 'COUNTER' } });
    expect(staff.pinHash).toMatch(/^\$2[aby]\$/);
  });
});

describe('FR-03: mở phiên bàn', () => {
  it('hai máy cùng mở một bàn → chỉ có 1 phiên, máy sau nhận "Bàn đã được mở"', async () => {
    const tableId = ids.tables[0]!;
    const [a, b] = await Promise.all([counter('POST', '/tabs', { tableId }), manager('POST', '/tabs', { tableId })]);
    const bodies = [a.json(), b.json()];
    expect(bodies.filter((x) => x.alreadyOpen).length).toBe(1);
    expect(bodies.find((x) => x.alreadyOpen).message).toBe('Bàn đã được mở');
    expect(bodies[0].tab.id).toBe(bodies[1].tab.id);
    expect(await prisma.tab.count({ where: { tableId, status: 'OPEN' } })).toBe(1);
  });
});

describe('FR-04: gọi món & in phiếu theo trạm', () => {
  it('tách phiếu theo trạm, chốt giá lúc gửi, đổi giá sau không ảnh hưởng (FR-11)', async () => {
    const tabId = await openTab(ids.tables[1]!);
    const res = await addRound(tabId, [
      { itemId: ids.cup, qty: 4 },
      { itemId: ids.grill, qty: 1, note: 'ít cay' },
    ]);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.total).toBe(4 * 15000 + 90000);
    expect(body.tickets.map((t: { stationName: string }) => t.stationName).sort()).toEqual(['Bếp', 'Quầy rót bia']);
    const kitchenTicket = body.tickets.find((t: { stationName: string }) => t.stationName === 'Bếp');
    expect(kitchenTicket).toMatchObject({ tableCode: 'T02', staffName: 'Quầy A', lines: [{ name: 'Sườn nướng', qty: 1, note: 'ít cay' }] });

    expect((await owner('PATCH', `/menu-items/${ids.grill}`, { price: 100000 })).statusCode).toBe(200);
    expect((await counter('GET', `/tabs/${tabId}`)).json().total).toBe(150000);
    await owner('PATCH', `/menu-items/${ids.grill}`, { price: 90000 });
  });

  it('món "hết" không gọi được', async () => {
    const tabId = await openTab(ids.tables[2]!);
    const res = await addRound(tabId, [{ itemId: ids.soldOut, qty: 1 }]);
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('ITEM_UNAVAILABLE');
  });

  it('máy in lỗi → lượt vẫn lưu, bàn đỏ, in lại được', async () => {
    const tabId = await openTab(ids.tables[3]!);
    const round = (await addRound(tabId, [{ itemId: ids.grill, qty: 2 }])).json().round;
    await counter('POST', `/rounds/${round.id}/print-result`, { status: 'FAILED' });
    const areas = (await counter('GET', '/areas?include=tables')).json();
    const table = areas[0].tables.find((t: { id: number }) => t.id === ids.tables[3]);
    expect(table.status).toBe('PRINT_ERROR');
    expect(table.tab.total).toBe(180000);
    const reprint = await counter('POST', `/rounds/${round.id}/reprint`);
    expect(reprint.json().tickets[0].lines).toEqual([{ name: 'Sườn nướng', qty: 2, note: null }]);
  });
});

describe('FR-06: hủy / giảm món cần PIN quản lý', () => {
  let tabId: number;
  let grillLineId: number;

  beforeAll(async () => {
    tabId = (await prisma.diningTable.findUniqueOrThrow({ where: { id: ids.tables[3]! } })).currentTabId!;
    const detail = (await counter('GET', `/tabs/${tabId}`)).json();
    grillLineId = detail.rounds[0].lines[0].id;
  });

  it('thiếu PIN quản lý thì không hoàn tất được', async () => {
    expect((await counter('POST', `/lines/${grillLineId}/void`, { qty: 1, reason: 'KHACH_DOI_Y' })).statusCode).toBe(400);
    const counterPin = await counter('POST', '/auth/approve', { pin: '1111' });
    expect(counterPin.statusCode).toBe(403);
    const fake = await counter('POST', `/lines/${grillLineId}/void`, { qty: 1, reason: 'KHACH_DOI_Y', approvalToken: 'xyz' });
    expect(fake.statusCode).toBe(403);
  });

  it('hủy hợp lệ tạo dòng âm + nhật ký; phiếu duyệt chỉ dùng một lần', async () => {
    const token = await approval();
    const tooMany = await counter('POST', `/lines/${grillLineId}/void`, { qty: 5, reason: 'KHACH_DOI_Y', approvalToken: token });
    expect(tooMany.statusCode).toBe(400);
    expect(tooMany.json().code).toBe('QTY_EXCEEDS');

    // Thao tác bị từ chối không làm mất phiếu duyệt
    const ok = await counter('POST', `/lines/${grillLineId}/void`, { qty: 1, reason: 'BEP_HET_MON', approvalToken: token });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().line).toMatchObject({ lineType: 'VOID', qty: -1, unitPrice: 90000, refLineId: grillLineId });
    expect(ok.json().tickets[0].title).toBe('PHIẾU HỦY MÓN');

    const reused = await counter('POST', `/lines/${grillLineId}/void`, { qty: 1, reason: 'BEP_HET_MON', approvalToken: token });
    expect(reused.statusCode).toBe(403);

    expect(await prisma.orderLine.count({ where: { id: grillLineId } })).toBe(1); // dòng gốc không bị xóa
    expect((await counter('GET', `/tabs/${tabId}`)).json().total).toBe(90000);
  });

  it('lý do "Khác" bắt buộc ghi chú; giảm giá theo %', async () => {
    const missingNote = await counter('POST', `/lines/${grillLineId}/discount`, { percent: 10, reason: 'KHAC', approvalToken: await approval() });
    expect(missingNote.statusCode).toBe(400);
    const res = await counter('POST', `/lines/${grillLineId}/discount`, { percent: 10, reason: 'KHAC', note: 'Khách quen', approvalToken: await approval() });
    expect(res.statusCode).toBe(201);
    expect(res.json().line).toMatchObject({ lineType: 'DISCOUNT', qty: 1, unitPrice: -9000 });
    expect((await counter('GET', `/tabs/${tabId}`)).json().total).toBe(81000);
  });

  it('nhật ký hủy/giảm có đủ món, số tiền, lý do, người yêu cầu, người duyệt (FR-18)', async () => {
    const log = (await manager('GET', '/reports/voids')).json();
    expect(log.count).toBe(2);
    expect(log.rows.find((r: { type: string }) => r.type === 'VOID')).toMatchObject({
      itemName: 'Sườn nướng',
      qty: 1,
      amount: 90000,
      reason: 'BEP_HET_MON',
      reasonLabel: 'Bếp hết món',
      requestedBy: { name: 'Quầy A' },
      approvedBy: { name: 'Quản lý B' },
    });
    expect(log.total).toBe(99000);
  });
});

describe('client gửi POST không thân kèm content-type JSON', () => {
  it('vẫn được chấp nhận; JSON hỏng thì báo 400 rõ ràng', async () => {
    // Dùng phiên đang mở ở T04 (đã tạo ở test FR-04), không tạo thêm hóa đơn
    const tabId = (await prisma.diningTable.findUniqueOrThrow({ where: { id: ids.tables[3]! } })).currentTabId!;
    const token = (await pinLogin('1111', 'may-json')).json().token;
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    expect((await app.inject({ method: 'POST', url: `/tabs/${tabId}/provisional`, headers })).statusCode).toBe(200);
    const bad = await app.inject({ method: 'POST', url: `/tabs/${tabId}/rounds`, headers, payload: '{khong-phai-json' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().message).toContain('JSON');
  });
});

describe('FR-07: in tạm tính', () => {
  it('đánh số lần in, bàn chuyển vàng, vẫn gọi thêm được', async () => {
    const tabId = (await prisma.diningTable.findUniqueOrThrow({ where: { id: ids.tables[1]! } })).currentTabId!;
    await counter('POST', `/tabs/${tabId}/provisional`);
    const second = (await counter('POST', `/tabs/${tabId}/provisional`)).json();
    expect(second.title).toMatch(/^Tạm tính — lần in 2 — \d{2}:\d{2}$/);
    expect(second.rows).toContainEqual({ name: 'Bia hơi cốc', qty: 4, unitPrice: 15000, amount: 60000 });

    const areas = (await counter('GET', '/areas?include=tables')).json();
    expect(areas[0].tables.find((t: { id: number }) => t.id === ids.tables[1]).status).toBe('PROVISIONAL');
    expect((await addRound(tabId, [{ itemId: ids.cup, qty: 6 }])).statusCode).toBe(201);
    const third = (await counter('POST', `/tabs/${tabId}/provisional`)).json();
    expect(third.rows).toContainEqual({ name: 'Bia hơi cốc', qty: 10, unitPrice: 15000, amount: 150000 });
  });
});

describe('FR-05: chuyển / gộp bàn', () => {
  it('chuyển sang bàn trống; không chuyển được sang bàn có khách', async () => {
    const t3 = (await prisma.diningTable.findUniqueOrThrow({ where: { id: ids.tables[2]! } })).currentTabId!;
    const busy = await counter('POST', `/tabs/${t3}/move`, { tableId: ids.tables[1] });
    expect(busy.statusCode).toBe(409);
    const moved = await counter('POST', `/tabs/${t3}/move`, { tableId: ids.tables[4] });
    expect(moved.statusCode).toBe(200);
    expect(moved.json().table.code).toBe('T05');
    const tables = await prisma.diningTable.findMany({ where: { id: { in: [ids.tables[2]!, ids.tables[4]!] } }, orderBy: { id: 'asc' } });
    expect(tables.map((t) => t.currentTabId)).toEqual([null, t3]);
  });

  it('gộp: tổng sau gộp = tổng hai phiên, bàn nguồn về trống, có lịch sử', async () => {
    const source = (await prisma.diningTable.findUniqueOrThrow({ where: { id: ids.tables[3]! } })).currentTabId!;
    const dest = (await prisma.diningTable.findUniqueOrThrow({ where: { id: ids.tables[1]! } })).currentTabId!;
    const before = (await counter('GET', `/tabs/${source}`)).json().total + (await counter('GET', `/tabs/${dest}`)).json().total;

    const res = await counter('POST', `/tabs/${source}/merge`, { tableId: ids.tables[1] });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(before);
    expect((await prisma.tab.findUniqueOrThrow({ where: { id: source } })).status).toBe('MERGED');
    expect((await prisma.diningTable.findUniqueOrThrow({ where: { id: ids.tables[3]! } })).currentTabId).toBeNull();
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'TAB_MERGE' } });
    expect(log.payload).toMatchObject({ fromTableId: ids.tables[3], toTableId: ids.tables[1] });

    // Phiên nguồn đã gộp thì không gọi thêm được
    expect((await addRound(source, [{ itemId: ids.cup, qty: 1 }])).statusCode).toBe(409);
  });
});

describe('FR-08: thanh toán', () => {
  it('VietQR có đúng số tiền và nội dung BH<mã>', async () => {
    const tabId = (await prisma.diningTable.findUniqueOrThrow({ where: { id: ids.tables[1]! } })).currentTabId!;
    const total = (await counter('GET', `/tabs/${tabId}`)).json().total;
    const qr = (await counter('GET', `/tabs/${tabId}/vietqr`)).json();
    expect(qr.amount).toBe(total);
    expect(qr.content).toBe(`BH${String(tabId).padStart(6, '0')}`);
    expect(qr.payload).toContain(`54${String(String(total).length).padStart(2, '0')}${total}`);
    expect((await counter('GET', `/tabs/${tabId}/vietqr?amount=${total + 1}`)).statusCode).toBe(400);
  });

  it('không đóng phiên khi tiền nhận < tổng; kết hợp 2 phương thức; hóa đơn không sửa được', async () => {
    const tabId = (await prisma.diningTable.findUniqueOrThrow({ where: { id: ids.tables[1]! } })).currentTabId!;
    // Giảm giá cả hóa đơn cần PIN quản lý
    const disc = await counter('POST', `/tabs/${tabId}/discount`, { amount: 1000, reason: 'KHAC', note: 'Làm tròn', approvalToken: await approval() });
    expect(disc.statusCode).toBe(201);
    const total = disc.json().total;

    const short = await counter('POST', `/tabs/${tabId}/pay`, { payments: [{ method: 'CASH', amount: total - 1000 }] });
    expect(short.statusCode).toBe(400);
    expect(short.json().code).toBe('INSUFFICIENT_PAYMENT');

    const transfer = 100000;
    const cash = total - transfer;
    const paid = await counter('POST', `/tabs/${tabId}/pay`, {
      payments: [
        { method: 'TRANSFER', amount: transfer },
        { method: 'CASH', amount: cash, tendered: cash + 50000 },
      ],
    });
    expect(paid.statusCode).toBe(200);
    expect(paid.json()).toMatchObject({ kind: 'FINAL', total, change: 50000 });
    expect(paid.json().adjustments).toContainEqual({ label: 'Giảm giá hóa đơn (Làm tròn)', amount: -1000 });

    expect((await prisma.diningTable.findUniqueOrThrow({ where: { id: ids.tables[1]! } })).currentTabId).toBeNull();
    expect((await addRound(tabId, [{ itemId: ids.cup, qty: 1 }])).statusCode).toBe(409);
    expect((await counter('POST', `/tabs/${tabId}/pay`, { payments: [] })).statusCode).toBe(409);
    expect((await counter('GET', `/tabs/${tabId}/bill`)).json().total).toBe(total);

    // Giảm giá hóa đơn có trong nhật ký FR-18
    const log = (await manager('GET', '/reports/voids')).json();
    expect(log.rows.some((r: { type: string }) => r.type === 'BILL_DISCOUNT')).toBe(true);
  });

  it('không có API sửa/xóa dòng gọi món hay thanh toán (NFR-04)', async () => {
    expect((await owner('DELETE', '/lines/1')).statusCode).toBe(404);
    expect((await owner('PATCH', '/payments/1', {})).statusCode).toBe(404);
  });
});

describe('FR-10 / FR-14 / FR-17: keg', () => {
  it('chỉ gắn được keg Trong kho; thay keg → keg cũ "Đã hết"; báo cáo hao hụt 8% tô đỏ', async () => {
    // Keg đang gắn đã bán 4 + 6 + 1 cốc ở các test trên; làm mới bằng keg dự phòng trước
    const busyKeg = await counter('POST', `/taps/${ids.tap}/change-keg`, { kegId: ids.keg });
    expect(busyKeg.statusCode).toBe(409);
    expect((await counter('POST', `/taps/${ids.tap}/change-keg`, { kegId: ids.spareKeg })).statusCode).toBe(200);

    // Dữ liệu mẫu của SRS: keg 50 L bán 92 cốc 0,5 L; hủy 1 cốc rồi bán bù 1 cốc
    const tabId = await openTab(ids.tables[5]!);
    const round = (await addRound(tabId, [{ itemId: ids.cup, qty: 92 }])).json();
    const detail = (await counter('GET', `/tabs/${tabId}`)).json();
    const lineId = detail.rounds.find((r: { id: number }) => r.id === round.round.id).lines[0].id;
    await counter('POST', `/lines/${lineId}/void`, { qty: 1, reason: 'NHAP_NHAM', approvalToken: await approval() });
    await addRound(tabId, [{ itemId: ids.cup, qty: 1 }]);

    const taps = (await counter('GET', '/taps')).json();
    expect(taps[0].currentKeg).toMatchObject({ id: ids.spareKeg, soldMl: 46000 });

    await owner('POST', '/kegs', { beerName: 'Bia hơi', capacityMl: 50000, cost: 900000, quantity: 2 });
    const stock = (await counter('GET', '/kegs?status=IN_STOCK')).json();
    expect(stock.length).toBe(2);
    expect((await counter('POST', `/taps/${ids.tap}/change-keg`, { kegId: stock[0].id })).statusCode).toBe(200);

    const report = (await owner('GET', '/reports/keg-loss')).json();
    const row = report.rows.find((r: { id: number }) => r.id === ids.spareKeg);
    expect(row).toMatchObject({ capacityMl: 50000, soldMl: 46000, lossMl: 4000, lossPct: 8, exceeded: true });
    expect(report.thresholdPct).toBe(5);
    expect((await owner('GET', '/reports/keg-loss?threshold=10')).json().rows.find((r: { id: number }) => r.id === ids.spareKeg).exceeded).toBe(false);
  });
});

describe('FR-12: quản lý bàn', () => {
  it('không xóa được bàn đang có phiên mở', async () => {
    const res = await owner('DELETE', `/tables/${ids.tables[5]}`);
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('TABLE_HAS_OPEN_TAB');
    expect((await owner('DELETE', `/tables/${ids.tables[3]}`)).statusCode).toBe(204); // có lịch sử → xóa mềm
    expect((await owner('POST', '/tables', { areaId: (await prisma.area.findFirstOrThrow()).id, code: 'T04' })).statusCode).toBe(201);
  });
});

describe('FR-13: quản lý nhân viên', () => {
  it('không cho trùng PIN; ngừng hoạt động thì token cũ hết hiệu lực', async () => {
    expect((await owner('POST', '/staff', { name: 'Mới', role: 'COUNTER', pin: '1111' })).statusCode).toBe(409);
    const created = await owner('POST', '/staff', { name: 'Mới', role: 'COUNTER', pin: '4444' });
    expect(created.statusCode).toBe(201);
    const token = (await pinLogin('4444', 'may-moi')).json().token;
    expect((await client(token)('GET', '/areas')).statusCode).toBe(200);
    await owner('PATCH', `/staff/${created.json().id}`, { active: false });
    expect((await client(token)('GET', '/areas')).statusCode).toBe(401);
  });
});

describe('FR-15: giá giờ vàng', () => {
  it('lượt gửi trong khung dùng giá giờ vàng; hóa đơn tách 2 dòng khi khác giá', async () => {
    // Khung bao trọn cả ngày để test không phụ thuộc giờ chạy
    const hh = await owner('POST', '/happy-hours', {
      name: 'Cả ngày',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      start: '00:00',
      end: '23:59',
      prices: [{ itemId: ids.cup, price: 12000 }],
    });
    expect(hh.statusCode).toBe(201);
    const tabId = (await prisma.diningTable.findUniqueOrThrow({ where: { id: ids.tables[5]! } })).currentTabId!;
    await addRound(tabId, [{ itemId: ids.cup, qty: 2 }]);
    await owner('PATCH', `/happy-hours/${hh.json().id}`, { active: false });

    const bill = (await counter('POST', `/tabs/${tabId}/provisional`)).json();
    const cupRows = bill.rows.filter((r: { name: string }) => r.name === 'Bia hơi cốc');
    expect(cupRows).toEqual([
      { name: 'Bia hơi cốc', qty: 92, unitPrice: 15000, amount: 1380000 },
      { name: 'Bia hơi cốc', qty: 2, unitPrice: 12000, amount: 24000 },
    ]);
  });
});

describe('FR-09: mở / đóng ca', () => {
  it('tổng hợp theo phương thức và chênh lệch tiền mặt; nhân viên quầy không đóng ca được', async () => {
    const opened = await counter('POST', '/shifts/open', { openingCash: 500000 });
    expect(opened.statusCode).toBe(201);
    expect((await counter('POST', '/shifts/open', { openingCash: 0 })).statusCode).toBe(409);

    const tabId = (await prisma.diningTable.findUniqueOrThrow({ where: { id: ids.tables[0]! } })).currentTabId!;
    await addRound(tabId, [{ itemId: ids.grill, qty: 1 }]);
    await counter('POST', `/tabs/${tabId}/pay`, { payments: [{ method: 'CASH', amount: 90000, tendered: 100000 }] });

    const shiftId = opened.json().id;
    expect((await counter('POST', `/shifts/${shiftId}/close`, { countedCash: 0 })).statusCode).toBe(403);
    const closed = await manager('POST', `/shifts/${shiftId}/close`, { countedCash: 580000 });
    expect(closed.statusCode).toBe(200);
    expect(closed.json().summary).toMatchObject({ cashTotal: 90000, transferTotal: 0, billCount: 1, expectedCash: 590000, difference: -10000 });
    expect((await manager('GET', '/shifts')).json().length).toBe(1);
  });
});

describe('FR-16 / FR-19: báo cáo', () => {
  it('dashboard khớp tổng tiền đã thu trong CSDL', async () => {
    const today = (await manager('GET', '/reports/today')).json();
    const sum = await prisma.payment.aggregate({ _sum: { amount: true } });
    expect(today.revenue).toBe(sum._sum.amount);
    expect(today.billCount).toBe(2);
    expect(today.occupiedTables).toBe(2);
    expect(today.totalTables).toBe(6);
  });

  it('top món trừ món đã hủy; giới hạn 31 ngày', async () => {
    const top = (await manager('GET', '/reports/top-items')).json();
    expect(top.rows[0]).toMatchObject({ name: 'Bia hơi cốc', qty: 4 + 6 + 92 - 1 + 1 + 2 });
    expect((await manager('GET', '/reports/top-items?from=2026-01-01&to=2026-03-01')).statusCode).toBe(400);
    const hourly = (await manager('GET', '/reports/hourly')).json();
    expect(hourly.rows).toHaveLength(24);
    const sum = await prisma.payment.aggregate({ _sum: { amount: true } });
    expect(hourly.rows.reduce((s: number, r: { revenue: number }) => s + r.revenue, 0)).toBe(sum._sum.amount);
  });
});

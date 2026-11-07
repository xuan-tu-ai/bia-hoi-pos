/**
 * Kiểm thử tích hợp theo tiêu chí nghiệm thu SRS mục 6.
 * CSDL kiểm thử được reset + seed (SRS 8.3) trước khi chạy.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const tokens: Record<string, string> = {};

async function login(email: string) {
  const res = await request(app).post('/api/auth/login').send({ email, password: '123456' });
  expect(res.status).toBe(200);
  return res.body.token as string;
}
const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
const api = {
  get: (who: string, url: string) => request(app).get(`/api${url}`).set(as(who)),
  post: (who: string, url: string, body: object = {}) => request(app).post(`/api${url}`).set(as(who)).send(body),
  patch: (who: string, url: string, body: object = {}) => request(app).patch(`/api${url}`).set(as(who)).send(body),
  delete: (who: string, url: string) => request(app).delete(`/api${url}`).set(as(who)),
};

async function tableId(code: string) {
  return (await prisma.diningTable.findUniqueOrThrow({ where: { code } })).id;
}
async function itemId(shortcut: string) {
  return (await prisma.menuItem.findUniqueOrThrow({ where: { shortcut } })).id;
}
/** Bàn trống bất kỳ (seed mở ngẫu nhiên 20 bàn). */
async function emptyTables(n: number) {
  const open = await prisma.tab.findMany({ where: { status: 'OPEN' }, select: { tableId: true } });
  const busy = new Set(open.map((t) => t.tableId));
  const all = await prisma.diningTable.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
  return all.filter((t) => !busy.has(t.id)).slice(0, n);
}

beforeAll(async () => {
  for (const u of ['lan', 'hung', 'hoa']) tokens[u] = await login(`${u}@biahoi.vn`);
});
afterAll(() => prisma.$disconnect());

describe('FR-01 Đăng nhập & phân quyền', () => {
  it('sai mật khẩu → thông báo đúng', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'lan@biahoi.vn', password: 'sai' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Email hoặc mật khẩu không đúng');
  });
  it('tài khoản bị khóa không đăng nhập được', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'khoa@biahoi.vn', password: '123456' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });
  it('không có token → 401; nhân viên quầy gọi API quản trị → 403', async () => {
    expect((await request(app).get('/api/tabs/summary')).status).toBe(401);
    const res = await api.get('lan', '/staff');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect((await api.get('hung', '/reports/keg-loss')).status).toBe(403);
    expect((await api.get('hung', '/reports/today')).status).toBe(200);
  });
  it('GET /auth/me trả người đang đăng nhập', async () => {
    const res = await api.get('lan', '/auth/me');
    expect(res.body).toMatchObject({ email: 'lan@biahoi.vn', role: 'COUNTER' });
  });
});

describe('FR-02 → FR-08 Luồng quầy', () => {
  it('sơ đồ bàn: 80 bàn, khoảng 20 bàn đang ngồi', async () => {
    const res = await api.get('lan', '/tabs/summary');
    expect(res.status).toBe(200);
    expect(res.body.totalTables).toBe(80);
    expect(res.body.occupied).toBe(20);
    expect(res.body.tables.filter((t: { status: string }) => t.status === 'PROVISIONAL_PRINTED').length).toBe(3);
  });

  it('hai máy mở cùng lúc một bàn → chỉ một phiên được tạo', async () => {
    const [t] = await emptyTables(1);
    const results = await Promise.all([1, 2, 3].map(() => api.post('lan', '/tabs', { tableId: t.id })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await prisma.tab.count({ where: { tableId: t.id, status: 'OPEN' } })).toBe(1);
  });

  it('kịch bản demo: mở bàn, gọi món, tách phiếu, hủy có PIN, chuyển, gộp, tạm tính, thanh toán', async () => {
    const [t15, t40, t41] = await emptyTables(3);

    // FR-03 mở bàn; máy thứ hai mở cùng bàn → 409 kèm tabId
    const open = await api.post('lan', '/tabs', { tableId: t15.id, guestCount: 4 });
    expect(open.status).toBe(201);
    const again = await api.post('hung', '/tabs', { tableId: t15.id });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatchObject({ code: 'TABLE_ALREADY_OPEN', message: 'Bàn đã được mở', details: { tabId: open.body.id } });

    // FR-04 gửi lượt 3 khu chế biến → 3 phiếu
    const [b, ngo, khoai] = await Promise.all([itemId('b'), itemId('ngo'), itemId('khoai')]);
    const round = await api.post('lan', `/tabs/${open.body.id}/rounds`, {
      items: [{ menuItemId: b, qty: 4 }, { menuItemId: ngo, qty: 1, note: 'ít cay' }, { menuItemId: khoai, qty: 1 }],
    });
    expect(round.status).toBe(201);
    expect(round.body.tickets.map((t: { stationName: string }) => t.stationName)).toEqual(['Quầy rót bia', 'Bếp nướng', 'Bếp chiên']);
    expect(round.body.tickets[1].lines).toEqual([{ name: 'Ngô nướng', qty: 1, note: 'ít cay' }]);

    // món "Hết món" không gửi được
    const out = await api.post('lan', `/tabs/${open.body.id}/rounds`, { items: [{ menuItemId: await itemId('daubap'), qty: 1 }] });
    expect(out.status).toBe(409);

    // đổi giá không ảnh hưởng lượt đã gửi
    await api.patch('hoa', `/menu-items/${khoai}`, { price: 45000 });
    let tab = (await api.get('lan', `/tabs/${open.body.id}`)).body;
    const khoaiLine = tab.rounds[0].lines.find((l: { menuItemId: number }) => l.menuItemId === khoai);
    expect(khoaiLine.unitPrice).toBe(39000);
    await api.patch('hoa', `/menu-items/${khoai}`, { price: 39000 });

    // FR-06 hủy 1 khoai: thiếu PIN / sai PIN / đúng PIN / vượt số lượng
    const voidUrl = `/order-lines/${khoaiLine.id}/void`;
    expect((await api.post('lan', voidUrl, { qty: 1, reason: 'CUSTOMER_CHANGED_MIND' })).body.error.code).toBe('PIN_REQUIRED');
    const wrong = await api.post('lan', voidUrl, { qty: 1, reason: 'CUSTOMER_CHANGED_MIND', approverPin: '0000' });
    expect(wrong.body.error).toMatchObject({ code: 'INVALID_PIN', message: 'PIN không đúng' });
    const ok = await api.post('lan', voidUrl, { qty: 1, reason: 'CUSTOMER_CHANGED_MIND', approverPin: '1234' });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ lineType: 'VOID', refLineId: khoaiLine.id, qty: -1, unitPrice: 39000 });
    expect((await api.post('hung', voidUrl, { qty: 1, reason: 'WRONG_ENTRY' })).body.error.code).toBe('QTY_EXCEEDED');
    expect((await api.post('hung', voidUrl, { qty: 1, reason: 'OTHER' })).status).toBe(400); // "Khác" phải có ghi chú

    // FR-05 chuyển sang bàn trống; chuyển vào bàn có khách bị chặn
    const moved = await api.post('lan', `/tabs/${open.body.id}/move`, { targetTableId: t40.id });
    expect(moved.status).toBe(200);
    const other = await api.post('lan', '/tabs', { tableId: t41.id });
    await api.post('lan', `/tabs/${other.body.id}/rounds`, { items: [{ menuItemId: await itemId('lac'), qty: 2 }] });
    expect((await api.post('lan', `/tabs/${other.body.id}/move`, { targetTableId: t40.id })).body.error.code).toBe('TABLE_NOT_EMPTY');

    // gộp bàn 41 vào bàn 40: tổng bàn đích = tổng hai bàn
    const before40 = (await api.get('lan', `/tabs/${open.body.id}`)).body.total;
    const before41 = (await api.get('lan', `/tabs/${other.body.id}`)).body.total;
    const merged = await api.post('lan', `/tabs/${other.body.id}/merge`, { targetTableId: t40.id });
    expect(merged.status).toBe(200);
    expect(merged.body.tabTotal).toBe(before40 + before41);
    // gộp vào bàn trống bị chặn
    const lone = await api.post('lan', '/tabs', { tableId: t41.id });
    expect((await api.post('lan', `/tabs/${lone.body.id}/merge`, { targetTableId: t15.id })).body.error.code).toBe('TABLE_EMPTY');

    // FR-07 tạm tính: số lần in tăng, món hủy không hiện, bàn chuyển vàng
    const p1 = await api.post('lan', `/tabs/${open.body.id}/provisional`);
    const p2 = await api.post('lan', `/tabs/${open.body.id}/provisional`);
    expect([p1.body.printNo, p2.body.printNo]).toEqual([1, 2]);
    expect(p2.body.lines.find((l: { name: string }) => l.name === 'Khoai tây chiên')).toBeUndefined();
    expect(p2.body.lines.find((l: { name: string }) => l.name.startsWith('Bia hơi cốc'))?.qty).toBe(4);
    const sum = (await api.get('lan', '/tabs/summary')).body;
    expect(sum.tables.find((t: { tableId: number }) => t.tableId === t40.id).status).toBe('PROVISIONAL_PRINTED');

    // FR-08 VietQR + thanh toán
    tab = (await api.get('lan', `/tabs/${open.body.id}`)).body;
    const qr = await api.get('lan', `/tabs/${open.body.id}/vietqr?amount=${tab.total}`);
    expect(qr.body.url).toContain(`amount=${tab.total}`);
    expect(qr.body.url).toContain('img.vietqr.io/image/MB-');
    const short = await api.post('lan', `/tabs/${open.body.id}/pay`, { payments: [{ method: 'CASH', amount: tab.total - 1000 }] });
    expect(short.body.error).toMatchObject({ code: 'INSUFFICIENT_PAYMENT', message: 'Số tiền nhận chưa đủ' });
    // giảm giá hóa đơn cần PIN với nhân viên quầy
    const noPin = await api.post('lan', `/tabs/${open.body.id}/pay`, {
      billDiscount: { type: 'PERCENT', value: 10 },
      payments: [{ method: 'CASH', amount: tab.total }],
    });
    expect(noPin.body.error.code).toBe('PIN_REQUIRED');
    const discount = Math.round(tab.total * 0.1);
    const due = tab.total - discount;
    const paid = await api.post('lan', `/tabs/${open.body.id}/pay`, {
      billDiscount: { type: 'PERCENT', value: 10 },
      approverPin: '1234',
      payments: [{ method: 'TRANSFER', amount: 50000 }, { method: 'CASH', amount: 500000 }],
    });
    expect(paid.status).toBe(200);
    expect(paid.body).toMatchObject({ subtotal: tab.total, discount, total: due, paid: 550000, change: 550000 - due });
    expect(paid.body.billNo).toMatch(/^HD-\d{8}-\d{4}$/);
    // hóa đơn đã thanh toán không sửa được; bàn về trống
    expect((await api.post('lan', `/tabs/${open.body.id}/rounds`, { items: [{ menuItemId: b, qty: 1 }] })).status).toBe(409);
    const after = (await api.get('lan', '/tabs/summary')).body;
    expect(after.tables.find((t: { tableId: number }) => t.tableId === t40.id).status).toBe('EMPTY');

    // FR-18: lần hủy và giảm giá hóa đơn có trong nhật ký
    const log = (await api.get('hoa', '/reports/voids')).body;
    expect(log.items.some((i: { type: string; itemName: string; approvedBy: { fullName: string } }) =>
      i.type === 'VOID' && i.itemName === 'Khoai tây chiên' && i.approvedBy.fullName === 'Lê Văn Hùng')).toBe(true);
    expect(log.items.some((i: { type: string; amount: number }) => i.type === 'BILL_DISCOUNT' && i.amount === discount)).toBe(true);
  });
});

describe('FR-10, FR-14, FR-17 Keg', () => {
  it('báo cáo hao hụt có keg 50 L bán 92 cốc → hao hụt 4 L = 8%, tô đỏ', async () => {
    const res = await api.get('hoa', '/reports/keg-loss?threshold=5');
    expect(res.status).toBe(200);
    const k = res.body.kegs.find((x: { soldMl: number; capacityMl: number }) => x.soldMl === 46000 && x.capacityMl === 50000);
    expect(k).toMatchObject({ lossMl: 4000, lossPercent: 8, overThreshold: true });
    // số lít đã bán khớp dữ liệu gốc: 92 cốc 0,5 L
    const cups = await prisma.orderLine.aggregate({ where: { kegId: k.kegId }, _sum: { qty: true } });
    expect(cups._sum.qty).toBe(92);
  });

  it('nhập 3 keg → 3 mã khác nhau; thay keg chỉ chọn keg trong kho; keg cũ vào báo cáo', async () => {
    const created = await api.post('hung', '/kegs', { beerName: 'Bia hơi Hà Nội', capacityMl: 50000, cost: 1500000, receivedAt: '2026-11-01', quantity: 3 });
    expect(created.status).toBe(201);
    expect(new Set(created.body.map((k: { code: string }) => k.code)).size).toBe(3);
    expect((await api.get('lan', '/kegs')).status).toBe(403);

    const taps = (await api.get('lan', '/taps')).body;
    const tap = taps.taps[0];
    const oldKegId = tap.currentKeg.id;
    expect((await api.post('lan', `/taps/${tap.id}/change-keg`, { kegId: oldKegId })).body.error.code).toBe('KEG_NOT_IN_STOCK');
    const changed = await api.post('lan', `/taps/${tap.id}/change-keg`, { kegId: created.body[0].id });
    expect(changed.status).toBe(200);
    const loss = (await api.get('hoa', '/reports/keg-loss')).body;
    expect(loss.kegs.some((k: { kegId: number }) => k.kegId === oldKegId)).toBe(true);
    const filtered = (await api.get('hoa', '/kegs?status=IN_STOCK')).body;
    expect(filtered.items.every((k: { status: string }) => k.status === 'IN_STOCK')).toBe(true);
  });
});

describe('FR-09 Ca', () => {
  it('không mở hai ca; chênh lệch = đếm − (đầu ca + tiền mặt)', async () => {
    const open = await api.post('lan', '/shifts/open', { openingCash: 1000000 });
    expect(open.status).toBe(201);
    expect((await api.post('hung', '/shifts/open', { openingCash: 0 })).body.error.code).toBe('SHIFT_ALREADY_OPEN');
    expect((await api.post('lan', `/shifts/${open.body.id}/close`, { countedCash: 0 })).status).toBe(403);
    const closed = await api.post('hung', `/shifts/${open.body.id}/close`, { countedCash: 1200000 });
    expect(closed.body.difference).toBe(1200000 - (1000000 + closed.body.cashSales));
  });
});

describe('FR-11 → FR-15 Quản trị', () => {
  it('mã tắt trùng → "Mã tắt đã tồn tại"', async () => {
    const groups = (await api.get('hoa', '/menu-groups')).body;
    const stations = (await api.get('hoa', '/kitchen-stations')).body;
    const res = await api.post('hoa', '/menu-items', { name: 'Trùng', shortcut: 'b', groupId: groups[0].id, price: 1000, unit: 'cốc', stationId: stations[0].id });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'DUPLICATE_SHORTCUT', message: 'Mã tắt đã tồn tại' });
  });

  it('không xóa bàn đang có khách; không xóa khu còn bàn', async () => {
    const busy = await prisma.tab.findFirstOrThrow({ where: { status: 'OPEN' } });
    const res = await api.delete('hoa', `/tables/${busy.tableId}`);
    expect(res.body.error).toMatchObject({ code: 'TABLE_NOT_EMPTY', message: 'Bàn đang có khách, không thể xóa' });
    const area = await prisma.area.findFirstOrThrow();
    expect((await api.delete('hoa', `/areas/${area.id}`)).body.error.code).toBe('AREA_NOT_EMPTY');
  });

  it('không tự khóa mình; không hạ quyền chủ quán cuối cùng; không trả mật khẩu/PIN', async () => {
    const list = (await api.get('hoa', '/staff')).body;
    const hoa = list.find((s: { email: string }) => s.email === 'hoa@biahoi.vn');
    expect(hoa.passwordHash).toBeUndefined();
    expect(hoa.pinHash).toBeUndefined();
    expect((await api.patch('hoa', `/staff/${hoa.id}`, { active: false })).body.error.code).toBe('CANNOT_LOCK_SELF');
    expect((await api.patch('hoa', `/staff/${hoa.id}`, { role: 'COUNTER' })).body.error.code).toBe('LAST_OWNER');
  });

  it('giờ vàng: gửi trong khung → giá ưu đãi; hai giá khác nhau → hóa đơn tách 2 dòng', async () => {
    const lac = await itemId('lac');
    const [t] = await emptyTables(1);
    const tab = (await api.post('lan', '/tabs', { tableId: t.id })).body;
    await api.post('lan', `/tabs/${tab.id}/rounds`, { items: [{ menuItemId: lac, qty: 1 }] });

    const hh = await api.post('hoa', '/happy-hours', {
      name: 'Test cả ngày', weekdays: [1, 2, 3, 4, 5, 6, 7], startTime: '00:00', endTime: '23:59',
      prices: [{ menuItemId: lac, price: 9000 }],
    });
    expect(hh.status).toBe(201);
    const menu = (await api.get('lan', '/menu')).body;
    expect(menu.flatMap((g: { items: unknown[] }) => g.items).find((i: { id: number }) => i.id === lac)).toMatchObject({ price: 9000, isHappyHour: true });

    await api.post('lan', `/tabs/${tab.id}/rounds`, { items: [{ menuItemId: lac, qty: 2 }] });
    const bill = (await api.post('lan', `/tabs/${tab.id}/provisional`)).body;
    const lacLines = bill.lines.filter((l: { name: string }) => l.name === 'Lạc rang');
    expect(lacLines.map((l: { unitPrice: number; qty: number }) => [l.unitPrice, l.qty])).toEqual([[15000, 1], [9000, 2]]);
    await api.delete('hoa', `/happy-hours/${hh.body.id}`);
  });
});

describe('FR-16, FR-19 Báo cáo', () => {
  it('doanh thu hôm nay khớp tổng hóa đơn đã thanh toán trong ngày', async () => {
    const res = (await api.get('hoa', '/reports/today')).body;
    const start = new Date(new Date().getTime() + 7 * 3600_000);
    start.setUTCHours(0, 0, 0, 0);
    const dayStart = new Date(start.getTime() - 7 * 3600_000);
    const paid = await prisma.tab.findMany({ where: { status: 'PAID', closedAt: { gte: dayStart } }, include: { rounds: { include: { lines: true } } } });
    const expected = paid.reduce((s, t) => s + t.rounds.flatMap((r) => r.lines).reduce((a, l) => a + l.qty * l.unitPrice, 0) - t.billDiscount, 0);
    expect(res.revenue.value).toBe(expected);
    expect(res.hourly).toHaveLength(24);
  });

  it('khoảng quá 31 ngày → lỗi; trong khoảng → top 10', async () => {
    const bad = await api.get('hoa', '/reports/top-items?from=2026-01-01&to=2026-03-01');
    expect(bad.body.error.code).toBe('RANGE_TOO_LARGE');
    const ok = await api.get('hoa', '/reports/top-items?by=revenue');
    expect(ok.status).toBe(200);
    expect(ok.body.items.length).toBeLessThanOrEqual(10);
    expect((await api.get('hoa', '/reports/hourly')).body.hours).toHaveLength(24);
  });
});

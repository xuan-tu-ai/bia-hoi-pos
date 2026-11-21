/**
 * BE-04: phiên bàn — sơ đồ bàn (FR-02), mở bàn (FR-03), gọi món (FR-04),
 * chuyển/gộp (FR-05), hủy/giảm món có duyệt (FR-06).
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, app, emptyTables, itemId, loginAll } from './helpers.js';

beforeAll(loginAll);
afterAll(() => prisma.$disconnect());

describe('FR-02 Sơ đồ bàn', () => {
  it('80 bàn, 20 bàn đang ngồi, 3 bàn đã in tạm tính', async () => {
    const res = await api.get('lan', '/tabs/summary');
    expect(res.status).toBe(200);
    expect(res.body.totalTables).toBe(80);
    expect(res.body.occupied).toBe(20);
    expect(res.body.tables.filter((t: { status: string }) => t.status === 'PROVISIONAL_PRINTED').length).toBe(3);
    const busy = res.body.tables.find((t: { status: string }) => t.status !== 'EMPTY');
    expect(busy).toMatchObject({ tabId: expect.any(Number), total: expect.any(Number), openedAt: expect.any(String) });
  });

  it('cần đăng nhập', async () => {
    expect((await request(app).get('/api/tabs/summary')).status).toBe(401);
  });
});

describe('FR-03 Mở phiên bàn', () => {
  it('hai máy mở cùng lúc một bàn → chỉ một phiên được tạo', async () => {
    const [t] = await emptyTables(1);
    const results = await Promise.all([1, 2, 3].map(() => api.post('lan', '/tabs', { tableId: t.id })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await prisma.tab.count({ where: { tableId: t.id, status: 'OPEN' } })).toBe(1);
  });

  it('mở bàn đã có khách → 409 kèm tabId của phiên đang mở', async () => {
    const [t] = await emptyTables(1);
    const open = await api.post('lan', '/tabs', { tableId: t.id, guestCount: 4 });
    expect(open.status).toBe(201);
    expect(open.body).toMatchObject({ tableId: t.id, guestCount: 4, status: 'OPEN' });
    const again = await api.post('hung', '/tabs', { tableId: t.id });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatchObject({ code: 'TABLE_ALREADY_OPEN', message: 'Bàn đã được mở', details: { tabId: open.body.id } });
  });
});

describe('FR-04 Gọi món & tách phiếu', () => {
  it('gửi lượt 3 khu chế biến → 3 phiếu; món hết không gửi được; đổi giá không ảnh hưởng lượt đã gửi', async () => {
    const [t] = await emptyTables(1);
    const tab = (await api.post('lan', '/tabs', { tableId: t.id })).body;
    const [b, ngo, khoai] = await Promise.all([itemId('b'), itemId('ngo'), itemId('khoai')]);

    const round = await api.post('lan', `/tabs/${tab.id}/rounds`, {
      items: [{ menuItemId: b, qty: 4 }, { menuItemId: ngo, qty: 1, note: 'ít cay' }, { menuItemId: khoai, qty: 1 }],
    });
    expect(round.status).toBe(201);
    expect(round.body.tickets.map((x: { stationName: string }) => x.stationName)).toEqual(['Quầy rót bia', 'Bếp nướng', 'Bếp chiên']);
    expect(round.body.tickets[1]).toMatchObject({ tableCode: t.code, lines: [{ name: 'Ngô nướng', qty: 1, note: 'ít cay' }] });

    const out = await api.post('lan', `/tabs/${tab.id}/rounds`, { items: [{ menuItemId: await itemId('daubap'), qty: 1 }] });
    expect(out.status).toBe(409);
    expect(out.body.error.code).toBe('ITEM_UNAVAILABLE');

    await api.patch('hoa', `/menu-items/${khoai}`, { price: 45000 });
    const detail = (await api.get('lan', `/tabs/${tab.id}`)).body;
    expect(detail.rounds[0].lines.find((l: { menuItemId: number }) => l.menuItemId === khoai).unitPrice).toBe(39000);
    await api.patch('hoa', `/menu-items/${khoai}`, { price: 39000 });

    // món bia hơi gắn với keg đang trên vòi mặc định (để tính hao hụt FR-17)
    const beer = await prisma.orderLine.findFirstOrThrow({ where: { roundId: round.body.round.id, menuItemId: b } });
    expect(beer.kegId).not.toBeNull();
    expect(detail.total).toBe(round.body.tabTotal);
  });
});

describe('FR-05 Chuyển / gộp bàn', () => {
  it('chuyển sang bàn trống; chuyển vào bàn có khách bị chặn; gộp → tổng bàn đích = tổng hai bàn; gộp vào bàn trống bị chặn', async () => {
    const [a, b, c] = await emptyTables(3);
    const tabA = (await api.post('lan', '/tabs', { tableId: a.id, guestCount: 2 })).body;
    await api.post('lan', `/tabs/${tabA.id}/rounds`, { items: [{ menuItemId: await itemId('b'), qty: 2 }] });

    const moved = await api.post('lan', `/tabs/${tabA.id}/move`, { targetTableId: b.id });
    expect(moved.status).toBe(200);
    expect((await api.get('lan', `/tabs/${tabA.id}`)).body.table.id).toBe(b.id);

    const tabC = (await api.post('lan', '/tabs', { tableId: c.id, guestCount: 3 })).body;
    await api.post('lan', `/tabs/${tabC.id}/rounds`, { items: [{ menuItemId: await itemId('lac'), qty: 2 }] });
    expect((await api.post('lan', `/tabs/${tabC.id}/move`, { targetTableId: b.id })).body.error.code).toBe('TABLE_NOT_EMPTY');

    const totalB = (await api.get('lan', `/tabs/${tabA.id}`)).body.total;
    const totalC = (await api.get('lan', `/tabs/${tabC.id}`)).body.total;
    const merged = await api.post('lan', `/tabs/${tabC.id}/merge`, { targetTableId: b.id });
    expect(merged.status).toBe(200);
    expect(merged.body.tabTotal).toBe(totalB + totalC);
    expect((await api.get('lan', `/tabs/${tabA.id}`)).body.guestCount).toBe(5);
    expect((await api.get('lan', `/tabs/${tabC.id}`)).body).toMatchObject({ status: 'MERGED', mergedIntoId: tabA.id });

    const lone = (await api.post('lan', '/tabs', { tableId: c.id })).body;
    expect((await api.post('lan', `/tabs/${lone.id}/merge`, { targetTableId: a.id })).body.error.code).toBe('TABLE_EMPTY');
  });
});

describe('FR-06 Hủy / giảm món đã gửi', () => {
  it('hủy: thiếu PIN / sai PIN bị chặn; đúng PIN → dòng âm; vượt số lượng bị chặn; "Khác" phải có ghi chú', async () => {
    const [t] = await emptyTables(1);
    const tab = (await api.post('lan', '/tabs', { tableId: t.id })).body;
    const khoai = await itemId('khoai');
    await api.post('lan', `/tabs/${tab.id}/rounds`, { items: [{ menuItemId: khoai, qty: 1 }] });
    const line = (await api.get('lan', `/tabs/${tab.id}`)).body.rounds[0].lines[0];

    const url = `/order-lines/${line.id}/void`;
    expect((await api.post('lan', url, { qty: 1, reason: 'CUSTOMER_CHANGED_MIND' })).body.error.code).toBe('PIN_REQUIRED');
    const wrong = await api.post('lan', url, { qty: 1, reason: 'CUSTOMER_CHANGED_MIND', approverPin: '0000' });
    expect(wrong.body.error).toMatchObject({ code: 'INVALID_PIN', message: 'PIN không đúng' });

    const ok = await api.post('lan', url, { qty: 1, reason: 'CUSTOMER_CHANGED_MIND', approverPin: '1234' });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ lineType: 'VOID', refLineId: line.id, qty: -1, unitPrice: 39000, tabTotal: 0 });
    const hung = await prisma.staff.findUniqueOrThrow({ where: { email: 'hung@biahoi.vn' } });
    expect(ok.body.approvedBy).toBe(hung.id);

    expect((await api.post('hung', url, { qty: 1, reason: 'WRONG_ENTRY' })).body.error.code).toBe('QTY_EXCEEDED');
    expect((await api.post('hung', url, { qty: 1, reason: 'OTHER' })).status).toBe(400);

    // dòng gốc không bị sửa (chỉ thêm, NFR-04)
    expect(await prisma.orderLine.findUniqueOrThrow({ where: { id: line.id } })).toMatchObject({ qty: 1, unitPrice: 39000 });
    expect(await prisma.auditLog.count({ where: { action: 'LINE_VOIDED', entityId: line.id } })).toBe(1);
  });

  it('giảm giá món: quản lý ca tự duyệt; giảm quá tiền còn lại bị chặn', async () => {
    const [t] = await emptyTables(1);
    const tab = (await api.post('lan', '/tabs', { tableId: t.id })).body;
    await api.post('lan', `/tabs/${tab.id}/rounds`, { items: [{ menuItemId: await itemId('khoai'), qty: 2 }] });
    const line = (await api.get('lan', `/tabs/${tab.id}`)).body.rounds[0].lines[0];

    const half = await api.post('hung', `/order-lines/${line.id}/discount`, { type: 'PERCENT', value: 50, reason: 'DEFECTIVE' });
    expect(half.status).toBe(201);
    expect(half.body).toMatchObject({ lineType: 'DISCOUNT', unitPrice: -39000, tabTotal: 39000 });

    const over = await api.post('hung', `/order-lines/${line.id}/discount`, { type: 'AMOUNT', value: 50000, reason: 'DEFECTIVE' });
    expect(over.body.error.code).toBe('DISCOUNT_EXCEEDED');
  });
});

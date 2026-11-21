/**
 * BE-05: tạm tính (FR-07), VietQR & thanh toán (FR-08), mở/đóng ca (FR-09).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, emptyTables, itemId, loginAll } from './helpers.js';

beforeAll(loginAll);
afterAll(() => prisma.$disconnect());

/** Mở một bàn trống và gửi một lượt: 4 cốc bia + 1 khoai (khoai bị hủy 1). */
async function openTabWithItems() {
  const [t] = await emptyTables(1);
  const tab = (await api.post('lan', '/tabs', { tableId: t.id, guestCount: 2 })).body;
  const [b, khoai] = await Promise.all([itemId('b'), itemId('khoai')]);
  await api.post('lan', `/tabs/${tab.id}/rounds`, { items: [{ menuItemId: b, qty: 4 }, { menuItemId: khoai, qty: 1 }] });
  const detail = (await api.get('lan', `/tabs/${tab.id}`)).body;
  const khoaiLine = detail.rounds[0].lines.find((l: { menuItemId: number }) => l.menuItemId === khoai);
  await api.post('hung', `/order-lines/${khoaiLine.id}/void`, { qty: 1, reason: 'CUSTOMER_CHANGED_MIND' });
  return { table: t, tabId: tab.id as number };
}

describe('FR-09 Ca', () => {
  it('chưa mở ca: sơ đồ bàn báo shift = null nhưng vẫn mở bàn, gọi món được', async () => {
    expect((await api.get('lan', '/shifts/current')).body).toBeNull();
    expect((await api.get('lan', '/tabs/summary')).body.shift).toBeNull();
    const { tabId } = await openTabWithItems();
    expect((await api.get('lan', `/tabs/${tabId}`)).body.total).toBeGreaterThan(0);
  });

  it('không mở hai ca; nhân viên quầy không đóng ca; chênh lệch = đếm − (đầu ca + tiền mặt)', async () => {
    const open = await api.post('lan', '/shifts/open', { openingCash: 1000000 });
    expect(open.status).toBe(201);
    expect((await api.get('lan', '/tabs/summary')).body.shift).toMatchObject({ id: open.body.id, openedBy: { fullName: expect.any(String) } });
    const again = await api.post('hung', '/shifts/open', { openingCash: 0 });
    expect(again.body.error).toMatchObject({ code: 'SHIFT_ALREADY_OPEN', details: { shiftId: open.body.id } });

    // thu trong ca: 1 hóa đơn trả tiền mặt
    const { tabId } = await openTabWithItems();
    const due = (await api.get('lan', `/tabs/${tabId}`)).body.total;
    await api.post('lan', `/tabs/${tabId}/pay`, { payments: [{ method: 'CASH', amount: due }] });

    expect((await api.post('lan', `/shifts/${open.body.id}/close`, { countedCash: 0 })).status).toBe(403);
    const closed = await api.post('hung', `/shifts/${open.body.id}/close`, { countedCash: 1200000 });
    expect(closed.status).toBe(200);
    expect(closed.body.cashSales).toBeGreaterThanOrEqual(due);
    expect(closed.body.difference).toBe(1200000 - (1000000 + closed.body.cashSales));
    expect((await api.post('hung', `/shifts/${open.body.id}/close`, { countedCash: 0 })).body.error.code).toBe('SHIFT_ALREADY_CLOSED');
    expect((await api.get('hung', '/shifts')).body[0].id).toBe(open.body.id);
  });
});

describe('FR-07 In tạm tính', () => {
  it('số lần in tăng dần, món đã hủy không hiện, bàn chuyển trạng thái đã in tạm tính', async () => {
    const { table, tabId } = await openTabWithItems();
    const p1 = await api.post('lan', `/tabs/${tabId}/provisional`);
    const p2 = await api.post('lan', `/tabs/${tabId}/provisional`);
    expect(p1.status).toBe(201);
    expect([p1.body.printNo, p2.body.printNo]).toEqual([1, 2]);
    expect(p2.body).toMatchObject({ kind: 'PROVISIONAL', tableCode: table.code });
    expect(p2.body.lines.find((l: { name: string }) => l.name === 'Khoai tây chiên')).toBeUndefined();
    expect(p2.body.lines.find((l: { name: string }) => l.name.startsWith('Bia hơi cốc'))?.qty).toBe(4);

    const sum = (await api.get('lan', '/tabs/summary')).body;
    expect(sum.tables.find((x: { tableId: number }) => x.tableId === table.id).status).toBe('PROVISIONAL_PRINTED');
  });
});

describe('FR-08 Thanh toán & VietQR', () => {
  it('VietQR có số tiền và nội dung BH<số hóa đơn>', async () => {
    const { tabId } = await openTabWithItems();
    const tab = (await api.get('lan', `/tabs/${tabId}`)).body;
    const qr = await api.get('lan', `/tabs/${tabId}/vietqr?amount=${tab.total}`);
    expect(qr.status).toBe(200);
    expect(qr.body.url).toContain('img.vietqr.io/image/MB-');
    expect(qr.body.url).toContain(`amount=${tab.total}`);
    expect(qr.body.url).toContain(`BH${tab.billNo.replace(/\D/g, '')}`);
  });

  it('thiếu tiền bị chặn; chuyển khoản vượt số phải trả bị chặn; giảm giá hóa đơn cần PIN với nhân viên quầy', async () => {
    const { tabId } = await openTabWithItems();
    const total = (await api.get('lan', `/tabs/${tabId}`)).body.total;

    const short = await api.post('lan', `/tabs/${tabId}/pay`, { payments: [{ method: 'CASH', amount: total - 1000 }] });
    expect(short.body.error).toMatchObject({ code: 'INSUFFICIENT_PAYMENT', message: 'Số tiền nhận chưa đủ' });

    const over = await api.post('lan', `/tabs/${tabId}/pay`, { payments: [{ method: 'TRANSFER', amount: total + 10000 }] });
    expect(over.body.error.code).toBe('OVERPAID_TRANSFER');

    const noPin = await api.post('lan', `/tabs/${tabId}/pay`, {
      billDiscount: { type: 'PERCENT', value: 10 },
      payments: [{ method: 'CASH', amount: total }],
    });
    expect(noPin.body.error.code).toBe('PIN_REQUIRED');
  });

  it('thanh toán kết hợp, giảm 10% có PIN → đúng tiền thừa, số hóa đơn; hóa đơn đã thanh toán không sửa được; bàn về trống', async () => {
    const { table, tabId } = await openTabWithItems();
    const subtotal = (await api.get('lan', `/tabs/${tabId}`)).body.total;
    const discount = Math.round(subtotal * 0.1);
    const due = subtotal - discount;

    const paid = await api.post('lan', `/tabs/${tabId}/pay`, {
      billDiscount: { type: 'PERCENT', value: 10, reason: 'OTHER', note: 'Khách quen' },
      approverPin: '1234',
      payments: [{ method: 'TRANSFER', amount: 20000 }, { method: 'CASH', amount: 200000 }],
    });
    expect(paid.status).toBe(200);
    expect(paid.body).toMatchObject({ subtotal, discount, total: due, paid: 220000, change: 220000 - due });
    expect(paid.body.billNo).toMatch(/^HD-\d{8}-\d{4}$/);

    const rows = await prisma.payment.findMany({ where: { tabId } });
    expect(rows.reduce((s, p) => s + p.amount, 0)).toBe(due);

    expect((await api.post('lan', `/tabs/${tabId}/rounds`, { items: [{ menuItemId: await itemId('b'), qty: 1 }] })).status).toBe(409);
    expect((await api.post('lan', `/tabs/${tabId}/pay`, { payments: [{ method: 'CASH', amount: due }] })).status).toBe(409);
    const after = (await api.get('lan', '/tabs/summary')).body;
    expect(after.tables.find((x: { tableId: number }) => x.tableId === table.id).status).toBe('EMPTY');
  });
});

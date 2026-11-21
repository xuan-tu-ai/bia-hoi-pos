/**
 * BE-06: vòi & thay keg (FR-10), nhập kho keg (FR-14), giá giờ vàng (FR-15).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, emptyTables, itemId, loginAll } from './helpers.js';

beforeAll(loginAll);
afterAll(() => prisma.$disconnect());

type Tap = { id: number; currentKeg: { id: number; capacityMl: number; soldMl: number; percent: number } | null };

describe('FR-14 Nhập kho keg', () => {
  it('nhập 3 keg → 3 mã khác nhau, trạng thái "Trong kho"; nhân viên quầy không xem được kho', async () => {
    const created = await api.post('hung', '/kegs', { beerName: 'Bia hơi Hà Nội', capacityMl: 50000, cost: 1500000, receivedAt: '2026-11-01', quantity: 3 });
    expect(created.status).toBe(201);
    expect(created.body).toHaveLength(3);
    expect(new Set(created.body.map((k: { code: string }) => k.code)).size).toBe(3);
    expect(created.body.every((k: { code: string; status: string }) => /^KEG-\d+$/.test(k.code) && k.status === 'IN_STOCK')).toBe(true);

    expect((await api.get('lan', '/kegs')).status).toBe(403);
    const inStock = (await api.get('hoa', '/kegs?status=IN_STOCK')).body;
    expect(inStock.items.every((k: { status: string }) => k.status === 'IN_STOCK')).toBe(true);
    expect(inStock.summary.inStock).toBeGreaterThanOrEqual(3);
  });

  it('dung tích chỉ 30 L hoặc 50 L', async () => {
    const res = await api.post('hung', '/kegs', { beerName: 'Bia', capacityMl: 40000, cost: 1, receivedAt: '2026-11-01', quantity: 1 });
    expect(res.status).toBe(400);
  });
});

describe('FR-10 Thay keg', () => {
  it('GET /taps: keg đang gắn, số ml đã bán, phần trăm; danh sách keg trong kho để chọn', async () => {
    const res = await api.get('lan', '/taps');
    expect(res.status).toBe(200);
    const tap = res.body.taps.find((t: Tap) => t.currentKeg);
    expect(tap.currentKeg).toMatchObject({ code: expect.any(String), soldMl: expect.any(Number), percent: expect.any(Number) });
    expect(res.body.inStockKegs.length).toBeGreaterThan(0);
  });

  it('chỉ chọn keg "Trong kho"; keg cũ bán dưới 90% phải xác nhận; xác nhận xong keg cũ hết, keg mới đang dùng', async () => {
    const { taps, inStockKegs } = (await api.get('lan', '/taps')).body;
    const tap: Tap = taps.find((t: Tap) => t.currentKeg && t.currentKeg.percent < 90);
    const oldKeg = tap.currentKeg!;
    const newKegId = inStockKegs[0].id;

    const notInStock = await api.post('lan', `/taps/${tap.id}/change-keg`, { kegId: oldKeg.id });
    expect(notInStock.body.error.code).toBe('KEG_NOT_IN_STOCK');

    const ask = await api.post('lan', `/taps/${tap.id}/change-keg`, { kegId: newKegId });
    expect(ask.status).toBe(409);
    expect(ask.body.error).toMatchObject({
      code: 'KEG_NOT_FINISHED',
      message: `Keg mới bán ${oldKeg.percent}%, chắc chắn thay?`,
      details: { kegId: oldKeg.id, percent: oldKeg.percent },
    });
    // bấm hủy → không thay gì
    expect((await prisma.tap.findUniqueOrThrow({ where: { id: tap.id } })).currentKegId).toBe(oldKeg.id);
    expect((await prisma.keg.findUniqueOrThrow({ where: { id: newKegId } })).status).toBe('IN_STOCK');

    const changed = await api.post('lan', `/taps/${tap.id}/change-keg`, { kegId: newKegId, confirm: true });
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ tapId: tap.id, emptiedKeg: { id: oldKeg.id, soldMl: oldKeg.soldMl }, tappedKeg: { id: newKegId } });
    expect(await prisma.keg.findUniqueOrThrow({ where: { id: oldKeg.id } })).toMatchObject({ status: 'EMPTY', soldMl: oldKeg.soldMl });
    expect(await prisma.keg.findUniqueOrThrow({ where: { id: newKegId } })).toMatchObject({ status: 'TAPPED', tapId: tap.id });

    // bia gửi sau khi thay được tính vào keg mới
    const beer = await prisma.menuItem.findFirstOrThrow({ where: { defaultTapId: tap.id, beerVolumeMl: { not: null } } });
    const [t] = await emptyTables(1);
    const tab = (await api.post('lan', '/tabs', { tableId: t.id })).body;
    const round = await api.post('lan', `/tabs/${tab.id}/rounds`, { items: [{ menuItemId: beer.id, qty: 2 }] });
    const line = await prisma.orderLine.findFirstOrThrow({ where: { roundId: round.body.round.id } });
    expect(line.kegId).toBe(newKegId);
    expect((await api.get('lan', '/taps')).body.taps.find((x: Tap) => x.id === tap.id).currentKeg.soldMl).toBe(2 * beer.beerVolumeMl!);
  });
});

describe('FR-15 Giá giờ vàng', () => {
  it('chỉ chủ quán quản lý khung giờ vàng', async () => {
    expect((await api.get('lan', '/happy-hours')).status).toBe(403);
    expect((await api.get('hung', '/happy-hours')).status).toBe(403);
    expect((await api.get('hoa', '/happy-hours')).status).toBe(200);
  });

  it('gửi trong khung → giá ưu đãi; hai giá khác nhau → hóa đơn tách 2 dòng; nhiều khung trùng → lấy giá thấp nhất; giảm giá trừ thêm trên giá đã chốt', async () => {
    const lac = await itemId('lac');
    const [t] = await emptyTables(1);
    const tab = (await api.post('lan', '/tabs', { tableId: t.id })).body;
    await api.post('lan', `/tabs/${tab.id}/rounds`, { items: [{ menuItemId: lac, qty: 1 }] });

    const allDay = { weekdays: [1, 2, 3, 4, 5, 6, 7], startTime: '00:00', endTime: '23:59' };
    const hh1 = await api.post('hoa', '/happy-hours', { ...allDay, name: 'Test 1', prices: [{ menuItemId: lac, price: 9000 }] });
    const hh2 = await api.post('hoa', '/happy-hours', { ...allDay, name: 'Test 2', prices: [{ menuItemId: lac, price: 12000 }] });
    expect([hh1.status, hh2.status]).toEqual([201, 201]);
    try {
      const menu = (await api.get('lan', '/menu')).body;
      const item = menu.flatMap((g: { items: unknown[] }) => g.items).find((i: { id: number }) => i.id === lac);
      expect(item).toMatchObject({ price: 9000, regularPrice: 15000, isHappyHour: true });

      await api.post('lan', `/tabs/${tab.id}/rounds`, { items: [{ menuItemId: lac, qty: 2 }] });
      const bill = (await api.post('lan', `/tabs/${tab.id}/provisional`)).body;
      const lacLines = bill.lines.filter((l: { name: string }) => l.name === 'Lạc rang');
      expect(lacLines.map((l: { unitPrice: number; qty: number }) => [l.unitPrice, l.qty])).toEqual([[15000, 1], [9000, 2]]);

      const happyLine = (await api.get('lan', `/tabs/${tab.id}`)).body.rounds[1].lines[0];
      const disc = await api.post('hung', `/order-lines/${happyLine.id}/discount`, { type: 'PERCENT', value: 50, reason: 'OTHER', note: 'Khách quen' });
      expect(disc.body.unitPrice).toBe(-9000);
    } finally {
      await api.delete('hoa', `/happy-hours/${hh1.body.id}`);
      await api.delete('hoa', `/happy-hours/${hh2.body.id}`);
    }
    const after = (await api.get('lan', '/menu')).body.flatMap((g: { items: unknown[] }) => g.items).find((i: { id: number }) => i.id === lac);
    expect(after).toMatchObject({ price: 15000, isHappyHour: false });
  });
});

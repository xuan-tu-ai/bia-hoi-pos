/**
 * BE-03: API danh mục — khu & bàn (FR-12), thực đơn (FR-04, FR-11), nhân viên (FR-13).
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, app, loginAll } from './helpers.js';

beforeAll(loginAll);
afterAll(() => prisma.$disconnect());

const lastAudit = () => prisma.auditLog.findFirstOrThrow({ orderBy: { id: 'desc' } });

describe('FR-12 Khu & bàn', () => {
  it('mọi vai trò xem được sơ đồ khu kèm bàn', async () => {
    const res = await api.get('lan', '/areas?include=tables');
    expect(res.status).toBe(200);
    const tables = res.body.flatMap((a: { tables: unknown[] }) => a.tables);
    expect(tables).toHaveLength(80);
  });

  it('chỉ chủ quán thêm/sửa/xóa khu và bàn', async () => {
    expect((await api.post('lan', '/areas', { name: 'Sân sau' })).status).toBe(403);
    expect((await api.post('hung', '/areas', { name: 'Sân sau' })).status).toBe(403);
    expect((await api.delete('hung', '/tables/1')).status).toBe(403);
  });

  it('thêm khu, thêm bàn, trùng số bàn bị chặn, xóa bàn rồi xóa khu; mỗi thao tác ghi nhật ký', async () => {
    const area = await api.post('hoa', '/areas', { name: 'Sân sau', sortOrder: 9 });
    expect(area.status).toBe(201);
    expect((await lastAudit()).action).toBe('AREA_CREATED');

    const renamed = await api.patch('hoa', `/areas/${area.body.id}`, { name: 'Sân sau mới' });
    expect(renamed.body.name).toBe('Sân sau mới');

    const table = await api.post('hoa', '/tables', { areaId: area.body.id, code: 'S01' });
    expect(table.status).toBe(201);
    const dup = await api.post('hoa', '/tables', { areaId: area.body.id, code: 'S01' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toMatchObject({ code: 'DUPLICATE_TABLE_CODE', message: 'Bàn "S01" đã tồn tại' });

    expect((await api.delete('hoa', `/areas/${area.body.id}`)).body.error.code).toBe('AREA_NOT_EMPTY');
    expect((await api.delete('hoa', `/tables/${table.body.id}`)).status).toBe(204);
    expect((await api.delete('hoa', `/areas/${area.body.id}`)).status).toBe(204);
    expect((await lastAudit()).action).toBe('AREA_DELETED');
  });

  it('không xóa bàn đang có khách; không xóa khu còn bàn', async () => {
    const busy = await prisma.tab.findFirstOrThrow({ where: { status: 'OPEN' } });
    const res = await api.delete('hoa', `/tables/${busy.tableId}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'TABLE_NOT_EMPTY', message: 'Bàn đang có khách, không thể xóa' });
    const area = await prisma.area.findFirstOrThrow();
    expect((await api.delete('hoa', `/areas/${area.id}`)).body.error.code).toBe('AREA_NOT_EMPTY');
  });
});

describe('FR-04, FR-11 Thực đơn', () => {
  it('GET /menu cho mọi vai trò: món đang bán theo nhóm, có giá và khu chế biến', async () => {
    const res = await api.get('lan', '/menu');
    expect(res.status).toBe(200);
    const items = res.body.flatMap((g: { items: unknown[] }) => g.items);
    expect(items.length).toBeGreaterThan(0);
    expect(items.find((i: { shortcut: string }) => i.shortcut === 'b')).toMatchObject({
      price: expect.any(Number),
      regularPrice: expect.any(Number),
      isHappyHour: expect.any(Boolean),
      stationName: 'Quầy rót bia',
      beerVolumeMl: 500,
    });
  });

  it('API quản trị thực đơn chỉ cho chủ quán', async () => {
    for (const url of ['/menu-groups', '/menu-items', '/kitchen-stations']) {
      expect((await api.get('lan', url)).status).toBe(403);
      expect((await api.get('hung', url)).status).toBe(403);
      expect((await api.get('hoa', url)).status).toBe(200);
    }
  });

  it('thêm nhóm, khu chế biến, món; sửa giá và hết món hiện ngay ở /menu', async () => {
    const group = await api.post('hoa', '/menu-groups', { name: 'Món thử' });
    const station = await api.post('hoa', '/kitchen-stations', { name: 'Bếp thử' });
    expect([group.status, station.status]).toEqual([201, 201]);

    const item = await api.post('hoa', '/menu-items', {
      name: 'Nem chua rán', shortcut: 'NemThu', groupId: group.body.id, price: 35000, unit: 'đĩa', stationId: station.body.id,
    });
    expect(item.status).toBe(201);
    expect(item.body.shortcut).toBe('nemthu');

    await api.patch('hoa', `/menu-items/${item.body.id}`, { price: 40000, available: false });
    const menu = (await api.get('lan', '/menu')).body;
    const found = menu.flatMap((g: { items: unknown[] }) => g.items).find((i: { id: number }) => i.id === item.body.id);
    expect(found).toMatchObject({ price: 40000, available: false, stationName: 'Bếp thử' });

    await api.patch('hoa', `/menu-items/${item.body.id}`, { active: false });
    const after = (await api.get('lan', '/menu')).body.flatMap((g: { items: unknown[] }) => g.items);
    expect(after.some((i: { id: number }) => i.id === item.body.id)).toBe(false);
  });

  it('mã tắt trùng → "Mã tắt đã tồn tại"; món bia hơi phải có vòi mặc định', async () => {
    const groups = (await api.get('hoa', '/menu-groups')).body;
    const stations = (await api.get('hoa', '/kitchen-stations')).body;
    const base = { groupId: groups[0].id, price: 1000, unit: 'cốc', stationId: stations[0].id };

    const dup = await api.post('hoa', '/menu-items', { ...base, name: 'Trùng', shortcut: 'b' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toMatchObject({ code: 'DUPLICATE_SHORTCUT', message: 'Mã tắt đã tồn tại' });

    const beer = await api.post('hoa', '/menu-items', { ...base, name: 'Bia thử', shortcut: 'biathu', beerVolumeMl: 500 });
    expect(beer.status).toBe(400);
    expect(beer.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('FR-13 Nhân viên', () => {
  it('chỉ chủ quán quản lý nhân viên; danh sách không trả mật khẩu/PIN', async () => {
    expect((await api.get('lan', '/staff')).status).toBe(403);
    expect((await api.get('hung', '/staff')).status).toBe(403);
    const list = (await api.get('hoa', '/staff')).body;
    expect(list.length).toBeGreaterThanOrEqual(5);
    for (const s of list) {
      expect(s.passwordHash).toBeUndefined();
      expect(s.pinHash).toBeUndefined();
    }
  });

  it('thêm quản lý ca có PIN → đăng nhập được; email trùng bị chặn; khóa tài khoản → không đăng nhập được', async () => {
    const created = await api.post('hoa', '/staff', {
      fullName: 'Ngô Thị Mai', email: 'mai@biahoi.vn', password: 'mai123', role: 'SHIFT_MANAGER', pin: '5678',
    });
    expect(created.status).toBe(201);
    expect(created.body.passwordHash).toBeUndefined();

    const login = await request(app).post('/api/auth/login').send({ email: 'mai@biahoi.vn', password: 'mai123' });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('SHIFT_MANAGER');

    const dup = await api.post('hoa', '/staff', { fullName: 'Mai 2', email: 'mai@biahoi.vn', password: '123456', role: 'COUNTER' });
    expect(dup.body.error.code).toBe('DUPLICATE_EMAIL');

    await api.patch('hoa', `/staff/${created.body.id}`, { active: false });
    const locked = await request(app).post('/api/auth/login').send({ email: 'mai@biahoi.vn', password: 'mai123' });
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('không tự khóa mình; không hạ quyền chủ quán cuối cùng', async () => {
    const hoa = (await api.get('hoa', '/staff')).body.find((s: { email: string }) => s.email === 'hoa@biahoi.vn');
    expect((await api.patch('hoa', `/staff/${hoa.id}`, { active: false })).body.error.code).toBe('CANNOT_LOCK_SELF');
    expect((await api.patch('hoa', `/staff/${hoa.id}`, { role: 'COUNTER' })).body.error.code).toBe('LAST_OWNER');
  });
});

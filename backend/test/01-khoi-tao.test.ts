/**
 * BE-01: server chạy được, lỗi trả đúng định dạng SRS 7.1, seed đủ dữ liệu SRS 8.3.
 */
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createOriginMatcher } from '../src/lib/cors-origin.js';

const app = createApp();
afterAll(() => prisma.$disconnect());

describe('Khởi tạo server', () => {
  it('GET /health → ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('đường dẫn không tồn tại → 404 theo định dạng lỗi chung', async () => {
    const res = await request(app).get('/khong-co');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy API' } });
  });

  it('body không phải JSON hợp lệ → 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/khong-co').set('Content-Type', 'application/json').send('{sai');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('CORS cho frontend triển khai (BE-08)', () => {
  const allow = createOriginMatcher([
    'http://localhost:5173',
    'https://bia-hoi.vercel.app/',
    'https://bia-hoi-*.vercel.app',
  ]);

  it('cho phép đúng địa chỉ đã khai báo (bỏ qua "/" cuối và hoa thường)', () => {
    expect(allow('http://localhost:5173')).toBe(true);
    expect(allow('https://bia-hoi.vercel.app')).toBe(true);
    expect(allow('https://BIA-HOI.vercel.app')).toBe(true);
  });

  it('"*" khớp bản preview của Vercel nhưng không khớp tên miền khác', () => {
    expect(allow('https://bia-hoi-git-feature-abc-team.vercel.app')).toBe(true);
    expect(allow('https://bia-hoi-x.vercel.app.evil.com')).toBe(false);
    expect(allow('https://bia-hoi-a.b.vercel.app')).toBe(false);
    expect(allow('http://bia-hoi-abc.vercel.app')).toBe(false);
  });

  it('chặn địa chỉ lạ, cho qua request không có Origin', () => {
    expect(allow('https://evil.com')).toBe(false);
    expect(allow(undefined)).toBe(true);
  });

  it('server trả header CORS cho origin hợp lệ và không trả cho origin lạ', async () => {
    const ok = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const bad = await request(app).get('/health').set('Origin', 'https://evil.com');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Dữ liệu mẫu (SRS 8.3)', () => {
  it('80 bàn, 20 bàn đang có khách', async () => {
    expect(await prisma.diningTable.count()).toBe(80);
    expect(await prisma.tab.count({ where: { status: 'OPEN' } })).toBe(20);
  });

  it('đủ tài khoản mẫu theo từng vai trò', async () => {
    const staff = await prisma.staff.findMany({ select: { email: true, role: true, active: true } });
    expect(staff).toEqual(
      expect.arrayContaining([
        { email: 'lan@biahoi.vn', role: 'COUNTER', active: true },
        { email: 'hung@biahoi.vn', role: 'SHIFT_MANAGER', active: true },
        { email: 'hoa@biahoi.vn', role: 'OWNER', active: true },
        expect.objectContaining({ email: 'khoa@biahoi.vn', active: false }),
      ]),
    );
  });

  it('có thực đơn, khu chế biến, vòi bia và lịch sử hóa đơn để làm báo cáo', async () => {
    const [items, stations, taps, paid] = await Promise.all([
      prisma.menuItem.count(),
      prisma.kitchenStation.count(),
      prisma.tap.count(),
      prisma.tab.count({ where: { status: 'PAID' } }),
    ]);
    expect(items).toBeGreaterThan(0);
    expect(stations).toBeGreaterThanOrEqual(3);
    expect(taps).toBeGreaterThan(0);
    expect(paid).toBeGreaterThan(0);
  });
});

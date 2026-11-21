/**
 * BE-02 / FR-01: đăng nhập, JWT, kiểm tra vai trò, xác minh PIN.
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { resolveApprover } from '../src/lib/approval.js';
import { authenticate } from '../src/middlewares/auth.js';
import { errorHandler } from '../src/middlewares/error-handler.js';
import { OWNER, requireRole } from '../src/middlewares/require-role.js';
import { api, app, loginAll, tokens } from './helpers.js';

beforeAll(loginAll);
afterAll(() => prisma.$disconnect());

describe('FR-01 Đăng nhập', () => {
  it('đúng email, mật khẩu → token và thông tin người dùng, không lộ mật khẩu/PIN', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'HOA@biahoi.vn', password: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: expect.any(Number), fullName: expect.any(String), email: 'hoa@biahoi.vn', role: 'OWNER' });
  });

  it('sai mật khẩu và email không tồn tại → cùng một thông báo', async () => {
    for (const body of [
      { email: 'lan@biahoi.vn', password: 'sai' },
      { email: 'khong-co@biahoi.vn', password: '123456' },
    ]) {
      const res = await request(app).post('/api/auth/login').send(body);
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({ code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng' });
    }
  });

  it('tài khoản bị khóa không đăng nhập được', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'khoa@biahoi.vn', password: '123456' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('thiếu trường → 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'lan@biahoi.vn' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /auth/me trả người đang đăng nhập', async () => {
    const res = await api.get('lan', '/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: 'lan@biahoi.vn', role: 'COUNTER' });
  });
});

describe('NFR-05 Token', () => {
  it('không có token, token sai, token hết hạn → 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc')).status).toBe(401);
    const expired = jwt.sign({ role: 'OWNER' }, env.JWT_SECRET, { subject: '1', expiresIn: -10 });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('API khác ngoài đăng nhập đều cần token', async () => {
    expect((await request(app).get('/api/staff')).status).toBe(401);
    expect((await api.get('lan', '/khong-co')).status).toBe(404);
  });

  it('tài khoản bị khóa sau khi đăng nhập → token cũ không dùng được nữa', async () => {
    const lan = await prisma.staff.findUniqueOrThrow({ where: { email: 'lan@biahoi.vn' } });
    await prisma.staff.update({ where: { id: lan.id }, data: { active: false } });
    try {
      expect((await api.get('lan', '/auth/me')).status).toBe(401);
    } finally {
      await prisma.staff.update({ where: { id: lan.id }, data: { active: true } });
    }
  });
});

describe('Phân quyền theo vai trò (SRS 2.2)', () => {
  // API thật cho chủ quán có từ BE-03; ở đây kiểm tra middleware trên một route thử.
  const guarded = express();
  guarded.get('/owner-only', authenticate, requireRole(...OWNER), (_req, res) => {
    res.json({ ok: true });
  });
  guarded.use(errorHandler);

  it('nhân viên quầy, quản lý ca → 403 FORBIDDEN; chủ quán → 200', async () => {
    for (const who of ['lan', 'hung']) {
      const res = await request(guarded).get('/owner-only').set('Authorization', `Bearer ${tokens[who]}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toEqual({ code: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này' });
    }
    expect((await request(guarded).get('/owner-only').set('Authorization', `Bearer ${tokens.hoa}`)).status).toBe(200);
  });
});

describe('Xác minh PIN người duyệt (FR-06)', () => {
  const user = async (email: string) => prisma.staff.findUniqueOrThrow({ where: { email } });

  it('quản lý ca, chủ quán tự duyệt, không cần PIN', async () => {
    const hung = await user('hung@biahoi.vn');
    expect(await resolveApprover(prisma, hung, undefined)).toBe(hung.id);
  });

  it('nhân viên quầy: thiếu PIN / sai PIN bị chặn; PIN của quản lý ca hoặc chủ quán → người duyệt tương ứng', async () => {
    const [lan, hung, hoa] = await Promise.all(['lan', 'hung', 'hoa'].map((u) => user(`${u}@biahoi.vn`)));
    await expect(resolveApprover(prisma, lan, undefined)).rejects.toMatchObject({ code: 'PIN_REQUIRED' });
    await expect(resolveApprover(prisma, lan, '0000')).rejects.toMatchObject({ code: 'INVALID_PIN', message: 'PIN không đúng' });
    expect(await resolveApprover(prisma, lan, '1234')).toBe(hung.id);
    expect(await resolveApprover(prisma, lan, '9999')).toBe(hoa.id);
  });
});

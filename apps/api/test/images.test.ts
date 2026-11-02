// Ảnh món (FR-11): chủ quán tải ảnh lên, ai cũng xem được qua /uploads, nhân viên quầy không sửa được.

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { buildApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

let app: FastifyInstance;
let ownerToken: string;
let counterToken: string;
let itemId: number;

const png = () => {
  const c = createCanvas(40, 30);
  const g = c.getContext('2d');
  g.fillStyle = '#b45309';
  g.fillRect(0, 0, 40, 30);
  return c.toBuffer('image/png');
};
const put = (token: string, body: Buffer, type = 'image/png') =>
  app.inject({ method: 'PUT', url: `/menu-items/${itemId}/image`, payload: body, headers: { authorization: `Bearer ${token}`, 'content-type': type } });

beforeAll(async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE audit_log, bill_print, payment, bill_discount, order_line, order_round, tab,
      shift, happy_hour_price, happy_hour, menu_item, menu_group, print_station,
      dining_table, area, keg, tap, staff RESTART IDENTITY CASCADE`);
  await prisma.staff.createMany({
    data: [
      { name: 'Quầy A', role: 'COUNTER', pinHash: await bcrypt.hash('1111', 4) },
      { name: 'Chủ C', role: 'OWNER', pinHash: await bcrypt.hash('9999', 4), email: 'chu@test.vn', passwordHash: await bcrypt.hash('matkhau123', 4) },
    ],
  });
  const group = await prisma.menuGroup.create({ data: { name: 'Đồ nướng' } });
  itemId = (await prisma.menuItem.create({ data: { groupId: group.id, name: 'Sườn nướng', price: 90000, unit: 'đĩa' } })).id;

  app = await buildApp({ logger: false });
  counterToken = (await app.inject({ method: 'POST', url: '/auth/pin', payload: { pin: '1111' }, headers: { 'x-device-key': 'img-test' } })).json().token;
  ownerToken = (await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'chu@test.vn', password: 'matkhau123' } })).json().token;
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('ảnh món', () => {
  it('chủ quán tải ảnh lên, ảnh phục vụ không cần đăng nhập và lưu đệm được', async () => {
    const res = await put(ownerToken, png());
    expect(res.statusCode).toBe(200);
    const file = res.json().imageFile as string;
    expect(file).toMatch(/^mon-\d+-[0-9a-f]{8}\.png$/);

    const img = await app.inject({ method: 'GET', url: `/uploads/${file}` });
    expect(img.statusCode).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(img.headers['cache-control']).toContain('immutable');
    expect(img.rawPayload.equals(png())).toBe(true);
  });

  it('đổi ảnh thì tệp cũ bị xóa; bỏ ảnh thì món không còn ảnh', async () => {
    const old = (await prisma.menuItem.findUniqueOrThrow({ where: { id: itemId } })).imageFile!;
    const next = (await put(ownerToken, png())).json().imageFile;
    expect(next).not.toBe(old);
    expect((await app.inject({ method: 'GET', url: `/uploads/${old}` })).statusCode).toBe(404);

    const del = await app.inject({ method: 'DELETE', url: `/menu-items/${itemId}/image`, headers: { authorization: `Bearer ${ownerToken}` } });
    expect(del.json().imageFile).toBeNull();
    expect((await app.inject({ method: 'GET', url: `/uploads/${next}` })).statusCode).toBe(404);
  });

  it('tệp không phải ảnh bị từ chối dù khai content-type là ảnh', async () => {
    const res = await put(ownerToken, Buffer.from('<script>alert(1)</script>'), 'image/jpeg');
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('NOT_AN_IMAGE');
  });

  it('ảnh quá 2 MB bị từ chối', async () => {
    const big = Buffer.concat([png(), Buffer.alloc(2 * 1024 * 1024)]);
    expect((await put(ownerToken, big)).statusCode).toBe(413);
  });

  it('nhân viên quầy không được đổi ảnh', async () => {
    expect((await put(counterToken, png())).statusCode).toBe(403);
  });

  it('tên tệp lạ (đường dẫn ../) không đọc được tệp ngoài thư mục ảnh', async () => {
    for (const name of ['..%2F..%2Fpackage.json', '..%5Cpackage.json', 'package.json']) {
      expect((await app.inject({ method: 'GET', url: `/uploads/${name}` })).statusCode).toBe(404);
    }
  });
});

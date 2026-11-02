// FR-20: thông báo đẩy khi hủy/giảm vượt 200.000 đ. Phần gửi thật được thay bằng bản ghi lại.

import bcrypt from 'bcryptjs';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { setPushSender } from '../src/lib/push';

let app: FastifyInstance;
type Call = (method: InjectOptions['method'], url: string, payload?: object) => Promise<LightMyRequestResponse>;
let owner: Call;
let counter: Call;
let tabId: number;
let lauId: number;
let lacId: number;

const sent: { endpoint: string; payload: { title: string; body: string; url: string } }[] = [];

const client =
  (token: string): Call =>
  (method, url, payload) =>
    app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } } as InjectOptions);

async function approval(): Promise<string> {
  return (await counter('POST', '/auth/approve', { pin: '8888' })).json().approvalToken;
}

async function addLine(itemId: number): Promise<number> {
  const round = (await counter('POST', `/tabs/${tabId}/rounds`, { items: [{ itemId, qty: 1 }] })).json().round;
  const detail = (await counter('GET', `/tabs/${tabId}`)).json();
  return detail.rounds.find((r: { id: number }) => r.id === round.id).lines[0].id;
}

beforeAll(async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE audit_log, bill_print, payment, bill_discount, order_line, order_round, tab,
      shift, happy_hour_price, happy_hour, menu_item, menu_group, print_station,
      dining_table, area, keg, tap, staff RESTART IDENTITY CASCADE`);
  const hash = (s: string) => bcrypt.hash(s, 4);
  await prisma.staff.createMany({
    data: [
      { name: 'Quầy A', role: 'COUNTER', pinHash: await hash('1111') },
      { name: 'Quản lý B', role: 'SHIFT_MANAGER', pinHash: await hash('8888') },
      { name: 'Chủ C', role: 'OWNER', pinHash: await hash('9999'), email: 'chu@test.vn', passwordHash: await hash('matkhau123') },
    ],
  });
  const area = await prisma.area.create({ data: { name: 'Sân' } });
  const table = await prisma.diningTable.create({ data: { areaId: area.id, code: 'S12' } });
  const group = await prisma.menuGroup.create({ data: { name: 'Món' } });
  lauId = (await prisma.menuItem.create({ data: { groupId: group.id, name: 'Lẩu riêu cua', price: 250000, unit: 'nồi' } })).id;
  lacId = (await prisma.menuItem.create({ data: { groupId: group.id, name: 'Lạc rang', price: 20000, unit: 'đĩa' } })).id;

  setPushSender(async (sub, payload) => {
    if (sub.endpoint.includes('da-go-cai-dat')) throw Object.assign(new Error('Gone'), { statusCode: 410 });
    sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
  });

  app = await buildApp({ logger: false });
  const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'chu@test.vn', password: 'matkhau123' } });
  owner = client(login.json().token);
  const pin = await app.inject({ method: 'POST', url: '/auth/pin', payload: { pin: '1111' }, headers: { 'x-device-key': 'push-test' } });
  counter = client(pin.json().token);
  tabId = (await counter('POST', '/tabs', { tableId: table.id })).json().tab.id;
});

afterAll(async () => {
  setPushSender(null);
  await app?.close();
  await prisma.$disconnect();
});

describe('FR-20: thông báo đẩy khi hủy/giảm lớn', () => {
  it('chỉ chủ quán đăng ký được; có khóa công khai và ngưỡng', async () => {
    expect((await counter('GET', '/push/public-key')).statusCode).toBe(403);
    const res = await owner('GET', '/push/public-key');
    expect(res.statusCode).toBe(200);
    expect(res.json().publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    expect(res.json().threshold).toBe(200000);
    // khóa giữ nguyên giữa các lần gọi (đổi khóa làm hỏng đăng ký cũ)
    expect((await owner('GET', '/push/public-key')).json().publicKey).toBe(res.json().publicKey);
  });

  it('đăng ký hai thiết bị, một máy đã gỡ cài đặt', async () => {
    const keys = { p256dh: 'BOr' + 'a'.repeat(84), auth: 'x'.repeat(22) };
    expect((await owner('POST', '/push/subscribe', { endpoint: 'https://push.example/dien-thoai-chu-quan', keys })).statusCode).toBe(201);
    expect((await owner('POST', '/push/subscribe', { endpoint: 'https://push.example/da-go-cai-dat', keys })).statusCode).toBe(201);
    expect((await counter('POST', '/push/subscribe', { endpoint: 'https://push.example/quay', keys })).statusCode).toBe(403);
    expect(await prisma.pushSubscription.count()).toBe(2);
  });

  it('hủy món 250.000 đ → báo cho chủ quán; máy đã gỡ bị xóa khỏi danh sách', async () => {
    const lineId = await addLine(lauId);
    const res = await counter('POST', `/lines/${lineId}/void`, { qty: 1, reason: 'NHAP_NHAM', approvalToken: await approval() });
    expect(res.statusCode).toBe(201);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      endpoint: 'https://push.example/dien-thoai-chu-quan',
      payload: {
        title: 'Hủy món 250.000 đ',
        body: 'Lẩu riêu cua ×1 · bàn S12 · Nhập nhầm. Quầy A yêu cầu, Quản lý B duyệt.',
        url: '/nhat-ky-huy',
      },
    });
    await vi.waitFor(async () => expect(await prisma.pushSubscription.count()).toBe(1));
  });

  it('hủy dưới ngưỡng và giảm đúng 200.000 đ thì không báo; trên ngưỡng thì báo', async () => {
    const small = await addLine(lacId);
    await counter('POST', `/lines/${small}/void`, { qty: 1, reason: 'KHACH_DOI_Y', approvalToken: await approval() });

    await addLine(lauId);
    await addLine(lauId);
    const exact = await counter('POST', `/tabs/${tabId}/discount`, { amount: 200000, reason: 'KHAC', note: 'Khách quen', approvalToken: await approval() });
    expect(exact.statusCode).toBe(201);
    await new Promise((r) => setTimeout(r, 300));
    expect(sent).toHaveLength(1);

    await counter('POST', `/tabs/${tabId}/discount`, { amount: 210000, reason: 'KHAC', note: 'Sinh nhật', approvalToken: await approval() });
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]!.payload).toMatchObject({ title: 'Giảm giá hóa đơn 210.000 đ', body: expect.stringContaining('Cả hóa đơn · bàn S12 · Sinh nhật') });
  });

  it('gửi thử tới thiết bị của mình; hủy đăng ký thì hết thiết bị', async () => {
    const test = await owner('POST', '/push/test');
    expect(test.json()).toEqual({ sent: 1, removed: 0 });
    expect(sent.at(-1)!.payload.title).toBe('Thông báo thử');

    expect((await owner('DELETE', '/push/subscribe', { endpoint: 'https://push.example/dien-thoai-chu-quan' })).statusCode).toBe(204);
    const none = await owner('POST', '/push/test');
    expect(none.statusCode).toBe(400);
    expect(none.json().code).toBe('NO_DEVICE');
  });
});

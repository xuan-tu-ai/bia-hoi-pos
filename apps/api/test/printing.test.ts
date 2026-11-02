// In qua máy in mạng (FR-04, NFR-08): backend gửi ESC/POS tới máy in của từng trạm.
// Máy in là một máy chủ TCP giả trong test, đọc lại ảnh từ lệnh ESC/POS nhận được.

import bcrypt from 'bcryptjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { decodeJobs, escposJob } from '../src/lib/printing/escpos';
import { rasterToPng, renderLines } from '../src/lib/printing/render';
import { prisma } from '../src/lib/prisma';

let app: FastifyInstance;
let call: (method: InjectOptions['method'], url: string, payload?: object) => Promise<LightMyRequestResponse>;
let owner: (method: InjectOptions['method'], url: string, payload?: object) => Promise<LightMyRequestResponse>;
let printer: net.Server;
let printerPort: number;
const received: Buffer[] = [];
const ids = {} as { kitchen: number; bar: number; ribs: number; beer: number; tableA: number; tableB: number };

/** Một cổng đang đóng chắc chắn (để giả máy in tắt). */
async function closedPort(): Promise<number> {
  const s = net.createServer().listen(0);
  await new Promise((r) => s.once('listening', r));
  const p = (s.address() as net.AddressInfo).port;
  await new Promise((r) => s.close(r));
  return p;
}

beforeAll(async () => {
  printer = net.createServer((socket) => {
    const chunks: Buffer[] = [];
    socket.on('data', (c) => chunks.push(c));
    socket.on('end', () => received.push(Buffer.concat(chunks)));
  });
  await new Promise<void>((r) => printer.listen(0, '127.0.0.1', r));
  printerPort = (printer.address() as net.AddressInfo).port;

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
  const area = await prisma.area.create({ data: { name: 'Sân' } });
  const [a, b] = await prisma.diningTable.createManyAndReturn({ data: [{ areaId: area.id, code: 'S01' }, { areaId: area.id, code: 'S02' }] });
  const kitchen = await prisma.printStation.create({ data: { name: 'Bếp nướng', printerName: 'XP-80C', connection: 'NETWORK', host: '127.0.0.1', port: printerPort } });
  const bar = await prisma.printStation.create({ data: { name: 'Quầy rót bia', printerName: 'Mặc định' } });
  const group = await prisma.menuGroup.create({ data: { name: 'Món' } });
  const ribs = await prisma.menuItem.create({ data: { groupId: group.id, name: 'Sườn nướng mật ong lá móc mắc', price: 90000, unit: 'đĩa', stationId: kitchen.id } });
  const beer = await prisma.menuItem.create({ data: { groupId: group.id, name: 'Bia hơi cốc', price: 15000, unit: 'cốc', stationId: bar.id } });
  Object.assign(ids, { kitchen: kitchen.id, bar: bar.id, ribs: ribs.id, beer: beer.id, tableA: a!.id, tableB: b!.id });

  app = await buildApp({ logger: false });
  const pin = await app.inject({ method: 'POST', url: '/auth/pin', payload: { pin: '1111' }, headers: { 'x-device-key': 'print-test' } });
  const token = pin.json().token;
  call = (method, url, payload) => app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } } as InjectOptions);
  const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'chu@test.vn', password: 'matkhau123' } });
  const ownerToken = login.json().token;
  owner = (method, url, payload) => app.inject({ method, url, payload, headers: { authorization: `Bearer ${ownerToken}` } } as InjectOptions);
});

afterAll(async () => {
  await app?.close();
  await new Promise((r) => printer.close(r));
  await prisma.$disconnect();
});

describe('ESC/POS', () => {
  it('ảnh raster đi qua lệnh ESC/POS rồi đọc lại không mất điểm nào', () => {
    const raster = renderLines([
      { kind: 'text', text: 'Bàn S01', size: 52, bold: true, align: 'center' },
      { kind: 'item', qty: '2', name: 'Lẩu riêu cua bắp bò sườn sụn', note: 'ít cay, không hành' },
    ]);
    expect(raster.width).toBe(576);
    expect(raster.height % 8).toBe(0);
    const job = escposJob(raster);
    expect([...job.subarray(0, 2)]).toEqual([0x1b, 0x40]); // ESC @
    expect([...job.subarray(-4)]).toEqual([0x1d, 0x56, 0x42, 0x00]); // cắt giấy
    const [back] = decodeJobs(job);
    expect(back!.width).toBe(raster.width);
    expect(back!.height).toBe(raster.height);
    expect(back!.bits.equals(raster.bits)).toBe(true);
    expect([...raster.bits].some((b) => b !== 0)).toBe(true); // có mực
  });
});

describe('in qua máy in mạng', () => {
  it('gửi lượt gọi: phiếu bếp tới máy in mạng, phiếu quầy rót để App quầy in', async () => {
    const tabId = (await call('POST', '/tabs', { tableId: ids.tableA })).json().tab.id;
    const res = await call('POST', `/tabs/${tabId}/rounds`, { items: [{ itemId: ids.ribs, qty: 2, note: 'nướng kỹ' }, { itemId: ids.beer, qty: 4 }] });
    expect(res.statusCode).toBe(201);
    const tickets = res.json().tickets as { stationName: string; delivery: string; printed: boolean | null }[];
    expect(tickets.find((t) => t.stationName === 'Bếp nướng')).toMatchObject({ delivery: 'network', printed: true });
    expect(tickets.find((t) => t.stationName === 'Quầy rót bia')).toMatchObject({ delivery: 'browser', printed: null });
    // còn phiếu App quầy tự in nên lượt chờ App quầy báo kết quả
    expect(res.json().round.printedStatus).toBe('PENDING');

    expect(received).toHaveLength(1);
    const [job] = decodeJobs(received[0]!);
    // lưu ảnh để người xem kiểm tra dấu tiếng Việt
    const dir = path.join(os.tmpdir(), 'biahoi-printouts');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'phieu-bep.png'), rasterToPng(job!));
    expect(job!.width).toBe(576);
    expect(job!.height).toBeGreaterThan(250); // đầu phiếu, một món kèm ghi chú
  });

  it('chỉ có trạm mạng và in thành công → lượt tự đánh dấu đã in', async () => {
    const tabId = (await prisma.diningTable.findUniqueOrThrow({ where: { id: ids.tableA } })).currentTabId!;
    const res = await call('POST', `/tabs/${tabId}/rounds`, { items: [{ itemId: ids.ribs, qty: 1 }] });
    expect(res.json().round.printedStatus).toBe('PRINTED');
  });

  it('máy in mạng tắt: lượt vẫn lưu, tự chuyển FAILED (bàn đỏ), báo lỗi rõ; in lại khi máy bật thì hết đỏ', async () => {
    await prisma.printStation.update({ where: { id: ids.kitchen }, data: { port: await closedPort() } });
    const tabId = (await call('POST', '/tabs', { tableId: ids.tableB })).json().tab.id;
    const res = await call('POST', `/tabs/${tabId}/rounds`, { items: [{ itemId: ids.ribs, qty: 1 }] });
    expect(res.statusCode).toBe(201);
    expect(res.json().round.printedStatus).toBe('FAILED');
    expect(res.json().tickets[0]).toMatchObject({ delivery: 'network', printed: false, error: expect.stringContaining('từ chối kết nối') });
    const map = (await call('GET', '/areas?include=tables')).json();
    expect(map[0].tables.find((t: { id: number }) => t.id === ids.tableB).status).toBe('PRINT_ERROR');

    await prisma.printStation.update({ where: { id: ids.kitchen }, data: { port: printerPort } });
    const reprint = await call('POST', `/rounds/${res.json().round.id}/reprint`);
    expect(reprint.json().printedStatus).toBe('PRINTED');
    const after = (await call('GET', '/areas?include=tables')).json();
    expect(after[0].tables.find((t: { id: number }) => t.id === ids.tableB).status).toBe('OPEN');
  });

  it('chủ quán in thử tới trạm mạng; trạm in qua trình duyệt thì báo không in thử được', async () => {
    const before = received.length;
    expect((await owner('POST', `/print-stations/${ids.kitchen}/test`)).json()).toEqual({ ok: true });
    expect(received.length).toBe(before + 1);
    expect((await owner('POST', `/print-stations/${ids.bar}/test`)).json().code).toBe('NOT_NETWORK');
    expect((await call('POST', `/print-stations/${ids.kitchen}/test`)).statusCode).toBe(403);
  });

  it('sửa trạm sang máy in mạng qua API', async () => {
    const res = await owner('PATCH', `/print-stations/${ids.bar}`, { connection: 'NETWORK', host: '192.168.1.60', port: 9100 });
    expect(res.json()).toMatchObject({ connection: 'NETWORK', host: '192.168.1.60', port: 9100 });
    expect((await owner('PATCH', `/print-stations/${ids.bar}`, { host: 'máy in; rm -rf' })).statusCode).toBe(400);
  });
});

import request from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

export const app = createApp();

/** Tài khoản mẫu trong seed, mật khẩu chung 123456. */
export const tokens: Record<string, string> = {};

export async function login(email: string) {
  const res = await request(app).post('/api/auth/login').send({ email, password: '123456' });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

export async function loginAll() {
  for (const u of ['lan', 'hung', 'hoa']) tokens[u] = await login(`${u}@biahoi.vn`);
}

const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
export const api = {
  get: (who: string, url: string) => request(app).get(`/api${url}`).set(as(who)),
  post: (who: string, url: string, body: object = {}) => request(app).post(`/api${url}`).set(as(who)).send(body),
  patch: (who: string, url: string, body: object = {}) => request(app).patch(`/api${url}`).set(as(who)).send(body),
  delete: (who: string, url: string) => request(app).delete(`/api${url}`).set(as(who)),
};

export async function tableId(code: string) {
  return (await prisma.diningTable.findUniqueOrThrow({ where: { code } })).id;
}
export async function itemId(shortcut: string) {
  return (await prisma.menuItem.findUniqueOrThrow({ where: { shortcut } })).id;
}
/** Bàn trống bất kỳ (seed mở ngẫu nhiên 20 bàn). */
export async function emptyTables(n: number) {
  const open = await prisma.tab.findMany({ where: { status: 'OPEN' }, select: { tableId: true } });
  const busy = new Set(open.map((t) => t.tableId));
  const all = await prisma.diningTable.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
  return all.filter((t) => !busy.has(t.id)).slice(0, n);
}

import request from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../src/app.js';

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

// openapi.yaml là hợp đồng API đóng băng ở G2: test này bắt lỗi khi code và tài liệu lệch nhau.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const spec = parse(readFileSync(path.resolve(import.meta.dirname, '../openapi.yaml'), 'utf8')) as {
  paths: Record<string, Record<string, unknown>>;
};
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const key = (method: string, url: string) => `${method.toUpperCase()} ${url.replace(/:(\w+)/g, '{$1}')}`;

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp({ logger: false });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('openapi.yaml khớp với code', () => {
  it('mọi route trong code đều có trong tài liệu', () => {
    const documented = new Set(Object.entries(spec.paths).flatMap(([p, ops]) => Object.keys(ops).filter((m) => METHODS.includes(m)).map((m) => key(m, p))));
    const missing = app.routeList.map((r) => key(r.method, r.url)).filter((k) => !documented.has(k));
    expect(missing).toEqual([]);
  });

  it('mọi endpoint trong tài liệu đều có trong code', () => {
    const implemented = new Set(app.routeList.map((r) => key(r.method, r.url)));
    const extra = Object.entries(spec.paths)
      .flatMap(([p, ops]) => Object.keys(ops).filter((m) => METHODS.includes(m)).map((m) => key(m, p)))
      .filter((k) => !implemented.has(k));
    expect(extra).toEqual([]);
  });

  it('trang /docs phục vụ được tài liệu', async () => {
    expect((await app.inject({ method: 'GET', url: '/docs/json' })).json().info.title).toContain('Bia Hơi Quầy');
    expect((await app.inject({ method: 'GET', url: '/docs/' })).statusCode).toBe(200);
  });
});

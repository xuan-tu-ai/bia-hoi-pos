import { existsSync } from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { config } from './config';
import { AppError } from './lib/errors';
import { authRoutes } from './routes/auth';
import { catalogRoutes } from './routes/catalog';
import { imageRoutes } from './routes/images';
import { kegRoutes } from './routes/kegs';
import { orderRoutes } from './routes/orders';
import { paymentRoutes } from './routes/payments';
import { pushRoutes } from './routes/push';
import { reportRoutes } from './routes/reports';
import { shiftRoutes } from './routes/shifts';
import { tableRoutes } from './routes/tables';

/** openapi.yaml nằm ở gốc apps/api; khi chạy bản build thì thư mục làm việc cũng là apps/api. */
function findSpec(): string | null {
  for (const p of [path.resolve(process.cwd(), 'openapi.yaml'), path.resolve(import.meta.dirname, '../openapi.yaml')]) {
    if (existsSync(p)) return p;
  }
  return null;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Mọi route đã đăng ký (trừ HEAD, OPTIONS và /docs), để test đối chiếu với openapi.yaml */
    routeList: { method: string; url: string }[];
  }
}

export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? true, trustProxy: config.trustProxy });

  const routeList: { method: string; url: string }[] = [];
  app.decorate('routeList', routeList);
  app.addHook('onRoute', (route) => {
    if (route.url.startsWith('/docs')) return;
    // HEAD do Fastify tự sinh, OPTIONS * là preflight CORS: không phải API
    for (const method of [route.method].flat()) if (method !== 'HEAD' && method !== 'OPTIONS') routeList.push({ method, url: route.url });
  });

  await app.register(cors, { origin: config.corsOrigin });

  // Nhiều client gửi POST không có thân nhưng vẫn kèm content-type: application/json (vd in tạm tính).
  // Mặc định Fastify trả 400 cho trường hợp này; ở đây coi thân rỗng là không có thân.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (body === '') return done(null, undefined);
    try {
      done(null, JSON.parse(body as string));
    } catch {
      done(Object.assign(new Error('Thân yêu cầu không phải JSON hợp lệ'), { statusCode: 400 }), undefined);
    }
  });
  await app.register(jwt, { secret: config.jwtSecret });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ code: err.code, message: err.message, details: err.details });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({ code: 'VALIDATION_ERROR', message: err.issues[0]?.message ?? 'Dữ liệu không hợp lệ', details: err.issues });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') return reply.code(409).send({ code: 'DUPLICATE', message: 'Dữ liệu bị trùng', details: err.meta });
      if (err.code === 'P2003') return reply.code(409).send({ code: 'IN_USE', message: 'Dữ liệu đang được tham chiếu, không thể xóa hoặc liên kết sai' });
      if (err.code === 'P2025') return reply.code(404).send({ code: 'NOT_FOUND', message: 'Không tìm thấy dữ liệu' });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) {
      return reply.code(status).send({ code: 'BAD_REQUEST', message: (err as Error).message });
    }
    req.log.error(err);
    return reply.code(500).send({ code: 'INTERNAL', message: 'Lỗi máy chủ' });
  });

  app.get('/health', async () => ({ ok: true, time: new Date() }));

  // Tài liệu API (hợp đồng đóng băng ở G2) tại /docs; tắt bằng DOCS=off
  const spec = findSpec();
  if (spec && process.env.DOCS !== 'off') {
    await app.register(swagger, { mode: 'static', specification: { path: spec, baseDir: path.dirname(spec) } });
    await app.register(swaggerUi, { routePrefix: '/docs' });
  }

  await app.register(authRoutes);
  await app.register(tableRoutes);
  await app.register(orderRoutes);
  await app.register(paymentRoutes);
  await app.register(shiftRoutes);
  await app.register(kegRoutes);
  await app.register(catalogRoutes);
  await app.register(imageRoutes);
  await app.register(reportRoutes);
  await app.register(pushRoutes);

  return app;
}

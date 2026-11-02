import { buildApp } from './app';
import { config } from './config';
import { prisma } from './lib/prisma';
import { attachRealtime, closeRealtime } from './lib/realtime';
import type { TokenPayload } from './lib/auth';

const app = await buildApp();

if (config.deviceKeys.length === 0) {
  app.log.warn('COUNTER_DEVICE_KEYS trống: mọi máy đều đăng nhập PIN được (chỉ dùng khi phát triển)');
}

attachRealtime(app.server, config.corsOrigin, async (token) => {
  const payload = app.jwt.verify<TokenPayload>(token);
  if (payload.kind !== 'access') throw new Error('UNAUTHORIZED');
});

await app.listen({ port: config.port, host: config.host });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await closeRealtime();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

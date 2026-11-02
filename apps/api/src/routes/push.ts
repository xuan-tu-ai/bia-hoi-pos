// FR-20: chủ quán đăng ký nhận thông báo đẩy trên PWA.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { ownerOnly } from '../lib/auth';
import { badRequest } from '../lib/errors';
import { audit, prisma } from '../lib/prisma';
import { getVapidKeys, sendPush } from '../lib/push';

const subscribeBody = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
const unsubscribeBody = z.object({ endpoint: z.string().url().max(1000) });

export async function pushRoutes(app: FastifyInstance) {
  app.get('/push/public-key', { preHandler: ownerOnly }, async (req) => {
    const { publicKey } = await getVapidKeys();
    const devices = await prisma.pushSubscription.count({ where: { staffId: req.user.sub } });
    return { publicKey, threshold: config.pushVoidThreshold, devices };
  });

  app.post('/push/subscribe', { preHandler: ownerOnly }, async (req, reply) => {
    const { endpoint, keys } = subscribeBody.parse(req.body);
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : null;
    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, staffId: req.user.sub, userAgent },
      update: { p256dh: keys.p256dh, auth: keys.auth, staffId: req.user.sub, userAgent },
    });
    await audit(prisma, req.user.sub, 'PUSH_SUBSCRIBE', 'push_subscription', sub.id);
    reply.code(201);
    return { id: sub.id };
  });

  app.delete('/push/subscribe', { preHandler: ownerOnly }, async (req, reply) => {
    const { endpoint } = unsubscribeBody.parse(req.body);
    await prisma.pushSubscription.deleteMany({ where: { endpoint, staffId: req.user.sub } });
    reply.code(204);
  });

  // Gửi thử tới các thiết bị của chính người đang đăng nhập
  app.post('/push/test', { preHandler: ownerOnly }, async (req) => {
    const result = await sendPush(
      { staffId: req.user.sub },
      { title: 'Thông báo thử', body: 'Điện thoại này sẽ nhận báo khi có hủy hoặc giảm giá lớn.', url: '/nhat-ky-huy', tag: 'test' },
    );
    if (result.sent === 0 && result.removed === 0) throw badRequest('NO_DEVICE', 'Chưa có thiết bị nào bật thông báo');
    return result;
  });
}

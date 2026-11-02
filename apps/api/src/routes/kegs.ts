import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { KEG_STATUSES } from '@biahoi/shared';
import { anyStaff, ownerOnly } from '../lib/auth';
import { conflict, notFound } from '../lib/errors';
import { audit, prisma } from '../lib/prisma';
import { emitTapsUpdated } from '../lib/realtime';
import { idParam, vnd } from '../lib/validate';

const receiveBody = z.object({
  beerName: z.string().trim().min(1).max(100),
  capacityMl: z.number().int().min(1000).max(200_000),
  cost: vnd.nonnegative(),
  receivedAt: z.coerce.date().optional(),
  quantity: z.number().int().min(1).max(50),
});
const changeKegBody = z.object({ kegId: z.number().int().positive() });

/** Tổng thể tích đã bán của các keg (dòng hủy có qty âm nên tự trừ). */
export async function soldMlByKeg(kegIds: number[]): Promise<Map<number, number>> {
  if (kegIds.length === 0) return new Map();
  const lines = await prisma.orderLine.findMany({
    where: { kegId: { in: kegIds } },
    select: { kegId: true, qty: true, volumeMl: true },
  });
  const sold = new Map<number, number>();
  for (const l of lines) sold.set(l.kegId!, (sold.get(l.kegId!) ?? 0) + l.qty * (l.volumeMl ?? 0));
  return sold;
}

export async function kegRoutes(app: FastifyInstance) {
  // FR-14: nhập kho nhiều keg cùng lúc
  app.post('/kegs', { preHandler: ownerOnly }, async (req, reply) => {
    const body = receiveBody.parse(req.body);
    const receivedAt = body.receivedAt ?? new Date();
    const kegs = await prisma.$transaction(async (tx) => {
      const created = await tx.keg.createManyAndReturn({
        data: Array.from({ length: body.quantity }, () => ({
          beerName: body.beerName,
          capacityMl: body.capacityMl,
          cost: body.cost,
          receivedAt,
        })),
      });
      await audit(tx, req.user.sub, 'KEG_RECEIVE', 'keg', null, { ...body, kegIds: created.map((k) => k.id) });
      return created;
    });
    reply.code(201);
    return kegs;
  });

  // FR-14: danh sách keg theo trạng thái (App quầy dùng ?status=IN_STOCK khi thay keg)
  app.get('/kegs', { preHandler: anyStaff }, async (req) => {
    const { status } = z.object({ status: z.enum(KEG_STATUSES).optional() }).parse(req.query);
    const kegs = await prisma.keg.findMany({
      where: { status },
      orderBy: [{ status: 'asc' }, { receivedAt: 'asc' }, { id: 'asc' }],
      include: { tap: { select: { id: true, name: true } } },
    });
    const sold = await soldMlByKeg(kegs.filter((k) => k.status !== 'IN_STOCK').map((k) => k.id));
    return kegs.map((k) => ({ ...k, soldMl: sold.get(k.id) ?? 0 }));
  });

  // FR-10: màn "Vòi bia" — danh sách vòi và keg đang gắn
  app.get('/taps', { preHandler: anyStaff }, async () => {
    const taps = await prisma.tap.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], include: { currentKeg: true } });
    const sold = await soldMlByKeg(taps.flatMap((t) => (t.currentKegId ? [t.currentKegId] : [])));
    return taps.map((t) => ({
      id: t.id,
      name: t.name,
      sortOrder: t.sortOrder,
      currentKeg: t.currentKeg && { ...t.currentKeg, soldMl: sold.get(t.currentKeg.id) ?? 0 },
    }));
  });

  // FR-10: thay keg — keg mới phải đang Trong kho (FR-14); keg cũ chuyển "Đã hết"
  app.post('/taps/:id/change-keg', { preHandler: anyStaff }, async (req) => {
    const { id } = idParam.parse(req.params);
    const { kegId } = changeKegBody.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tap WHERE id = ${id} FOR UPDATE`;
      const tap = await tx.tap.findUnique({ where: { id } });
      if (!tap) throw notFound('vòi');
      const keg = await tx.keg.findUnique({ where: { id: kegId } });
      if (!keg) throw notFound('keg');
      if (keg.status !== 'IN_STOCK') throw conflict('KEG_NOT_IN_STOCK', 'Chỉ gắn được keg đang ở trạng thái Trong kho');

      const now = new Date();
      const oldKegId = tap.currentKegId;
      if (oldKegId) {
        await tx.tap.update({ where: { id }, data: { currentKegId: null } });
        await tx.keg.update({ where: { id: oldKegId }, data: { status: 'EMPTY', emptiedAt: now } });
      }
      // Cập nhật có điều kiện để hai máy không gắn cùng một keg vào hai vòi.
      const tapped = await tx.keg.updateMany({ where: { id: kegId, status: 'IN_STOCK' }, data: { status: 'TAPPED', tapId: id, tappedAt: now } });
      if (tapped.count === 0) throw conflict('KEG_NOT_IN_STOCK', 'Keg vừa được gắn ở vòi khác');
      await tx.tap.update({ where: { id }, data: { currentKegId: kegId } });
      await audit(tx, req.user.sub, 'KEG_CHANGE', 'tap', id, { oldKegId, newKegId: kegId });
      return { oldKegId, newKegId: kegId };
    });

    emitTapsUpdated([id]);
    return result;
  });
}

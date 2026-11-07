import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma, type Tx } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { conflict, notFound } from '../../lib/errors.js';
import { vnDayRange } from '../../lib/time.js';
import type { AuthUser } from '../../middlewares/auth.js';
import type { listKegsQuery, receiveKegsSchema } from './kegs.schema.js';

/**
 * Số ml đã bán của từng keg = Σ qty × thể tích món bia, tính trên các dòng gắn keg đó
 * (dòng VOID mang qty âm nên món đã hủy tự bị trừ) — FR-10.
 */
export async function soldMlByKeg(tx: Tx, kegIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (kegIds.length === 0) return map;
  const rows = await tx.$queryRaw<{ kegId: number; soldMl: bigint }[]>`
    SELECT l."kegId" AS "kegId", COALESCE(SUM(l.qty * m."beerVolumeMl"), 0)::bigint AS "soldMl"
    FROM "OrderLine" l JOIN "MenuItem" m ON m.id = l."menuItemId"
    WHERE l."kegId" IN (${Prisma.join(kegIds)}) AND l."lineType" IN ('NORMAL', 'VOID') AND m."beerVolumeMl" IS NOT NULL
    GROUP BY l."kegId"`;
  for (const r of rows) map.set(r.kegId, Number(r.soldMl));
  return map;
}

// FR-10 Vòi & thay keg

export async function listTaps() {
  const [taps, inStock] = await Promise.all([
    prisma.tap.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], include: { currentKeg: true } }),
    prisma.keg.findMany({ where: { status: 'IN_STOCK' }, orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }] }),
  ]);
  const sold = await soldMlByKeg(prisma, taps.flatMap((t) => (t.currentKeg ? [t.currentKeg.id] : [])));
  return {
    taps: taps.map((t) => {
      const k = t.currentKeg;
      const soldMl = k ? sold.get(k.id) ?? 0 : 0;
      return {
        id: t.id,
        name: t.name,
        currentKeg: k
          ? {
              id: k.id,
              code: k.code,
              beerName: k.beerName,
              capacityMl: k.capacityMl,
              tappedAt: k.tappedAt,
              soldMl,
              percent: Math.round((soldMl / k.capacityMl) * 1000) / 10,
            }
          : null,
      };
    }),
    /** Keg "Trong kho" để chọn khi thay keg (nhân viên quầy không có quyền xem kho). */
    inStockKegs: inStock.map((k) => ({ id: k.id, code: k.code, beerName: k.beerName, capacityMl: k.capacityMl, receivedAt: k.receivedAt })),
  };
}

export async function changeKeg(user: AuthUser, tapId: number, kegId: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Tap" WHERE id = ${tapId} FOR UPDATE`;
    const tap = await tx.tap.findUnique({ where: { id: tapId }, include: { currentKeg: true } });
    if (!tap) throw notFound('Không tìm thấy vòi');

    await tx.$queryRaw`SELECT id FROM "Keg" WHERE id = ${kegId} FOR UPDATE`;
    const next = await tx.keg.findUnique({ where: { id: kegId } });
    if (!next) throw notFound('Không tìm thấy keg');
    if (next.status !== 'IN_STOCK') throw conflict('KEG_NOT_IN_STOCK', 'Chỉ chọn được keg đang "Trong kho"');

    const now = new Date();
    let old: { id: number; code: string; soldMl: number } | null = null;
    if (tap.currentKeg) {
      const soldMl = (await soldMlByKeg(tx, [tap.currentKeg.id])).get(tap.currentKeg.id) ?? 0;
      await tx.tap.update({ where: { id: tapId }, data: { currentKegId: null } });
      await tx.keg.update({ where: { id: tap.currentKeg.id }, data: { status: 'EMPTY', emptiedAt: now, soldMl } });
      old = { id: tap.currentKeg.id, code: tap.currentKeg.code, soldMl };
    }
    await tx.keg.update({ where: { id: kegId }, data: { status: 'TAPPED', tapId, tappedAt: now } });
    await tx.tap.update({ where: { id: tapId }, data: { currentKegId: kegId } });

    await audit(tx, user.id, 'KEG_CHANGED', 'Tap', tapId, { oldKegId: old?.id ?? null, oldSoldMl: old?.soldMl ?? null, newKegId: kegId });
    return { tapId, emptiedKeg: old, tappedKeg: { id: next.id, code: next.code, tappedAt: now } };
  });
}

// FR-14 Kho keg

export async function listKegs(q: z.infer<typeof listKegsQuery>) {
  const [kegs, counts] = await Promise.all([
    prisma.keg.findMany({
      where: q.status ? { status: q.status } : {},
      include: { tap: { select: { id: true, name: true } } },
      orderBy: [{ id: 'desc' }],
    }),
    prisma.keg.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const count = (st: string) => counts.find((c) => c.status === st)?._count._all ?? 0;
  const liveSold = await soldMlByKeg(prisma, kegs.filter((k) => k.status === 'TAPPED').map((k) => k.id));
  return {
    summary: { inStock: count('IN_STOCK'), tapped: count('TAPPED'), empty: count('EMPTY') },
    items: kegs.map((k) => ({
      id: k.id,
      code: k.code,
      beerName: k.beerName,
      capacityMl: k.capacityMl,
      cost: k.cost,
      receivedAt: k.receivedAt,
      status: k.status,
      tap: k.status === 'TAPPED' ? k.tap : null,
      tappedAt: k.tappedAt,
      emptiedAt: k.emptiedAt,
      soldMl: k.status === 'TAPPED' ? liveSold.get(k.id) ?? 0 : k.soldMl,
    })),
  };
}

/** FR-14: nhập nhiều keg một lần, mỗi keg một mã KEG-xxxx. */
export async function receiveKegs(user: AuthUser, input: z.infer<typeof receiveKegsSchema>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4202)`;
    const rows = await tx.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)) AS max FROM "Keg" WHERE code ~ '^KEG-[0-9]+$'`;
    let next = (rows[0]?.max ?? 0) + 1;
    const receivedAt = vnDayRange(input.receivedAt).start;
    const created = [];
    for (let i = 0; i < input.quantity; i++) {
      const code = `KEG-${String(next++).padStart(4, '0')}`;
      created.push(
        await tx.keg.create({
          data: { code, beerName: input.beerName, capacityMl: input.capacityMl, cost: input.cost, receivedAt },
        }),
      );
    }
    await audit(tx, user.id, 'KEGS_RECEIVED', 'Keg', created[0].id, {
      codes: created.map((k) => k.code),
      beerName: input.beerName,
      capacityMl: input.capacityMl,
      cost: input.cost,
    });
    return created;
  });
}

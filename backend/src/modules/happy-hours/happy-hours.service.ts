import type { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { isHappyHourActive } from '../../lib/pricing.js';
import type { createHappyHourSchema, updateHappyHourSchema } from './happy-hours.schema.js';

const include = {
  prices: { include: { menuItem: { select: { id: true, name: true, price: true } } }, orderBy: { id: 'asc' } },
} as const;

type Row = Awaited<ReturnType<typeof loadOne>>;
const loadOne = (id: number) => prisma.happyHour.findUniqueOrThrow({ where: { id }, include });

function present(h: NonNullable<Row>, now = new Date()) {
  return {
    id: h.id,
    name: h.name,
    weekdays: h.weekdays,
    startTime: h.startTime,
    endTime: h.endTime,
    enabled: h.enabled,
    activeNow: isHappyHourActive(h, now),
    prices: h.prices.map((p) => ({ menuItemId: p.menuItemId, name: p.menuItem.name, regularPrice: p.menuItem.price, price: p.price })),
  };
}

export async function listHappyHours() {
  const rows = await prisma.happyHour.findMany({ include, orderBy: { id: 'asc' } });
  return rows.map((h) => present(h));
}

export async function createHappyHour(actorId: number, input: z.infer<typeof createHappyHourSchema>) {
  const id = await prisma.$transaction(async (tx) => {
    const h = await tx.happyHour.create({
      data: {
        name: input.name,
        weekdays: input.weekdays,
        startTime: input.startTime,
        endTime: input.endTime,
        enabled: input.enabled ?? true,
        prices: { create: input.prices },
      },
    });
    await audit(tx, actorId, 'HAPPY_HOUR_CREATED', 'HappyHour', h.id, input);
    return h.id;
  });
  return present(await loadOne(id));
}

export async function updateHappyHour(actorId: number, id: number, input: z.infer<typeof updateHappyHourSchema>) {
  await prisma.$transaction(async (tx) => {
    const { prices, ...rest } = input;
    await tx.happyHour.update({ where: { id }, data: rest });
    if (prices) {
      await tx.happyHourPrice.deleteMany({ where: { happyHourId: id } });
      await tx.happyHourPrice.createMany({ data: prices.map((p) => ({ ...p, happyHourId: id })) });
    }
    await audit(tx, actorId, 'HAPPY_HOUR_UPDATED', 'HappyHour', id, input);
  });
  return present(await loadOne(id));
}

/** Xóa khung giờ vàng không ảnh hưởng hóa đơn cũ: giá đã chốt trong OrderLine. */
export async function deleteHappyHour(actorId: number, id: number) {
  await prisma.$transaction(async (tx) => {
    await tx.happyHour.delete({ where: { id } });
    await audit(tx, actorId, 'HAPPY_HOUR_DELETED', 'HappyHour', id);
  });
}

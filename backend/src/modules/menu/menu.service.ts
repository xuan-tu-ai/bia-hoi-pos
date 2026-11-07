import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { badRequest, conflict } from '../../lib/errors.js';
import { loadHappyPrices } from '../../lib/pricing.js';
import type * as s from './menu.schema.js';

// Thực đơn cho màn gọi món (FR-04)

/** Nhóm → món (chỉ món đang bán), kèm giá hiện hành (đã tính giờ vàng). */
export async function getMenu() {
  const [groups, happy] = await Promise.all([
    prisma.menuGroup.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        items: {
          where: { active: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: { station: { select: { id: true, name: true } } },
        },
      },
    }),
    loadHappyPrices(prisma, new Date()),
  ]);
  return groups
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      id: g.id,
      name: g.name,
      items: g.items.map((i) => ({
        id: i.id,
        name: i.name,
        shortcut: i.shortcut,
        unit: i.unit,
        price: happy.get(i.id) ?? i.price,
        regularPrice: i.price,
        isHappyHour: happy.has(i.id),
        available: i.available,
        stationId: i.station.id,
        stationName: i.station.name,
        beerVolumeMl: i.beerVolumeMl,
      })),
    }));
}

// Nhóm món

export function listGroups() {
  return prisma.menuGroup.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: { _count: { select: { items: { where: { active: true } } } } },
  }).then((gs) => gs.map(({ _count, ...g }) => ({ ...g, itemCount: _count.items })));
}

export function createGroup(actorId: number, input: z.infer<typeof s.groupSchema>) {
  return prisma.$transaction(async (tx) => {
    const g = await tx.menuGroup.create({ data: input });
    await audit(tx, actorId, 'MENU_GROUP_CREATED', 'MenuGroup', g.id, input);
    return g;
  });
}

export function updateGroup(actorId: number, id: number, input: z.infer<typeof s.updateGroupSchema>) {
  return prisma.$transaction(async (tx) => {
    const g = await tx.menuGroup.update({ where: { id }, data: input });
    await audit(tx, actorId, 'MENU_GROUP_UPDATED', 'MenuGroup', id, input);
    return g;
  });
}

// Khu chế biến

export function listStations() {
  return prisma.kitchenStation.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
}

export function createStation(actorId: number, input: z.infer<typeof s.stationSchema>) {
  return prisma.$transaction(async (tx) => {
    const st = await tx.kitchenStation.create({ data: input });
    await audit(tx, actorId, 'STATION_CREATED', 'KitchenStation', st.id, input);
    return st;
  });
}

export function updateStation(actorId: number, id: number, input: z.infer<typeof s.updateStationSchema>) {
  return prisma.$transaction(async (tx) => {
    const st = await tx.kitchenStation.update({ where: { id }, data: input });
    await audit(tx, actorId, 'STATION_UPDATED', 'KitchenStation', id, input);
    return st;
  });
}

// Món

const itemInclude = {
  group: { select: { id: true, name: true } },
  station: { select: { id: true, name: true } },
  defaultTap: { select: { id: true, name: true } },
} satisfies Prisma.MenuItemInclude;

export function listItems(q: z.infer<typeof s.listItemsQuery>) {
  const where: Prisma.MenuItemWhereInput = {
    ...(q.includeInactive === 'true' ? {} : { active: true }),
    ...(q.groupId ? { groupId: q.groupId } : {}),
    ...(q.q
      ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { shortcut: { startsWith: q.q.toLowerCase() } }] }
      : {}),
  };
  return prisma.menuItem.findMany({
    where,
    include: itemInclude,
    orderBy: [{ group: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { id: 'asc' }],
  });
}

async function assertShortcutFree(shortcut: string, exceptId?: number) {
  const other = await prisma.menuItem.findUnique({ where: { shortcut } });
  if (other && other.id !== exceptId) throw conflict('DUPLICATE_SHORTCUT', 'Mã tắt đã tồn tại');
}

export async function createItem(actorId: number, input: z.infer<typeof s.createItemSchema>) {
  await assertShortcutFree(input.shortcut);
  const data = { ...input, beerVolumeMl: input.beerVolumeMl ?? null, defaultTapId: input.beerVolumeMl ? input.defaultTapId : null };
  return prisma.$transaction(async (tx) => {
    const item = await tx.menuItem.create({ data, include: itemInclude });
    await audit(tx, actorId, 'MENU_ITEM_CREATED', 'MenuItem', item.id, input);
    return item;
  });
}

/** Đổi giá chỉ ảnh hưởng lượt gửi sau — giá đã chốt nằm trong OrderLine.unitPrice (FR-11). */
export async function updateItem(actorId: number, id: number, input: z.infer<typeof s.updateItemSchema>) {
  if (input.shortcut) await assertShortcutFree(input.shortcut, id);
  const current = await prisma.menuItem.findUniqueOrThrow({ where: { id } });
  const beerVolumeMl = input.beerVolumeMl !== undefined ? input.beerVolumeMl : current.beerVolumeMl;
  const defaultTapId = input.defaultTapId !== undefined ? input.defaultTapId : current.defaultTapId;
  if (beerVolumeMl && !defaultTapId) throw badRequest('VALIDATION_ERROR', 'Món bia hơi phải chọn vòi mặc định');

  return prisma.$transaction(async (tx) => {
    const item = await tx.menuItem.update({
      where: { id },
      data: { ...input, beerVolumeMl: beerVolumeMl ?? null, defaultTapId: beerVolumeMl ? defaultTapId : null },
      include: itemInclude,
    });
    await audit(tx, actorId, 'MENU_ITEM_UPDATED', 'MenuItem', id, input);
    return item;
  });
}

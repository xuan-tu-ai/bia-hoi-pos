import type { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { conflict, notFound } from '../../lib/errors.js';
import type { createAreaSchema, createTableSchema, updateAreaSchema, updateTableSchema } from './areas.schema.js';

/** Sắp bàn theo số (bàn "2" trước bàn "10"). */
const byCode = (a: { sortOrder: number; code: string }, b: { sortOrder: number; code: string }) =>
  a.sortOrder - b.sortOrder || a.code.localeCompare(b.code, 'vi', { numeric: true });

export async function listAreas(includeTables: boolean) {
  const areas = await prisma.area.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: includeTables ? { tables: { where: { active: true }, select: { id: true, code: true, sortOrder: true, areaId: true } } } : undefined,
  });
  return areas.map((a) => ({
    id: a.id,
    name: a.name,
    sortOrder: a.sortOrder,
    ...('tables' in a ? { tables: [...(a.tables as { sortOrder: number; code: string }[])].sort(byCode) } : {}),
  }));
}

export async function createArea(actorId: number, input: z.infer<typeof createAreaSchema>) {
  return prisma.$transaction(async (tx) => {
    const area = await tx.area.create({ data: input });
    await audit(tx, actorId, 'AREA_CREATED', 'Area', area.id, input);
    return area;
  });
}

export async function updateArea(actorId: number, id: number, input: z.infer<typeof updateAreaSchema>) {
  return prisma.$transaction(async (tx) => {
    const area = await tx.area.update({ where: { id }, data: input });
    await audit(tx, actorId, 'AREA_UPDATED', 'Area', id, input);
    return area;
  });
}

/** FR-12: không xóa được khu còn bàn. Khu từng có bàn (đã ẩn) thì chỉ ẩn khu. */
export async function deleteArea(actorId: number, id: number) {
  return prisma.$transaction(async (tx) => {
    const area = await tx.area.findUnique({ where: { id }, include: { tables: { select: { active: true } } } });
    if (!area || !area.active) throw notFound('Không tìm thấy khu');
    if (area.tables.some((t) => t.active)) throw conflict('AREA_NOT_EMPTY', 'Không xóa được khu còn bàn');
    if (area.tables.length > 0) await tx.area.update({ where: { id }, data: { active: false } });
    else await tx.area.delete({ where: { id } });
    await audit(tx, actorId, 'AREA_DELETED', 'Area', id);
  });
}

async function assertCodeFree(code: string, exceptId?: number) {
  const other = await prisma.diningTable.findUnique({ where: { code } });
  if (other && other.id !== exceptId) throw conflict('DUPLICATE_TABLE_CODE', `Bàn "${code}" đã tồn tại`);
}

export async function createTable(actorId: number, input: z.infer<typeof createTableSchema>) {
  await assertCodeFree(input.code);
  const area = await prisma.area.findUnique({ where: { id: input.areaId } });
  if (!area || !area.active) throw notFound('Không tìm thấy khu');
  return prisma.$transaction(async (tx) => {
    const table = await tx.diningTable.create({ data: input });
    await audit(tx, actorId, 'TABLE_CREATED', 'DiningTable', table.id, input);
    return table;
  });
}

export async function updateTable(actorId: number, id: number, input: z.infer<typeof updateTableSchema>) {
  if (input.code) await assertCodeFree(input.code, id);
  return prisma.$transaction(async (tx) => {
    if (input.active === false) await assertNoOpenTab(tx, id);
    const table = await tx.diningTable.update({ where: { id }, data: input });
    await audit(tx, actorId, 'TABLE_UPDATED', 'DiningTable', id, input);
    return table;
  });
}

async function assertNoOpenTab(tx: Pick<typeof prisma, 'tab'>, tableId: number) {
  const open = await tx.tab.findFirst({ where: { tableId, status: 'OPEN' } });
  if (open) throw conflict('TABLE_NOT_EMPTY', 'Bàn đang có khách, không thể xóa');
}

/** FR-12: không xóa bàn đang có khách. Bàn đã có lịch sử thì chỉ ẩn (SRS 8.1). */
export async function deleteTable(actorId: number, id: number) {
  return prisma.$transaction(async (tx) => {
    const table = await tx.diningTable.findUnique({ where: { id }, include: { _count: { select: { tabs: true } } } });
    if (!table || !table.active) throw notFound('Không tìm thấy bàn');
    await assertNoOpenTab(tx, id);
    if (table._count.tabs > 0) {
      // giải phóng mã bàn để có thể tạo lại bàn cùng số
      await tx.diningTable.update({ where: { id }, data: { active: false, code: `${table.code}#${table.id}` } });
    } else {
      await tx.diningTable.delete({ where: { id } });
    }
    await audit(tx, actorId, 'TABLE_DELETED', 'DiningTable', id, { code: table.code });
  });
}

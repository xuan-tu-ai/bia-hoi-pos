import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { tabTotal, tableStatus } from '@biahoi/shared';
import { anyStaff } from '../lib/auth';
import { AppError, conflict, notFound } from '../lib/errors';
import { audit, lockTab, prisma } from '../lib/prisma';
import { emitTablesUpdated } from '../lib/realtime';
import { idParam } from '../lib/validate';
import { getTabDetail, getTabTotal, requireOpenTab } from '../services/tabs';

const openTabBody = z.object({
  tableId: z.number().int().positive(),
  guestCount: z.number().int().min(1).max(200).optional(),
});
const targetTableBody = z.object({ tableId: z.number().int().positive() });

class TableAlreadyOpen extends Error {}

export async function tableRoutes(app: FastifyInstance) {
  // FR-02: sơ đồ bàn theo khu; ?include=tables để kèm bàn, trạng thái, tạm tính
  app.get('/areas', { preHandler: anyStaff }, async (req) => {
    const { include } = z.object({ include: z.string().optional() }).parse(req.query);
    if (include !== 'tables') return prisma.area.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });

    const areas = await prisma.area.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        tables: {
          where: { active: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            currentTab: {
              include: {
                rounds: { select: { printedStatus: true, lines: { select: { qty: true, unitPrice: true } } } },
                billDiscounts: { select: { amount: true } },
                _count: { select: { billPrints: { where: { kind: 'PROVISIONAL' } } } },
              },
            },
          },
        },
      },
    });

    return areas.map((area) => ({
      id: area.id,
      name: area.name,
      sortOrder: area.sortOrder,
      tables: area.tables.map((t) => {
        const tab = t.currentTab;
        const summary = tab && {
          hasPrintError: tab.rounds.some((r) => r.printedStatus === 'FAILED'),
          provisionalCount: tab._count.billPrints,
        };
        return {
          id: t.id,
          code: t.code,
          sortOrder: t.sortOrder,
          status: tableStatus(summary),
          tab: tab && {
            id: tab.id,
            openedAt: tab.openedAt,
            guestCount: tab.guestCount,
            total: tabTotal(tab.rounds.flatMap((r) => r.lines), tab.billDiscounts),
          },
        };
      }),
    }));
  });

  app.get('/tabs/:id', { preHandler: anyStaff }, async (req) => {
    const { id } = idParam.parse(req.params);
    return getTabDetail(prisma, id);
  });

  // FR-03: mở phiên bàn; hai máy cùng mở → máy sau nhận "Bàn đã được mở" và vào phiên đó
  app.post('/tabs', { preHandler: anyStaff }, async (req, reply) => {
    const { tableId, guestCount } = openTabBody.parse(req.body);
    const table = await prisma.diningTable.findUnique({ where: { id: tableId } });
    if (!table || !table.active) throw notFound('bàn');

    try {
      const tab = await prisma.$transaction(async (tx) => {
        if (table.currentTabId) throw new TableAlreadyOpen();
        const created = await tx.tab.create({ data: { tableId, guestCount, openedById: req.user.sub } });
        // Cập nhật có điều kiện: chỉ một transaction thắng khi hai máy mở cùng lúc.
        const updated = await tx.diningTable.updateMany({ where: { id: tableId, currentTabId: null }, data: { currentTabId: created.id } });
        if (updated.count === 0) throw new TableAlreadyOpen();
        await audit(tx, req.user.sub, 'TAB_OPEN', 'tab', created.id, { tableId, guestCount });
        return created;
      });
      emitTablesUpdated([tableId]);
      reply.code(201);
      return { alreadyOpen: false, tab: await getTabDetail(prisma, tab.id) };
    } catch (err) {
      if (!(err instanceof TableAlreadyOpen)) throw err;
      const current = await prisma.diningTable.findUniqueOrThrow({ where: { id: tableId } });
      if (!current.currentTabId) throw conflict('RETRY', 'Bàn vừa thay đổi trạng thái, vui lòng thử lại');
      return { alreadyOpen: true, message: 'Bàn đã được mở', tab: await getTabDetail(prisma, current.currentTabId) };
    }
  });

  // FR-05: chuyển cả phiên sang bàn trống
  app.post('/tabs/:id/move', { preHandler: anyStaff }, async (req) => {
    const { id } = idParam.parse(req.params);
    const { tableId: targetId } = targetTableBody.parse(req.body);

    const fromTableId = await prisma.$transaction(async (tx) => {
      const tab = await requireOpenTab(tx, id);
      if (tab.tableId === targetId) throw conflict('SAME_TABLE', 'Bàn đích trùng bàn hiện tại');
      const target = await tx.diningTable.findUnique({ where: { id: targetId } });
      if (!target || !target.active) throw notFound('bàn đích');

      // Gỡ bàn nguồn trước vì current_tab_id là duy nhất.
      await tx.diningTable.update({ where: { id: tab.tableId }, data: { currentTabId: null } });
      const updated = await tx.diningTable.updateMany({ where: { id: targetId, currentTabId: null }, data: { currentTabId: tab.id } });
      if (updated.count === 0) throw conflict('TARGET_NOT_EMPTY', 'Bàn đích đang có khách, hãy dùng Gộp bàn');
      await tx.tab.update({ where: { id: tab.id }, data: { tableId: targetId } });
      await audit(tx, req.user.sub, 'TAB_MOVE', 'tab', tab.id, { fromTableId: tab.tableId, toTableId: targetId });
      return tab.tableId;
    });

    emitTablesUpdated([fromTableId, targetId]);
    return getTabDetail(prisma, id);
  });

  // FR-05: gộp các món của phiên nguồn vào phiên đang mở ở bàn đích
  app.post('/tabs/:id/merge', { preHandler: anyStaff }, async (req) => {
    const { id } = idParam.parse(req.params);
    const { tableId: targetTableId } = targetTableBody.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.diningTable.findUnique({ where: { id: targetTableId } });
      if (!target?.currentTabId) throw conflict('TARGET_EMPTY', 'Bàn đích đang trống, hãy dùng Chuyển bàn');
      if (target.currentTabId === id) throw conflict('SAME_TABLE', 'Bàn đích trùng bàn hiện tại');

      // Khóa theo thứ tự id tăng dần để hai lệnh gộp ngược chiều không bị deadlock.
      const [firstId, secondId] = id < target.currentTabId ? [id, target.currentTabId] : [target.currentTabId, id];
      await lockTab(tx, firstId);
      await lockTab(tx, secondId);
      const source = await requireOpenTab(tx, id);
      const dest = await requireOpenTab(tx, target.currentTabId);

      const sourceTotal = await getTabTotal(tx, source.id);
      const destTotal = await getTabTotal(tx, dest.id);

      // order_line giữ nguyên (chỉ thêm, không sửa); chuyển lượt gọi và giảm giá sang phiên đích.
      await tx.orderRound.updateMany({ where: { tabId: source.id }, data: { tabId: dest.id } });
      await tx.billDiscount.updateMany({ where: { tabId: source.id }, data: { tabId: dest.id } });
      await tx.diningTable.update({ where: { id: source.tableId }, data: { currentTabId: null } });
      await tx.tab.update({ where: { id: source.id }, data: { status: 'MERGED', closedAt: new Date(), mergedIntoId: dest.id } });

      const mergedTotal = await getTabTotal(tx, dest.id);
      if (mergedTotal !== sourceTotal + destTotal) {
        throw new AppError(500, 'MERGE_TOTAL_MISMATCH', 'Tổng tiền sau gộp không khớp, đã hủy thao tác');
      }
      await audit(tx, req.user.sub, 'TAB_MERGE', 'tab', dest.id, {
        fromTabId: source.id,
        toTabId: dest.id,
        fromTableId: source.tableId,
        toTableId: targetTableId,
        sourceTotal,
        destTotal,
      });
      return { destTabId: dest.id, sourceTableId: source.tableId };
    });

    emitTablesUpdated([result.sourceTableId, targetTableId]);
    return getTabDetail(prisma, result.destTabId);
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ADJUST_REASON_LABELS, checkDiscount, checkVoid, lineState, resolveDiscountAmount, resolveUnitPrice, type HappyHourRule } from '@biahoi/shared';
import { anyStaff, verifyApproval } from '../lib/auth';
import { badRequest, conflict, notFound } from '../lib/errors';
import { audit, prisma, type Tx } from '../lib/prisma';
import { notifyLargeAdjustment } from '../lib/push';
import { emitTablesUpdated } from '../lib/realtime';
import { adjustReasonInput, discountValue, idParam } from '../lib/validate';
import { dispatchTickets, roundStatusAfter } from '../services/printing';
import { buildRoundTickets, getTabTotal, requireOpenTab } from '../services/tabs';

const roundBody = z.object({
  items: z
    .array(
      z.object({
        itemId: z.number().int().positive(),
        qty: z.number().int().min(1).max(999),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .min(1, 'Lượt gọi phải có ít nhất 1 món')
    .max(100),
  note: z.string().trim().max(200).optional(),
});

const printResultBody = z.object({ status: z.enum(['PRINTED', 'FAILED']) });
const reprintBody = z.object({ stationId: z.number().int().positive().optional() }).optional();

const voidBody = adjustReasonInput.and(z.object({ qty: z.number().int().positive(), approvalToken: z.string() }));
const discountBody = adjustReasonInput.and(discountValue).and(z.object({ approvalToken: z.string() }));

async function activeHappyHours(tx: Tx, itemIds: number[]): Promise<HappyHourRule[]> {
  const rows = await tx.happyHour.findMany({
    where: { active: true },
    include: { prices: { where: { itemId: { in: itemIds } } } },
  });
  return rows.map((r) => ({
    id: r.id,
    daysOfWeek: r.daysOfWeek,
    startMinute: r.startMinute,
    endMinute: r.endMinute,
    prices: new Map(r.prices.map((p) => [p.itemId, p.price])),
  }));
}

/** Lấy dòng NORMAL cần điều chỉnh, khóa phiên và tính trạng thái hiện tại của dòng. */
async function loadAdjustableLine(tx: Tx, lineId: number) {
  const line = await tx.orderLine.findUnique({ where: { id: lineId }, include: { round: true } });
  if (!line) throw notFound('món');
  if (line.lineType !== 'NORMAL') throw badRequest('NOT_ADJUSTABLE', 'Chỉ hủy/giảm được món gốc, không phải dòng điều chỉnh');
  const tab = await requireOpenTab(tx, line.round.tabId);
  const adjustments = await tx.orderLine.findMany({ where: { refLineId: line.id } });
  return { line, tab, state: lineState(line, adjustments) };
}

export async function orderRoutes(app: FastifyInstance) {
  // FR-04: gửi lượt gọi → lưu, chốt giá theo giờ gửi, tách phiếu theo trạm in
  app.post('/tabs/:id/rounds', { preHandler: anyStaff }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = roundBody.parse(req.body);
    const now = new Date();

    const { round, tableId } = await prisma.$transaction(async (tx) => {
      const tab = await requireOpenTab(tx, id);
      const itemIds = [...new Set(body.items.map((i) => i.itemId))];
      const items = await tx.menuItem.findMany({ where: { id: { in: itemIds } }, include: { defaultTap: true } });
      const byId = new Map(items.map((i) => [i.id, i]));

      const missing = itemIds.filter((iid) => !byId.get(iid)?.active);
      if (missing.length) throw badRequest('ITEM_NOT_FOUND', 'Có món không tồn tại', { itemIds: missing });
      const unavailable = items.filter((i) => !i.available);
      if (unavailable.length) {
        throw conflict('ITEM_UNAVAILABLE', `Món đã hết: ${unavailable.map((i) => i.name).join(', ')}`, {
          itemIds: unavailable.map((i) => i.id),
        });
      }

      const rules = await activeHappyHours(tx, itemIds);
      const created = await tx.orderRound.create({ data: { tabId: tab.id, createdById: req.user.sub, note: body.note } });
      await tx.orderLine.createMany({
        data: body.items.map((input) => {
          const item = byId.get(input.itemId)!;
          const price = resolveUnitPrice(item.id, item.price, rules, now);
          const isBeer = !!item.beerVolumeMl;
          return {
            roundId: created.id,
            itemId: item.id,
            itemName: item.name,
            qty: input.qty,
            unitPrice: price.unitPrice,
            happyHourId: price.happyHourId,
            lineType: 'NORMAL' as const,
            note: input.note,
            createdById: req.user.sub,
            createdAt: now,
            stationId: item.stationId,
            // FR-10: thể tích cộng dồn vào keg đang gắn ở vòi mặc định của món
            volumeMl: isBeer ? item.beerVolumeMl : null,
            kegId: isBeer ? (item.defaultTap?.currentKegId ?? null) : null,
          };
        }),
      });
      await audit(tx, req.user.sub, 'ROUND_CREATE', 'order_round', created.id, { tabId: tab.id, items: body.items });
      return { round: created, tableId: tab.tableId };
    });

    // Phiếu của trạm máy in mạng được gửi ngay; lượt vẫn được lưu dù máy in lỗi (FR-04)
    const tickets = await dispatchTickets(await buildRoundTickets(prisma, round.id));
    const printedStatus = roundStatusAfter(tickets) ?? round.printedStatus;
    if (printedStatus !== round.printedStatus) await prisma.orderRound.update({ where: { id: round.id }, data: { printedStatus } });
    emitTablesUpdated([tableId]);
    reply.code(201);
    return {
      round: { id: round.id, tabId: round.tabId, createdAt: round.createdAt, printedStatus },
      tickets,
      total: await getTabTotal(prisma, round.tabId),
    };
  });

  // App quầy báo kết quả in; FAILED → bàn chuyển đỏ (FR-02, FR-04)
  app.post('/rounds/:id/print-result', { preHandler: anyStaff }, async (req) => {
    const { id } = idParam.parse(req.params);
    const { status } = printResultBody.parse(req.body);
    const round = await prisma.orderRound.findUnique({ where: { id }, include: { tab: true } });
    if (!round) throw notFound('lượt gọi');
    await prisma.orderRound.update({ where: { id }, data: { printedStatus: status } });
    emitTablesUpdated([round.tab.tableId]);
    return { id, printedStatus: status };
  });

  // FR-04: nút "In lại" khi máy in lỗi; có thể in lại riêng một trạm
  app.post('/rounds/:id/reprint', { preHandler: anyStaff }, async (req) => {
    const { id } = idParam.parse(req.params);
    const body = reprintBody.parse(req.body ?? undefined);
    const round = await prisma.orderRound.findUnique({ where: { id }, include: { tab: true } });
    if (!round) throw notFound('lượt gọi');
    const tickets = await dispatchTickets(await buildRoundTickets(prisma, id, { stationId: body?.stationId, title: 'PHIẾU GỌI MÓN (IN LẠI)' }));
    const status = roundStatusAfter(tickets);
    if (status && status !== round.printedStatus) {
      await prisma.orderRound.update({ where: { id }, data: { printedStatus: status } });
      emitTablesUpdated([round.tab.tableId]);
    }
    await audit(prisma, req.user.sub, 'ROUND_REPRINT', 'order_round', id, { stationId: body?.stationId ?? null });
    return { tickets, printedStatus: status ?? round.printedStatus };
  });

  // FR-06: hủy món đã gửi — cần PIN Quản lý ca; tạo dòng điều chỉnh âm, không xóa dữ liệu
  app.post('/lines/:id/void', { preHandler: anyStaff }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = voidBody.parse(req.body);
    const approval = await verifyApproval(app, body.approvalToken);

    const { voidLine, tableId } = await prisma.$transaction(async (tx) => {
      const { line, tab, state } = await loadAdjustableLine(tx, id);
      const check = checkVoid(state, line.unitPrice, body.qty);
      if (!check.ok) throw badRequest(check.code, check.message);

      const created = await tx.orderLine.create({
        data: {
          roundId: line.roundId,
          itemId: line.itemId,
          itemName: line.itemName,
          qty: -body.qty,
          unitPrice: line.unitPrice,
          lineType: 'VOID',
          refLineId: line.id,
          reason: body.reason,
          reasonNote: body.note,
          createdById: req.user.sub,
          approvedById: approval.approver.id,
          happyHourId: line.happyHourId,
          stationId: line.stationId,
          // Hủy bia trừ lại thể tích đã bán của keg (xem README: quyết định cần nhóm xác nhận)
          kegId: line.kegId,
          volumeMl: line.volumeMl,
        },
      });
      await audit(tx, req.user.sub, 'LINE_VOID', 'order_line', created.id, {
        refLineId: line.id,
        qty: body.qty,
        amount: body.qty * line.unitPrice,
        reason: body.reason,
        approvedBy: approval.approver.id,
      });
      return { voidLine: created, tableId: tab.tableId };
    });

    approval.consume();
    emitTablesUpdated([tableId]);
    // FR-20: không chờ gửi xong để quầy không bị chậm
    void notifyLargeAdjustment({
      kind: 'VOID',
      amount: -voidLine.qty * voidLine.unitPrice,
      tableId,
      itemName: voidLine.itemName,
      qty: body.qty,
      reason: body.note || ADJUST_REASON_LABELS[body.reason],
      requester: req.user.name,
      approver: approval.approver.name,
    }).catch((err) => req.log.warn({ err }, 'Không gửi được thông báo đẩy'));
    reply.code(201);
    return {
      line: voidLine,
      // Phiếu báo hủy gửi về trạm (bếp/quầy rót) để không làm món nữa
      tickets: await dispatchTickets(await buildRoundTickets(prisma, voidLine.roundId, { lineIds: [voidLine.id], title: 'PHIẾU HỦY MÓN' })),
    };
  });

  // FR-06: giảm giá một món đã gửi (% hoặc số tiền) — cần PIN Quản lý ca
  app.post('/lines/:id/discount', { preHandler: anyStaff }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = discountBody.parse(req.body);
    const approval = await verifyApproval(app, body.approvalToken);

    const { discountLine, tableId } = await prisma.$transaction(async (tx) => {
      const { line, tab, state } = await loadAdjustableLine(tx, id);
      const amount = resolveDiscountAmount(state.netAmount, body);
      const check = checkDiscount(state, amount);
      if (!check.ok) throw badRequest(check.code, check.message);

      const created = await tx.orderLine.create({
        data: {
          roundId: line.roundId,
          itemId: line.itemId,
          itemName: line.itemName,
          qty: 1,
          unitPrice: -amount,
          lineType: 'DISCOUNT',
          refLineId: line.id,
          reason: body.reason,
          reasonNote: body.note,
          createdById: req.user.sub,
          approvedById: approval.approver.id,
          stationId: line.stationId,
        },
      });
      await audit(tx, req.user.sub, 'LINE_DISCOUNT', 'order_line', created.id, {
        refLineId: line.id,
        amount,
        percent: body.percent ?? null,
        reason: body.reason,
        approvedBy: approval.approver.id,
      });
      return { discountLine: created, tableId: tab.tableId };
    });

    approval.consume();
    emitTablesUpdated([tableId]);
    void notifyLargeAdjustment({
      kind: 'DISCOUNT',
      amount: -discountLine.unitPrice,
      tableId,
      itemName: discountLine.itemName,
      reason: body.note || ADJUST_REASON_LABELS[body.reason],
      requester: req.user.name,
      approver: approval.approver.name,
    }).catch((err) => req.log.warn({ err }, 'Không gửi được thông báo đẩy'));
    reply.code(201);
    return { line: discountLine };
  });
}

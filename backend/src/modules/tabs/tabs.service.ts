import type { z } from 'zod';
import { prisma, type Tx } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { resolveApprover } from '../../lib/approval.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { loadHappyPrices, priceOf } from '../../lib/pricing.js';
import { billLines, lineAmount, lineStates, tabTotal } from '../../lib/tab-total.js';
import type { AuthUser } from '../../middlewares/auth.js';
import {
  billNoOf,
  lockOpenTab,
  lockTables,
  subtotalOf,
  subtotalsByTab,
  tabDetailInclude,
  type TabWithDetail,
} from './tabs.repo.js';
import type * as s from './tabs.schema.js';

// FR-02 Sơ đồ bàn

export async function summary() {
  const [tables, openTabs] = await Promise.all([
    prisma.diningTable.findMany({
      where: { active: true, area: { active: true } },
      select: { id: true, code: true, areaId: true, sortOrder: true },
    }),
    prisma.tab.findMany({
      where: { status: 'OPEN' },
      select: { id: true, tableId: true, openedAt: true, guestCount: true, _count: { select: { prints: { where: { kind: 'PROVISIONAL' } } } } },
    }),
  ]);
  const subtotals = await subtotalsByTab(prisma, openTabs.map((t) => t.id));
  const byTable = new Map(openTabs.map((t) => [t.tableId, t]));

  let openAmount = 0;
  const rows = tables
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code, 'vi', { numeric: true }))
    .map((t) => {
      const tab = byTable.get(t.id);
      if (!tab) return { tableId: t.id, code: t.code, areaId: t.areaId, status: 'EMPTY' as const };
      const total = subtotals.get(tab.id) ?? 0;
      openAmount += total;
      return {
        tableId: t.id,
        code: t.code,
        areaId: t.areaId,
        status: tab._count.prints > 0 ? ('PROVISIONAL_PRINTED' as const) : ('OCCUPIED' as const),
        tabId: tab.id,
        total,
        guestCount: tab.guestCount,
        openedAt: tab.openedAt,
      };
    });

  return { occupied: rows.filter((r) => r.status !== 'EMPTY').length, totalTables: tables.length, openAmount, tables: rows };
}

// FR-03 Mở phiên bàn

export async function openTab(user: AuthUser, input: z.infer<typeof s.openTabSchema>) {
  return prisma.$transaction(async (tx) => {
    await lockTables(tx, [input.tableId]);
    const table = await tx.diningTable.findUnique({ where: { id: input.tableId } });
    if (!table || !table.active) throw notFound('Không tìm thấy bàn');

    const existing = await tx.tab.findFirst({ where: { tableId: input.tableId, status: 'OPEN' } });
    if (existing) throw conflict('TABLE_ALREADY_OPEN', 'Bàn đã được mở', { tabId: existing.id });

    const tab = await tx.tab.create({
      data: { tableId: input.tableId, guestCount: input.guestCount ?? null, openedById: user.id },
    });
    await audit(tx, user.id, 'TAB_OPENED', 'Tab', tab.id, { tableId: table.id, tableCode: table.code, guestCount: tab.guestCount });
    return { id: tab.id, tableId: tab.tableId, guestCount: tab.guestCount, status: tab.status, openedAt: tab.openedAt };
  });
}

// FR-04 Chi tiết phiên

function presentTab(tab: TabWithDetail) {
  const allLines = tab.rounds.flatMap((r) => r.lines);
  const states = lineStates(allLines);
  const subtotal = allLines.reduce((sum, l) => sum + lineAmount(l), 0);
  return {
    id: tab.id,
    billNo: tab.billNo ?? billNoOf(tab),
    status: tab.status,
    table: { id: tab.table.id, code: tab.table.code, areaId: tab.table.area.id, areaName: tab.table.area.name },
    guestCount: tab.guestCount,
    openedAt: tab.openedAt,
    openedBy: tab.openedBy,
    closedAt: tab.closedAt,
    mergedIntoId: tab.mergedIntoId,
    provisionalCount: tab.prints[0]?.printNo ?? 0,
    subtotal,
    billDiscount: tab.billDiscount,
    total: subtotal - tab.billDiscount,
    rounds: tab.rounds.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
      lines: r.lines.map((l) => {
        const st = states.get(l.id);
        return {
          id: l.id,
          menuItemId: l.menuItemId,
          name: l.menuItem.name,
          unit: l.menuItem.unit,
          stationId: l.menuItem.station.id,
          stationName: l.menuItem.station.name,
          qty: l.qty,
          unitPrice: l.unitPrice,
          amount: lineAmount(l),
          note: l.note,
          lineType: l.lineType,
          refLineId: l.refLineId,
          reason: l.reason,
          requestedBy: l.requestedBy,
          approvedBy: l.approvedBy,
          createdAt: l.createdAt,
          ...(st ? { remainingQty: st.remainingQty, discountAmount: st.discountAmount, netAmount: st.netAmount } : {}),
        };
      }),
    })),
  };
}

export async function getTab(id: number) {
  const tab = await prisma.tab.findUnique({ where: { id }, include: tabDetailInclude });
  if (!tab) throw notFound('Không tìm thấy phiên bàn');
  return presentTab(tab);
}

// FR-04 Gửi lượt gọi

export async function sendRound(user: AuthUser, tabId: number, input: z.infer<typeof s.sendRoundSchema>) {
  return prisma.$transaction(async (tx) => {
    await lockOpenTab(tx, tabId);
    const tab = await tx.tab.findUniqueOrThrow({ where: { id: tabId }, include: { table: true } });

    const ids = [...new Set(input.items.map((i) => i.menuItemId))];
    const items = await tx.menuItem.findMany({
      where: { id: { in: ids } },
      include: { station: true, defaultTap: { select: { id: true, currentKegId: true } } },
    });
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const id of ids) {
      const it = byId.get(id);
      if (!it || !it.active) throw notFound('Món không tồn tại hoặc đã ngừng bán');
      if (!it.available) throw conflict('ITEM_UNAVAILABLE', `Món "${it.name}" đã hết`, { menuItemId: it.id });
    }

    // Chốt giá tại thời điểm gửi (giờ vàng nếu đang trong khung)
    const now = new Date();
    const happy = await loadHappyPrices(tx, now);

    const round = await tx.orderRound.create({
      data: {
        tabId,
        createdById: user.id,
        createdAt: now,
        lines: {
          create: input.items.map((i) => {
            const it = byId.get(i.menuItemId)!;
            const isBeer = !!it.beerVolumeMl && !!it.defaultTap;
            return {
              menuItemId: it.id,
              qty: i.qty,
              unitPrice: priceOf(it, happy),
              note: i.note || null,
              tapId: isBeer ? it.defaultTap!.id : null,
              kegId: isBeer ? it.defaultTap!.currentKegId : null,
              createdAt: now,
            };
          }),
        },
      },
      include: { createdBy: { select: { id: true, fullName: true } } },
    });

    // Tách phiếu theo khu chế biến
    const tickets = new Map<number, { stationId: number; stationName: string; sortOrder: number; tableCode: string; lines: { name: string; qty: number; note: string | null }[] }>();
    for (const i of input.items) {
      const it = byId.get(i.menuItemId)!;
      const t = tickets.get(it.stationId) ?? {
        stationId: it.station.id,
        stationName: it.station.name,
        sortOrder: it.station.sortOrder,
        tableCode: tab.table.code,
        lines: [],
      };
      t.lines.push({ name: it.name, qty: i.qty, note: i.note || null });
      tickets.set(it.stationId, t);
    }

    await audit(tx, user.id, 'ROUND_SENT', 'Tab', tabId, {
      roundId: round.id,
      items: input.items.map((i) => ({ menuItemId: i.menuItemId, qty: i.qty })),
    });

    return {
      round: { id: round.id, tabId, createdAt: round.createdAt, createdBy: round.createdBy },
      tickets: [...tickets.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.stationId - b.stationId).map(({ sortOrder: _s, ...t }) => t),
      tabTotal: (await subtotalOf(tx, tabId)) - tab.billDiscount,
    };
  });
}

// FR-05 Chuyển / gộp bàn

async function loadTarget(tx: Tx, targetTableId: number) {
  const target = await tx.diningTable.findUnique({ where: { id: targetTableId } });
  if (!target || !target.active) throw notFound('Không tìm thấy bàn đích');
  const targetTab = await tx.tab.findFirst({ where: { tableId: targetTableId, status: 'OPEN' } });
  return { target, targetTab };
}

export async function moveTab(user: AuthUser, tabId: number, input: z.infer<typeof s.targetTableSchema>) {
  return prisma.$transaction(async (tx) => {
    const src = await tx.tab.findUnique({ where: { id: tabId }, include: { table: true } });
    if (!src) throw notFound('Không tìm thấy phiên bàn');
    await lockTables(tx, [src.tableId, input.targetTableId]);
    await lockOpenTab(tx, tabId);
    if (src.tableId === input.targetTableId) throw badRequest('SAME_TABLE', 'Bàn đích trùng bàn hiện tại');

    const { target, targetTab } = await loadTarget(tx, input.targetTableId);
    if (targetTab) throw conflict('TABLE_NOT_EMPTY', 'Bàn đích đang có khách, hãy dùng Gộp bàn');

    await tx.tab.update({ where: { id: tabId }, data: { tableId: target.id } });
    await audit(tx, user.id, 'TAB_MOVED', 'Tab', tabId, {
      fromTableId: src.tableId,
      fromCode: src.table.code,
      toTableId: target.id,
      toCode: target.code,
    });
    return { tabId, tableId: target.id, tableCode: target.code };
  });
}

export async function mergeTab(user: AuthUser, tabId: number, input: z.infer<typeof s.targetTableSchema>) {
  return prisma.$transaction(async (tx) => {
    const src = await tx.tab.findUnique({ where: { id: tabId }, include: { table: true } });
    if (!src) throw notFound('Không tìm thấy phiên bàn');
    await lockTables(tx, [src.tableId, input.targetTableId]);
    if (src.tableId === input.targetTableId) throw badRequest('SAME_TABLE', 'Bàn đích trùng bàn hiện tại');

    const { target, targetTab } = await loadTarget(tx, input.targetTableId);
    if (!targetTab) throw conflict('TABLE_EMPTY', 'Bàn đích đang trống, hãy dùng Chuyển bàn');

    // khóa hai phiên theo thứ tự id
    for (const id of [tabId, targetTab.id].sort((a, b) => a - b)) await lockOpenTab(tx, id);

    const movedAmount = await subtotalOf(tx, tabId);
    await tx.orderRound.updateMany({ where: { tabId }, data: { tabId: targetTab.id } });
    await tx.tab.update({
      where: { id: tabId },
      data: { status: 'MERGED', mergedIntoId: targetTab.id, closedAt: new Date() },
    });
    if (src.guestCount || targetTab.guestCount) {
      await tx.tab.update({
        where: { id: targetTab.id },
        data: { guestCount: (src.guestCount ?? 0) + (targetTab.guestCount ?? 0) },
      });
    }
    await audit(tx, user.id, 'TAB_MERGED', 'Tab', tabId, {
      fromTabId: tabId,
      fromTableId: src.tableId,
      fromCode: src.table.code,
      toTabId: targetTab.id,
      toTableId: target.id,
      toCode: target.code,
      amount: movedAmount,
    });
    return {
      targetTabId: targetTab.id,
      tableId: target.id,
      tableCode: target.code,
      tabTotal: (await subtotalOf(tx, targetTab.id)) - targetTab.billDiscount,
    };
  });
}

// FR-06 Hủy / giảm món đã gửi

async function loadLineForAdjust(tx: Tx, lineId: number) {
  const line = await tx.orderLine.findUnique({ where: { id: lineId }, include: { round: true, menuItem: true } });
  if (!line) throw notFound('Không tìm thấy món');
  if (line.lineType !== 'NORMAL') throw badRequest('VALIDATION_ERROR', 'Chỉ hủy/giảm được dòng món gốc');
  await lockOpenTab(tx, line.round.tabId);
  const adjustments = await tx.orderLine.findMany({ where: { refLineId: lineId } });
  const state = lineStates([line, ...adjustments]).get(line.id)!;
  return { line, state };
}

export async function voidLine(user: AuthUser, lineId: number, input: z.infer<typeof s.voidSchema>) {
  return prisma.$transaction(async (tx) => {
    const { line, state } = await loadLineForAdjust(tx, lineId);
    if (input.qty > state.remainingQty) {
      throw badRequest('QTY_EXCEEDED', `Không hủy được nhiều hơn số lượng còn lại (${state.remainingQty})`, {
        remainingQty: state.remainingQty,
      });
    }
    if (state.netAmount - input.qty * line.unitPrice < 0) {
      throw badRequest('VALIDATION_ERROR', 'Món này đã được giảm giá, hủy số lượng này sẽ làm tiền món bị âm');
    }
    const approvedById = await resolveApprover(tx, user, input.approverPin);

    const v = await tx.orderLine.create({
      data: {
        roundId: line.roundId,
        menuItemId: line.menuItemId,
        qty: -input.qty,
        unitPrice: line.unitPrice,
        lineType: 'VOID',
        refLineId: line.id,
        reason: input.reason,
        note: input.note || null,
        requestedById: user.id,
        approvedById,
        tapId: line.tapId,
        kegId: line.kegId,
      },
    });
    await audit(tx, user.id, 'LINE_VOIDED', 'OrderLine', line.id, {
      tabId: line.round.tabId,
      qty: input.qty,
      amount: input.qty * line.unitPrice,
      reason: input.reason,
      approvedById,
    });
    return {
      id: v.id,
      lineType: v.lineType,
      refLineId: v.refLineId,
      qty: v.qty,
      unitPrice: v.unitPrice,
      reason: v.reason,
      note: v.note,
      requestedBy: v.requestedById,
      approvedBy: v.approvedById,
      tabTotal: await tabTotalOf(tx, line.round.tabId),
    };
  });
}

export async function discountLine(user: AuthUser, lineId: number, input: z.infer<typeof s.discountSchema>) {
  return prisma.$transaction(async (tx) => {
    const { line, state } = await loadLineForAdjust(tx, lineId);
    const amount = input.type === 'PERCENT' ? Math.round((state.netAmount * input.value) / 100) : Math.round(input.value);
    if (amount <= 0) throw badRequest('VALIDATION_ERROR', 'Số tiền giảm phải lớn hơn 0');
    if (amount > state.netAmount) {
      throw badRequest('DISCOUNT_EXCEEDED', `Không giảm được nhiều hơn tiền còn lại của món (${state.netAmount})`, {
        netAmount: state.netAmount,
      });
    }
    const approvedById = await resolveApprover(tx, user, input.approverPin);

    const d = await tx.orderLine.create({
      data: {
        roundId: line.roundId,
        menuItemId: line.menuItemId,
        qty: 1,
        unitPrice: -amount,
        lineType: 'DISCOUNT',
        refLineId: line.id,
        reason: input.reason,
        note: input.note || null,
        requestedById: user.id,
        approvedById,
      },
    });
    await audit(tx, user.id, 'LINE_DISCOUNTED', 'OrderLine', line.id, {
      tabId: line.round.tabId,
      type: input.type,
      value: input.value,
      amount,
      reason: input.reason,
      approvedById,
    });
    return {
      id: d.id,
      lineType: d.lineType,
      refLineId: d.refLineId,
      qty: d.qty,
      unitPrice: d.unitPrice,
      reason: d.reason,
      note: d.note,
      requestedBy: d.requestedById,
      approvedBy: d.approvedById,
      tabTotal: await tabTotalOf(tx, line.round.tabId),
    };
  });
}

async function tabTotalOf(tx: Tx, tabId: number) {
  const tab = await tx.tab.findUniqueOrThrow({ where: { id: tabId }, select: { billDiscount: true } });
  return (await subtotalOf(tx, tabId)) - tab.billDiscount;
}

// FR-07 In tạm tính

/** Dữ liệu hóa đơn (dùng chung cho tạm tính và hóa đơn cuối). */
export function buildBill(tab: TabWithDetail) {
  const allLines = tab.rounds.flatMap((r) => r.lines.map((l) => ({ ...l, name: l.menuItem.name })));
  const lines = billLines(allLines);
  const subtotal = allLines.reduce((sum, l) => sum + lineAmount(l), 0);
  return {
    tabId: tab.id,
    billNo: tab.billNo ?? billNoOf(tab),
    tableCode: tab.table.code,
    areaName: tab.table.area.name,
    guestCount: tab.guestCount,
    openedAt: tab.openedAt,
    lines: lines.map(({ menuItemId: _m, ...l }) => l),
    subtotal,
    discount: tab.billDiscount,
    total: tabTotal(allLines, tab.billDiscount),
  };
}

export async function printProvisional(user: AuthUser, tabId: number) {
  return prisma.$transaction(async (tx) => {
    await lockOpenTab(tx, tabId);
    const last = await tx.billPrint.findFirst({ where: { tabId, kind: 'PROVISIONAL' }, orderBy: { printNo: 'desc' } });
    const print = await tx.billPrint.create({ data: { tabId, kind: 'PROVISIONAL', printNo: (last?.printNo ?? 0) + 1 } });
    const tab = await tx.tab.findUniqueOrThrow({ where: { id: tabId }, include: tabDetailInclude });
    const bill = buildBill(tab);
    await audit(tx, user.id, 'PROVISIONAL_PRINTED', 'Tab', tabId, { printNo: print.printNo, total: bill.total });
    return { ...bill, kind: 'PROVISIONAL' as const, printNo: print.printNo, printedAt: print.printedAt, printedBy: user.fullName };
  });
}

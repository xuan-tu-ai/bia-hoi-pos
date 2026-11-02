import {
  billCode,
  buildBillBody,
  formatVnTime,
  lineState,
  tabTotal,
  tableStatus,
  type BillBody,
} from '@biahoi/shared';
import type { BillKind } from '@prisma/client';
import { conflict, notFound } from '../lib/errors';
import { lockTab, prisma, type Tx } from '../lib/prisma';

type Db = Tx | typeof prisma;

/** Khóa phiên bàn và bảo đảm phiên đang mở; dùng ở đầu mọi thao tác ghi trên phiên. */
export async function requireOpenTab(tx: Tx, tabId: number) {
  await lockTab(tx, tabId);
  const tab = await tx.tab.findUnique({ where: { id: tabId } });
  if (!tab) throw notFound('phiên bàn');
  if (tab.status !== 'OPEN') {
    throw conflict('TAB_NOT_OPEN', tab.status === 'PAID' ? 'Phiên bàn đã thanh toán' : 'Phiên bàn đã được gộp sang bàn khác');
  }
  return tab;
}

export async function getTabTotal(db: Db, tabId: number): Promise<number> {
  const lines = await db.orderLine.findMany({ where: { round: { tabId } }, select: { qty: true, unitPrice: true } });
  const discounts = await db.billDiscount.findMany({ where: { tabId }, select: { amount: true } });
  return tabTotal(lines, discounts);
}

const staffName = { select: { id: true, name: true } } as const;

/** Chi tiết phiên bàn cho panel gọi món, màn thanh toán. */
export async function getTabDetail(db: Db, tabId: number) {
  const tab = await db.tab.findUnique({
    where: { id: tabId },
    include: {
      table: { include: { area: true } },
      openedBy: staffName,
      rounds: {
        orderBy: { id: 'asc' },
        include: {
          createdBy: staffName,
          lines: { orderBy: { id: 'asc' }, include: { createdBy: staffName, approvedBy: staffName } },
        },
      },
      billDiscounts: { orderBy: { id: 'asc' }, include: { createdBy: staffName, approvedBy: staffName } },
      payments: { orderBy: { id: 'asc' }, include: { receivedBy: staffName } },
      billPrints: { orderBy: { id: 'asc' } },
    },
  });
  if (!tab) throw notFound('phiên bàn');

  const allLines = tab.rounds.flatMap((r) => r.lines);
  const adjustmentsOf = (id: number) => allLines.filter((l) => l.refLineId === id);
  const provisionalCount = tab.billPrints.filter((p) => p.kind === 'PROVISIONAL').length;

  return {
    id: tab.id,
    billCode: billCode(tab.id),
    status: tab.status,
    tableStatus: tab.status === 'OPEN'
      ? tableStatus({ hasPrintError: tab.rounds.some((r) => r.printedStatus === 'FAILED'), provisionalCount })
      : null,
    table: { id: tab.table.id, code: tab.table.code, areaId: tab.table.areaId, areaName: tab.table.area.name },
    openedAt: tab.openedAt,
    openedBy: tab.openedBy,
    guestCount: tab.guestCount,
    closedAt: tab.closedAt,
    mergedIntoId: tab.mergedIntoId,
    total: tabTotal(allLines, tab.billDiscounts),
    paidAmount: tab.payments.reduce((s, p) => s + p.amount, 0),
    provisionalCount,
    rounds: tab.rounds.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
      printedStatus: r.printedStatus,
      note: r.note,
      lines: r.lines.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        itemName: l.itemName,
        qty: l.qty,
        unitPrice: l.unitPrice,
        amount: l.qty * l.unitPrice,
        lineType: l.lineType,
        refLineId: l.refLineId,
        reason: l.reason,
        reasonNote: l.reasonNote,
        note: l.note,
        createdAt: l.createdAt,
        createdBy: l.createdBy,
        approvedBy: l.approvedBy,
        happyHourId: l.happyHourId,
        ...(l.lineType === 'NORMAL' ? { state: lineState(l, adjustmentsOf(l.id)) } : {}),
      })),
    })),
    billDiscounts: tab.billDiscounts.map((d) => ({
      id: d.id,
      amount: d.amount,
      percent: d.percent,
      reason: d.reason,
      reasonNote: d.reasonNote,
      createdAt: d.createdAt,
      createdBy: d.createdBy,
      approvedBy: d.approvedBy,
    })),
    payments: tab.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: p.amount,
      tendered: p.tendered,
      createdAt: p.createdAt,
      receivedBy: p.receivedBy,
    })),
    billPrints: tab.billPrints.map((p) => ({ kind: p.kind, printNo: p.printNo, printedAt: p.printedAt })),
  };
}

export interface PrintedBill extends BillBody {
  kind: BillKind;
  title: string;
  billCode: string;
  tableCode: string;
  areaName: string;
  openedAt: Date;
  printedAt: Date;
  printNo: number;
  guestCount: number | null;
  payments?: { method: string; amount: number; tendered: number | null }[];
  change?: number;
}

/** Dữ liệu để App quầy in tạm tính (FR-07) hoặc hóa đơn chính thức (FR-08). */
export async function buildPrintedBill(db: Db, tabId: number, kind: BillKind, printNo: number, printedAt: Date): Promise<PrintedBill> {
  const tab = await db.tab.findUniqueOrThrow({
    where: { id: tabId },
    include: { table: { include: { area: true } }, billDiscounts: { orderBy: { id: 'asc' } }, payments: { orderBy: { id: 'asc' } } },
  });
  const lines = await db.orderLine.findMany({
    where: { round: { tabId } },
    orderBy: { id: 'asc' },
    select: { itemName: true, qty: true, unitPrice: true, lineType: true },
  });
  const body = buildBillBody(lines, tab.billDiscounts);
  const code = billCode(tab.id);
  const bill: PrintedBill = {
    ...body,
    kind,
    title: kind === 'PROVISIONAL' ? `Tạm tính — lần in ${printNo} — ${formatVnTime(printedAt)}` : `Hóa đơn ${code}`,
    billCode: code,
    tableCode: tab.table.code,
    areaName: tab.table.area.name,
    openedAt: tab.openedAt,
    printedAt,
    printNo,
    guestCount: tab.guestCount,
  };
  if (kind === 'FINAL') {
    bill.payments = tab.payments.map((p) => ({ method: p.method, amount: p.amount, tendered: p.tendered }));
    bill.change = tab.payments.reduce((s, p) => s + (p.tendered !== null ? p.tendered - p.amount : 0), 0);
  }
  return bill;
}

export interface PrintTicket {
  title: string;
  stationId: number | null;
  stationName: string;
  /** Tên máy in Windows trên máy quầy; null = chưa cấu hình trạm → in PDF (NFR-08) */
  printerName: string | null;
  roundId: number;
  tableCode: string;
  areaName: string;
  time: string;
  createdAt: Date;
  staffName: string;
  note: string | null;
  lines: { name: string; qty: number; note: string | null }[];
}

/**
 * Tách các dòng của một lượt gọi theo trạm in, mỗi trạm một phiếu (FR-04).
 * `lineIds` để in riêng một số dòng (vd phiếu hủy món).
 */
export async function buildRoundTickets(
  db: Db,
  roundId: number,
  opts: { lineIds?: number[]; title?: string; stationId?: number } = {},
): Promise<PrintTicket[]> {
  const round = await db.orderRound.findUnique({
    where: { id: roundId },
    include: {
      tab: { include: { table: { include: { area: true } } } },
      createdBy: true,
      lines: {
        where: opts.lineIds ? { id: { in: opts.lineIds } } : { lineType: 'NORMAL' },
        orderBy: { id: 'asc' },
        include: { station: true, createdBy: true },
      },
    },
  });
  if (!round) throw notFound('lượt gọi');

  const byStation = new Map<number | null, PrintTicket>();
  for (const line of round.lines) {
    if (opts.stationId !== undefined && line.stationId !== opts.stationId) continue;
    let ticket = byStation.get(line.stationId);
    if (!ticket) {
      const at = opts.lineIds ? line.createdAt : round.createdAt;
      ticket = {
        title: opts.title ?? 'PHIẾU GỌI MÓN',
        stationId: line.stationId,
        stationName: line.station?.name ?? 'Chưa gán trạm',
        printerName: line.station?.printerName ?? null,
        roundId: round.id,
        tableCode: round.tab.table.code,
        areaName: round.tab.table.area.name,
        time: formatVnTime(at),
        createdAt: at,
        staffName: opts.lineIds ? line.createdBy.name : round.createdBy.name,
        note: opts.lineIds ? null : round.note,
        lines: [],
      };
      byStation.set(line.stationId, ticket);
    }
    ticket.lines.push({ name: line.itemName, qty: Math.abs(line.qty), note: line.note ?? line.reasonNote });
  }
  return [...byStation.values()];
}

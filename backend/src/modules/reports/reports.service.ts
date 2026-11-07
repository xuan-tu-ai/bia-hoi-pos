import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { badRequest } from '../../lib/errors.js';
import { addDays, daysInclusive, startOfVnDay, vnDateString, vnDayRange, vnHour } from '../../lib/time.js';
import { summary as tableSummary } from '../tabs/tabs.service.js';
import { staffOptions } from '../staff/staff.service.js';
import type * as s from './reports.schema.js';

/** Khoảng ngày [from 0h, to+1 0h) theo giờ VN; mặc định `defaultDays` ngày gần nhất. */
function resolveRange(from: string | undefined, to: string | undefined, defaultDays: number, maxDays?: number) {
  const toStr = to ?? vnDateString(new Date());
  const fromStr = from ?? vnDateString(addDays(vnDayRange(toStr).start, -(defaultDays - 1)));
  if (fromStr > toStr) throw badRequest('VALIDATION_ERROR', 'Ngày bắt đầu phải trước ngày kết thúc');
  if (maxDays && daysInclusive(fromStr, toStr) > maxDays) {
    throw badRequest('RANGE_TOO_LARGE', `Chỉ chọn được tối đa ${maxDays} ngày`);
  }
  return { from: fromStr, to: toStr, start: vnDayRange(fromStr).start, end: vnDayRange(toStr).end };
}

const pctChange = (cur: number, prev: number) => (prev === 0 ? null : Math.round(((cur - prev) / prev) * 1000) / 10);

// FR-16 Tổng quan hôm nay

async function revenueBetween(start: Date, end: Date) {
  const [pay, bills] = await Promise.all([
    prisma.payment.groupBy({ by: ['method'], where: { createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    prisma.tab.count({ where: { status: 'PAID', closedAt: { gte: start, lt: end } } }),
  ]);
  const cash = pay.find((p) => p.method === 'CASH')?._sum.amount ?? 0;
  const transfer = pay.find((p) => p.method === 'TRANSFER')?._sum.amount ?? 0;
  return { revenue: cash + transfer, cash, transfer, bills };
}

/** Bàn đang ngồi và tạm tính đang mở tại một thời điểm trong quá khứ (để so "cùng giờ hôm qua"). */
async function openStateAt(at: Date) {
  const [occ] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM "Tab" t
    WHERE t."openedAt" <= ${at} AND (t."closedAt" IS NULL OR t."closedAt" > ${at})`;
  const [amt] = await prisma.$queryRaw<{ s: bigint }[]>`
    SELECT COALESCE(SUM(l.qty * l."unitPrice"), 0)::bigint AS s
    FROM "OrderLine" l JOIN "OrderRound" r ON r.id = l."roundId" JOIN "Tab" t ON t.id = r."tabId"
    WHERE l."createdAt" <= ${at} AND t."openedAt" <= ${at} AND (t."closedAt" IS NULL OR t."closedAt" > ${at})`;
  return { occupied: Number(occ.n), openAmount: Number(amt.s) };
}

async function hourlyRevenue(start: Date, end: Date) {
  const buckets = Array.from({ length: 24 }, () => 0);
  const rows = await prisma.payment.findMany({ where: { createdAt: { gte: start, lt: end } }, select: { createdAt: true, amount: true } });
  for (const r of rows) buckets[vnHour(r.createdAt)] += r.amount;
  return buckets;
}

export async function today() {
  const now = new Date();
  const todayStart = startOfVnDay(now);
  const yStart = addDays(todayStart, -1);
  const ySameTime = addDays(now, -1);

  const [cur, prev, tables, prevOpen, hToday, hYesterday] = await Promise.all([
    revenueBetween(todayStart, now),
    revenueBetween(yStart, ySameTime),
    tableSummary(),
    openStateAt(ySameTime),
    hourlyRevenue(todayStart, addDays(todayStart, 1)),
    hourlyRevenue(yStart, todayStart),
  ]);

  return {
    generatedAt: now,
    revenue: { value: cur.revenue, yesterday: prev.revenue, changePercent: pctChange(cur.revenue, prev.revenue) },
    openAmount: { value: tables.openAmount, yesterday: prevOpen.openAmount, changePercent: pctChange(tables.openAmount, prevOpen.openAmount) },
    occupiedTables: {
      value: tables.occupied,
      total: tables.totalTables,
      yesterday: prevOpen.occupied,
      changePercent: pctChange(tables.occupied, prevOpen.occupied),
    },
    bills: { value: cur.bills, yesterday: prev.bills, changePercent: pctChange(cur.bills, prev.bills) },
    hourly: hToday.map((v, hour) => ({ hour, today: v, yesterday: hYesterday[hour] })),
    paymentSplit: { cash: cur.cash, transfer: cur.transfer },
  };
}

// FR-17 Hao hụt keg

export async function kegLoss(q: z.infer<typeof s.kegLossQuery>) {
  const r = resolveRange(q.from, q.to, 30);
  const kegs = await prisma.keg.findMany({
    where: { status: 'EMPTY', emptiedAt: { gte: r.start, lt: r.end } },
    include: { tap: { select: { name: true } } },
    orderBy: { emptiedAt: 'desc' },
  });

  let totalLossMl = 0;
  let totalLossAmount = 0;
  const rows = kegs.map((k) => {
    const soldMl = k.soldMl ?? 0;
    const lossMl = k.capacityMl - soldMl;
    const lossPercent = Math.round((lossMl / k.capacityMl) * 1000) / 10;
    const lossAmount = Math.round((lossMl * k.cost) / k.capacityMl);
    totalLossMl += lossMl;
    totalLossAmount += lossAmount;
    return {
      kegId: k.id,
      code: k.code,
      beerName: k.beerName,
      tapName: k.tap?.name ?? null,
      capacityMl: k.capacityMl,
      soldMl,
      lossMl,
      lossPercent,
      lossAmount,
      tappedAt: k.tappedAt,
      emptiedAt: k.emptiedAt,
      durationMinutes: k.tappedAt && k.emptiedAt ? Math.round((k.emptiedAt.getTime() - k.tappedAt.getTime()) / 60000) : null,
      overThreshold: lossPercent > q.threshold,
    };
  });

  return {
    from: r.from,
    to: r.to,
    threshold: q.threshold,
    totalLossLiters: Math.round(totalLossMl / 100) / 10,
    totalLossAmount,
    kegs: rows,
  };
}

// FR-18 Nhật ký hủy/giảm

export async function voids(q: z.infer<typeof s.voidsQuery>) {
  const r = resolveRange(q.from, q.to, 7);
  const staff = { select: { id: true, fullName: true } } as const;

  const lineTypes = q.type === 'BILL_DISCOUNT' ? [] : q.type ? [q.type] : (['VOID', 'DISCOUNT'] as const);
  const [lines, bills, people] = await Promise.all([
    lineTypes.length
      ? prisma.orderLine.findMany({
          where: {
            lineType: { in: [...lineTypes] },
            createdAt: { gte: r.start, lt: r.end },
            ...(q.staffId ? { requestedById: q.staffId } : {}),
            ...(q.approverId ? { approvedById: q.approverId } : {}),
            ...(q.reason ? { reason: q.reason } : {}),
          },
          include: {
            menuItem: { select: { name: true } },
            requestedBy: staff,
            approvedBy: staff,
            round: { select: { tab: { select: { id: true, table: { select: { code: true } } } } } },
          },
        })
      : [],
    !q.type || q.type === 'BILL_DISCOUNT'
      ? prisma.tab.findMany({
          where: {
            status: 'PAID',
            billDiscount: { gt: 0 },
            closedAt: { gte: r.start, lt: r.end },
            ...(q.staffId ? { billDiscountById: q.staffId } : {}),
            ...(q.approverId ? { billDiscountApprovedById: q.approverId } : {}),
            ...(q.reason ? { billDiscountReason: q.reason } : {}),
          },
          include: { table: { select: { code: true } }, billDiscountBy: staff, billDiscountApprovedBy: staff },
        })
      : [],
    staffOptions(),
  ]);

  const items = [
    ...lines.map((l) => ({
      id: `L${l.id}`,
      type: l.lineType as 'VOID' | 'DISCOUNT',
      createdAt: l.createdAt,
      tabId: l.round.tab.id,
      tableCode: l.round.tab.table.code,
      itemName: l.menuItem.name,
      qty: l.lineType === 'VOID' ? -l.qty : null,
      amount: -(l.qty * l.unitPrice),
      reason: l.reason,
      note: l.note,
      requestedBy: l.requestedBy,
      approvedBy: l.approvedBy,
    })),
    ...bills.map((t) => ({
      id: `B${t.id}`,
      type: 'BILL_DISCOUNT' as const,
      createdAt: t.closedAt!,
      tabId: t.id,
      tableCode: t.table.code,
      itemName: `Giảm giá hóa đơn ${t.billNo ?? ''}`.trim(),
      qty: null,
      amount: t.billDiscount,
      reason: t.billDiscountReason,
      note: t.billDiscountNote,
      requestedBy: t.billDiscountBy,
      approvedBy: t.billDiscountApprovedBy,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const sum = (t: string) => items.filter((i) => i.type === t).reduce((acc, i) => acc + i.amount, 0);
  return {
    from: r.from,
    to: r.to,
    count: items.length,
    totalAmount: items.reduce((acc, i) => acc + i.amount, 0),
    voidAmount: sum('VOID'),
    discountAmount: sum('DISCOUNT') + sum('BILL_DISCOUNT'),
    items,
    /** Danh sách nhân viên cho bộ lọc (Quản lý ca không có quyền gọi /api/staff). */
    people,
  };
}

// FR-19 Món bán chạy & doanh thu theo giờ

export async function topItems(q: z.infer<typeof s.topItemsQuery>) {
  const r = resolveRange(q.from, q.to, 7, 31);
  const orderBy = q.by === 'revenue' ? Prisma.sql`revenue DESC, qty DESC` : Prisma.sql`qty DESC, revenue DESC`;
  const rows = await prisma.$queryRaw<{ menuItemId: number; name: string; qty: bigint; revenue: bigint }[]>`
    SELECT m.id AS "menuItemId", m.name,
      COALESCE(SUM(CASE WHEN l."lineType" IN ('NORMAL', 'VOID') THEN l.qty ELSE 0 END), 0)::bigint AS qty,
      COALESCE(SUM(l.qty * l."unitPrice"), 0)::bigint AS revenue
    FROM "OrderLine" l
      JOIN "OrderRound" r ON r.id = l."roundId"
      JOIN "Tab" t ON t.id = r."tabId"
      JOIN "MenuItem" m ON m.id = l."menuItemId"
    WHERE t.status = 'PAID' AND t."closedAt" >= ${r.start} AND t."closedAt" < ${r.end}
    GROUP BY m.id, m.name
    HAVING SUM(CASE WHEN l."lineType" IN ('NORMAL', 'VOID') THEN l.qty ELSE 0 END) > 0
    ORDER BY ${orderBy}
    LIMIT ${q.limit}`;
  return {
    from: r.from,
    to: r.to,
    by: q.by,
    items: rows.map((x) => ({ menuItemId: x.menuItemId, name: x.name, qty: Number(x.qty), revenue: Number(x.revenue) })),
  };
}

export async function hourly(q: z.infer<typeof s.hourlyQuery>) {
  const r = resolveRange(q.from, q.to, 7, 31);
  const [payments, tabs] = await Promise.all([
    prisma.payment.findMany({ where: { createdAt: { gte: r.start, lt: r.end } }, select: { createdAt: true, amount: true } }),
    prisma.tab.findMany({ where: { status: 'PAID', closedAt: { gte: r.start, lt: r.end } }, select: { closedAt: true } }),
  ]);
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, bills: 0 }));
  for (const p of payments) hours[vnHour(p.createdAt)].revenue += p.amount;
  for (const t of tabs) hours[vnHour(t.closedAt!)].bills += 1;
  const days = daysInclusive(r.from, r.to);
  return { from: r.from, to: r.to, days, hours };
}

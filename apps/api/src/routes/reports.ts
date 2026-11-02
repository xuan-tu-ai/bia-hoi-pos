// Báo cáo cho PWA chủ quán (FR-16..FR-19). Dữ liệu một quán nhỏ nên tổng hợp bằng
// JavaScript sau khi lọc theo khoảng ngày là đủ nhanh (FR-19: ≤ 3 giây với dữ liệu demo).

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ADJUST_REASONS, ADJUST_REASON_LABELS, DAY_MS, kegLoss, tabTotal, vnParts, vnStartOfDay } from '@biahoi/shared';
import { config } from '../config';
import { managerOnly } from '../lib/auth';
import { prisma } from '../lib/prisma';
import { dateRangeQuery, resolveDateRange } from '../lib/validate';
import { soldMlByKeg } from './kegs';

async function revenueBetween(from: Date, to: Date): Promise<number> {
  const r = await prisma.payment.aggregate({ where: { createdAt: { gte: from, lt: to } }, _sum: { amount: true } });
  return r._sum.amount ?? 0;
}

const billsBetween = (from: Date, to: Date) => prisma.tab.count({ where: { status: 'PAID', closedAt: { gte: from, lt: to } } });

const voidsQuery = dateRangeQuery.extend({
  staffId: z.coerce.number().int().positive().optional(),
  approverId: z.coerce.number().int().positive().optional(),
  reason: z.enum(ADJUST_REASONS).optional(),
});

const topItemsQuery = dateRangeQuery.extend({
  by: z.enum(['qty', 'revenue']).default('qty'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const kegLossQuery = dateRangeQuery.extend({ threshold: z.coerce.number().min(0).max(100).optional() });

export async function reportRoutes(app: FastifyInstance) {
  // FR-16: dashboard hôm nay, so với cùng thời điểm hôm qua
  app.get('/reports/today', { preHandler: managerOnly }, async () => {
    const now = new Date();
    const today = vnStartOfDay(now);
    const yesterday = new Date(today.getTime() - DAY_MS);
    const yesterdayNow = new Date(now.getTime() - DAY_MS);

    const openTabs = await prisma.tab.findMany({
      where: { status: 'OPEN' },
      select: { rounds: { select: { lines: { select: { qty: true, unitPrice: true } } } }, billDiscounts: { select: { amount: true } } },
    });

    return {
      asOf: now,
      revenue: await revenueBetween(today, now),
      openTotal: openTabs.reduce((s, t) => s + tabTotal(t.rounds.flatMap((r) => r.lines), t.billDiscounts), 0),
      occupiedTables: openTabs.length,
      totalTables: await prisma.diningTable.count({ where: { active: true } }),
      billCount: await billsBetween(today, now),
      yesterday: {
        revenue: await revenueBetween(yesterday, yesterdayNow),
        billCount: await billsBetween(yesterday, yesterdayNow),
      },
    };
  });

  // FR-17: hao hụt các keg đã hết; mặc định lọc theo ngày keg hết trong 31 ngày gần nhất
  app.get('/reports/keg-loss', { preHandler: managerOnly }, async (req) => {
    const q = kegLossQuery.parse(req.query);
    const threshold = q.threshold ?? config.kegLossThresholdPct;
    const range = q.from
      ? resolveDateRange(q, 366)
      : { start: new Date(vnStartOfDay(new Date()).getTime() - 30 * DAY_MS), end: new Date(Date.now() + DAY_MS) };

    const kegs = await prisma.keg.findMany({
      where: { status: 'EMPTY', emptiedAt: { gte: range.start, lt: range.end } },
      orderBy: { emptiedAt: 'desc' },
      include: { tap: { select: { id: true, name: true } } },
    });
    const sold = await soldMlByKeg(kegs.map((k) => k.id));

    const rows = kegs.map((k) => {
      const soldMl = sold.get(k.id) ?? 0;
      const loss = kegLoss(k.capacityMl, soldMl, threshold);
      return {
        id: k.id,
        beerName: k.beerName,
        tap: k.tap,
        capacityMl: k.capacityMl,
        soldMl,
        ...loss,
        cost: k.cost,
        /** Tiền bia mất, quy theo giá nhập keg */
        lossValue: Math.round((k.cost * Math.max(0, loss.lossMl)) / k.capacityMl),
        tappedAt: k.tappedAt,
        emptiedAt: k.emptiedAt,
        durationMinutes: k.tappedAt && k.emptiedAt ? Math.round((k.emptiedAt.getTime() - k.tappedAt.getTime()) / 60_000) : null,
      };
    });
    return {
      thresholdPct: threshold,
      rows,
      summary: {
        kegCount: rows.length,
        totalLossMl: rows.reduce((s, r) => s + r.lossMl, 0),
        totalLossValue: rows.reduce((s, r) => s + r.lossValue, 0),
        soldMl: rows.reduce((s, r) => s + r.soldMl, 0),
        capacityMl: rows.reduce((s, r) => s + r.capacityMl, 0),
        exceededCount: rows.filter((r) => r.exceeded).length,
      },
    };
  });

  // FR-18: nhật ký hủy/giảm món (FR-06) và giảm giá hóa đơn (FR-08)
  app.get('/reports/voids', { preHandler: managerOnly }, async (req) => {
    const q = voidsQuery.parse(req.query);
    const { start, end } = resolveDateRange(q, 31);
    const filter = {
      createdAt: { gte: start, lt: end },
      createdById: q.staffId,
      approvedById: q.approverId,
      reason: q.reason,
    };
    const people = { createdBy: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } } } as const;

    const lines = await prisma.orderLine.findMany({
      where: { ...filter, lineType: { in: ['VOID', 'DISCOUNT'] } },
      include: { ...people, round: { include: { tab: { include: { table: true } } } } },
    });
    const discounts = await prisma.billDiscount.findMany({ where: filter, include: { ...people, tab: { include: { table: true } } } });

    const rows = [
      ...lines.map((l) => ({
        id: `line-${l.id}`,
        type: l.lineType as 'VOID' | 'DISCOUNT',
        itemName: l.itemName,
        qty: l.lineType === 'VOID' ? -l.qty : null,
        amount: -(l.qty * l.unitPrice),
        reason: l.reason,
        reasonLabel: l.reason ? ADJUST_REASON_LABELS[l.reason] : null,
        reasonNote: l.reasonNote,
        tabId: l.round.tabId,
        tableCode: l.round.tab.table.code,
        requestedBy: l.createdBy,
        approvedBy: l.approvedBy,
        createdAt: l.createdAt,
      })),
      ...discounts.map((d) => ({
        id: `bill-${d.id}`,
        type: 'BILL_DISCOUNT' as const,
        itemName: null,
        qty: null,
        amount: -d.amount,
        reason: d.reason,
        reasonLabel: ADJUST_REASON_LABELS[d.reason],
        reasonNote: d.reasonNote,
        tabId: d.tabId,
        tableCode: d.tab.table.code,
        requestedBy: d.createdBy,
        approvedBy: d.approvedBy,
        createdAt: d.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return { rows, total: rows.reduce((s, r) => s + r.amount, 0), count: rows.length };
  });

  // FR-19: top món theo số lượng (đã trừ hủy) hoặc doanh thu (đã trừ hủy, giảm)
  app.get('/reports/top-items', { preHandler: managerOnly }, async (req) => {
    const q = topItemsQuery.parse(req.query);
    const { start, end } = resolveDateRange(q, 31);
    const lines = await prisma.orderLine.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { itemId: true, itemName: true, qty: true, unitPrice: true, lineType: true },
    });

    const items = new Map<number, { itemId: number; name: string; qty: number; revenue: number }>();
    for (const l of lines) {
      const row = items.get(l.itemId) ?? { itemId: l.itemId, name: l.itemName, qty: 0, revenue: 0 };
      if (l.lineType !== 'DISCOUNT') row.qty += l.qty;
      row.revenue += l.qty * l.unitPrice;
      items.set(l.itemId, row);
    }
    const rows = [...items.values()]
      .filter((r) => r.qty > 0)
      .sort((a, b) => (q.by === 'qty' ? b.qty - a.qty || b.revenue - a.revenue : b.revenue - a.revenue))
      .slice(0, q.limit);
    return { by: q.by, from: start, to: end, rows };
  });

  // FR-19: doanh thu (tiền đã thu) theo giờ trong ngày, cộng dồn trong khoảng ngày
  app.get('/reports/hourly', { preHandler: managerOnly }, async (req) => {
    const { start, end, days } = resolveDateRange(dateRangeQuery.parse(req.query), 31);
    const payments = await prisma.payment.findMany({ where: { createdAt: { gte: start, lt: end } }, select: { amount: true, tabId: true, createdAt: true } });

    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, bills: new Set<number>() }));
    for (const p of payments) {
      const h = hours[vnParts(p.createdAt).hour]!;
      h.revenue += p.amount;
      h.bills.add(p.tabId);
    }
    return {
      from: start,
      to: end,
      days,
      rows: hours.map((h) => ({ hour: h.hour, revenue: h.revenue, billCount: h.bills.size, avgRevenuePerDay: Math.round(h.revenue / days) })),
    };
  });
}

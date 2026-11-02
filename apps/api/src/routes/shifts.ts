import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Shift } from '@prisma/client';
import { anyStaff, managerOnly } from '../lib/auth';
import { conflict, notFound } from '../lib/errors';
import { audit, prisma, type Tx } from '../lib/prisma';
import { dateRangeQuery, idParam, resolveDateRange, vnd } from '../lib/validate';

const openBody = z.object({ openingCash: vnd.nonnegative() });
const closeBody = z.object({ countedCash: vnd.nonnegative(), note: z.string().trim().max(300).optional() });

export interface ShiftSummary {
  cashTotal: number;
  transferTotal: number;
  revenue: number;
  billCount: number;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
}

async function summarize(db: Tx | typeof prisma, shift: Shift, countedCash: number | null): Promise<ShiftSummary> {
  const payments = await db.payment.findMany({ where: { shiftId: shift.id }, select: { method: true, amount: true, tabId: true } });
  const cashTotal = payments.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0);
  const transferTotal = payments.filter((p) => p.method === 'TRANSFER').reduce((s, p) => s + p.amount, 0);
  const expectedCash = shift.openingCash + cashTotal;
  return {
    cashTotal,
    transferTotal,
    revenue: cashTotal + transferTotal,
    billCount: new Set(payments.map((p) => p.tabId)).size,
    expectedCash,
    countedCash,
    difference: countedCash === null ? null : countedCash - expectedCash,
  };
}

const withStaff = { openedBy: { select: { id: true, name: true } }, closedBy: { select: { id: true, name: true } } } as const;

export async function shiftRoutes(app: FastifyInstance) {
  // FR-09: mở ca, nhập tiền đầu ca. Cả quán dùng chung một ca tại một thời điểm.
  app.post('/shifts/open', { preHandler: anyStaff }, async (req, reply) => {
    const { openingCash } = openBody.parse(req.body);
    const shift = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7001)`; // tránh hai máy cùng mở ca
      const open = await tx.shift.findFirst({ where: { closedAt: null } });
      if (open) throw conflict('SHIFT_ALREADY_OPEN', 'Đang có ca chưa đóng', { shiftId: open.id });
      const created = await tx.shift.create({ data: { openedById: req.user.sub, openingCash } });
      await audit(tx, req.user.sub, 'SHIFT_OPEN', 'shift', created.id, { openingCash });
      return created;
    });
    reply.code(201);
    return shift;
  });

  app.get('/shifts/current', { preHandler: anyStaff }, async () => {
    const shift = await prisma.shift.findFirst({ where: { closedAt: null }, include: withStaff });
    if (!shift) return { shift: null };
    return { shift, summary: await summarize(prisma, shift, null) };
  });

  // FR-09: đóng ca — quản lý nhập tiền mặt thực đếm, hệ thống tính chênh lệch
  app.post('/shifts/:id/close', { preHandler: managerOnly }, async (req) => {
    const { id } = idParam.parse(req.params);
    const { countedCash, note } = closeBody.parse(req.body);
    return prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({ where: { id } });
      if (!shift) throw notFound('ca');
      if (shift.closedAt) throw conflict('SHIFT_CLOSED', 'Ca đã đóng');
      const summary = await summarize(tx, shift, countedCash);
      const closed = await tx.shift.update({
        where: { id },
        data: {
          closedAt: new Date(),
          closedById: req.user.sub,
          countedCash,
          expectedCash: summary.expectedCash,
          summary: { ...summary, note: note ?? null },
        },
        include: withStaff,
      });
      await audit(tx, req.user.sub, 'SHIFT_CLOSE', 'shift', id, { ...summary });
      return { shift: closed, summary };
    });
  });

  // FR-09: xem lại báo cáo đóng ca trên web quản trị
  app.get('/shifts', { preHandler: managerOnly }, async (req) => {
    const { start, end } = resolveDateRange(dateRangeQuery.parse(req.query), 92);
    const shifts = await prisma.shift.findMany({
      where: { openedAt: { gte: start, lt: end } },
      orderBy: { openedAt: 'desc' },
      include: withStaff,
    });
    // Tổng hợp tính lại từ thanh toán để ca đang mở và ca cũ đều có số
    return Promise.all(shifts.map(async (s) => ({ ...s, summary: await summarize(prisma, s, s.countedCash) })));
  });

  app.get('/shifts/:id', { preHandler: managerOnly }, async (req) => {
    const { id } = idParam.parse(req.params);
    const shift = await prisma.shift.findUnique({ where: { id }, include: withStaff });
    if (!shift) throw notFound('ca');
    return { shift, summary: await summarize(prisma, shift, shift.countedCash) };
  });
}

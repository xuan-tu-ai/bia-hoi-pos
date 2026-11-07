import type { Shift } from '@prisma/client';
import { prisma, type Tx } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { conflict, notFound } from '../../lib/errors.js';
import type { AuthUser } from '../../middlewares/auth.js';

const include = {
  staff: { select: { id: true, fullName: true } },
  closedBy: { select: { id: true, fullName: true } },
} as const;

/** Tổng tiền mặt / chuyển khoản thu được trong khoảng [from, to). */
async function salesBetween(tx: Tx, from: Date, to: Date) {
  const rows = await tx.payment.groupBy({
    by: ['method'],
    where: { createdAt: { gte: from, lt: to } },
    _sum: { amount: true },
  });
  const get = (m: 'CASH' | 'TRANSFER') => rows.find((r) => r.method === m)?._sum.amount ?? 0;
  return { cashSales: get('CASH'), transferSales: get('TRANSFER') };
}

/** FR-09: chênh lệch = tiền đếm − (tiền đầu ca + tiền mặt thu trong ca). */
async function present(tx: Tx, s: Shift & { staff: { id: number; fullName: string }; closedBy: { id: number; fullName: string } | null }) {
  const sales =
    s.closedAt && s.cashSales != null && s.transferSales != null
      ? { cashSales: s.cashSales, transferSales: s.transferSales }
      : await salesBetween(tx, s.openedAt, s.closedAt ?? new Date());
  const expectedCash = s.openingCash + sales.cashSales;
  return {
    id: s.id,
    staff: s.staff,
    openedAt: s.openedAt,
    openingCash: s.openingCash,
    closedAt: s.closedAt,
    closedBy: s.closedBy,
    countedCash: s.countedCash,
    ...sales,
    expectedCash,
    difference: s.countedCash != null ? s.countedCash - expectedCash : null,
    status: s.closedAt ? ('CLOSED' as const) : ('OPEN' as const),
  };
}

export async function openShift(user: AuthUser, openingCash: number) {
  return prisma.$transaction(async (tx) => {
    // khóa bảng mức advisory để hai máy không cùng mở ca
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4201)`;
    const open = await tx.shift.findFirst({ where: { closedAt: null } });
    if (open) throw conflict('SHIFT_ALREADY_OPEN', 'Đang có ca chưa đóng, không thể mở ca mới', { shiftId: open.id });
    const s = await tx.shift.create({ data: { staffId: user.id, openingCash }, include });
    await audit(tx, user.id, 'SHIFT_OPENED', 'Shift', s.id, { openingCash });
    return present(tx, s);
  });
}

export async function currentShift() {
  const s = await prisma.shift.findFirst({ where: { closedAt: null }, include, orderBy: { id: 'desc' } });
  return s ? present(prisma, s) : null;
}

export async function closeShift(user: AuthUser, id: number, countedCash: number) {
  return prisma.$transaction(async (tx) => {
    const s = await tx.shift.findUnique({ where: { id } });
    if (!s) throw notFound('Không tìm thấy ca');
    if (s.closedAt) throw conflict('SHIFT_ALREADY_CLOSED', 'Ca này đã đóng');
    const closedAt = new Date();
    const sales = await salesBetween(tx, s.openedAt, closedAt);
    const closed = await tx.shift.update({
      where: { id },
      data: { closedAt, closedById: user.id, countedCash, ...sales },
      include,
    });
    const view = await present(tx, closed);
    await audit(tx, user.id, 'SHIFT_CLOSED', 'Shift', id, { countedCash, ...sales, difference: view.difference });
    return view;
  });
}

export async function listShifts() {
  const rows = await prisma.shift.findMany({ include, orderBy: { id: 'desc' }, take: 50 });
  return Promise.all(rows.map((s) => present(prisma, s)));
}

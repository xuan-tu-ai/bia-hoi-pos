import type { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { resolveApprover } from '../../lib/approval.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { computeDiscount } from '../../lib/tab-total.js';
import { transferNote, vietQrUrl } from '../../lib/vietqr.js';
import type { AuthUser } from '../../middlewares/auth.js';
import { billNoOf, lockOpenTab, subtotalOf, tabDetailInclude } from '../tabs/tabs.repo.js';
import { buildBill } from '../tabs/tabs.service.js';
import type { paySchema } from './payments.schema.js';

// FR-08 VietQR

export async function getVietQr(tabId: number, amount?: number) {
  const tab = await prisma.tab.findUnique({ where: { id: tabId } });
  if (!tab) throw notFound('Không tìm thấy phiên bàn');
  const value = amount ?? (await subtotalOf(prisma, tabId)) - tab.billDiscount;
  if (value <= 0) throw badRequest('VALIDATION_ERROR', 'Số tiền chuyển khoản phải lớn hơn 0');

  const billNo = tab.billNo ?? billNoOf(tab);
  const addInfo = transferNote(billNo);
  return {
    url: vietQrUrl(value, addInfo),
    amount: value,
    addInfo,
    billNo,
    bank: env.VIETQR_BANK,
    account: env.VIETQR_ACCOUNT,
    accountName: env.VIETQR_ACCOUNT_NAME,
  };
}

// FR-08 Thanh toán

export async function pay(user: AuthUser, tabId: number, input: z.infer<typeof paySchema>) {
  return prisma.$transaction(async (tx) => {
    await lockOpenTab(tx, tabId);
    const tab = await tx.tab.findUniqueOrThrow({ where: { id: tabId } });

    const subtotal = await subtotalOf(tx, tabId);
    const discount = computeDiscount(subtotal, input.billDiscount);
    const total = subtotal - discount;

    // Giảm giá hóa đơn: Nhân viên quầy cần PIN (SRS 2.2)
    const approvedById = discount > 0 ? await resolveApprover(tx, user, input.approverPin) : null;

    const cash = input.payments.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0);
    const transfers = input.payments.filter((p) => p.method === 'TRANSFER');
    const transfer = transfers.reduce((s, p) => s + p.amount, 0);
    const paid = cash + transfer;

    if (paid < total) {
      throw badRequest('INSUFFICIENT_PAYMENT', 'Số tiền nhận chưa đủ', { total, paid, missing: total - paid });
    }
    const change = paid - total;
    if (change > cash) throw badRequest('OVERPAID_TRANSFER', 'Số tiền chuyển khoản vượt quá số phải trả');

    // Payment lưu số tiền thực thu: tiền mặt đã trừ tiền thừa trả khách
    const netCash = cash - change;
    const rows = [
      ...(netCash > 0 ? [{ method: 'CASH' as const, amount: netCash }] : []),
      ...transfers.map((p) => ({ method: 'TRANSFER' as const, amount: p.amount })),
    ];
    const paidAt = new Date();
    if (rows.length) {
      await tx.payment.createMany({
        data: rows.map((r) => ({ tabId, method: r.method, amount: r.amount, receivedById: user.id, createdAt: paidAt })),
      });
    }

    const billNo = billNoOf(tab);
    await tx.tab.update({
      where: { id: tabId },
      data: {
        status: 'PAID',
        closedAt: paidAt,
        billNo,
        billDiscount: discount,
        ...(discount > 0
          ? {
              billDiscountReason: input.billDiscount?.reason ?? 'OTHER',
              billDiscountNote: input.billDiscount?.note || null,
              billDiscountById: user.id,
              billDiscountApprovedById: approvedById,
            }
          : {}),
      },
    });
    await tx.billPrint.create({ data: { tabId, kind: 'FINAL', printNo: 1, printedAt: paidAt } });
    await audit(tx, user.id, 'TAB_PAID', 'Tab', tabId, { billNo, subtotal, discount, total, cash: netCash, transfer, approvedById });

    const full = await tx.tab.findUniqueOrThrow({ where: { id: tabId }, include: tabDetailInclude });
    const bill = buildBill(full);
    return {
      ...bill,
      kind: 'FINAL' as const,
      billNo,
      subtotal,
      discount,
      total,
      paid,
      change,
      payments: rows,
      paidAt,
      cashier: user.fullName,
    };
  });
}

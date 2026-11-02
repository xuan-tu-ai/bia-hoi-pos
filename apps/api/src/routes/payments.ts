import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ADJUST_REASON_LABELS, PAYMENT_METHODS, billCode, buildVietQrPayload, resolveDiscountAmount } from '@biahoi/shared';
import { config } from '../config';
import { anyStaff, verifyApproval } from '../lib/auth';
import { AppError, badRequest, conflict } from '../lib/errors';
import { audit, prisma } from '../lib/prisma';
import { notifyLargeAdjustment } from '../lib/push';
import { emitTablesUpdated } from '../lib/realtime';
import { adjustReasonInput, discountValue, idParam, positiveVnd } from '../lib/validate';
import { buildPrintedBill, getTabTotal, requireOpenTab } from '../services/tabs';

const payBody = z.object({
  payments: z
    .array(
      z.object({
        method: z.enum(PAYMENT_METHODS),
        amount: positiveVnd,
        /** Tiền khách đưa (chỉ với tiền mặt), để tính tiền thừa */
        tendered: positiveVnd.optional(),
      }),
    )
    .max(4),
});

const billDiscountBody = adjustReasonInput.and(discountValue).and(z.object({ approvalToken: z.string() }));
const vietqrQuery = z.object({ amount: z.coerce.number().int().positive().optional() });

export async function paymentRoutes(app: FastifyInstance) {
  // FR-07: in tạm tính — không giới hạn số lần; bàn chuyển vàng nhưng vẫn gọi thêm được
  app.post('/tabs/:id/provisional', { preHandler: anyStaff }, async (req) => {
    const { id } = idParam.parse(req.params);
    const { bill, tableId } = await prisma.$transaction(async (tx) => {
      const tab = await requireOpenTab(tx, id);
      const printNo = (await tx.billPrint.count({ where: { tabId: id, kind: 'PROVISIONAL' } })) + 1;
      const print = await tx.billPrint.create({ data: { tabId: id, kind: 'PROVISIONAL', printNo, printedById: req.user.sub } });
      return { bill: await buildPrintedBill(tx, id, 'PROVISIONAL', printNo, print.printedAt), tableId: tab.tableId };
    });
    emitTablesUpdated([tableId]);
    return bill;
  });

  // FR-08: mã VietQR với số tiền và nội dung BH<mã hóa đơn>. ?amount= khi trả kết hợp tiền mặt
  app.get('/tabs/:id/vietqr', { preHandler: anyStaff }, async (req) => {
    const { id } = idParam.parse(req.params);
    const { amount: requested } = vietqrQuery.parse(req.query);
    if (!config.bank.bin || !config.bank.accountNo) {
      throw new AppError(503, 'BANK_NOT_CONFIGURED', 'Chưa cấu hình tài khoản ngân hàng (BANK_BIN, BANK_ACCOUNT_NO)');
    }
    const tab = await prisma.tab.findUnique({ where: { id } });
    if (!tab || tab.status !== 'OPEN') throw conflict('TAB_NOT_OPEN', 'Phiên bàn không còn mở');
    const total = await getTabTotal(prisma, id);
    const amount = requested ?? total;
    if (amount <= 0 || amount > total) throw badRequest('INVALID_AMOUNT', `Số tiền chuyển khoản phải từ 1 đến ${total} đ`);

    const content = billCode(id);
    return {
      payload: buildVietQrPayload({ bankBin: config.bank.bin, accountNo: config.bank.accountNo, amount, addInfo: content }),
      amount,
      content,
      bankBin: config.bank.bin,
      accountNo: config.bank.accountNo,
      accountName: config.bank.accountName,
    };
  });

  // FR-08: giảm giá cả hóa đơn — cần PIN Quản lý ca; ghi vào nhật ký FR-18
  app.post('/tabs/:id/discount', { preHandler: anyStaff }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = billDiscountBody.parse(req.body);
    const approval = await verifyApproval(app, body.approvalToken);

    const { discount, tableId } = await prisma.$transaction(async (tx) => {
      const tab = await requireOpenTab(tx, id);
      const total = await getTabTotal(tx, id);
      const amount = resolveDiscountAmount(total, body);
      if (amount <= 0) throw badRequest('INVALID_AMOUNT', 'Số tiền giảm phải lớn hơn 0');
      if (amount > total) throw badRequest('AMOUNT_EXCEEDS', `Chỉ được giảm tối đa ${total} đ`);

      const created = await tx.billDiscount.create({
        data: {
          tabId: id,
          amount: -amount,
          percent: body.percent,
          reason: body.reason,
          reasonNote: body.note,
          createdById: req.user.sub,
          approvedById: approval.approver.id,
        },
      });
      await audit(tx, req.user.sub, 'BILL_DISCOUNT', 'bill_discount', created.id, {
        tabId: id,
        amount,
        percent: body.percent ?? null,
        reason: body.reason,
        approvedBy: approval.approver.id,
      });
      return { discount: created, tableId: tab.tableId };
    });

    approval.consume();
    emitTablesUpdated([tableId]);
    void notifyLargeAdjustment({
      kind: 'BILL_DISCOUNT',
      amount: -discount.amount,
      tableId,
      reason: body.note || ADJUST_REASON_LABELS[body.reason],
      requester: req.user.name,
      approver: approval.approver.name,
    }).catch((err) => req.log.warn({ err }, 'Không gửi được thông báo đẩy'));
    reply.code(201);
    return { discount, total: await getTabTotal(prisma, id) };
  });

  // FR-08: hoàn tất thanh toán → in hóa đơn chính thức, đóng phiên, bàn về trống
  app.post('/tabs/:id/pay', { preHandler: anyStaff }, async (req) => {
    const { id } = idParam.parse(req.params);
    const { payments } = payBody.parse(req.body);

    for (const p of payments) {
      if (p.tendered !== undefined && p.method !== 'CASH') throw badRequest('INVALID_TENDERED', 'Tiền khách đưa chỉ áp dụng cho tiền mặt');
      if (p.tendered !== undefined && p.tendered < p.amount) throw badRequest('TENDERED_TOO_LOW', 'Tiền khách đưa ít hơn số tiền thu');
    }

    const { bill, tableId } = await prisma.$transaction(async (tx) => {
      const tab = await requireOpenTab(tx, id);
      const total = await getTabTotal(tx, id);
      const received = payments.reduce((s, p) => s + p.amount, 0);
      if (received < total) throw badRequest('INSUFFICIENT_PAYMENT', `Còn thiếu ${total - received} đ`, { total, received });
      if (received > total) {
        throw badRequest('OVERPAYMENT', 'Tổng số tiền thu lớn hơn số phải trả; ghi tiền khách đưa vào "tendered"', { total, received });
      }

      const shift = await tx.shift.findFirst({ where: { closedAt: null }, orderBy: { id: 'desc' } });
      const now = new Date();
      await tx.payment.createMany({
        data: payments.map((p) => ({
          tabId: id,
          method: p.method,
          amount: p.amount,
          tendered: p.tendered ?? null,
          receivedById: req.user.sub,
          shiftId: shift?.id ?? null,
          createdAt: now,
        })),
      });
      await tx.tab.update({ where: { id }, data: { status: 'PAID', closedAt: now } });
      await tx.diningTable.update({ where: { id: tab.tableId }, data: { currentTabId: null } });
      await tx.billPrint.create({ data: { tabId: id, kind: 'FINAL', printNo: 1, printedById: req.user.sub, printedAt: now } });
      await audit(tx, req.user.sub, 'TAB_PAY', 'tab', id, { total, payments });
      return { bill: await buildPrintedBill(tx, id, 'FINAL', 1, now), tableId: tab.tableId };
    });

    emitTablesUpdated([tableId]);
    return bill;
  });

  // In lại hóa đơn chính thức của phiên đã thanh toán (chỉ đọc, không sửa được)
  app.get('/tabs/:id/bill', { preHandler: anyStaff }, async (req) => {
    const { id } = idParam.parse(req.params);
    const final = await prisma.billPrint.findFirst({ where: { tabId: id, kind: 'FINAL' } });
    if (!final) throw conflict('NOT_PAID', 'Phiên bàn chưa thanh toán');
    return buildPrintedBill(prisma, id, 'FINAL', final.printNo, final.printedAt);
  });
}

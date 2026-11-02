// Quy tắc tính tiền (SRS 6.2): tiền là số nguyên VND; tổng phiên = Σ(qty × unit_price),
// dòng VOID có qty âm, dòng DISCOUNT có unit_price âm, giảm giá hóa đơn có amount âm.

import type { LineType } from './types';

export interface PricedLine {
  qty: number;
  unitPrice: number;
}

export interface AdjustableLine extends PricedLine {
  lineType: LineType;
}

export function isVnd(n: number): boolean {
  return Number.isSafeInteger(n);
}

export function lineAmount(line: PricedLine): number {
  return line.qty * line.unitPrice;
}

export function sumLines(lines: readonly PricedLine[]): number {
  return lines.reduce((sum, l) => sum + lineAmount(l), 0);
}

/** Tổng phải trả của một phiên bàn. `billDiscounts` là các khoản giảm giá hóa đơn (số âm). */
export function tabTotal(lines: readonly PricedLine[], billDiscounts: readonly { amount: number }[] = []): number {
  return sumLines(lines) + billDiscounts.reduce((sum, d) => sum + d.amount, 0);
}

/** Làm tròn phần trăm về đồng. */
export function percentOf(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100);
}

export interface LineState {
  /** Số lượng còn lại sau khi trừ các dòng hủy */
  remainingQty: number;
  /** Tổng tiền đã giảm trên dòng này (số dương) */
  discounted: number;
  /** Giá trị thực của dòng = remainingQty × đơn giá − discounted */
  netAmount: number;
}

/**
 * Trạng thái hiện tại của một dòng NORMAL, tính từ các dòng điều chỉnh (VOID/DISCOUNT)
 * có ref_line_id trỏ tới nó.
 */
export function lineState(line: PricedLine, adjustments: readonly AdjustableLine[]): LineState {
  let voidedQty = 0;
  let discounted = 0;
  for (const a of adjustments) {
    if (a.lineType === 'VOID') voidedQty += -a.qty;
    else if (a.lineType === 'DISCOUNT') discounted += -lineAmount(a);
  }
  const remainingQty = line.qty - voidedQty;
  return { remainingQty, discounted, netAmount: remainingQty * line.unitPrice - discounted };
}

export type AdjustCheck = { ok: true } | { ok: false; code: string; message: string };

/** Kiểm tra có được hủy `qty` phần của dòng không. */
export function checkVoid(state: LineState, unitPrice: number, qty: number): AdjustCheck {
  if (!Number.isInteger(qty) || qty <= 0) {
    return { ok: false, code: 'INVALID_QTY', message: 'Số lượng hủy phải là số nguyên dương' };
  }
  if (qty > state.remainingQty) {
    return { ok: false, code: 'QTY_EXCEEDS', message: `Chỉ còn ${state.remainingQty} phần để hủy` };
  }
  // Dòng đã giảm giá: không cho hủy tới mức giá trị dòng bị âm.
  if ((state.remainingQty - qty) * unitPrice < state.discounted) {
    return {
      ok: false,
      code: 'DISCOUNTED_LINE',
      message: 'Món đã được giảm giá, không thể hủy thêm số lượng này',
    };
  }
  return { ok: true };
}

/** Kiểm tra có được giảm `amount` đồng trên dòng không. */
export function checkDiscount(state: LineState, amount: number): AdjustCheck {
  if (!isVnd(amount) || amount <= 0) {
    return { ok: false, code: 'INVALID_AMOUNT', message: 'Số tiền giảm phải là số nguyên dương' };
  }
  if (amount > state.netAmount) {
    return { ok: false, code: 'AMOUNT_EXCEEDS', message: `Chỉ được giảm tối đa ${state.netAmount} đ` };
  }
  return { ok: true };
}

/** Quy đổi yêu cầu giảm giá (% hoặc số tiền) ra số đồng. */
export function resolveDiscountAmount(base: number, input: { percent?: number; amount?: number }): number {
  if (input.percent !== undefined) return percentOf(base, input.percent);
  return input.amount ?? 0;
}

export function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' đ';
}

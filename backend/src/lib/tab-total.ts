/**
 * Tính tiền một phiên bàn (SRS 8.1):
 *   Tổng = Σ (qty × unitPrice) của mọi dòng − giảm giá hóa đơn
 * Dòng VOID có qty âm, dòng DISCOUNT có unitPrice âm nên chỉ cần cộng thẳng.
 */

export type LineLike = {
  id: number;
  qty: number;
  unitPrice: number;
  lineType: 'NORMAL' | 'VOID' | 'DISCOUNT';
  refLineId: number | null;
};

export const lineAmount = (l: Pick<LineLike, 'qty' | 'unitPrice'>) => l.qty * l.unitPrice;

export function linesSubtotal(lines: Pick<LineLike, 'qty' | 'unitPrice'>[]): number {
  return lines.reduce((s, l) => s + lineAmount(l), 0);
}

export function tabTotal(lines: Pick<LineLike, 'qty' | 'unitPrice'>[], billDiscount = 0): number {
  return linesSubtotal(lines) - billDiscount;
}

export type LineState = {
  /** Số lượng còn lại sau khi trừ các lần hủy. */
  remainingQty: number;
  /** Tổng tiền đã giảm cho dòng này (số dương). */
  discountAmount: number;
  /** Tiền thực của dòng sau hủy và giảm. */
  netAmount: number;
};

/** Trạng thái từng dòng NORMAL sau khi áp các dòng VOID/DISCOUNT trỏ về nó. */
export function lineStates(lines: LineLike[]): Map<number, LineState> {
  const states = new Map<number, LineState>();
  for (const l of lines) {
    if (l.lineType === 'NORMAL') states.set(l.id, { remainingQty: l.qty, discountAmount: 0, netAmount: lineAmount(l) });
  }
  for (const l of lines) {
    if (l.lineType === 'NORMAL' || l.refLineId == null) continue;
    const s = states.get(l.refLineId);
    if (!s) continue;
    if (l.lineType === 'VOID') s.remainingQty += l.qty; // qty âm
    else s.discountAmount += -lineAmount(l);
    s.netAmount += lineAmount(l);
  }
  return states;
}

export type BillLine = { menuItemId: number; name: string; qty: number; unitPrice: number; amount: number; discount: number };

/**
 * Dòng hóa đơn (tạm tính / hóa đơn cuối): gộp các món cùng món và cùng đơn giá,
 * bỏ món đã hủy hết, món bị giảm giá hiện số tiền sau giảm (SRS FR-07).
 */
export function billLines(lines: (LineLike & { menuItemId: number; name: string })[]): BillLine[] {
  const states = lineStates(lines);
  const groups = new Map<string, BillLine>();
  for (const l of lines) {
    if (l.lineType !== 'NORMAL') continue;
    const s = states.get(l.id)!;
    if (s.remainingQty <= 0 && s.netAmount === 0) continue;
    const key = `${l.menuItemId}:${l.unitPrice}`;
    const g = groups.get(key) ?? { menuItemId: l.menuItemId, name: l.name, qty: 0, unitPrice: l.unitPrice, amount: 0, discount: 0 };
    g.qty += s.remainingQty;
    g.amount += s.netAmount;
    g.discount += s.discountAmount;
    groups.set(key, g);
  }
  return [...groups.values()].filter((g) => g.qty > 0 || g.amount !== 0);
}

/** Số tiền giảm của hóa đơn theo % hoặc số tiền, làm tròn về số nguyên VND, không vượt quá tạm tính. */
export function computeDiscount(subtotal: number, d: { type: 'PERCENT' | 'AMOUNT'; value: number } | null | undefined) {
  if (!d || d.value <= 0) return 0;
  const raw = d.type === 'PERCENT' ? Math.round((subtotal * d.value) / 100) : Math.round(d.value);
  return Math.max(0, Math.min(raw, subtotal));
}

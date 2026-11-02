// Gộp dòng để in tạm tính / hóa đơn (FR-07, FR-15).

import { ADJUST_REASON_LABELS, type AdjustReason, type LineType } from './types';
import { lineAmount } from './money';

export interface BillSourceLine {
  itemName: string;
  qty: number;
  unitPrice: number;
  lineType: LineType;
}

export interface BillSourceDiscount {
  amount: number; // số âm
  reason: AdjustReason;
  reasonNote?: string | null;
}

export interface BillRow {
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface BillAdjustmentRow {
  label: string;
  amount: number; // số âm
}

export interface BillBody {
  rows: BillRow[];
  adjustments: BillAdjustmentRow[];
  total: number;
}

/**
 * Gộp các món cùng tên + cùng đơn giá (vd "Bia hơi cốc ×10"); cùng món khác giá
 * (giờ vàng) thành 2 dòng. Dòng hủy được trừ vào số lượng; món bị hủy hết không in.
 * Giảm giá món và giảm giá hóa đơn in thành dòng riêng.
 */
export function buildBillBody(lines: readonly BillSourceLine[], billDiscounts: readonly BillSourceDiscount[] = []): BillBody {
  const groups = new Map<string, BillRow>();
  const itemDiscounts = new Map<string, number>();

  for (const line of lines) {
    if (line.lineType === 'DISCOUNT') {
      itemDiscounts.set(line.itemName, (itemDiscounts.get(line.itemName) ?? 0) + lineAmount(line));
      continue;
    }
    const key = `${line.itemName}\u0000${line.unitPrice}`;
    const row = groups.get(key) ?? { name: line.itemName, qty: 0, unitPrice: line.unitPrice, amount: 0 };
    row.qty += line.qty;
    row.amount += lineAmount(line);
    groups.set(key, row);
  }

  const rows = [...groups.values()].filter((r) => r.qty !== 0);
  const adjustments: BillAdjustmentRow[] = [
    ...[...itemDiscounts].map(([name, amount]) => ({ label: `Giảm giá: ${name}`, amount })),
    ...billDiscounts.map((d) => ({
      label: `Giảm giá hóa đơn (${d.reasonNote || ADJUST_REASON_LABELS[d.reason]})`,
      amount: d.amount,
    })),
  ];
  const total = rows.reduce((s, r) => s + r.amount, 0) + adjustments.reduce((s, a) => s + a.amount, 0);
  return { rows, adjustments, total };
}

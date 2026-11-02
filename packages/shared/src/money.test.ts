import { describe, expect, it } from 'vitest';
import { checkDiscount, checkVoid, lineState, resolveDiscountAmount, tabTotal } from './money';

describe('tabTotal', () => {
  it('cộng dòng thường, trừ dòng hủy/giảm và giảm giá hóa đơn', () => {
    const lines = [
      { qty: 10, unitPrice: 15000 }, // bia cốc ×10
      { qty: 2, unitPrice: 60000 },
      { qty: -1, unitPrice: 60000 }, // VOID 1 phần
      { qty: 1, unitPrice: -10000 }, // DISCOUNT 10k
    ];
    expect(tabTotal(lines)).toBe(150000 + 120000 - 60000 - 10000);
    expect(tabTotal(lines, [{ amount: -20000 }])).toBe(180000);
  });

  it('tổng sau gộp bàn = tổng hai phiên trước gộp (FR-05)', () => {
    const a = [{ qty: 3, unitPrice: 15000 }, { qty: -1, unitPrice: 15000 }];
    const b = [{ qty: 1, unitPrice: 250000 }];
    expect(tabTotal([...a, ...b])).toBe(tabTotal(a) + tabTotal(b));
  });
});

describe('lineState / checkVoid / checkDiscount', () => {
  const line = { qty: 4, unitPrice: 50000 };

  it('tính số lượng còn lại và giá trị thực', () => {
    const s = lineState(line, [
      { lineType: 'VOID', qty: -1, unitPrice: 50000 },
      { lineType: 'DISCOUNT', qty: 1, unitPrice: -20000 },
    ]);
    expect(s).toEqual({ remainingQty: 3, discounted: 20000, netAmount: 130000 });
  });

  it('không cho hủy quá số lượng còn lại', () => {
    const s = lineState(line, [{ lineType: 'VOID', qty: -3, unitPrice: 50000 }]);
    expect(checkVoid(s, 50000, 1).ok).toBe(true);
    expect(checkVoid(s, 50000, 2)).toMatchObject({ ok: false, code: 'QTY_EXCEEDS' });
    expect(checkVoid(s, 50000, 0)).toMatchObject({ ok: false, code: 'INVALID_QTY' });
  });

  it('không cho hủy làm giá trị dòng đã giảm giá bị âm', () => {
    const s = lineState(line, [{ lineType: 'DISCOUNT', qty: 1, unitPrice: -60000 }]);
    expect(checkVoid(s, 50000, 2).ok).toBe(true); // còn 2×50k = 100k ≥ 60k
    expect(checkVoid(s, 50000, 3)).toMatchObject({ ok: false, code: 'DISCOUNTED_LINE' });
  });

  it('không cho giảm quá giá trị thực của dòng', () => {
    const s = lineState(line, []);
    expect(checkDiscount(s, 200000).ok).toBe(true);
    expect(checkDiscount(s, 200001)).toMatchObject({ ok: false, code: 'AMOUNT_EXCEEDS' });
    expect(checkDiscount(s, 1.5)).toMatchObject({ ok: false, code: 'INVALID_AMOUNT' });
  });

  it('quy đổi giảm theo % ra số đồng, làm tròn', () => {
    expect(resolveDiscountAmount(135000, { percent: 10 })).toBe(13500);
    expect(resolveDiscountAmount(33333, { percent: 15 })).toBe(5000);
    expect(resolveDiscountAmount(100000, { amount: 25000 })).toBe(25000);
  });
});
